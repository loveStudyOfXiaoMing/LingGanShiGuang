
export type Language = 'zh' | 'en';

export interface Goal {
  id: string;
  name: string;
  color?: string;
  completed?: boolean;
  completedAt?: string;
}

export interface Note {
  id: string;
  content: string;
  date: string;
  mood?: string;
  imageUrl?: string;
  dailyInsight?: string;
  goals?: string[];
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface CycleSummary {
  id: string;
  startDate: string;
  endDate: string;
  summaryText: string;
  keyInsights: string[];
  growthScore: number;
  createdDate: string;
  advice?: string[];
  moodTrend?: string;
  topThemes?: string[];
  nextWeekPlan?: string[];
}

export type CycleLength = 7 | 14 | 30;

export interface AppState {
  notes: Note[];
  summaries: CycleSummary[];
  cycleLength: CycleLength;
  language: Language;
  goals: Goal[];
  version?: number;
}
