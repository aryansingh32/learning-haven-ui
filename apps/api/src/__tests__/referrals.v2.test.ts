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

import { ReferralsV2Service } from '../modules/billing/services/referrals.v2.service';
import redis from '../config/redis';
import app from '../app';
import { TEST_USER, authHeaders } from './setup';

const mockQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

describe('Referrals V2 Service & Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
  });

  describe('getOrCreateReferralCode', () => {
    it('should return existing code if available', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ code: 'EXISTING', is_custom: false }]
      });

      const res = await ReferralsV2Service.getOrCreateReferralCode(TEST_USER.id);
      expect(res.code).toBe('EXISTING');
      expect(res.isCustom).toBe(false);
    });

    it('should generate and save new code if none exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // not found
      mockQuery.mockResolvedValueOnce({
        rows: [{ code: 'NEWCODE1', is_custom: false }] // insert result
      });

      const res = await ReferralsV2Service.getOrCreateReferralCode(TEST_USER.id);
      expect(res.code).toBe('NEWCODE1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.referral_codes'),
        [TEST_USER.id, expect.any(String)]
      );
    });
  });

  describe('applyReferralOnSignup', () => {
    it('should successfully apply referral code', async () => {
      const referrerId = 'referrer-123';
      const referredId = TEST_USER.id;

      // 1. SELECT referral_code
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'rc-1', user_id: referrerId }]
      });
      // 2. SELECT referrer age
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }] // 10 days old
      });
      // 3. SELECT existing referral for referred user
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 4. IP check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 5. Device check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 6. Velocity check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // 7. INSERT referral
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 8. UPDATE user referred_by
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await ReferralsV2Service.applyReferralOnSignup(referredId, 'REFCODE1', '192.168.1.1', 'fingerprint123');
      expect(res.success).toBe(true);
      expect(res.status).toBe('pending');
    });

    it('should flag as suspicious and set status to suspicious on high fraud score', async () => {
      const referrerId = 'referrer-123';
      const referredId = TEST_USER.id;

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'rc-1', user_id: referrerId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // IP check -> Matches previous referral (adds 40)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'prev-ref-ip' }] });
      // Device check -> Matches previous referral (adds 30)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'prev-ref-fp' }] });
      // Velocity check -> High velocity (adds 30)
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] }); // total score = 100 > 70
      
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await ReferralsV2Service.applyReferralOnSignup(referredId, 'REFCODE1', '192.168.1.1', 'fingerprint123');
      expect(res.success).toBe(true);
      expect(res.status).toBe('suspicious');
    });
  });

  describe('creditReferralCommission', () => {
    it('should credit commission successfully using active tier', async () => {
      const referrerId = 'referrer-123';
      const referralId = 'ref-1';

      // 1. SELECT referral details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: referralId,
          referrer_id: referrerId,
          payment_id: 'pay-1',
          status: 'pending',
          payment_status: 'captured',
          final_amount: 9900,
          custom_commission_pct: null,
          custom_commission_fixed: null,
          referral_code_id: 'rc-1'
        }]
      });
      // 2. Count referrer sales for tier calculation
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '6' }] // 6 sales = Silver tier (15%)
      });
      // 3. SELECT tier percentage
      mockQuery.mockResolvedValueOnce({
        rows: [{ commission_pct: 15 }]
      });

      // DB Transaction Mocks using query matching
      mockClientQuery.mockImplementation((sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select wallet_balance')) {
          return Promise.resolve({ rows: [{ wallet_balance: 1000 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await ReferralsV2Service.creditReferralCommission(referralId);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.users SET wallet_balance = wallet_balance + $1'),
        [1485, referrerId] // 15% of 9900 = 1485 paise
      );
    });
  });

  describe('requestWithdrawal', () => {
    it('should reject requests under ₹100', async () => {
      await expect(
        ReferralsV2Service.requestWithdrawal(TEST_USER.id, 5000, 'test@upi')
      ).rejects.toThrow('Minimum withdrawal is ₹100');
    });

    it('should approve requests and deduct wallet balance successfully', async () => {
      // DB Transaction Mocks using query matching
      mockClientQuery.mockImplementation((sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select wallet_balance')) {
          return Promise.resolve({ rows: [{ wallet_balance: 15000 }] });
        }
        if (sqlLower.includes('insert into public.withdrawals')) {
          return Promise.resolve({
            rows: [{ id: 'with-1', amount: 10000, upi_id: 'test@upi', status: 'pending' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await ReferralsV2Service.requestWithdrawal(TEST_USER.id, 10000, 'test@upi');
      expect(res.status).toBe('pending');
      expect(res.amount).toBe(10000);
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/v2/referrals/earnings returns wallet and tier data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ wallet_balance: 5000, total_referral_earnings: 12000 }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { status: 'active', count: '4' },
          { status: 'pending', count: '1' }
        ]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'Bronze', commission_pct: 10, min_referrals: 0, max_referrals: 4 },
          { name: 'Silver', commission_pct: 15, min_referrals: 5, max_referrals: 14 }
        ]
      });

      const res = await request(app)
        .get('/api/v2/referrals/earnings')
        .set(authHeaders(TEST_USER.id));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.walletBalance).toBe(5000);
      expect(res.body.data.activeReferrals).toBe(4);
    });
  });
});
