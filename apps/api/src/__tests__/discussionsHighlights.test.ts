/**
 * Chapter discussions and highlights (slice W2-L1): input checks and how
 * threads are shaped. Access rules are SQL-tested in learning.sql and
 * exercised end to end in the browser run.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), connect: jest.fn() }, supabase: {} }));

import { pool } from '../config/database';
import { buildThreads, parsePostBody, DiscussionsService, type PostRow } from '../modules/learning/services/discussions.service';
import { parseHighlightInput, HighlightsService } from '../modules/learning/services/highlights.service';

const q = pool.query as unknown as jest.Mock;

const row = (p: Partial<PostRow> & { id: string }): PostRow => ({
    parent_id: null, user_id: 'u2', author_name: 'Asha', body: 'text', created_at: '2026-10-09T10:00:00.000Z',
    edited_at: null, deleted_at: null, hidden_at: null, hidden_reason: null, reported_by_me: false, open_reports: 0, ...p,
});

describe('post bodies', () => {
    it('trims and accepts normal posts', () => expect(parsePostBody('  Why LIFO?  ')).toEqual({ body: 'Why LIFO?' }));
    it('refuses empty and over-long posts', () => {
        expect(parsePostBody('   ')).toHaveProperty('error');
        expect(parsePostBody(42)).toHaveProperty('error');
        expect(parsePostBody('x'.repeat(4001))).toHaveProperty('error');
    });
});

describe('threads', () => {
    const rows = [
        row({ id: 'b', created_at: '2026-10-09T11:00:00.000Z', body: 'second question' }),
        row({ id: 'a', user_id: 'me', body: 'first question' }),
        row({ id: 'a2', parent_id: 'a', created_at: '2026-10-09T10:30:00.000Z', body: 'an answer' }),
        row({ id: 'gone', deleted_at: '2026-10-09T12:00:00.000Z', created_at: '2026-10-09T09:00:00.000Z', body: 'secret' }),
        row({ id: 'gone-with-replies', deleted_at: '2026-10-09T12:00:00.000Z', created_at: '2026-10-09T09:30:00.000Z', body: 'removed text' }),
        row({ id: 'r', parent_id: 'gone-with-replies', created_at: '2026-10-09T09:40:00.000Z' }),
        row({ id: 'h', hidden_at: '2026-10-09T13:00:00.000Z', hidden_reason: 'spam', user_id: 'me', open_reports: 2 }),
    ];

    it('puts replies under their post, oldest first', () => {
        const t = buildThreads(rows, 'me', false);
        expect(t.map((p) => p.id)).toEqual(['gone-with-replies', 'a', 'h', 'b']);
        expect(t.find((p) => p.id === 'a')?.replies.map((r) => r.id)).toEqual(['a2']);
        expect(t.find((p) => p.id === 'a')?.mine).toBe(true);
    });

    it('drops deleted posts without replies and blanks deleted text', () => {
        const t = buildThreads(rows, 'me', false);
        expect(t.find((p) => p.id === 'gone')).toBeUndefined();
        const kept = t.find((p) => p.id === 'gone-with-replies')!;
        expect(kept).toMatchObject({ deleted: true, body: '', author_name: '' });
        expect(JSON.stringify(t)).not.toContain('removed text');
        expect(JSON.stringify(t)).not.toContain('secret');
    });

    it('tells the author why their post was hidden, and staff how often posts were reported', () => {
        const mine = buildThreads(rows, 'me', false).find((p) => p.id === 'h')!;
        expect(mine).toMatchObject({ hidden: true, hidden_reason: 'spam' });
        expect(mine).not.toHaveProperty('open_reports');
        const staff = buildThreads(rows, 'staff', true).find((p) => p.id === 'h')!;
        expect(staff.open_reports).toBe(2);
        const other = buildThreads(rows, 'someone', false).find((p) => p.id === 'h')!;
        expect(other.hidden_reason).toBeNull();
    });
});

describe('who moderates', () => {
    const forge = '00000000-0000-0000-0000-00000000f0f0';
    it.each([
        ['a Forge admin', { role: 'admin', owner_org_id: forge }, undefined, true],
        ['a learner on a Forge course', { role: 'user', owner_org_id: forge }, undefined, false],
        ['college content staff on their course', { role: 'user', owner_org_id: 'org-a' }, true, true],
        ['a college student on their course', { role: 'user', owner_org_id: 'org-a' }, false, false],
    ])('%s', async (_label, user, perm, expected) => {
        q.mockImplementation(async (sql: string) => {
            if (sql.includes('from public.users u, public.courses c')) return { rows: [user] };
            if (sql.includes('user_permissions')) return { rows: [{ ok: perm }] };
            throw new Error('unexpected');
        });
        expect(await DiscussionsService.isStaff('u1', { id: 'c1' })).toBe(expected);
    });
});

describe('highlights', () => {
    it('accepts a highlight with context and a colour', () => {
        expect(parseHighlightInput({ text: 'LIFO', prefix: 'x'.repeat(100), suffix: 'y'.repeat(100), start_offset: 12, color: 'green' })).toEqual({
            text: 'LIFO', prefix: 'x'.repeat(64), suffix: 'y'.repeat(64), start_offset: 12, color: 'green', step_id: null,
        });
    });
    it('refuses empty text, unknown colours, bad offsets and step ids', () => {
        expect(typeof parseHighlightInput({ text: ' ' })).toBe('string');
        expect(typeof parseHighlightInput({ text: 'a', color: 'red' })).toBe('string');
        expect(typeof parseHighlightInput({ text: 'a', start_offset: -1 })).toBe('string');
        expect(typeof parseHighlightInput({ text: 'a', step_id: 'not-a-uuid' })).toBe('string');
        expect(typeof parseHighlightInput({ text: 'a'.repeat(2001) })).toBe('string');
    });
    it('reads as "none yet" when the table is missing on an older database', async () => {
        q.mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
        expect(await HighlightsService.listForChapter('u1', 'c1')).toEqual({ available: false, highlights: [] });
        expect((await HighlightsService.listForCourse('u1', ['c1'])).size).toBe(0);
    });
});
