import { pool } from '../../../config/database';
import logger from '../../../config/logger';
import { indiaDate } from '../../learning/services/practiceHelpers';

/**
 * Placement readiness: one score (0–100) from what a learner has actually done, with
 * the parts it is made of and what to do next. Computed on the server from practice,
 * test results, courses, projects, profile and consistency — never from the browser.
 *
 * College test results are left out on purpose: a college may not have released them,
 * and a score that moved would give them away.
 */

export type ReadinessKey = 'practice' | 'assessments' | 'learning' | 'projects' | 'profile' | 'consistency';

export interface ReadinessInputs {
    solved: { easy: number; medium: number; hard: number };
    topics: Array<{ topic: string; total: number; solved: number }>;
    assessments: { count: number; averagePercent: number | null };
    chaptersCompleted: number;
    projects: { completed: number; inProgressPercent: number[] };
    profile: { hasResume: boolean; skills: number; publicPortfolio: boolean };
    activeDays30: number;
}

export interface ReadinessPart {
    key: ReadinessKey;
    label: string;
    weight: number;     // share of the total, 0–1
    score: number;      // 0–100
    detail: string;     // what was counted
    next: { label: string; link: string } | null;
}

export interface Readiness {
    score: number;
    level: 'Getting started' | 'Building up' | 'Interview-ready' | 'Placement-ready';
    parts: ReadinessPart[];
    weakTopics: string[];
    nextSteps: Array<{ label: string; link: string; gain: number }>;
}

// Targets that count as "done" for each part.
export const TARGETS = { practicePoints: 120, assessments: 5, chapters: 24, projects: 3, skills: 3, activeDays: 20 };
const WEIGHTS: Record<ReadinessKey, number> = { practice: 0.3, assessments: 0.2, learning: 0.15, projects: 0.15, profile: 0.1, consistency: 0.1 };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (n: number, target: number) => Math.min(1, n / target);

export function levelFor(score: number): Readiness['level'] {
    if (score >= 80) return 'Placement-ready';
    if (score >= 55) return 'Interview-ready';
    if (score >= 30) return 'Building up';
    return 'Getting started';
}

/** The score and its parts. Pure: same inputs, same answer. */
export function scoreReadiness(i: ReadinessInputs): Readiness {
    const points = i.solved.easy + i.solved.medium * 2.5 + i.solved.hard * 4;
    const topicsTried = i.topics.filter((t) => t.total > 0);
    const covered = topicsTried.filter((t) => t.solved > 0).length;
    const coverage = topicsTried.length ? covered / topicsTried.length : 0;
    const solvedTotal = i.solved.easy + i.solved.medium + i.solved.hard;

    const assessments = i.assessments.count === 0 || i.assessments.averagePercent === null
        ? 0
        // A single good test isn't readiness yet: confidence grows with the number taken.
        : i.assessments.averagePercent * (0.6 + 0.4 * ratio(i.assessments.count, TARGETS.assessments));

    const projectUnits = i.projects.completed + i.projects.inProgressPercent.reduce((s, p) => s + Math.min(100, p) / 200, 0);
    const profile = (i.profile.hasResume ? 40 : 0) + ratio(i.profile.skills, TARGETS.skills) * 30 + (i.profile.publicPortfolio ? 30 : 0);

    const parts: ReadinessPart[] = [
        {
            key: 'practice', label: 'Coding practice', weight: WEIGHTS.practice,
            score: clamp(ratio(points, TARGETS.practicePoints) * 80 + coverage * 20),
            detail: `${solvedTotal} solved (${i.solved.easy} easy, ${i.solved.medium} medium, ${i.solved.hard} hard) · ${covered}/${topicsTried.length} topics`,
            next: { label: solvedTotal === 0 ? 'Solve your first problems' : i.solved.medium < 10 ? 'Solve medium problems' : 'Practise your weakest topics', link: '/topics' },
        },
        {
            key: 'assessments', label: 'Test scores', weight: WEIGHTS.assessments, score: clamp(assessments),
            detail: i.assessments.count === 0 ? 'No mock or test-series tests yet'
                : `${i.assessments.count} test${i.assessments.count === 1 ? '' : 's'} · average ${Math.round(i.assessments.averagePercent ?? 0)}%`,
            next: { label: 'Take a timed mock test', link: '/test-series' },
        },
        {
            key: 'learning', label: 'Courses', weight: WEIGHTS.learning, score: clamp(ratio(i.chaptersCompleted, TARGETS.chapters) * 100),
            detail: `${i.chaptersCompleted} chapter${i.chaptersCompleted === 1 ? '' : 's'} completed`,
            next: { label: 'Finish your next chapter', link: '/courses' },
        },
        {
            key: 'projects', label: 'Projects', weight: WEIGHTS.projects, score: clamp(ratio(projectUnits, TARGETS.projects) * 100),
            detail: `${i.projects.completed} built${i.projects.inProgressPercent.length ? `, ${i.projects.inProgressPercent.length} in progress` : ''}`,
            next: { label: i.projects.completed + i.projects.inProgressPercent.length === 0 ? 'Start a build challenge' : 'Finish a project', link: '/projects' },
        },
        {
            key: 'profile', label: 'Resume and profile', weight: WEIGHTS.profile, score: clamp(profile),
            detail: [i.profile.hasResume ? 'resume ✓' : 'no resume', `${i.profile.skills} skill${i.profile.skills === 1 ? '' : 's'}`,
                i.profile.publicPortfolio ? 'public portfolio ✓' : 'portfolio private'].join(' · '),
            next: !i.profile.hasResume ? { label: 'Build your resume', link: '/resume' }
                : !i.profile.publicPortfolio ? { label: 'Publish your portfolio', link: '/settings/portfolio' }
                : { label: 'Add your skills', link: '/settings/account' },
        },
        {
            key: 'consistency', label: 'Consistency', weight: WEIGHTS.consistency, score: clamp(ratio(i.activeDays30, TARGETS.activeDays) * 100),
            detail: `Active ${i.activeDays30} of the last 30 days`,
            next: { label: 'Study a little every day', link: '/dashboard' },
        },
    ];
    for (const p of parts) if (p.score >= 100) p.next = null;

    const score = clamp(parts.reduce((s, p) => s + p.score * p.weight, 0));
    const nextSteps = parts
        .filter((p) => p.next)
        .map((p) => ({ ...p.next!, gain: Math.round((100 - p.score) * p.weight) }))
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 3);
    // Topics with problems available where the learner has solved little.
    const weakTopics = topicsTried
        .filter((t) => t.solved / t.total < 0.3)
        .sort((a, b) => a.solved / a.total - b.solved / b.total || b.total - a.total)
        .map((t) => t.topic)
        .slice(0, 5);

    return { score, level: levelFor(score), parts, weakTopics, nextSteps };
}

/** A missing table (an older database) counts as "nothing yet", not an error. */
async function q<T>(sql: string, params: unknown[], fallback: T[]): Promise<T[]> {
    try {
        return (await pool.query(sql, params)).rows as T[];
    } catch (error: any) {
        if (error?.code === '42P01' || error?.code === '42703') return fallback;
        throw error;
    }
}

export class ReadinessService {
    static async inputs(userId: string): Promise<ReadinessInputs> {
        const [solved, topics, tests, mocks, chapters, projects, resume, skills, portfolio, active] = await Promise.all([
            q<{ difficulty: string; n: number }>(
                `select p.difficulty, count(*)::int as n from public.user_problem_status s join public.problems p on p.id = s.problem_id
                  where s.user_id = $1 and s.status = 'solved' and p.deleted_at is null group by p.difficulty`, [userId], []),
            // Topics of Forge's public library, and how many of each the learner solved.
            q<{ topic: string; total: number; solved: number }>(
                `select p.topic, count(*)::int as total,
                        count(*) filter (where exists (select 1 from public.user_problem_status s
                                          where s.problem_id = p.id and s.user_id = $1 and s.status = 'solved'))::int as solved
                   from public.problems p
                  where p.deleted_at is null and p.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and p.visibility = 'public'
                  group by p.topic`, [userId], []),
            q<{ n: number; pct: number | null }>(
                `select count(*)::int as n, avg(100.0 * score / nullif(total_marks, 0))::float as pct from public.test_attempts
                  where user_id = $1 and status = 'completed' and assignment_id is null and total_marks > 0
                    and submitted_at > now() - interval '180 days'`, [userId], [{ n: 0, pct: null }]),
            q<{ n: number; pct: number | null }>(
                `select count(*)::int as n, avg(score_percent)::float as pct from public.mock_test_attempts
                  where user_id = $1 and status = 'completed' and score_percent is not null
                    and submitted_at > now() - interval '180 days'`, [userId], [{ n: 0, pct: null }]),
            q<{ n: number }>(`select count(*)::int as n from public.user_chapter_progress where user_id = $1 and status = 'COMPLETED'`, [userId], [{ n: 0 }]),
            q<{ status: string | null; progress: number | null; completed_at: string | null }>(
                `select status, progress_percentage::float as progress, completed_at from public.build_enrollments
                  where user_id = $1 and deleted_at is null`, [userId], []),
            q<{ n: number }>(`select count(*)::int as n from public.user_resumes where user_id = $1`, [userId], [{ n: 0 }]),
            q<{ n: number }>(`select count(*)::int as n from public.user_skills where user_id = $1`, [userId], [{ n: 0 }]),
            q<{ n: number }>(`select count(*)::int as n from public.learner_portfolios where user_id = $1 and is_public`, [userId], [{ n: 0 }]),
            // A day counts when the learner studied 5+ minutes or solved something.
            q<{ n: number }>(
                `select count(*)::int as n from (
                   select day from public.study_time_daily where user_id = $1 and seconds >= 300 and day > current_date - 30
                   union
                   select (solved_at at time zone 'Asia/Kolkata')::date from public.user_problem_status
                    where user_id = $1 and status = 'solved' and solved_at > now() - interval '30 days') d`, [userId], [{ n: 0 }]),
        ]);

        const by = (d: string) => solved.find((r) => r.difficulty === d)?.n ?? 0;
        const t = tests[0] ?? { n: 0, pct: null };
        const m = mocks[0] ?? { n: 0, pct: null };
        const count = (t.n ?? 0) + (m.n ?? 0);
        const averagePercent = count === 0 ? null : (((t.pct ?? 0) * (t.n ?? 0)) + ((m.pct ?? 0) * (m.n ?? 0))) / count;
        const done = (p: { status: string | null; progress: number | null; completed_at: string | null }) =>
            p.status === 'completed' || Boolean(p.completed_at) || (p.progress ?? 0) >= 100;

        return {
            solved: { easy: by('easy'), medium: by('medium'), hard: by('hard') },
            topics,
            assessments: { count, averagePercent },
            chaptersCompleted: chapters[0]?.n ?? 0,
            projects: { completed: projects.filter(done).length, inProgressPercent: projects.filter((p) => !done(p)).map((p) => p.progress ?? 0) },
            profile: { hasResume: (resume[0]?.n ?? 0) > 0, skills: skills[0]?.n ?? 0, publicPortfolio: (portfolio[0]?.n ?? 0) > 0 },
            activeDays30: active[0]?.n ?? 0,
        };
    }

    /** Today's readiness, saved as today's snapshot, with the last 12 weeks of snapshots for the trend. */
    static async get(userId: string) {
        const readiness = scoreReadiness(await this.inputs(userId));
        const today = indiaDate();
        try {
            await pool.query(
                `insert into public.readiness_snapshots (user_id, day, score, parts) values ($1, $2, $3, $4)
                 on conflict (user_id, day) do update set score = excluded.score, parts = excluded.parts`,
                [userId, today, readiness.score, JSON.stringify(Object.fromEntries(readiness.parts.map((p) => [p.key, p.score])))]);
        } catch (error: any) {
            if (error?.code !== '42P01') logger.warn('Readiness snapshot not saved', { userId, code: error?.code });
        }
        const history = await q<{ day: string; score: number }>(
            `select to_char(day, 'YYYY-MM-DD') as day, score from public.readiness_snapshots
              where user_id = $1 and day > current_date - 84 order by day`, [userId], []);
        return { ...readiness, history };
    }
}
