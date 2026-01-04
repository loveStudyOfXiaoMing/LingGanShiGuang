
import React, { useState } from 'react';
import { CycleSummary, Language } from '../types';
import { Quote, Star, Sparkles, Share2, Download, Compass, X, Camera, Activity, Tag, ListChecks } from 'lucide-react';
import { translations } from '../i18n';

interface SummaryCardProps {
  summary: CycleSummary;
  language: Language;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary, language }) => {
  const [showPoster, setShowPoster] = useState(false);
  const t = translations[language].summaries;
  
  let details: any = {
    summaryText: summary.summaryText,
    keyInsights: summary.keyInsights,
    growthScore: summary.growthScore,
    advice: summary.advice || [],
    moodTrend: summary.moodTrend || '',
    topThemes: summary.topThemes || [],
    nextWeekPlan: summary.nextWeekPlan || []
  };
  try {
    if (summary.summaryText.startsWith('{')) {
       details = { ...details, ...JSON.parse(summary.summaryText) };
    }
  } catch(e) {}

  const dateLocale = language === 'zh' ? 'zh-CN' : 'en-US';
  const dateRange = `${new Date(summary.startDate).toLocaleDateString(dateLocale)} — ${new Date(summary.endDate).toLocaleDateString(dateLocale)}`;
  const summaryText = typeof details.summaryText === 'string' ? details.summaryText : String(details.summaryText || '');

  // 导出 Markdown 报告
  const handleExport = () => {
    const content = `
# ${t.reportTitle}
**周期**: ${dateRange}
**成长得分**: ${details.growthScore}

## 核心成长洞察
${details.summaryText}

## 心情走势 (Mood Trend)
${details.moodTrend || '-'}

## 高频主题 (Top Themes)
${(details.topThemes || []).map((item: string) => `- ${item}`).join('\n')}

## 近期亮点 (Key Insights)
${(details.keyInsights || []).map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

## 进阶建议 (Advice)
${(details.advice || []).map((item: string) => `- ${item}`).join('\n')}

## 下周行动计划 (Next Week Plan)
${(details.nextWeekPlan || []).map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

---
*由 灵感时光 AI 生成*
    `.trim();

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Growth_Report_${summary.endDate.split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="group relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[3rem] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
        
        <div className="relative bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/50">
          {/* Header Section */}
          <div className="bg-slate-900 p-10 text-white">
            <div className="flex justify-between items-start mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Growth Milestone</span>
                </div>
                <h3 className="text-4xl font-black tracking-tighter serif-text mb-2">
                  {t.reportTitle}
                </h3>
                <p className="text-slate-400 text-sm font-medium">
                  {dateRange}
                </p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t.growthScore}</p>
                <p className="text-5xl font-black leading-none bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent">
                  {details.growthScore}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
               <button 
                onClick={() => setShowPoster(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
               >
                  <Share2 className="w-3 h-3" /> 分享海报
               </button>
               <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
               >
                  <Download className="w-3 h-3" /> 导出报告
               </button>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-10 md:p-14 space-y-16">
            <section className="relative">
              <Quote className="absolute -left-8 -top-4 w-12 h-12 text-slate-50 -z-10" />
              <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                <div className="w-8 h-px bg-slate-900"></div> {t.coreSummary}
              </h4>
              <p className="text-slate-700 leading-relaxed text-xl font-serif italic md:pl-4">
                {details.summaryText}
              </p>
            </section>

            <div className="grid md:grid-cols-2 gap-16">
              <section>
                <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                   <Activity className="w-4 h-4 text-emerald-400" /> {t.moodTrend}
                </h4>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                  {details.moodTrend || t.noMoodTrend}
                </div>
              </section>

              <section>
                <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                   <Tag className="w-4 h-4 text-indigo-400" /> {t.topThemes}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(details.topThemes || []).map((theme: string, idx: number) => (
                    <span key={idx} className="px-4 py-2 bg-white border border-slate-100 rounded-full text-xs font-semibold text-slate-500">
                      {theme}
                    </span>
                  ))}
                  {!details.topThemes?.length && (
                    <span className="text-xs text-slate-400">{t.noTopThemes}</span>
                  )}
                </div>
              </section>
            </div>

            <section>
              <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                 <ListChecks className="w-4 h-4 text-amber-400" /> {t.nextWeekPlan}
              </h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {(details.nextWeekPlan || []).map((plan: string, idx: number) => (
                  <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                    {plan}
                  </div>
                ))}
                {!details.nextWeekPlan?.length && (
                  <div className="text-xs text-slate-400">{t.noNextWeekPlan}</div>
                )}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-16">
              <section>
                <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                   <Sparkles className="w-4 h-4 text-indigo-400" /> {t.insights}
                </h4>
                <ul className="space-y-6">
                  {details.keyInsights?.map((insight: string, idx: number) => (
                    <li key={idx} className="group/item">
                      <div className="flex items-start gap-4">
                        <span className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover/item:bg-slate-900 group-hover/item:text-white transition-all">
                          {idx + 1}
                        </span>
                        <p className="text-slate-600 text-sm leading-relaxed group-hover/item:text-slate-900 transition-colors">{insight}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-slate-900 font-black mb-8 uppercase tracking-widest text-xs flex items-center gap-3">
                   <Compass className="w-4 h-4 text-purple-400" /> {t.advice}
                </h4>
                <div className="space-y-4">
                  {(details.advice || []).map((adv: string, idx: number) => (
                    <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all">
                      <p className="text-slate-600 text-sm leading-relaxed italic">"{adv}"</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Poster Modal */}
      {showPoster && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            {/* Poster Content for Screenshot */}
            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col aspect-[9/16] relative">
              <div className="bg-slate-900 p-8 text-white flex-1 flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                    <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">SoulJournal AI</div>
                 </div>
                 
                 <div className="flex-1 flex flex-col justify-center text-center">
                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Milestone Achieved</p>
                    <h2 className="text-3xl font-black serif-text mb-2">{language === 'zh' ? '成长蜕变' : 'Evolution'}</h2>
                    <p className="text-slate-400 text-xs mb-10">{dateRange}</p>
                    
                    <div className="w-32 h-32 mx-auto mb-10 relative">
                       <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                       <div className="relative w-full h-full bg-white/5 backdrop-blur-md rounded-full border border-white/20 flex flex-col items-center justify-center">
                          <span className="text-4xl font-black leading-none">{details.growthScore}</span>
                          <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Growth Score</span>
                       </div>
                    </div>

                    <p className="text-lg serif-text italic leading-relaxed text-slate-200 px-4">
                      "{summaryText.length > 80 ? summaryText.substring(0, 80) + '...' : summaryText}"
                    </p>
                 </div>

                 <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-between">
                    <div className="text-left">
                       <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Core Insight</p>
                       <p className="text-xs font-bold text-slate-300 mt-1 truncate max-w-[150px]">{details.keyInsights?.[0]}</p>
                    </div>
                    <div className="w-10 h-10 bg-white p-1 rounded-lg">
                       {/* Placeholder for QR - purely aesthetic for poster look */}
                       <div className="w-full h-full border border-slate-200 grid grid-cols-3 grid-rows-3 gap-0.5">
                          {[...Array(9)].map((_, i) => <div key={i} className={`bg-slate-800 ${i%2===0 ? 'opacity-100' : 'opacity-20'}`}></div>)}
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="mt-6 flex justify-center gap-4">
               <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-6 shadow-xl border border-white/20">
                  <div className="flex flex-col items-center gap-1">
                     <Camera className="w-4 h-4 text-slate-900" />
                     <span className="text-[10px] font-black text-slate-400">截图保存</span>
                  </div>
                  <div className="w-px h-6 bg-slate-200"></div>
                  <button onClick={() => setShowPoster(false)} className="flex flex-col items-center gap-1 group">
                     <X className="w-4 h-4 text-red-500 group-hover:scale-125 transition-transform" />
                     <span className="text-[10px] font-black text-slate-400">关闭预览</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SummaryCard;
