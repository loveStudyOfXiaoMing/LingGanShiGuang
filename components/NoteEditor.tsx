
import React, { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import { Send, Smile, Cloud, Zap, Coffee, Image as ImageIcon, X, RefreshCw, Sparkles, Wand2, RotateCcw } from 'lucide-react';
import { Goal, Language, Note } from '../types';
import { translations } from '../i18n';

interface NoteEditorProps {
  onSave: (content: string, mood: string, imageUrl: string | undefined, goals: string[]) => void;
  onUpdate?: (noteId: string, content: string, mood: string, imageUrl: string | undefined, goals: string[]) => void;
  onCancelEdit?: () => void;
  isSaving: boolean;
  language: Language;
  onGetPrompt: () => Promise<string | undefined>;
  editingNote?: Note | null;
  goals?: Goal[];
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  onSave,
  onUpdate,
  onCancelEdit,
  isSaving,
  language,
  onGetPrompt,
  editingNote,
  goals = []
}) => {
  const t = translations[language].editor;
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState('neutral');
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [isGettingPrompt, setIsGettingPrompt] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moodsList = [
    { icon: Smile, label: t.moods.happy, value: 'happy', color: 'text-amber-500 bg-amber-50' },
    { icon: Zap, label: t.moods.energetic, value: 'energetic', color: 'text-blue-500 bg-blue-50' },
    { icon: Cloud, label: t.moods.thoughtful, value: 'thoughtful', color: 'text-indigo-500 bg-indigo-50' },
    { icon: Coffee, label: t.moods.neutral, value: 'neutral', color: 'text-slate-500 bg-slate-50' },
  ];

  useEffect(() => {
    if (!editingNote) return;
    setContent(editingNote.content || '');
    setSelectedMood(editingNote.mood || 'neutral');
    setImage(editingNote.imageUrl || null);
    setSelectedGoals(editingNote.goals || []);
    setPrompt(null);
  }, [editingNote?.id]);

  useEffect(() => {
    if (editingNote) return;
    setContent('');
    setSelectedMood('neutral');
    setImage(null);
    setSelectedGoals([]);
  }, [editingNote]);

  const handleGetPrompt = async () => {
    setIsGettingPrompt(true);
    const p = await onGetPrompt();
    if (p) setPrompt(p);
    setIsGettingPrompt(false);
  };

  const handleSave = () => {
    const strippedContent = content.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent && !image) return;
    if (editingNote && onUpdate) {
      onUpdate(editingNote.id, content, selectedMood, image || undefined, selectedGoals);
      return;
    }
    onSave(content, selectedMood, image || undefined, selectedGoals);
    setContent('');
    setImage(null);
    setPrompt(null);
    setSelectedGoals([]);
  };

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      {/* AI Inspiration Prompt */}
      <div className={`mb-6 transition-all duration-500 overflow-hidden ${prompt ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-[2rem] flex items-start gap-4">
           <Sparkles className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
           <div>
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-1">今日成长契机</span>
             <p className="text-indigo-900/70 font-medium serif-text italic">{prompt}</p>
           </div>
           <button onClick={() => setPrompt(null)} className="ml-auto text-indigo-200 hover:text-indigo-400">
             <X className="w-4 h-4" />
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden relative">
        {/* Editor Header */}
        <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleGetPrompt}
              disabled={isGettingPrompt}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGettingPrompt ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              <span>{t.getPrompt}</span>
            </button>
            {editingNote && (
              <button
                onClick={() => onCancelEdit?.()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.cancelEdit}</span>
              </button>
            )}
          </div>
          
          <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-1">
            {moodsList.map((m) => (
              <button
                key={m.value}
                onClick={() => setSelectedMood(m.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  selectedMood === m.value 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <m.icon className={`w-4 h-4 ${selectedMood === m.value ? m.color.split(' ')[0] : ''}`} />
                {selectedMood === m.value && <span className="text-xs font-bold">{m.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="relative">
          <ReactQuill 
            theme="snow"
            value={content}
            onChange={setContent}
            placeholder={t.placeholder}
          />
        </div>

        <div className="px-8 py-6 border-t border-slate-50 space-y-6">
          <section>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
              {t.goals}
            </label>
            {goals.length === 0 && (
              <p className="text-xs text-slate-300">{t.noGoals}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {goals.map((goal) => {
                const active = selectedGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoals((prev) => active ? prev.filter((id) => id !== goal.id) : [...prev, goal.id])}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                      active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-500'
                    }`}
                  >
                    {goal.name}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:shadow-lg hover:shadow-indigo-50 transition-all border border-slate-100"
              title={t.addImage}
            >
              <ImageIcon className="w-5 h-5" />
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} className="hidden" accept="image/*" />
            </button>
            
            {image && (
              <div className="relative ml-2">
                <img src={image} className="w-12 h-12 object-cover rounded-xl border-2 border-white shadow-md" alt="Preview" />
                <button onClick={() => setImage(null)} className="absolute -top-1 -right-1 bg-slate-900 text-white rounded-full p-0.5 shadow-sm">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || (!content.replace(/<[^>]*>/g, '').trim() && !image)}
            className="group bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-bold py-4 px-10 rounded-2xl transition-all flex items-center gap-3 shadow-xl shadow-slate-200 hover:-translate-y-1 active:translate-y-0"
          >
            {isSaving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{editingNote ? t.update : t.save}</span>
                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
