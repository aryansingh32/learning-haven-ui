/**
 * Who may see a course and who gets its premium chapters: one rule for Learn
 * and Campus. The database is mocked; campus helpers are SQL-tested separately.
 */
jest.mock('../config/database', () => ({ pool: { query: jest.fn() }, supabase: {} }));
jest.mock('../modules/entitlements/entitlements.repository', () => ({
  EntitlementsRepository: { getUserPlanAndEntitlements: jest.fn() },
}));
jest.mock('../modules/entitlements/access.service', () => ({ accessService: { canAccess: jest.fn() } }));

import { pool } from '../config/database';
import { EntitlementsRepository } from '../modules/entitlements/entitlements.repository';
import { accessService } from '../modules/entitlements/access.service';
import { CourseAccessService } from '../modules/learning/services/courseAccess.service';

const q = pool.query as unknown as jest.Mock;
const plan = EntitlementsRepository.getUserPlanAndEntitlements as unknown as jest.Mock;
const grant = accessService.canAccess as unknown as jest.Mock;

/** Answer pool.query by SQL text. */
function db(answers: { currentPlan?: string; canSee?: boolean; licence?: boolean | 'missing' }) {
  q.mockImplementation(async (sql: string) => {
    if (sql.includes('current_plan')) return { rows: [{ current_plan: answers.currentPlan ?? 'free' }] };
    if (sql.includes('user_can_see_course')) return { rows: [{ ok: answers.canSee ?? false }] };
    if (sql.includes('user_has_course_licence')) {
      if (answers.licence === 'missing') throw Object.assign(new Error('function does not exist'), { code: '42883' });
      return { rows: [{ ok: answers.licence ?? false }] };
    }
    return { rows: [] };
  });
}

const premium = { id: 'c1', is_premium: true };
const publicCourse = { id: 'c1', is_premium: false, is_published: true, visibility: 'public', deleted_at: null };

beforeEach(() => {
  jest.clearAllMocks();
  plan.mockResolvedValue({ planSlug: 'free' });
  grant.mockResolvedValue({ allowed: false });
});

describe('premium access', () => {
  it('opens free courses for everyone', async () => {
    db({});
    expect(await CourseAccessService.hasPremiumAccess('u1', { id: 'c1', is_premium: false })).toBe(true);
  });

  it('opens premium courses with a subscription, or a plan set on the account by an admin', async () => {
    db({});
    plan.mockResolvedValue({ planSlug: 'pro' });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(true);
    plan.mockResolvedValue({ planSlug: 'free' });
    db({ currentPlan: 'pro' });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(true);
  });

  it('opens a premium course bought on its own or included in the plan', async () => {
    db({});
    grant.mockResolvedValue({ allowed: true });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(true);
  });

  it('opens a premium course through the learner\'s college licence', async () => {
    db({ licence: true });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(true);
  });

  it('stays locked without any of those, and when the campus helpers are not deployed yet', async () => {
    db({ licence: false });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(false);
    db({ licence: 'missing' });
    expect(await CourseAccessService.hasPremiumAccess('u1', premium)).toBe(false);
  });
});

describe('course visibility', () => {
  it('shows published public courses to anyone, signed in or not', async () => {
    db({});
    expect(await CourseAccessService.canSeeCourse(null, publicCourse)).toBe(true);
    expect(q).not.toHaveBeenCalled();
  });

  it('hides drafts and deleted courses from visitors', async () => {
    db({});
    expect(await CourseAccessService.canSeeCourse(null, { ...publicCourse, is_published: false })).toBe(false);
    expect(await CourseAccessService.canSeeCourse('u1', { ...publicCourse, deleted_at: '2026-01-01' })).toBe(false);
  });

  it('asks the campus rule for college courses', async () => {
    db({ canSee: true });
    expect(await CourseAccessService.canSeeCourse('u1', { ...publicCourse, visibility: 'batch' })).toBe(true);
    db({ canSee: false });
    expect(await CourseAccessService.canSeeCourse('u1', { ...publicCourse, visibility: 'org' })).toBe(false);
    expect(await CourseAccessService.canSeeCourse(null, { ...publicCourse, visibility: 'org' })).toBe(false);
  });
});
