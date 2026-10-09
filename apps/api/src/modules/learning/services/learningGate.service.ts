import { pool } from '../../../config/database';
import logger from '../../../config/logger';

/** Postgres errors for objects a not-yet-applied migration creates: treat as "feature off". */
const MISSING = new Set(['42P01', '42883', '42703', '3F000']); // table, function, column, schema
export const isMissingObject = (err: unknown) => MISSING.has((err as { code?: string })?.code ?? '');

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Prerequisite {
    course_id: string;
    title: string;
    slug: string;
    total: number;
    done: number;
    completed: boolean;
}

/** Why a learner may start a course whose prerequisites they haven't finished. */
export type PrerequisiteExemption = 'admin' | 'college_assigned' | 'already_started' | null;

export type ChapterGate =
    | { ok: true }
    | { ok: false; code: 'PREREQUISITES'; message: string; prerequisites: Prerequisite[] }
    | { ok: false; code: 'DRIP'; message: string; available_at: string };

/**
 * Drip release: chapter N opens (N - 1) × interval days after the learner
 * started the course. Chapter 1 (or no drip) has no date. Before the learner
 * starts, dates count from `now`.
 */
export function dripUnlockAt(
    startedAt: Date | null,
    chapterNumber: number,
    intervalDays: number | null | undefined,
    now: Date = new Date(),
): Date | null {
    if (!intervalDays || intervalDays < 1 || !Number.isFinite(chapterNumber) || chapterNumber <= 1) return null;
    const start = startedAt ?? now;
    return new Date(start.getTime() + (chapterNumber - 1) * intervalDays * DAY_MS);
}

export function isPrerequisiteMet(p: { total: number; done: number }): boolean {
    return p.total > 0 && p.done >= p.total;
}

export function formatPrerequisiteMessage(unmet: { title: string }[]): string {
    if (unmet.length === 0) return '';
    const names = unmet.map((p) => `"${p.title}"`);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `Finish ${list} before starting this course.`;
}

export function formatDripMessage(availableAt: Date): string {
    const date = availableAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    return `This chapter unlocks on ${date}.`;
}

/**
 * Course prerequisites and drip release, enforced on the server.
 *
 * Exemptions from prerequisites: Forge admins (previewing), courses the
 * learner's college assigned to them (the college decides the order), and
 * learners who had already made progress in the course before the
 * prerequisite was added. A chapter the learner has completed always opens.
 */
export class LearningGateService {
    static async isAdmin(userId: string): Promise<boolean> {
        const { rows } = await pool.query<{ role: string | null }>('select role from public.users where id = $1', [userId]);
        return ['admin', 'super_admin'].includes(rows[0]?.role ?? '');
    }

    /** Every prerequisite of a course with this learner's progress in it. */
    static async listPrerequisites(userId: string, courseId: string): Promise<Prerequisite[]> {
        try {
            const { rows } = await pool.query<Omit<Prerequisite, 'completed'>>(
                `select r.id as course_id, r.title, r.slug, cc.total, cc.done
                   from public.course_prerequisites p
                   join public.courses r on r.id = p.required_course_id and r.deleted_at is null
                   cross join lateral public.course_completion($1, r.id) cc
                  where p.course_id = $2
                  order by r.title`,
                [userId, courseId],
            );
            return rows.map((r) => ({ ...r, completed: isPrerequisiteMet(r) }));
        } catch (err) {
            if (isMissingObject(err)) return [];
            throw err;
        }
    }

    static async prerequisiteExemption(userId: string, courseId: string): Promise<PrerequisiteExemption> {
        if (await this.isAdmin(userId)) return 'admin';
        try {
            const { rows } = await pool.query(
                `select 1 from campus.course_assignments a
                   join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = $1
                  where a.course_id = $2 and a.status = 'published' limit 1`,
                [userId, courseId],
            );
            if (rows.length) return 'college_assigned';
        } catch (err) {
            if (!isMissingObject(err)) throw err;
        }
        const { rows } = await pool.query(
            `select 1 from public.user_chapter_progress p
               join public.chapters c on c.id = p.chapter_id
              where p.user_id = $1 and c.course_id = $2
                and (p.status in ('IN_PROGRESS', 'COMPLETED') or cardinality(coalesce(p.steps_completed, '{}')) > 0)
              limit 1`,
            [userId, courseId],
        );
        return rows.length ? 'already_started' : null;
    }

    /** Can this learner start (or keep going in) the course? */
    static async checkCourseStart(userId: string, courseId: string) {
        const prerequisites = await this.listPrerequisites(userId, courseId);
        const unmet = prerequisites.filter((p) => !p.completed);
        const exemption = unmet.length ? await this.prerequisiteExemption(userId, courseId) : null;
        const blocked = unmet.length > 0 && !exemption;
        return { blocked, prerequisites, unmet, exemption, message: blocked ? formatPrerequisiteMessage(unmet) : '' };
    }

    static async dripSettings(userId: string, courseId: string): Promise<{ intervalDays: number | null; startedAt: Date | null }> {
        try {
            const { rows } = await pool.query<{ drip_interval_days: number | null; started_at: Date | null }>(
                `select c.drip_interval_days, public.course_started_at($1, c.id) as started_at
                   from public.courses c where c.id = $2`,
                [userId, courseId],
            );
            return { intervalDays: rows[0]?.drip_interval_days ?? null, startedAt: rows[0]?.started_at ?? null };
        } catch (err) {
            if (isMissingObject(err)) return { intervalDays: null, startedAt: null };
            throw err;
        }
    }

    /**
     * Is this chapter open to the learner right now, as far as prerequisites and
     * drip go? (Sequential unlocking and the paywall are checked elsewhere.)
     */
    static async chapterGate(userId: string, chapterId: string, now: Date = new Date()): Promise<ChapterGate> {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId)) return { ok: true }; // not a chapter: callers 404
        const { rows } = await pool.query<{ course_id: string | null; chapter_number: number; status: string | null }>(
            `select c.course_id, c.chapter_number,
                    (select p.status from public.user_chapter_progress p where p.user_id = $1 and p.chapter_id = c.id) as status
               from public.chapters c where c.id = $2`,
            [userId, chapterId],
        );
        const chapter = rows[0];
        if (!chapter?.course_id || chapter.status === 'COMPLETED') return { ok: true };

        const start = await this.checkCourseStart(userId, chapter.course_id);
        if (start.blocked) {
            return { ok: false, code: 'PREREQUISITES', message: start.message, prerequisites: start.unmet };
        }

        const drip = await this.dripSettings(userId, chapter.course_id);
        const unlockAt = dripUnlockAt(drip.startedAt, chapter.chapter_number, drip.intervalDays, now);
        if (unlockAt && unlockAt > now && !(await this.isAdmin(userId))) {
            return { ok: false, code: 'DRIP', message: formatDripMessage(unlockAt), available_at: unlockAt.toISOString() };
        }
        return { ok: true };
    }

    /** Express helper: answer 403 when the chapter is gated. Returns true when the request may go on. */
    static async allowChapterWrite(userId: string, chapterId: string, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
        try {
            const gate = await this.chapterGate(userId, chapterId);
            if (gate.ok === true) return true;
            const { ok: _ok, ...body } = gate as Exclude<ChapterGate, { ok: true }>;
            res.status(403).json({ error: body.message, ...body });
            return false;
        } catch (err) {
            logger.error('Chapter gate check failed', { chapterId, error: (err as Error).message });
            res.status(500).json({ error: 'Internal Server Error' });
            return false;
        }
    }
}
