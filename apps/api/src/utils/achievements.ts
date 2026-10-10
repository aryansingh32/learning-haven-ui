/**
 * Weekly missions, coding streaks, milestones and badge collections (slice W2-G1).
 * Pure helpers: the service feeds them rows, they decide progress. Days are India
 * (IST) calendar days as 'YYYY-MM-DD'; a week runs Monday to Sunday.
 */

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The India calendar day of a moment. */
export const istDay = (at: Date | string) => new Date(new Date(at).getTime() + IST_OFFSET).toISOString().slice(0, 10);

/** Monday..Sunday of the India week containing `today`, the UTC instant it began, and days left including today. */
export function indiaWeek(today: string) {
    const start = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const end = addDays(start, 6);
    const startsAt = new Date(Date.parse(`${start}T00:00:00Z`) - IST_OFFSET).toISOString();
    const daysLeft = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY) + 1;
    return { start, end, startsAt, daysLeft };
}

// ─── Weekly missions ────────────────────────────────────────────────────────

export type MissionMetric = 'solved' | 'chapters' | 'study_minutes' | 'active_days';
export interface MissionDef { key: string; label: string; metric: MissionMetric; target: number; xp: number }

export const DEFAULT_WEEKLY_MISSIONS: MissionDef[] = [
    { key: 'solve_problems', label: 'Solve 5 problems', metric: 'solved', target: 5, xp: 100 },
    { key: 'complete_chapters', label: 'Complete 2 chapters', metric: 'chapters', target: 2, xp: 80 },
    { key: 'study_minutes', label: 'Study for 2 hours', metric: 'study_minutes', target: 120, xp: 60 },
    { key: 'active_days', label: 'Learn on 4 different days', metric: 'active_days', target: 4, xp: 80 },
];

const METRICS: MissionMetric[] = ['solved', 'chapters', 'study_minutes', 'active_days'];

/** Admin-set missions (gamification_config.weekly_missions) when they are well-formed, else the defaults. */
export function sanitizeMissions(raw: unknown): MissionDef[] {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 8) return DEFAULT_WEEKLY_MISSIONS;
    const keys = new Set<string>();
    const out: MissionDef[] = [];
    for (const m of raw as any[]) {
        const ok = m && typeof m.key === 'string' && /^[a-z0-9_]{1,40}$/.test(m.key) && !keys.has(m.key) &&
            typeof m.label === 'string' && m.label.trim().length > 0 && m.label.length <= 80 &&
            METRICS.includes(m.metric) && Number.isInteger(m.target) && m.target >= 1 && m.target <= 10_000 &&
            Number.isInteger(m.xp) && m.xp >= 0 && m.xp <= 500;
        if (!ok) return DEFAULT_WEEKLY_MISSIONS;
        keys.add(m.key);
        out.push({ key: m.key, label: m.label.trim(), metric: m.metric, target: m.target, xp: m.xp });
    }
    return out;
}

export interface WeekActivity {
    /** One India day per problem solved this week (distinct problems). */
    solveDays: string[];
    /** One India day per chapter completed this week. */
    chapterDays: string[];
    /** Study time this week, per India day. */
    study: Array<{ day: string; seconds: number }>;
    /** Other days with real coding activity (accepted submissions). */
    otherActiveDays?: string[];
}

/** A day counts as active with a solve, a finished chapter, an accepted submission or 5+ minutes of study. */
export const MIN_ACTIVE_STUDY_SECONDS = 300;

export function weekStats(a: WeekActivity, week: { start: string; end: string }): Record<MissionMetric, number> {
    const inWeek = (d: string) => d >= week.start && d <= week.end;
    const study = a.study.filter((s) => inWeek(s.day));
    const active = new Set<string>([
        ...a.solveDays, ...a.chapterDays, ...(a.otherActiveDays ?? []),
        ...study.filter((s) => s.seconds >= MIN_ACTIVE_STUDY_SECONDS).map((s) => s.day),
    ].filter(inWeek));
    return {
        solved: a.solveDays.filter(inWeek).length,
        chapters: a.chapterDays.filter(inWeek).length,
        study_minutes: Math.floor(study.reduce((s, r) => s + r.seconds, 0) / 60),
        active_days: active.size,
    };
}

export type RewardStatus = 'pending' | 'paid';
export interface MissionView extends MissionDef {
    progress: number;
    complete: boolean;
    /** locked: not done yet; claimable: done, not claimed; pending: claimed, XP waits for the daily limit; paid. */
    state: 'locked' | 'claimable' | 'pending' | 'paid';
}

export const missionRewardKey = (weekStart: string, key: string) => `weekly:${weekStart}:${key}`;

export function missionViews(defs: MissionDef[], stats: Record<MissionMetric, number>, claimed: Map<string, RewardStatus>, weekStart: string): MissionView[] {
    return defs.map((d) => {
        const progress = Math.min(stats[d.metric] ?? 0, d.target);
        const complete = (stats[d.metric] ?? 0) >= d.target;
        const status = claimed.get(missionRewardKey(weekStart, d.key));
        const state = status === 'paid' ? 'paid' : status === 'pending' ? 'pending' : complete ? 'claimable' : 'locked';
        return { ...d, progress, complete, state };
    });
}

// ─── Coding streak ──────────────────────────────────────────────────────────

/**
 * Consecutive India days with at least one solved problem. The current streak is alive
 * while the last coding day is today or yesterday (today isn't over yet).
 */
export function codingStreak(days: string[], today: string) {
    const sorted = [...new Set(days)].filter((d) => d <= today).sort();
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of sorted) {
        run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
        longest = Math.max(longest, run);
        prev = d;
    }
    const last = sorted[sorted.length - 1] ?? null;
    const alive = last === today || last === addDays(today, -1);
    return { current: alive ? run : 0, longest, today_done: last === today, last_day: last };
}

// ─── Milestones and collections ────────────────────────────────────────────

export type MilestoneMetric = 'solved' | 'chapters' | 'coding_streak';
export interface Badge { id: string; name: string; emoji: string }
export interface MilestoneDef { id: string; metric: MilestoneMetric; target: number; xp: number; label: string; badge: Badge }

const ms = (metric: MilestoneMetric, target: number, xp: number, label: string, name: string, emoji: string): MilestoneDef => ({
    id: `${metric}_${target}`, metric, target, xp, label, badge: { id: `milestone_${metric}_${target}`, name, emoji },
});

export const MILESTONES: MilestoneDef[] = [
    ms('solved', 1, 25, 'Solve your first problem', 'First Solve', '🥉'),
    ms('solved', 10, 50, 'Solve 10 problems', 'Problem Solver', '🧩'),
    ms('solved', 25, 100, 'Solve 25 problems', 'Quarter Century', '🎯'),
    ms('solved', 50, 150, 'Solve 50 problems', 'Half Century', '🏏'),
    ms('solved', 100, 250, 'Solve 100 problems', 'Centurion', '💯'),
    ms('chapters', 1, 25, 'Complete your first chapter', 'Chapter One', '📖'),
    ms('chapters', 10, 100, 'Complete 10 chapters', 'Bookworm', '📚'),
    ms('chapters', 25, 200, 'Complete 25 chapters', 'Scholar', '🎓'),
    ms('coding_streak', 7, 100, 'Solve a problem 7 days in a row', 'Week of Code', '🔥'),
    ms('coding_streak', 30, 300, 'Solve a problem 30 days in a row', 'Month of Code', '🌋'),
];

export const milestoneRewardKey = (id: string) => `milestone:${id}`;

export function milestonesReached(stats: Record<MilestoneMetric, number>): MilestoneDef[] {
    return MILESTONES.filter((m) => (stats[m.metric] ?? 0) >= m.target);
}

export interface CollectionDef { id: string; name: string; description: string; badges: Array<Badge & { hint: string }> }

const fromMilestones = (metric: MilestoneMetric) =>
    MILESTONES.filter((m) => m.metric === metric).map((m) => ({ ...m.badge, hint: m.label }));

/** Badges grouped into collections. Learning Journey holds the badges chapters already award (utils/badges.ts). */
export const COLLECTIONS: CollectionDef[] = [
    { id: 'problem_solver', name: 'Problem Solver', description: 'Solve problems in practice.', badges: fromMilestones('solved') },
    { id: 'scholar', name: 'Scholar', description: 'Finish chapters in your courses.', badges: fromMilestones('chapters') },
    {
        id: 'consistency', name: 'Consistency', description: 'Show up day after day.',
        badges: [...fromMilestones('coding_streak'), { id: 'week_streak', name: 'Week Streak', emoji: '🔥', hint: 'Keep a 7-day learning streak' }],
    },
    {
        id: 'learning_journey', name: 'Learning Journey', description: 'Milestones along your course.',
        badges: [
            { id: 'first_step', name: 'First Step', emoji: '🎯', hint: 'Complete your first chapter' },
            { id: 'fast_learner', name: 'Fast Learner', emoji: '⚡', hint: 'Complete 5 chapters in 7 days' },
            { id: 'dsa_champion', name: 'DSA Champion', emoji: '🏆', hint: 'Complete 18 chapters' },
        ],
    },
];

export function collectionViews(earned: Map<string, string>) {
    return COLLECTIONS.map((c) => {
        const badges = c.badges.map((b) => ({ ...b, earned: earned.has(b.id), earned_at: earned.get(b.id) ?? null }));
        const count = badges.filter((b) => b.earned).length;
        return { id: c.id, name: c.name, description: c.description, badges, earned: count, total: badges.length, complete: count === badges.length };
    });
}

// ─── Leaderboard and limits ────────────────────────────────────────────────

/** "Priya Sharma" → "Priya S.": a first name and an initial, never an email or a full name. */
export function displayName(fullName: string | null | undefined): string {
    const parts = String(fullName ?? '').replace(/\S+@\S+/g, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Learner';
    const first = parts[0].slice(0, 20);
    const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : '';
    return first + initial;
}

export const DEFAULT_DAILY_REWARD_XP_CAP = 300;

/** The daily limit for reward XP: system setting max_daily_xp, then gamification_config.reward_daily_xp_cap, then 300. */
export function dailyCap(maxDailyXp: unknown, configCap: unknown): number {
    for (const v of [maxDailyXp, configCap]) {
        const n = typeof v === 'string' ? Number(v.trim()) : typeof v === 'number' ? v : NaN;
        if (Number.isInteger(n) && n >= 10 && n <= 100_000) return n;
    }
    return DEFAULT_DAILY_REWARD_XP_CAP;
}
