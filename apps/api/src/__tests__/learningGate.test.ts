/**
 * Course prerequisites and drip release (slice W2-L1). The database is mocked;
 * the SQL helpers (course_completion, course_started_at) are SQL-tested in learning.sql.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn() }, supabase: {} }));

import { pool } from '../config/database';
import {
    LearningGateService, dripUnlockAt, formatPrerequisiteMessage, isPrerequisiteMet,
} from '../modules/learning/services/learningGate.service';

const q = pool.query as unknown as jest.Mock;
const DAY = 24 * 60 * 60 * 1000;
const CH = '0c100000-0000-4000-8000-000000000002';

interface Fixture {
    role?: string;
    prereqs?: { title: string; total: number; done: number }[] | 'missing';
    assigned?: boolean;
    started?: boolean;
    chapter?: { chapter_number: number; status: string | null };
    drip?: number | null;
    startedAt?: Date | null;
}

function db(f: Fixture) {
    q.mockImplementation(async (sql: string) => {
        if (sql.includes('select role from public.users')) return { rows: [{ role: f.role ?? 'user' }] };
        if (sql.includes('course_prerequisites')) {
            if (f.prereqs === 'missing') throw Object.assign(new Error('relation does not exist'), { code: '42P01' });
            return { rows: (f.prereqs ?? []).map((p, i) => ({ course_id: `r${i}`, slug: `r${i}`, ...p })) };
        }
        if (sql.includes('campus.course_assignments')) return { rows: f.assigned ? [{ '?column?': 1 }] : [] };
        if (sql.includes("p.status in ('IN_PROGRESS', 'COMPLETED')")) return { rows: f.started ? [{ '?column?': 1 }] : [] };
        if (sql.includes('from public.chapters c where c.id')) {
            return { rows: [{ course_id: 'c1', chapter_number: f.chapter?.chapter_number ?? 1, status: f.chapter?.status ?? null }] };
        }
        if (sql.includes('course_started_at')) return { rows: [{ drip_interval_days: f.drip ?? null, started_at: f.startedAt ?? null }] };
        throw new Error(`unexpected query: ${sql}`);
    });
}

beforeEach(() => jest.clearAllMocks());

describe('drip release dates', () => {
    const start = new Date('2026-10-01T10:00:00Z');
    it('opens chapter N (N-1) x interval days after the start', () => {
        expect(dripUnlockAt(start, 3, 7)?.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    });
    it('never delays chapter 1 or a course without drip', () => {
        expect(dripUnlockAt(start, 1, 7)).toBeNull();
        expect(dripUnlockAt(start, 5, null)).toBeNull();
        expect(dripUnlockAt(start, 5, 0)).toBeNull();
    });
    it('counts from now before the learner starts', () => {
        const now = new Date('2026-10-09T00:00:00Z');
        expect(dripUnlockAt(null, 2, 3, now)?.getTime()).toBe(now.getTime() + 3 * DAY);
    });
});

describe('prerequisite rules', () => {
    it('needs every chapter done, and a course with no chapters is never done', () => {
        expect(isPrerequisiteMet({ total: 4, done: 4 })).toBe(true);
        expect(isPrerequisiteMet({ total: 4, done: 3 })).toBe(false);
        expect(isPrerequisiteMet({ total: 0, done: 0 })).toBe(false);
    });
    it('names what to finish', () => {
        expect(formatPrerequisiteMessage([{ title: 'Basics' }])).toBe('Finish "Basics" before starting this course.');
        expect(formatPrerequisiteMessage([{ title: 'A' }, { title: 'B' }, { title: 'C' }])).toBe('Finish "A", "B" and "C" before starting this course.');
    });

    it('blocks a learner who has not finished a prerequisite', async () => {
        db({ prereqs: [{ title: 'Basics', total: 4, done: 1 }] });
        const r = await LearningGateService.checkCourseStart('u1', 'c1');
        expect(r.blocked).toBe(true);
        expect(r.unmet.map((p) => p.title)).toEqual(['Basics']);
        expect(r.message).toContain('Basics');
    });

    it('lets them in once it is finished', async () => {
        db({ prereqs: [{ title: 'Basics', total: 4, done: 4 }] });
        const r = await LearningGateService.checkCourseStart('u1', 'c1');
        expect(r.blocked).toBe(false);
        expect(r.prerequisites[0].completed).toBe(true);
    });

    it.each([
        ['admins', { role: 'admin' }, 'admin'],
        ['a course their college assigned', { assigned: true }, 'college_assigned'],
        ['learners who had already started the course', { started: true }, 'already_started'],
    ])('exempts %s', async (_label, extra, exemption) => {
        db({ prereqs: [{ title: 'Basics', total: 4, done: 0 }], ...(extra as Fixture) });
        const r = await LearningGateService.checkCourseStart('u1', 'c1');
        expect(r.blocked).toBe(false);
        expect(r.exemption).toBe(exemption);
    });

    it('turns itself off when the table is missing (migration not applied yet)', async () => {
        db({ prereqs: 'missing' });
        const r = await LearningGateService.checkCourseStart('u1', 'c1');
        expect(r).toMatchObject({ blocked: false, prerequisites: [] });
    });
});

describe('chapter gate', () => {
    const now = new Date('2026-10-09T12:00:00Z');

    it('refuses chapters of a course whose prerequisites are not done', async () => {
        db({ prereqs: [{ title: 'Basics', total: 2, done: 0 }], chapter: { chapter_number: 1, status: null } });
        const g = await LearningGateService.chapterGate('u1', CH, now);
        expect(g).toMatchObject({ ok: false, code: 'PREREQUISITES' });
    });

    it('refuses a chapter before its drip date and says when it opens', async () => {
        db({ chapter: { chapter_number: 3, status: 'UNLOCKED' }, drip: 7, startedAt: new Date('2026-10-01T12:00:00Z') });
        const g = await LearningGateService.chapterGate('u1', CH, now);
        expect(g).toMatchObject({ ok: false, code: 'DRIP', available_at: '2026-10-15T12:00:00.000Z' });
        expect((g as { message: string }).message).toMatch(/unlocks on 15 Oct 2026/);
    });

    it('opens it once the date has passed', async () => {
        db({ chapter: { chapter_number: 2, status: 'UNLOCKED' }, drip: 7, startedAt: new Date('2026-10-01T12:00:00Z') });
        expect(await LearningGateService.chapterGate('u1', CH, now)).toEqual({ ok: true });
    });

    it('always opens a completed chapter', async () => {
        db({ prereqs: [{ title: 'Basics', total: 2, done: 0 }], chapter: { chapter_number: 5, status: 'COMPLETED' }, drip: 30, startedAt: now });
        expect(await LearningGateService.chapterGate('u1', CH, now)).toEqual({ ok: true });
    });

    it('lets admins preview drip chapters', async () => {
        db({ role: 'admin', chapter: { chapter_number: 4, status: null }, drip: 7, startedAt: now });
        expect(await LearningGateService.chapterGate('u1', CH, now)).toEqual({ ok: true });
    });

    it('answers 403 with the reason for writes', async () => {
        db({ chapter: { chapter_number: 3, status: 'UNLOCKED' }, drip: 7, startedAt: now });
        const json = jest.fn();
        const res = { status: jest.fn(() => ({ json })) };
        expect(await LearningGateService.allowChapterWrite('u1', CH, res)).toBe(false);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(json.mock.calls[0][0]).toMatchObject({ code: 'DRIP', error: expect.stringMatching(/unlocks on/) });
    });
});
