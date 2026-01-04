
import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  PenLine, 
  History, 
  CalendarDays,
  Settings as SettingsIcon, 
  Sparkles,
  Target,
  CheckCircle2,
  Search,
  X,
  Languages,
  Trash2,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Note, CycleSummary, AppState, CycleLength, Language, Goal } from './types';
import { translations } from './i18n';
import NoteEditor from './components/NoteEditor';
import Dashboard from './components/Dashboard';
import SummaryCard from './components/SummaryCard';
import DailyLog from './components/DailyLog';
import CalendarView from './components/CalendarView';
import { generateGrowthSummary, generateDailyInsight, generateReflectionPrompt } from './services/geminiService';
import {
  clearStoredDirectoryHandle,
  ensureDirectoryPermission,
  getStoredDirectoryHandle,
  pickRootDirectory,
  readStateFromFile,
  storeDirectoryHandle,
  supportsFileSystemAccess,
  writeStateToFile,
  STORAGE_DIR_NAME
} from './services/fileStorage';

const HERO_TITLE_TEXT = '记录成长中的每一簇微光';
const API_KEY_STORAGE_KEY = 'deepseek_api_key';

const getStoredApiKey = () => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch (error) {
    console.error(error);
    return '';
  }
};

const createEmptyState = (): AppState => ({
  notes: [],
  summaries: [],
  cycleLength: 7,
  language: 'zh',
  goals: [],
  version: 2
});

const normalizeState = (raw: any): AppState => {
  const base = createEmptyState();
  if (!raw || typeof raw !== 'object') return base;

  const language: Language = raw.language === 'en' ? 'en' : 'zh';
  const cycleLength: CycleLength = [7, 14, 30].includes(raw.cycleLength) ? raw.cycleLength : base.cycleLength;

  const goals: Goal[] = Array.isArray(raw.goals)
    ? raw.goals.map((g: any) => ({
        id: typeof g?.id === 'string' ? g.id : crypto.randomUUID(),
        name: String(g?.name || '').trim(),
        completed: Boolean(g?.completed),
        completedAt: typeof g?.completedAt === 'string' ? g.completedAt : undefined
      })).filter((g: Goal) => g.name)
    : [];

  const notes: Note[] = Array.isArray(raw.notes)
    ? raw.notes.map((n: any) => ({
        id: typeof n?.id === 'string' ? n.id : crypto.randomUUID(),
        content: typeof n?.content === 'string' ? n.content : '',
        date: typeof n?.date === 'string' ? n.date : new Date().toISOString(),
        mood: typeof n?.mood === 'string' ? n.mood : undefined,
        imageUrl: typeof n?.imageUrl === 'string' ? n.imageUrl : undefined,
        dailyInsight: typeof n?.dailyInsight === 'string' ? n.dailyInsight : undefined,
        goals: Array.isArray(n?.goals) ? n.goals.map(String) : [],
        updatedAt: typeof n?.updatedAt === 'string' ? n.updatedAt : undefined,
        deletedAt: typeof n?.deletedAt === 'string' ? n.deletedAt : null
      }))
    : [];

  const summaries: CycleSummary[] = Array.isArray(raw.summaries)
    ? raw.summaries.map((s: any) => ({
        id: typeof s?.id === 'string' ? s.id : crypto.randomUUID(),
        startDate: typeof s?.startDate === 'string' ? s.startDate : new Date().toISOString(),
        endDate: typeof s?.endDate === 'string' ? s.endDate : new Date().toISOString(),
        summaryText: typeof s?.summaryText === 'string' ? s.summaryText : '',
        keyInsights: Array.isArray(s?.keyInsights) ? s.keyInsights.map(String) : [],
        growthScore: typeof s?.growthScore === 'number' ? s.growthScore : 0,
        createdDate: typeof s?.createdDate === 'string' ? s.createdDate : new Date().toISOString(),
        advice: Array.isArray(s?.advice) ? s.advice.map(String) : [],
        moodTrend: typeof s?.moodTrend === 'string' ? s.moodTrend : '',
        topThemes: Array.isArray(s?.topThemes) ? s.topThemes.map(String) : [],
        nextWeekPlan: Array.isArray(s?.nextWeekPlan) ? s.nextWeekPlan.map(String) : []
      }))
    : [];

  return {
    ...base,
    language,
    cycleLength,
    goals,
    notes,
    summaries,
    version: 2
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editor' | 'history' | 'summaries' | 'settings' | 'calendar' | 'trash' | 'goals'>('editor');
  const [state, setState] = useState<AppState>(() => createEmptyState());

  const t = translations[state.language];
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [heroTitle, setHeroTitle] = useState('');
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    mood: 'all',
    goal: 'all',
    startDate: '',
    endDate: ''
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newGoal, setNewGoal] = useState('');
  const [storageHandle, setStorageHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [storageStatus, setStorageStatus] = useState<'idle' | 'connected' | 'disconnected' | 'permission' | 'unsupported' | 'error'>('idle');
  const [isStorageSyncing, setIsStorageSyncing] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageSupported] = useState(() => supportsFileSystemAccess());

  const storagePathLabel = storageHandle
    ? storageHandle.name === STORAGE_DIR_NAME
      ? `${storageHandle.name}`
      : `${storageHandle.name}/${STORAGE_DIR_NAME}`
    : '';

  const normalizedApiKey = apiKey.trim();

  useEffect(() => {
    try {
      if (normalizedApiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEY, normalizedApiKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    } catch (error) {
      console.error(error);
    }
  }, [normalizedApiKey]);

  const saveStateToDisk = async (manual: boolean) => {
    if (!storageHandle) return;
    if (manual) setIsStorageSyncing(true);
    try {
      await writeStateToFile(storageHandle, state);
      setStorageStatus('connected');
    } catch (error: any) {
      console.error(error);
      if (error?.name === 'NotAllowedError') {
        setStorageStatus('permission');
      } else {
        setStorageStatus('error');
      }
    } finally {
      if (manual) setIsStorageSyncing(false);
    }
  };

  const handlePickStorageDirectory = async () => {
    if (!storageSupported) return;
    try {
      const pickedHandle = await pickRootDirectory();
      if (!pickedHandle) return;
      const hasPermission = await ensureDirectoryPermission(pickedHandle);
      if (!hasPermission) {
        setStorageStatus('permission');
        return;
      }
      await storeDirectoryHandle(pickedHandle);
      const storedData = await readStateFromFile(pickedHandle);
      if (storedData) {
        const nextState = normalizeState(storedData);
        const hasCurrentData = state.notes.length > 0 || state.summaries.length > 0;
        if (!hasCurrentData || confirm(t.settings.fileStorageReplaceConfirm)) {
          setState(nextState);
        } else {
          await writeStateToFile(pickedHandle, state);
        }
      } else {
        await writeStateToFile(pickedHandle, state);
      }
      setStorageHandle(pickedHandle);
      setStorageStatus('connected');
    } catch (error) {
      console.error(error);
      setStorageStatus('error');
    }
  };

  const handleDisconnectStorage = async () => {
    try {
      await clearStoredDirectoryHandle();
    } catch (error) {
      console.error(error);
    }
    setStorageHandle(null);
    setStorageStatus('disconnected');
  };

  const handleSyncStorage = async () => {
    if (!storageHandle) return;
    await saveStateToDisk(true);
  };

  useEffect(() => {
    let cancelled = false;
    const initStorage = async () => {
      if (!storageSupported) {
        setStorageStatus('unsupported');
        setIsStorageReady(true);
        return;
      }
      try {
        const storedHandle = await getStoredDirectoryHandle();
        if (!storedHandle) {
          setStorageStatus('disconnected');
          return;
        }
        const hasPermission = await ensureDirectoryPermission(storedHandle);
        if (!hasPermission) {
          setStorageStatus('permission');
          return;
        }
        const storedData = await readStateFromFile(storedHandle);
        if (cancelled) return;
        if (storedData) {
          setState(normalizeState(storedData));
        }
        setStorageHandle(storedHandle);
        setStorageStatus('connected');
      } catch (error) {
        console.error(error);
        if (!cancelled) setStorageStatus('error');
      } finally {
        if (!cancelled) setIsStorageReady(true);
      }
    };

    initStorage();
    return () => {
      cancelled = true;
    };
  }, [storageSupported]);

  useEffect(() => {
    if (!isStorageReady || storageStatus !== 'connected' || !storageHandle) return;
    saveStateToDisk(false);
  }, [state, storageHandle, storageStatus, isStorageReady]);

  useEffect(() => {
    if (activeTab !== 'editor') return;
    let index = 0;
    setHeroTitle('');
    const intervalId = window.setInterval(() => {
      index += 1;
      setHeroTitle(HERO_TITLE_TEXT.slice(0, index));
      if (index >= HERO_TITLE_TEXT.length) {
        window.clearInterval(intervalId);
      }
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [activeTab]);

  const handleSaveNote = async (
    content: string,
    mood: string,
    imageUrl?: string,
    goals: string[] = []
  ) => {
    setIsSavingNote(true);
    try {
      const plainText = content.replace(/<[^>]*>/g, '').trim();
      const dailyInsight = normalizedApiKey
        ? await generateDailyInsight(plainText, state.language, normalizedApiKey, imageUrl)
        : undefined;
      const newNote: Note = {
        id: crypto.randomUUID(),
        content,
        mood,
        imageUrl,
        dailyInsight,
        date: new Date().toISOString(),
        goals,
        deletedAt: null
      };
      setState(prev => ({ ...prev, notes: [newNote, ...prev.notes] }));
      setActiveTab('history');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleGetPrompt = async () => {
    if (!normalizedApiKey) return undefined;
    const activeNotes = state.notes.filter(note => !note.deletedAt);
    return await generateReflectionPrompt(activeNotes, state.language, normalizedApiKey);
  };

  const handleUpdateNote = (
    noteId: string,
    content: string,
    mood: string,
    imageUrl: string | undefined,
    goals: string[]
  ) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(note => note.id === noteId
        ? {
            ...note,
            content,
            mood,
            imageUrl,
            goals,
            updatedAt: new Date().toISOString()
          }
        : note
      )
    }));
    setEditingNote(null);
    setActiveTab('history');
  };

  const handleDeleteNote = (note: Note) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(item => item.id === note.id ? { ...item, deletedAt: new Date().toISOString() } : item)
    }));
  };

  const handleRestoreNote = (note: Note) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(item => item.id === note.id ? { ...item, deletedAt: null } : item)
    }));
  };

  const handlePermanentDelete = (note: Note) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.filter(item => item.id !== note.id)
    }));
  };

  const handleEmptyTrash = () => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.filter(note => !note.deletedAt)
    }));
  };

  const triggerSummary = async () => {
    if (!normalizedApiKey) {
      alert(t.settings.apiKeyMissing);
      return;
    }
    const activeNotes = state.notes.filter(note => !note.deletedAt);
    if (activeNotes.length === 0) return;
    setIsProcessingAI(true);
    try {
      const sortedNotes = [...activeNotes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const aiResult = await generateGrowthSummary(sortedNotes, state.cycleLength, state.language, normalizedApiKey, state.goals);
      const newSummary: CycleSummary = {
        id: crypto.randomUUID(),
        startDate: sortedNotes[0].date,
        endDate: sortedNotes[sortedNotes.length - 1].date,
        summaryText: JSON.stringify(aiResult),
        keyInsights: aiResult.keyInsights,
        growthScore: aiResult.growthScore,
        createdDate: new Date().toISOString(),
        advice: aiResult.advice,
        moodTrend: aiResult.moodTrend,
        topThemes: aiResult.topThemes,
        nextWeekPlan: aiResult.nextWeekPlan
      };
      setState(prev => ({ ...prev, summaries: [newSummary, ...prev.summaries] }));
      setActiveTab('summaries');
    } catch (error) {
      alert("AI Analysis failed");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const activeNotes = useMemo(() => state.notes.filter(note => !note.deletedAt), [state.notes]);
  const deletedNotes = useMemo(() => state.notes.filter(note => note.deletedAt), [state.notes]);

  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    return activeNotes.filter(note => {
      const noteDate = new Date(note.date);
      if (start && noteDate < start) return false;
      if (end && noteDate > end) return false;
      if (filters.mood !== 'all' && note.mood !== filters.mood) return false;
      if (filters.goal !== 'all' && !(note.goals || []).includes(filters.goal)) return false;
      if (!term) return true;

      const plainText = note.content.replace(/<[^>]*>/g, '').toLowerCase();
      const goalText = state.goals
        .filter(goal => (note.goals || []).includes(goal.id))
        .map(goal => goal.name)
        .join(' ')
        .toLowerCase();
      const insightText = (note.dailyInsight || '').toLowerCase();

      return [plainText, goalText, insightText].some(text => text.includes(term));
    });
  }, [activeNotes, filters, searchTerm, state.goals]);

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setActiveTab('editor');
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
  };

  const addGoal = () => {
    const name = newGoal.trim();
    if (!name) return;
    setState(prev => {
      if (prev.goals.some(goal => goal.name === name)) return prev;
      return { ...prev, goals: [...prev.goals, { id: crypto.randomUUID(), name, completed: false }] };
    });
    setNewGoal('');
  };

  const toggleGoalCompletion = (goalId: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(goal => goal.id === goalId
        ? {
            ...goal,
            completed: !goal.completed,
            completedAt: goal.completed ? undefined : new Date().toISOString()
          }
        : goal
      )
    }));
  };

  const removeGoal = (goalId: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(goal => goal.id !== goalId),
      notes: prev.notes.map(note => ({
        ...note,
        goals: (note.goals || []).filter(id => id !== goalId)
      }))
    }));
  };

  return (
    <div className="min-h-screen bg-[#fdfdfb] text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Zen Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[60] glass-panel px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('editor')}>
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter hidden sm:block">{t.appName}</span>
          </div>

          <div className="flex bg-slate-100/50 p-1 rounded-2xl">
            <NavTab active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={PenLine} />
            <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} />
            <NavTab active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={CalendarDays} />
            <NavTab active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={Target} />
            <NavTab active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} />
            <NavTab active={activeTab === 'summaries'} onClick={() => setActiveTab('summaries')} icon={Sparkles} badge={state.summaries.length} />
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setActiveTab('settings')}
               className={`p-2.5 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
             >
               <SettingsIcon className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'editor' && (
            <div className="animate-slide-up space-y-16">
              <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-5xl font-black tracking-tight mb-6 serif-text leading-tight">
                  <span className="inline-flex items-end">
                    <span>{heroTitle}</span>
                    <span className="ml-1 inline-block w-[2px] bg-slate-900 animate-pulse" style={{ height: '0.9em' }} aria-hidden="true" />
                  </span>
                </h1>
                <p className="text-slate-400 text-lg">在安静的角落，与更优秀的自己不期而遇。</p>
              </div>
              <NoteEditor
                onSave={handleSaveNote}
                onUpdate={handleUpdateNote}
                onCancelEdit={handleCancelEdit}
                isSaving={isSavingNote}
                language={state.language}
                onGetPrompt={handleGetPrompt}
                editingNote={editingNote}
                goals={state.goals}
              />
              
              {/* Feature cards were removed from here to make the UI cleaner */}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="animate-slide-up space-y-12">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                 <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">{t.dashboard.title}</h1>
                    <p className="text-slate-400">时间不会撒谎，它是成长的见证者。</p>
                 </div>
                 <button 
                   onClick={triggerSummary}
                   disabled={isProcessingAI || activeNotes.length === 0 || !normalizedApiKey}
                   className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-indigo-100"
                 >
                   {isProcessingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                   <span>开启 AI 深度剖析</span>
                 </button>
               </div>
               <Dashboard notes={activeNotes} summaries={state.summaries} goals={state.goals} language={state.language} />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="animate-slide-up space-y-12">
              <CalendarView notes={activeNotes} language={state.language} />
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="animate-slide-up max-w-2xl mx-auto space-y-12">
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-2">{t.goals.title}</h1>
                <p className="text-slate-400">{t.goals.subtitle}</p>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGoal();
                      }
                    }}
                    placeholder={t.goals.placeholder}
                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 text-sm text-slate-600"
                  />
                  <button
                    onClick={addGoal}
                    className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold"
                  >
                    {t.goals.add}
                  </button>
                </div>

                {state.goals.length === 0 && (
                  <p className="text-sm text-slate-300">{t.goals.empty}</p>
                )}

                <div className="space-y-3">
                  {state.goals.map(goal => (
                    <div
                      key={goal.id}
                      className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${goal.completed ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/60'}`}
                    >
                      <button
                        onClick={() => toggleGoalCompletion(goal.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <CheckCircle2 className={`w-5 h-5 ${goal.completed ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <div>
                          <p className={`text-sm font-bold ${goal.completed ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {goal.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {goal.completed ? t.goals.completed : t.goals.active}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => removeGoal(goal.id)}
                        className="p-2 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-slate-600"
                        title={t.goals.remove}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-slide-up space-y-12">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                 <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">{t.nav.history}</h1>
                    <p className="text-slate-400">岁月流转，唯有文字是不灭的锚点。</p>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                   <div className="relative md:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder={t.history.search} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-50 shadow-sm transition-all"
                      />
                   </div>
                   <button
                     onClick={() => setShowFilters((prev) => !prev)}
                     className="px-4 py-3 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all flex items-center gap-2 text-sm font-bold"
                   >
                     <Filter className="w-4 h-4" />
                     {t.history.filters}
                   </button>
                 </div>
               </div>
               {showFilters && (
                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="grid md:grid-cols-3 gap-4">
                     <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.history.mood}</label>
                       <select
                         value={filters.mood}
                         onChange={(e) => setFilters((prev) => ({ ...prev, mood: e.target.value }))}
                         className="w-full px-3 py-2 rounded-xl border border-slate-100 text-sm text-slate-600"
                       >
                         <option value="all">{t.history.all}</option>
                         <option value="happy">{t.editor.moods.happy}</option>
                         <option value="energetic">{t.editor.moods.energetic}</option>
                         <option value="thoughtful">{t.editor.moods.thoughtful}</option>
                         <option value="neutral">{t.editor.moods.neutral}</option>
                       </select>
                     </div>
                     <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.history.goal}</label>
                       <select
                         value={filters.goal}
                         onChange={(e) => setFilters((prev) => ({ ...prev, goal: e.target.value }))}
                         className="w-full px-3 py-2 rounded-xl border border-slate-100 text-sm text-slate-600"
                       >
                         <option value="all">{t.history.all}</option>
                         {state.goals.map(goal => (
                           <option key={goal.id} value={goal.id}>{goal.name}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.history.date}</label>
                       <div className="flex gap-2">
                         <input
                           type="date"
                           value={filters.startDate}
                           onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                           className="w-full px-3 py-2 rounded-xl border border-slate-100 text-sm text-slate-600"
                         />
                         <input
                           type="date"
                           value={filters.endDate}
                           onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                           className="w-full px-3 py-2 rounded-xl border border-slate-100 text-sm text-slate-600"
                         />
                       </div>
                     </div>
                   </div>
                   <div className="mt-6 flex justify-end">
                     <button
                       onClick={() => {
                        setFilters({ mood: 'all', goal: 'all', startDate: '', endDate: '' });
                        setSearchTerm('');
                      }}
                       className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-900 transition-all"
                     >
                       {t.history.reset}
                     </button>
                   </div>
                 </div>
               )}
               <DailyLog
                 notes={filteredNotes}
                language={state.language}
                onImageClick={setPreviewImage}
                onEditNote={handleEditNote}
                onDeleteNote={handleDeleteNote}
                goals={state.goals}
              />
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="animate-slide-up space-y-8">
              <h1 className="text-4xl font-black tracking-tight mb-8">智慧里程碑</h1>
              <div className="grid grid-cols-1 gap-12">
                {state.summaries.map(s => <SummaryCard key={s.id} summary={s} language={state.language} />)}
                {state.summaries.length === 0 && (
                  <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <Sparkles className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                    <p className="text-slate-300 font-bold tracking-widest uppercase">等待你的第一次阶段复盘</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'trash' && (
            <div className="animate-slide-up space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-black tracking-tight mb-2">{t.settings.trashTitle}</h1>
                  <p className="text-slate-400">{t.settings.trashSubtitle}</p>
                </div>
                <button
                  onClick={handleEmptyTrash}
                  disabled={deletedNotes.length === 0}
                  className="px-6 py-3 rounded-2xl border border-red-100 text-red-500 font-bold hover:bg-red-50 disabled:bg-slate-100 disabled:text-slate-300 transition-all"
                >
                  {t.settings.emptyTrash}
                </button>
              </div>
              <DailyLog
                notes={deletedNotes}
                language={state.language}
                onImageClick={setPreviewImage}
                onRestoreNote={handleRestoreNote}
                onPermanentDelete={handlePermanentDelete}
                goals={state.goals}
                isTrashView
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-slide-up max-w-2xl mx-auto space-y-12">
              <h1 className="text-4xl font-black tracking-tight">{t.settings.title}</h1>
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10">
                <section>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 block flex items-center gap-2">
                    <Languages className="w-3 h-3" /> {t.settings.language}
                  </label>
                  <div className="flex bg-slate-50 p-1.5 rounded-2xl w-fit">
                    {(['zh', 'en'] as Language[]).map(lang => (
                      <button 
                        key={lang} 
                        onClick={() => setState(p => ({ ...p, language: lang }))}
                        className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${state.language === lang ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                      >
                        {lang === 'zh' ? '简体中文' : 'English'}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 block flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {t.settings.cycle}
                  </label>
                  <div className="flex gap-4">
                    {[7, 14, 30].map(days => (
                      <button
                        key={days}
                        onClick={() => setState(p => ({ ...p, cycleLength: days as CycleLength }))}
                        className={`flex-1 py-4 rounded-2xl border-2 transition-all font-black ${state.cycleLength === days ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                      >
                        {days} 天
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">
                    {t.settings.apiKeyLabel}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t.settings.apiKeyPlaceholder}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-100 text-sm text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    {t.settings.apiKeyHint}
                  </p>
                </section>

                <section>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">
                    {t.settings.fileStorage}
                  </label>
                  <p className={`text-xs font-medium ${storageStatus === 'connected' ? 'text-emerald-500' : storageStatus === 'permission' || storageStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                    {!storageSupported
                      ? t.settings.fileStorageUnsupported
                      : storageStatus === 'connected' && storageHandle
                        ? `${t.settings.fileStorageConnected}${storagePathLabel}`
                        : storageStatus === 'permission'
                          ? t.settings.fileStoragePermissionDenied
                          : storageStatus === 'error'
                            ? t.settings.fileStorageError
                            : t.settings.fileStorageDisconnected}
                  </p>
                  {storageSupported && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        onClick={handlePickStorageDirectory}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold"
                      >
                        {storageHandle ? t.settings.fileStorageChange : t.settings.fileStoragePick}
                      </button>
                      <button
                        onClick={handleSyncStorage}
                        disabled={!storageHandle || storageStatus !== 'connected' || isStorageSyncing}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold disabled:opacity-60"
                      >
                        {isStorageSyncing ? t.settings.fileStorageSyncing : t.settings.fileStorageSync}
                      </button>
                      {storageHandle && (
                        <button
                          onClick={handleDisconnectStorage}
                          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-100 text-slate-500 text-sm font-bold"
                        >
                          {t.settings.fileStorageDisconnect}
                        </button>
                      )}
                    </div>
                  )}
                </section>

                <section>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">
                    {t.settings.trash}
                  </label>
                  <button
                    onClick={() => setActiveTab('trash')}
                    className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold"
                  >
                    {t.settings.openTrash} ({deletedNotes.length})
                  </button>
                </section>

                <section className="pt-8 border-t border-slate-50">
                  <button 
                    onClick={() => { if(confirm(t.settings.confirmClear)) { setState({ ...createEmptyState(), language: state.language }); setEditingNote(null); } }}
                    className="w-full py-4 rounded-2xl border-2 border-red-50 text-red-500 font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t.settings.clearData}
                  </button>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Image Zoom Portal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-xl flex items-center justify-center p-8 cursor-zoom-out animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" />
          <button className="absolute top-8 right-8 p-4 bg-slate-900 text-white rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};

const NavTab: React.FC<{ active: boolean; onClick: () => void; icon: any; badge?: number }> = ({ active, onClick, icon: Icon, badge }) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-xl transition-all duration-500 relative ${active ? 'bg-white text-slate-900 shadow-md scale-110' : 'text-slate-400 hover:text-slate-600'}`}
  >
    <Icon className="w-5 h-5" />
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

export default App;
