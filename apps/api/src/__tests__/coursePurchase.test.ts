import { pool } from '../config/database';

// Mock database pool & supabase auth
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
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

import { PaymentsV2Service } from '../modules/billing/services/payments.v2.service';
import razorpay from '../config/razorpay';
import { TEST_USER } from './setup';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

const COURSE_ID = '40000000-0000-4000-a000-000000000001';

type CourseOverrides = Partial<{
  price_inr: number | null;
  original_price_inr: number | null;
  is_free: boolean;
  is_published: boolean;
}>;

/**
 * Wire pool.query for the createCourseOrder path: the course lookup, the
 * "already owned" check, and the payment insert.
 */
function mockCourseLookup(overrides: CourseOverrides = {}, alreadyOwned = false) {
  const course = {
    id: COURSE_ID,
    title: 'DSA Interview Track',
    slug: 'dsa-interview-track',
    price_inr: 49900,
    original_price_inr: 99900,
    is_free: false,
    is_published: true,
    ...overrides,
  };

  mockQuery.mockImplementation((sql: string) => {
    const s = sql.toLowerCase();
    if (s.includes('from public.courses')) return Promise.resolve({ rows: [course] });
    if (s.includes('from public.user_entitlements')) {
      return Promise.resolve({ rows: alreadyOwned ? [{ '?column?': 1 }] : [] });
    }
    if (s.includes('insert into public.payments')) {
      return Promise.resolve({ rows: [{ id: 'payment-1' }] });
    }
    return Promise.resolve({ rows: [] });
  });

  return course;
}

describe('Single-course purchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
    (razorpay.orders.create as jest.Mock).mockResolvedValue({ id: 'order_course_123' });
  });

  describe('createCourseOrder', () => {
    it('prices the order from the course record, not from a plan', async () => {
      mockCourseLookup();

      const order = await PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID);

      expect(order.amount).toBe(49900);
      expect(order.finalAmount).toBe(49900);
      expect(order.course).toEqual({
        id: COURSE_ID,
        title: 'DSA Interview Track',
        slug: 'dsa-interview-track',
      });
      expect(order.razorpayOrderId).toBe('order_course_123');
    });

    it('records the course as the purchased resource and leaves plan_id null', async () => {
      mockCourseLookup();

      await PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID);

      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.toLowerCase().includes('insert into public.payments')
      );
      expect(insertCall).toBeDefined();

      const [sql, params] = insertCall as [string, any[]];
      // plan_id is written as a literal NULL in the statement.
      expect(sql).toContain('NULL');
      const metadata = params[params.length - 1];
      expect(metadata).toMatchObject({
        purchase_kind: 'resource',
        resource_type: 'course',
        resource_id: COURSE_ID,
      });
    });

    it('refuses a free course', async () => {
      mockCourseLookup({ is_free: true });

      await expect(
        PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID)
      ).rejects.toThrow('This course is free — no purchase is required');
    });

    it('refuses an unpublished course', async () => {
      mockCourseLookup({ is_published: false });

      await expect(
        PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID)
      ).rejects.toThrow('This course is not available for purchase');
    });

    it('refuses a course with no standalone price (plan-only)', async () => {
      mockCourseLookup({ price_inr: null });

      await expect(
        PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID)
      ).rejects.toThrow('This course is not individually purchasable');
    });

    it('refuses to charge twice for a course the learner already owns', async () => {
      mockCourseLookup({}, true);

      await expect(
        PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID)
      ).rejects.toThrow('You already have access to this course');
      expect(razorpay.orders.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown course', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(
        PaymentsV2Service.createCourseOrder(TEST_USER.id, COURSE_ID)
      ).rejects.toThrow('Course not found');
    });
  });

  describe('verifyAndActivate for a standalone course purchase', () => {
    beforeEach(() => {
      mockClientQuery.mockImplementation((sql: string) => {
        const s = sql.toLowerCase();
        if (s.includes('select * from public.payments')) {
          return Promise.resolve({
            rows: [{
              id: 'pay-course-1',
              user_id: TEST_USER.id,
              // A standalone course purchase carries no plan.
              plan_id: null,
              status: 'created',
              final_amount: 49900,
              billing_cycle: 'one_time',
              description: 'DSA Interview Track',
              metadata: { resource_type: 'course', resource_id: COURSE_ID },
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('grants course access without creating a subscription', async () => {
      const res = await PaymentsV2Service.verifyAndActivate(
        TEST_USER.id, 'order_course_123', 'pay_123', 'sig_123'
      );

      expect(res.success).toBe(true);
      expect(res.plan).toBeNull();
      expect(res.subscriptionId).toBeNull();
      expect(res.resource).toEqual({ type: 'course', id: COURSE_ID });

      // No subscription row for a one-off course purchase.
      const insertedSubscription = mockClientQuery.mock.calls.some(([sql]: [string]) =>
        sql.toLowerCase().includes('insert into public.subscriptions')
      );
      expect(insertedSubscription).toBe(false);
    });

    it('grants permanent access — the entitlement does not expire', async () => {
      await PaymentsV2Service.verifyAndActivate(
        TEST_USER.id, 'order_course_123', 'pay_123', 'sig_123'
      );

      const entitlementCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.toLowerCase().includes('insert into public.user_entitlements')
      );
      expect(entitlementCall).toBeDefined();

      const params = (entitlementCall as [string, any[]])[1];
      // [userId, feature, resourceType, resourceId, label, paymentId, subId, expiresAt, metadata]
      expect(params[1]).toBe('course_access');
      expect(params[2]).toBe('course');
      expect(params[3]).toBe(COURSE_ID);
      expect(params[7]).toBeNull();
    });

    it('commits the transaction', async () => {
      await PaymentsV2Service.verifyAndActivate(
        TEST_USER.id, 'order_course_123', 'pay_123', 'sig_123'
      );

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('rejects a payment that names neither a plan nor a resource', async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        const s = sql.toLowerCase();
        if (s.includes('select * from public.payments')) {
          return Promise.resolve({
            rows: [{
              id: 'pay-orphan',
              user_id: TEST_USER.id,
              plan_id: null,
              status: 'created',
              final_amount: 100,
              billing_cycle: 'one_time',
              metadata: {},
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        PaymentsV2Service.verifyAndActivate(TEST_USER.id, 'order_x', 'pay_x', 'sig_x')
      ).rejects.toThrow('Payment references neither a plan nor a purchasable resource');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
