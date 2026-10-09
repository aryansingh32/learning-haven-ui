import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import { indiaDate } from '../../learning/services/practiceHelpers';

/** One learner's dashboard numbers: study time by day, goals, recent assessment results, and an activity feed. */

export interface StudyRow { day: string; seconds: number }
export interface ActivityItem { kind: 'solved' | 'attempted' | 'chapter' | 'certificate' | 'test_series' | 'mock_test'; title: string; detail: string | null; link: string | null; at: string }
export interface AssessmentResult { kind: 'test_series' | 'mock_test'; title: string; percent: number; at: string; link: string | null }

const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Monday of the (India) week containing `date`. */
export const weekStart = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

/** The last `span` days (oldest first) with minutes studied, plus today's, this week's and goal days met this week. */
export function shapeStudy(rows: StudyRow[], today: string, goalMinutes: number | null, span = 14) {
    const byDay = new Map(rows.map((r) => [r.day, r.seconds]));
    const minutes = (d: string) => Math.round((byDay.get(d) ?? 0) / 60);
    const days = Array.from({ length: span }, (_, i) => addDays(today, i - span + 1)).map((date) => ({ date, minutes: minutes(date) }));
    const monday = weekStart(today);
    const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d <= today);
    return {
        days,
        today_minutes: minutes(today),
        week_minutes: thisWeek.reduce((s, d) => s + minutes(d), 0),
        goal_minutes: goalMinutes,
        goal_days_met: goalMinutes ? thisWeek.filter((d) => minutes(d) >= goalMinutes).length : 0,
        week_days_so_far: thisWeek.length,
    };
}

/** Newest first, at most `limit`; a solve hides the failed tries of the same problem on the same day. */
export function mergeActivity(items: ActivityItem[], limit = 15): ActivityItem[] {
    const solvedKey = new Set(items.filter((i) => i.kind === 'solved').map((i) => `${i.link}|${i.at.slice(0, 10)}`));
    return items
        .filter((i) => i.kind !== 'attempted' || !solvedKey.has(`${i.link}|${i.at.slice(0, 10)}`))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, limit);
}

export class InsightsService {
    /** Adds study time to today's (India) row; a single report is capped at 4 hours, a day at 24. */
    static async addStudyTime(user_id: string, seconds: number) {
        const s = Math.min(Math.floor(seconds), 4 * 3600);
        await pool.query(
            `insert into public.study_time_daily (user_id, day, seconds) values ($1, $2, least($3, 86400))
             on conflict (user_id, day) do update set seconds = least(public.study_time_daily.seconds + excluded.seconds, 86400)`,
            [user_id, indiaDate(), s],
        );
        await CacheService.del(`user:${user_id}:insights`);
        return s;
    }

    static async updateGoals(user_id: string, goals: { daily_minutes?: number | null; weekly_problems?: number | null; learning_goal?: string | null }) {
        const sets: string[] = [];
        const values: unknown[] = [user_id];
        if (goals.daily_minutes !== undefined) { values.push(goals.daily_minutes); sets.push(`daily_time_minutes = $${values.length}`); }
        if (goals.weekly_problems !== undefined) { values.push(goals.weekly_problems); sets.push(`weekly_problem_goal = $${values.length}`); }
        if (goals.learning_goal !== undefined) { values.push(goals.learning_goal); sets.push(`learning_goal = $${values.length}`); }
        if (sets.length > 0) await pool.query(`update public.users set ${sets.join(', ')}, updated_at = now() where id = $1`, values);
        await CacheService.del(`user:${user_id}:insights`);
        return InsightsService.get(user_id, true);
    }

    static async get(user_id: string, fresh = false) {
        const cacheKey = `user:${user_id}:insights`;
        if (!fresh) {
            const cached = await CacheService.get(cacheKey);
            if (cached) return cached;
        }
        const today = indiaDate();
        const since = addDays(today, -13);
        const monday = weekStart(today);
        // A day boundary in India is 18:30 UTC the day before.
        const mondayUtc = new Date(Date.parse(`${monday}T00:00:00Z`) - 330 * 60_000).toISOString();

        // Each feed source is its own query, and a table that isn't there yet (a migration not applied) gives no rows.
        const rows = (sql: string, params: unknown[]) =>
            pool.query(sql, params).then((r) => r.rows, (e) => { if (e?.code === '42P01') return []; throw e; });
        const [user, study, solvedWeek, solved, attempted, chapters, certificates, testSeries, mockTests] = await Promise.all([
            rows(`select learning_goal, daily_time_minutes, weekly_problem_goal from public.users where id = $1`, [user_id]),
            rows(`select day::text as day, seconds from public.study_time_daily where user_id = $1 and day >= $2`, [user_id, since]),
            rows(`select count(*)::int as n from public.user_problem_status where user_id = $1 and status = 'solved' and solved_at >= $2`, [user_id, mondayUtc]),
            rows(`select 'solved' as kind, p.title, p.difficulty as detail, '/problems/' || p.slug as link, s.solved_at as at
                    from public.user_problem_status s join public.problems p on p.id = s.problem_id
                   where s.user_id = $1 and s.status = 'solved' and s.solved_at is not null order by s.solved_at desc limit 15`, [user_id]),
            rows(`select 'attempted' as kind, p.title, ps.verdict || ' · ' || ps.passed || '/' || ps.total || ' tests' as detail, '/problems/' || p.slug as link, ps.created_at as at
                    from public.problem_submissions ps join public.problems p on p.id = ps.problem_id
                   where ps.user_id = $1 and ps.verdict <> 'Accepted' order by ps.created_at desc limit 15`, [user_id]),
            rows(`select 'chapter' as kind, c.title, co.title as detail, '/chapter/' || c.id as link, cp.completed_at as at
                    from public.user_chapter_progress cp join public.chapters c on c.id = cp.chapter_id left join public.courses co on co.id = c.course_id
                   where cp.user_id = $1 and cp.completed_at is not null order by cp.completed_at desc limit 15`, [user_id]),
            rows(`select 'certificate' as kind, topic as title, null as detail, '/certificates' as link, issued_at as at
                    from public.certificates where user_id = $1 order by issued_at desc limit 5`, [user_id]),
            rows(`select 'test_series' as kind, t.title, round(100.0 * ta.score / nullif(ta.total_marks, 0))::int as percent, ta.submitted_at as at,
                         '/test-series/tests/' || ta.test_id as link
                    from public.test_attempts ta join public.tests t on t.id = ta.test_id
                   where ta.user_id = $1 and ta.status = 'completed' and ta.score is not null and ta.submitted_at is not null
                   order by ta.submitted_at desc limit 8`, [user_id]),
            rows(`select 'mock_test' as kind, co.title, ma.score_percent as percent, ma.submitted_at as at, '/course/' || co.id || '/mock-test' as link
                    from public.mock_test_attempts ma join public.courses co on co.id = ma.course_id
                   where ma.user_id = $1 and ma.status = 'completed' and ma.score_percent is not null and ma.submitted_at is not null
                   order by ma.submitted_at desc limit 8`, [user_id]),
        ]);
        const iso = (r: any) => ({ ...r, at: new Date(r.at).toISOString() });
        const testsDone = [...testSeries, ...mockTests].map(iso)
            .map((r: any) => ({ ...r, percent: Math.max(0, Math.min(100, Number(r.percent))) }));
        const activityRows = [
            ...solved, ...attempted, ...chapters, ...certificates,
            ...testsDone.map((r: any) => ({ kind: r.kind, title: r.title, detail: `${r.percent}%`, link: r.link, at: r.at })),
        ].map(iso);

        const u: any = user[0] ?? {};
        const result = {
            date: today,
            goals: {
                learning_goal: u.learning_goal ?? null,
                daily_minutes: u.daily_time_minutes ?? null,
                weekly_problems: u.weekly_problem_goal ?? null,
                solved_this_week: solvedWeek[0]?.n ?? 0,
            },
            study: shapeStudy(study.map((r: any) => ({ day: r.day, seconds: Number(r.seconds) })), today, u.daily_time_minutes ?? null),
            assessments: testsDone.sort((a: any, b: any) => b.at.localeCompare(a.at)).slice(0, 8) as AssessmentResult[],
            activity: mergeActivity(activityRows as ActivityItem[]),
        };
        await CacheService.set(cacheKey, result, 120);
        return result;
    }
}
