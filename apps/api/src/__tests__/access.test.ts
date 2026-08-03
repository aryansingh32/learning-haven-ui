import { pool } from '../config/database';
import redis from '../config/redis';
import { accessService } from '../modules/entitlements/access.service';

jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const mockQuery = pool.query as jest.Mock;

describe('AccessService', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const courseId = '00000000-0000-0000-0000-000000000101';

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockResolvedValue(null);
  });

  it('allows a free user to access an assigned free course', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'free-plan', slug: 'free', name: 'Free' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const result = await accessService.canAccess(userId, 'course', courseId);

    expect(result.allowed).toBe(true);
  });

  it('denies a free user access to a pro-only course with upgrade metadata', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'free-plan', slug: 'free', name: 'Free' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ required_plan_slug: 'pro', required_plan_name: 'Pro', required_plan_price: 79900 }],
      });

    const result = await accessService.canAccess(userId, 'course', courseId);

    expect(result).toEqual({
      allowed: false,
      requiredPlanSlug: 'pro',
      requiredPlanName: 'Pro',
      requiredPlanPrice: 79900,
    });
  });

  it('allows a pro user to access an assigned course', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'pro-plan', slug: 'pro', name: 'Pro' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const result = await accessService.canAccess(userId, 'course', courseId);

    expect(result.allowed).toBe(true);
  });

  it('allows feature use within daily limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'free-plan', slug: 'free', name: 'Free' }] })
      .mockResolvedValueOnce({ rows: [{ feature_limit: 5 }] });
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('4');

    const result = await accessService.canUseFeature(userId, 'ai_queries_per_day');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('denies the 6th free AI query and returns the limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'free-plan', slug: 'free', name: 'Free' }] })
      .mockResolvedValueOnce({ rows: [{ feature_limit: 5 }] })
      .mockResolvedValueOnce({
        rows: [{ required_plan_slug: 'pro', required_plan_name: 'Pro', required_plan_price: 79900 }],
      });
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('5');

    const result = await accessService.canUseFeature(userId, 'ai_queries_per_day');

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(5);
    expect(result.requiredPlanSlug).toBe('pro');
  });

  it('unlimited feature never denies', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'pro-plan', slug: 'pro', name: 'Pro' }] })
      .mockResolvedValueOnce({ rows: [{ feature_limit: -1 }] });

    const result = await accessService.canUseFeature(userId, 'ai_queries_per_day');

    expect(result).toEqual({ allowed: true, featureKey: 'ai_queries_per_day', limit: -1, remaining: -1 });
  });

  it('consumes usage atomically', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ plan_id: 'free-plan', slug: 'free', name: 'Free' }] })
      .mockResolvedValueOnce({ rows: [{ feature_limit: 5 }] });
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('2');
    (redis.incr as jest.Mock).mockResolvedValueOnce(3);

    const result = await accessService.consumeFeatureUsage(userId, 'ai_queries_per_day');

    expect(redis.incr).toHaveBeenCalled();
    expect(result.used).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it('invalidateUserCache clears Redis keys', async () => {
    await accessService.invalidateUserCache(userId);

    expect(redis.del).toHaveBeenCalledWith(`content_entitlements:${userId}`);
    expect(redis.del).toHaveBeenCalledWith(`user_plan:${userId}`);
    expect(redis.del).toHaveBeenCalledWith(`entitlements:${userId}`);
  });
});
