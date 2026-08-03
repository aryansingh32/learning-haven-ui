import request from 'supertest';
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
import app from '../app';
import { TEST_USER, authHeaders } from './setup';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

describe('Payments V2 Service & Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    
    // Set up default pool.query behavior to prevent unhandled queries
    mockQuery.mockImplementation((sql: string, params?: any[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes('select * from public.plans') || sqlLower.includes('select id, name, slug')) {
        return Promise.resolve({
          rows: [{ id: params?.[0] || 'plan-1', name: 'Pro', slug: 'pro', price_monthly: 9900, features: [] }]
        });
      }
      if (sqlLower.includes('insert into public.payments')) {
        return Promise.resolve({
          rows: [{ id: 'payment-id-123' }]
        });
      }
      if (sqlLower.includes('select * from public.coupons')) {
        if (params?.[0] === 'BADCOUPON') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({
          rows: [{ id: 'coupon-1', code: params?.[0] || 'PROMO50', type: 'percentage', value: 50, is_active: true }]
        });
      }
      if (sqlLower.includes('select 1 from public.coupon_usages')) {
        return Promise.resolve({ rows: [] });
      }
      if (sqlLower.includes('update public.subscriptions set cancel_at_period_end = true')) {
        return Promise.resolve({
          rows: [{ id: 'sub-1', user_id: TEST_USER.id, cancel_at_period_end: true }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
    
    // Set up default client.query behavior
    mockClientQuery.mockImplementation((sql: string, params?: any[]) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes('select * from public.payments')) {
        return Promise.resolve({
          rows: [{ id: 'pay-1', user_id: TEST_USER.id, plan_id: 'plan-1', status: 'created', final_amount: 9900, billing_cycle: 'monthly', coupon_id: 'coupon-1', discount_amount: 4950 }]
        });
      }
      if (sqlLower.includes('select slug, name from public.plans')) {
        return Promise.resolve({
          rows: [{ slug: 'pro', name: 'Pro' }]
        });
      }
      if (sqlLower.includes('insert into public.subscriptions')) {
        return Promise.resolve({
          rows: [{ id: 'sub-123' }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  describe('createOrder', () => {
    it('should create a Razorpay order without coupon successfully', async () => {
      const planId = '30000000-0000-4000-a000-000000000001';
      const order = await PaymentsV2Service.createOrder(TEST_USER.id, planId, 'monthly');
      expect(order.orderId).toBe('payment-id-123');
      expect(order.finalAmount).toBe(9900); // 9900 paise
      expect(razorpay.orders.create).toHaveBeenCalled();
    });

    it('should apply a percentage coupon successfully', async () => {
      const planId = '30000000-0000-4000-a000-000000000001';
      const order = await PaymentsV2Service.createOrder(TEST_USER.id, planId, 'monthly', 'PROMO50');
      expect(order.discountAmount).toBe(4950); // 50% of 9900
      expect(order.finalAmount).toBe(4950); // base (9900) - discount (4950) = 4950
    });

    it('should throw error for invalid coupon', async () => {
      const planId = '30000000-0000-4000-a000-000000000001';
      await expect(
        PaymentsV2Service.createOrder(TEST_USER.id, planId, 'monthly', 'BADCOUPON')
      ).rejects.toThrow('Invalid or inactive coupon');
    });
  });

  describe('verifyAndActivate', () => {
    it('should verify payment and activate subscription', async () => {
      const razorpayOrderId = 'order_test_123';
      const razorpayPaymentId = 'pay_test_456';
      const razorpaySignature = 'signature_789';

      const res = await PaymentsV2Service.verifyAndActivate(
        TEST_USER.id,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      expect(res.success).toBe(true);
      expect(res.subscriptionId).toBe('sub-123');
      expect(res.plan.slug).toBe('pro');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const sub = await PaymentsV2Service.cancelSubscription(TEST_USER.id, 'No longer needed');
      expect(sub.cancel_at_period_end).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.subscriptions SET cancel_at_period_end = true'),
        ['No longer needed', TEST_USER.id]
      );
    });
  });

  describe('API Endpoints', () => {
    it('POST /api/v2/payments/create-order creates order', async () => {
      const planId = '30000000-0000-4000-a000-000000000001';
      const res = await request(app)
        .post('/api/v2/payments/create-order')
        .set(authHeaders(TEST_USER.id))
        .send({
          plan_id: planId,
          billing_cycle: 'monthly'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.finalAmount).toBe(9900);
    });

    it('POST /api/v2/payments/verify verifies payment', async () => {
      const res = await request(app)
        .post('/api/v2/payments/verify')
        .set(authHeaders(TEST_USER.id))
        .send({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'sig_123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
