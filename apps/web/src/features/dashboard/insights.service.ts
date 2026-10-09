import { api } from '@/services/api.svc';

export interface Insights {
  date: string;
  goals: { learning_goal: string | null; daily_minutes: number | null; weekly_problems: number | null; solved_this_week: number };
  study: {
    days: Array<{ date: string; minutes: number }>;
    today_minutes: number;
    week_minutes: number;
    goal_minutes: number | null;
    goal_days_met: number;
    week_days_so_far: number;
  };
  assessments: Array<{ kind: 'test_series' | 'mock_test'; title: string; percent: number; at: string; link: string | null }>;
  activity: Array<{
    kind: 'solved' | 'attempted' | 'chapter' | 'certificate' | 'test_series' | 'mock_test';
    title: string; detail: string | null; link: string | null; at: string;
  }>;
}
export type GoalsInput = { daily_minutes?: number | null; weekly_problems?: number | null; learning_goal?: string | null };

export const INSIGHTS_KEY = ['my-insights'];
export const fetchInsights = (): Promise<Insights> => api.get('/users/me/insights');
export const saveGoals = (g: GoalsInput): Promise<Insights> => api.put('/users/me/goals', g);

export function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round(mins / (60 * 24));
  return days === 1 ? 'yesterday' : days < 7 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
