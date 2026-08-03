import request from 'supertest';
import { pool } from '../config/database';

// Mock database pool & supabase auth
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'testuser@learninghaven.dev' } },
        error: null,
      }),
    },
  },
}));

import { EntitlementsService } from '../modules/entitlements/entitlements.service';
import { EntitlementsRepository } from '../modules/entitlements/entitlements.repository';
import { requireEntitlement, requireAndConsumeEntitlement } from '../modules/entitlements/entitlements.middleware';
import redis from '../config/redis';
import app from '../app';
import { TEST_USER, authHeaders } from './setup';

const mockQuery = pool.query as jest.Mock;

describe('Entitlements Service & Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset redis mocks
    (redis.get as jest.Mock).mockReset();
    (redis.incr as jest.Mock).mockReset();
    (redis.expire as jest.Mock).mockReset();
    (redis.decr as jest.Mock).mockReset();
  });

  describe('Entitlements Repository', () => {
    it('should return default free entitlements if no active subscription', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // s.status = 'active'
      mockQuery.mockResolvedValueOnce({
        rows: [
          { feature_key: 'ai_queries_per_day', entitlement_type: 'numeric_limit', numeric_value: 5, label: 'AI queries' }
        ]
      }); // entitlements for free plan
      mockQuery.mockResolvedValueOnce({ rows: [] }); // direct user/resource entitlements

      const info = await EntitlementsRepository.getUserPlanAndEntitlements(TEST_USER.id);
      expect(info.planSlug).toBe('free');
      expect(info.entitlements).toHaveLength(1);
      expect(info.entitlements[0].featureKey).toBe('ai_queries_per_day');
    });

    it('should return subscription entitlements if active', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { plan_id: 'pro-uuid', plan_slug: 'pro', plan_name: 'Pro', subscription_id: 'sub-1', subscription_status: 'active' }
        ]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { feature_key: 'career_paths_access', entitlement_type: 'boolean', bool_value: true, label: 'Career Paths' }
        ]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const info = await EntitlementsRepository.getUserPlanAndEntitlements(TEST_USER.id);
      expect(info.planSlug).toBe('pro');
      expect(info.entitlements[0].featureKey).toBe('career_paths_access');
      expect(info.entitlements[0].boolValue).toBe(true);
    });
  });

  describe('Entitlements Service', () => {
    it('should allow boolean entitlement when true', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'career_paths_access', entitlement_type: 'boolean', bool_value: true }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await EntitlementsService.checkEntitlement(TEST_USER.id, 'career_paths_access');
      expect(res.allowed).toBe(true);
    });

    it('should deny and return upgrade info when feature not owned', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'free', plan_name: 'Free' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'ai_queries_per_day', entitlement_type: 'numeric_limit', numeric_value: 5 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock upgrade lookup query
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro', price_monthly: 9900 }]
      });

      const res = await EntitlementsService.checkEntitlement(TEST_USER.id, 'career_paths_access');
      expect(res.allowed).toBe(false);
      expect(res.upgradeRequiredPlan).toBe('pro');
      expect(res.upgradePrice).toBe(9900);
    });

    it('should handle redis daily consumption', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'free', plan_name: 'Free' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'ai_queries_per_day', entitlement_type: 'numeric_limit', numeric_value: 5 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      (redis.incr as jest.Mock).mockResolvedValueOnce(3); // 3rd query of the day

      const res = await EntitlementsService.checkAndConsumeUsage(TEST_USER.id, 'ai_queries_per_day');
      expect(res.allowed).toBe(true);
      expect(res.used).toBe(3);
      expect(res.remaining).toBe(2);
    });

    it('should deny and decrement back if usage exceeds limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'free', plan_name: 'Free' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'ai_queries_per_day', entitlement_type: 'numeric_limit', numeric_value: 5 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock upgrade query
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro', price_monthly: 9900 }]
      });

      (redis.incr as jest.Mock).mockResolvedValueOnce(6); // 6th query (limit is 5)
      (redis.decr as jest.Mock).mockResolvedValueOnce(5);

      const res = await EntitlementsService.checkAndConsumeUsage(TEST_USER.id, 'ai_queries_per_day');
      expect(res.allowed).toBe(false);
      expect(redis.decr).toHaveBeenCalled();
      expect(res.upgradeRequiredPlan).toBe('pro');
    });

    it('should check build challenge enrollments count for challenge_limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'free', plan_name: 'Free' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'challenge_limit', entitlement_type: 'numeric_limit', numeric_value: 3 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Count started challenges in DB
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '2' }]
      });

      const res = await EntitlementsService.checkEntitlement(TEST_USER.id, 'challenge_limit');
      expect(res.allowed).toBe(true);
      expect(res.used).toBe(2);
      expect(res.remaining).toBe(1);
    });
  });

  describe('Middleware', () => {
    it('should allow request to proceed if entitlement allowed', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'career_paths_access', entitlement_type: 'boolean', bool_value: true }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const req: any = { user: { id: TEST_USER.id } };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireEntitlement('career_paths_access');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 structured response on denial', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'free', plan_name: 'Free' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ feature_key: 'career_paths_access', entitlement_type: 'boolean', bool_value: false }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro', price_monthly: 9900 }]
      });

      const req: any = { user: { id: TEST_USER.id } };
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = requireEntitlement('career_paths_access');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'ENTITLEMENT_DENIED',
            details: expect.objectContaining({
              upgradeRequired: true,
              upgradeRequiredPlan: 'pro',
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/entitlements/map returns entitlements map', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ plan_slug: 'pro', plan_name: 'Pro' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { feature_key: 'career_paths_access', entitlement_type: 'boolean', bool_value: true },
          { feature_key: 'ai_queries_per_day', entitlement_type: 'numeric_limit', numeric_value: -1 }
        ]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/entitlements/map')
        .set(authHeaders(TEST_USER.id));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.career_paths_access.allowed).toBe(true);
      expect(res.body.data._plan.slug).toBe('pro');
    });
  });
});
