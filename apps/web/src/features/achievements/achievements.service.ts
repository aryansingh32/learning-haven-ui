import { api } from '@/services/api.svc';

export type MissionState = 'locked' | 'claimable' | 'pending' | 'paid';
export interface Mission {
  key: string; label: string; metric: 'solved' | 'chapters' | 'study_minutes' | 'active_days';
  target: number; xp: number; progress: number; complete: boolean; state: MissionState;
}
export interface BadgeView { id: string; name: string; emoji: string; hint: string; earned: boolean; earned_at: string | null }
export interface Achievements {
  today: string;
  rewards_enabled: boolean;
  week: { start: string; end: string; days_left: number; stats: Record<Mission['metric'], number> };
  missions: Mission[];
  coding_streak: { current: number; longest: number; today_done: boolean; last_day: string | null };
  milestones: Array<{
    id: string; metric: 'solved' | 'chapters' | 'coding_streak'; label: string; target: number; xp: number;
    badge: { id: string; name: string; emoji: string }; progress: number; earned: boolean; earned_at: string | null;
    reward: 'pending' | 'paid' | null;
  }>;
  collections: Array<{ id: string; name: string; description: string; badges: BadgeView[]; earned: number; total: number; complete: boolean }>;
  xp_today: { paid: number; cap: number; pending: number };
  new_milestones?: Array<{ id: string; name: string; emoji: string; xp: number }>;
}
export interface Leaderboard {
  available: boolean;
  period: 'all' | 'week';
  week_start: string;
  total: number;
  entries: Array<{ rank: number; name: string; xp: number; is_me: boolean }>;
  me: { rank: number | null; xp: number; hidden: boolean };
}

export const ACHIEVEMENTS_KEY = ['my-achievements'];
export const leaderboardKey = (period: 'all' | 'week') => ['leaderboard', period];

export const fetchAchievements = (): Promise<Achievements> => api.get('/users/me/achievements');
export const claimMission = (key: string): Promise<{ result: 'paid' | 'already_paid' | 'capped'; achievements: Achievements }> =>
  api.post(`/users/me/missions/${encodeURIComponent(key)}/claim`, {});
export const fetchLeaderboard = (period: 'all' | 'week'): Promise<Leaderboard> => api.get(`/users/leaderboard?period=${period}&limit=50`);
export const setLeaderboardHidden = (hidden: boolean): Promise<{ hidden: boolean }> => api.put('/users/me/leaderboard-visibility', { hidden });

/** "5 Oct – 11 Oct" */
export function weekLabel(start: string, end: string) {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(start)} – ${f(end)}`;
}

export const missionUnit = (m: Pick<Mission, 'metric'>) =>
  m.metric === 'study_minutes' ? 'min' : m.metric === 'active_days' ? 'days' : m.metric === 'chapters' ? 'chapters' : 'problems';
