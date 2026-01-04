
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Note, CycleSummary, Language, Goal } from '../types';
import { Calendar, TrendingUp, Award, BookOpen } from 'lucide-react';
import { translations } from '../i18n';

interface DashboardProps {
  notes: Note[];
  summaries: CycleSummary[];
  goals: Goal[];
  language: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ notes, summaries, goals, language }) => {
  const t = translations[language].dashboard;
  const chartData = summaries.map(s => ({
    date: s.endDate.split('T')[0],
    score: s.growthScore
  })).slice(-7);

  const stats = [
    { label: t.stats.totalDays, value: notes.length, icon: Calendar, color: 'text-slate-900 bg-slate-100' },
    { label: t.stats.avgScore, value: summaries.length ? Math.round(summaries.reduce((a, b) => a + b.growthScore, 0) / summaries.length) : '-', icon: TrendingUp, color: 'text-slate-900 bg-slate-100' },
    { label: t.stats.completedCycles, value: summaries.length, icon: Award, color: 'text-slate-900 bg-slate-100' },
    { label: t.stats.weekWords, value: notes.slice(-7).reduce((a, b) => a + b.content.length, 0), icon: BookOpen, color: 'text-slate-900 bg-slate-100' },
  ];

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const heatmap = useMemo(() => {
    const days = 84;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    const counts = new Map<string, number>();
    notes.forEach(note => {
      const key = toDateKey(new Date(note.date));
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const cells = Array.from({ length: days }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const key = toDateKey(date);
      return { key, count: counts.get(key) || 0, date };
    });

    return cells;
  }, [notes]);

  const progressData = useMemo(() => {
    return goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      percent: goal.completed ? 100 : 0
    }));
  }, [goals]);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="border-b-2 border-slate-50 pb-6">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">{stat.label}</p>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">{t.chartTitle}</h3>
        <div className="h-48 w-full">
          {summaries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: 'none', padding: '8px' }}
                />
                <Area type="monotone" dataKey="score" stroke="#0f172a" strokeWidth={3} fillOpacity={0.05} fill="#0f172a" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <p className="text-xs font-bold uppercase tracking-widest">{t.noData}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t.heatmapTitle}</h3>
            <span className="text-[10px] font-bold text-slate-300">{t.heatmapRange}</span>
          </div>
          <div className="grid grid-rows-7 grid-flow-col gap-2">
            {heatmap.map(cell => {
              const level = cell.count === 0
                ? 'bg-slate-100'
                : cell.count === 1
                ? 'bg-indigo-100'
                : cell.count === 2
                ? 'bg-indigo-300'
                : 'bg-indigo-500';
              return (
                <div
                  key={cell.key}
                  className={`w-4 h-4 rounded-[4px] ${level}`}
                  title={`${cell.key}: ${cell.count} ${t.heatmapUnit}`}
                />
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t.progressTitle}</h3>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{t.goalsTitle}</p>
              {progressData.length === 0 && (
                <p className="text-xs text-slate-300">{t.noGoals}</p>
              )}
              {progressData.map(item => (
                <div key={item.id} className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold mb-2">
                    <span>{item.name}</span>
                    <span>{item.percent}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
