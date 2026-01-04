
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Note, Language } from '../types';
import { translations } from '../i18n';

interface CalendarViewProps {
  notes: Note[];
  language: Language;
}

const CalendarView: React.FC<CalendarViewProps> = ({ notes, language }) => {
  const t = translations[language].calendar;
  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateKey(new Date()));

  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    notes.forEach(note => {
      const key = toDateKey(new Date(note.date));
      const list = map.get(key) || [];
      list.push(note);
      map.set(key, list);
    });
    return map;
  }, [notes]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const startWeekday = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();

  const monthLabel = currentDate.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long'
  });

  const dayCells = Array.from({ length: startWeekday + daysInMonth }, (_, idx) => {
    if (idx < startWeekday) return null;
    const day = idx - startWeekday + 1;
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const count = notesByDate.get(key)?.length || 0;
    return { key, day, count };
  });

  const selectedNotes = selectedDate
    ? [...(notesByDate.get(selectedDate) || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(toDateKey(new Date(year, month, 1)));
      return;
    }
    const selected = new Date(selectedDate);
    if (selected.getFullYear() !== year || selected.getMonth() !== month) {
      setSelectedDate(toDateKey(new Date(year, month, 1)));
    }
  }, [year, month, selectedDate]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-500">{monthLabel}</span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="grid grid-cols-7 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">
          {t.weekDays.map((day: string) => (
            <div key={day} className="text-center">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: startWeekday }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-16" />
          ))}
          {dayCells.map(cell => {
            if (!cell) return null;
            const active = selectedDate === cell.key;
            const intensity = cell.count === 0
              ? 'bg-slate-50'
              : cell.count === 1
              ? 'bg-indigo-50'
              : cell.count === 2
              ? 'bg-indigo-100'
              : 'bg-indigo-200';
            return (
              <button
                key={cell.key}
                onClick={() => setSelectedDate(cell.key)}
                className={`h-16 rounded-2xl border border-slate-100 p-3 text-left transition-all ${intensity} ${
                  active ? 'ring-2 ring-indigo-400 border-indigo-200' : ''
                }`}
              >
                <div className="text-xs font-bold text-slate-700">{cell.day}</div>
                <div className="text-[10px] text-slate-400 mt-2">{cell.count} {t.dailySummary}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{t.snapshot}</h3>
        {selectedNotes.length === 0 ? (
          <p className="text-sm text-slate-300">{t.noNotes}</p>
        ) : (
          <div className="space-y-4">
            {selectedNotes.map(note => (
              <div key={note.id} className="p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-slate-500">{new Date(note.date).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-300">{note.mood || 'neutral'}</span>
                </div>
                <p className="text-sm text-slate-600">
                  {note.content.replace(/<[^>]*>/g, '').slice(0, 140)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
