/**
 * Practice list rules against an in-memory stand-in for the problems table:
 * company filter, title search, deleted problems hidden, the company list,
 * and the daily problem (free only, solved-today flag).
 */
const rows = {
  problems: [
    { id: 'p1', slug: 'two-sum', title: 'Two Sum', difficulty: 'easy', topic: 'Arrays & Hashing', companies: ['Amazon', 'Google'], is_premium: false, deleted_at: null, order_index: 1 },
    { id: 'p2', slug: 'group-anagrams', title: 'Group Anagrams', difficulty: 'medium', topic: 'Arrays & Hashing', companies: ['Amazon', 'Uber'], is_premium: false, deleted_at: null, order_index: 2 },
    { id: 'p3', slug: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'hard', topic: 'Two Pointers', companies: ['Google'], is_premium: true, deleted_at: null, order_index: 3 },
    { id: 'p4', slug: 'old-sum', title: 'Old Sum', difficulty: 'easy', topic: 'Arrays & Hashing', companies: ['Amazon'], is_premium: false, deleted_at: '2026-01-01', order_index: 4 },
  ] as any[],
  user_problem_status: [] as any[],
};

jest.mock('../config/database', () => {
  const builder = (table: string) => {
    let list: any[] = [...(rows as any)[table]];
    const q: any = {
      select: () => q,
      is: (c: string, v: null) => { list = list.filter((r) => r[c] === v); return q; },
      eq: (c: string, v: unknown) => { if (!c.includes('.')) list = list.filter((r) => r[c] === v); return q; },
      contains: (c: string, v: string[]) => { list = list.filter((r) => v.every((x) => (r[c] ?? []).includes(x))); return q; },
      ilike: (c: string, pattern: string) => {
        const needle = pattern.replace(/^%|%$/g, '').toLowerCase();
        list = list.filter((r) => String(r[c]).toLowerCase().includes(needle));
        return q;
      },
      order: (c: string) => { list.sort((a, b) => a[c] - b[c]); return q; },
      range: (a: number, b: number) => { const count = list.length; list = list.slice(a, b + 1); return Promise.resolve({ data: list, error: null, count }); },
      maybeSingle: () => Promise.resolve({ data: list[0] ?? null, error: null }),
      then: (ok: any, bad: any) => Promise.resolve({ data: list, error: null }).then(ok, bad),
    };
    return q;
  };
  return { supabase: { from: builder } };
});
jest.mock('../modules/core/services/cache.service', () => ({
  CacheService: { get: async () => null, set: async () => undefined, del: async () => undefined, delPattern: async () => undefined },
}));

import { ProblemsService } from '../modules/learning/services/problems.service';
import { pickDaily } from '../modules/learning/services/practiceHelpers';

const list = (extra: object = {}) => ProblemsService.getProblems({ page: 1, limit: 50, ...extra }) as Promise<any>;

describe('practice list', () => {
  it('hides deleted problems', async () => {
    const r = await list();
    expect(r.problems.map((p: any) => p.slug)).toEqual(['two-sum', 'group-anagrams', 'trapping-rain-water']);
    expect(r.pagination.total).toBe(3);
  });

  it('filters by company', async () => {
    expect((await list({ company: 'Google' })).problems.map((p: any) => p.slug)).toEqual(['two-sum', 'trapping-rain-water']);
    expect((await list({ company: 'Uber', difficulty: 'medium' })).problems.map((p: any) => p.slug)).toEqual(['group-anagrams']);
  });

  it('searches titles by any part of the name', async () => {
    expect((await list({ search: 'anag' })).problems.map((p: any) => p.slug)).toEqual(['group-anagrams']);
    expect((await list({ search: 'sum' })).problems.map((p: any) => p.slug)).toEqual(['two-sum']);
  });

  it('lists companies, most problems first, ignoring deleted problems', async () => {
    const r: any = await ProblemsService.getCompanies();
    expect(r.companies).toEqual([{ name: 'Amazon', count: 2 }, { name: 'Google', count: 2 }, { name: 'Uber', count: 1 }]);
  });

  it('picks a free problem for the day, with solved flags for the learner', async () => {
    const now = new Date('2026-10-09T06:00:00Z');
    const expected = pickDaily(rows.problems.filter((p) => !p.is_premium && !p.deleted_at), '2026-10-09')!;
    const anon: any = await ProblemsService.getDaily(undefined, now);
    expect(anon).toMatchObject({ date: '2026-10-09', solved: false, solved_today: false });
    expect(anon.problem.slug).toBe(expected.slug);

    rows.user_problem_status.push({ user_id: 'u1', problem_id: expected.id, status: 'solved', solved_at: '2026-10-09T02:00:00Z' });
    expect(await ProblemsService.getDaily('u1', now)).toMatchObject({ solved: true, solved_today: true });
    rows.user_problem_status[0].solved_at = '2026-10-01T02:00:00Z';
    expect(await ProblemsService.getDaily('u1', now)).toMatchObject({ solved: true, solved_today: false });
    expect(await ProblemsService.getDaily('u2', now)).toMatchObject({ solved: false });
  });
});
