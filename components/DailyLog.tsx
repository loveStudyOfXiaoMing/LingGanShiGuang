
import React from 'react';
import { Note, Language, Goal } from '../types';
import { translations } from '../i18n';
import { Quote, Edit3, Trash2, RotateCcw, X } from 'lucide-react';

interface DailyLogProps {
  notes: Note[];
  language: Language;
  onImageClick?: (url: string) => void;
  onEditNote?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
  onRestoreNote?: (note: Note) => void;
  onPermanentDelete?: (note: Note) => void;
  goals?: Goal[];
  isTrashView?: boolean;
}

const DailyLog: React.FC<DailyLogProps> = ({
  notes,
  language,
  onImageClick,
  onEditNote,
  onDeleteNote,
  onRestoreNote,
  onPermanentDelete,
  goals = [],
  isTrashView = false
}) => {
  const t = translations[language];
  const dateLocale = language === 'zh' ? 'zh-CN' : 'en-US';
  const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (notes.length === 0) return (
    <div className="py-20 text-center">
      <p className="text-slate-300 font-medium italic">空山新雨后，等待你的第一笔记录...</p>
    </div>
  );

  return (
    <div className="space-y-16 max-w-4xl mx-auto px-4">
      {sortedNotes.map((note) => (
        <div key={note.id} className="group relative">
          {/* Time Line Marker */}
          <div className="absolute left-[-40px] top-0 bottom-[-64px] hidden md:block">
            <div className="w-px h-full bg-slate-100 group-last:h-0"></div>
            <div className="absolute top-0 left-[-4px] w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors"></div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-8">
            {/* Date Info */}
            <div className="md:w-32 flex-shrink-0">
               <div className="sticky top-24">
                  <div className="text-3xl font-black text-slate-200 group-hover:text-indigo-100 transition-colors leading-none mb-2">
                    {new Date(note.date).getDate()}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {new Date(note.date).toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' })}
                  </div>
               </div>
            </div>

            {/* Content Card */}
            <div className="flex-1">
              <div className="bg-white p-8 md:p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500">
                {(onEditNote || onDeleteNote || onRestoreNote || onPermanentDelete) && (
                  <div className="flex justify-end gap-2 mb-4">
                    {!isTrashView && onEditNote && (
                      <button
                        onClick={() => onEditNote(note)}
                        className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {!isTrashView && onDeleteNote && (
                      <button
                        onClick={() => onDeleteNote(note)}
                        className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {isTrashView && onRestoreNote && (
                      <button
                        onClick={() => onRestoreNote(note)}
                        className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {isTrashView && onPermanentDelete && (
                      <button
                        onClick={() => onPermanentDelete(note)}
                        className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Delete forever"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                   <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                     {(t.editor.moods as Record<string, string>)[note.mood || 'neutral'] || note.mood || 'Neutral'}
                   </div>
                   <div className="h-px flex-1 bg-slate-50"></div>
                </div>

                {note.goals?.length && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(note.goals || []).map(goalId => {
                      const goal = goals.find(g => g.id === goalId);
                      if (!goal) return null;
                      return (
                        <span key={goalId} className="px-3 py-1 rounded-full bg-amber-50 text-amber-500 text-[10px] font-bold uppercase tracking-widest">
                          {goal.name}
                        </span>
                      );
                    })}
                  </div>
                )}

                {note.imageUrl && (
                  <div className="mb-8 overflow-hidden rounded-2xl cursor-zoom-in group-img">
                    <img 
                      src={note.imageUrl} 
                      className="w-full max-h-[400px] object-cover transition-transform duration-700 group-hover-img:scale-105" 
                      onClick={() => onImageClick?.(note.imageUrl!)}
                    />
                  </div>
                )}

                <div 
                  className="prose prose-slate max-w-none serif-text text-lg leading-relaxed text-slate-700 quill-content"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />

                {note.dailyInsight && (
                  <div className="mt-8 pt-8 border-t border-slate-50 flex gap-4 items-start italic">
                    <Quote className="w-5 h-5 text-indigo-200 flex-shrink-0 mt-1" />
                    <p className="text-indigo-900/60 font-medium text-sm leading-relaxed">
                      {note.dailyInsight}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DailyLog;
