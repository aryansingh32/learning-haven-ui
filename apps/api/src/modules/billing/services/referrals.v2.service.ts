import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { Queue } from 'bullmq';
import redis from '../../../config/redis';

const monetizationQueue = new Queue('monetization', {
  connection: redis,
});

export class ReferralsV2Service {
  /**
   * Get or create a referral code for a user.
   */
  static async getOrCreateReferralCode(userId: string): Promise<{ code: string; isCustom: boolean }> {
    const res = await pool.query(`SELECT code, is_custom FROM public.referral_codes WHERE user_id = $1 LIMIT 1`, [userId]);
    if (res.rows.length > 0) {
      return { code: res.rows[0].code, isCustom: res.rows[0].is_custom };
    }

    const newCode = Array.from(Array(8), () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();
    const insertRes = await pool.query(
      `INSERT INTO public.referral_codes (user_id, code) VALUES ($1, $2) RETURNING code, is_custom`,
      [userId, newCode]
    );
    return { code: insertRes.rows[0].code, isCustom: insertRes.rows[0].is_custom };
  }

  /**
   * Apply referral code during signup.
   */
  static async applyReferralOnSignup(
    referredUserId: string,
    referralCode: string,
    signupIp?: string,
    deviceFingerprint?: string
  ) {
    const codeRes = await pool.query(`SELECT id, user_id FROM public.referral_codes WHERE code = $1 AND is_active = true`, [referralCode.toUpperCase()]);
    if (codeRes.rows.length === 0) return { success: false, reason: 'Invalid code' };
    
    const referrerId = codeRes.rows[0].user_id;
    if (referrerId === referredUserId) return { success: false, reason: 'Cannot refer self' };

    const referrerRes = await pool.query(`SELECT created_at FROM public.users WHERE id = $1`, [referrerId]);
    if (referrerRes.rows.length === 0) return { success: false, reason: 'Referrer not found' };
    
    const referrerAgeDays = (Date.now() - new Date(referrerRes.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (referrerAgeDays < 7) return { success: false, reason: 'Referrer account must be 7 days old' };

    const existingRef = await pool.query(`SELECT id FROM public.referrals WHERE referred_user_id = $1`, [referredUserId]);
    if (existingRef.rows.length > 0) return { success: false, reason: 'Already referred' };

    const { score: fraudScore, reasons: fraudReasons } = await this.calculateFraudScore(referrerId, signupIp, deviceFingerprint);
    // Score >= 70 means suspicious (max from IP+device = 40+30 = 70, so >= catches it)
    const status = fraudScore >= 70 ? 'suspicious' : 'pending';

    await pool.query(
      `INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code_id, referral_code_used, status, fraud_score, fraud_reasons, signup_ip, signup_device_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [referrerId, referredUserId, codeRes.rows[0].id, referralCode, status, fraudScore, JSON.stringify(fraudReasons), signupIp, deviceFingerprint]
    );

    await pool.query(`UPDATE public.users SET referred_by = $1 WHERE id = $2`, [referrerId, referredUserId]);

    return { success: true, status };
  }

  /**
   * Activate referral after payment is captured.
   */
  static async activateReferralAfterPayment(paymentId: string) {
    const paymentRes = await pool.query(`SELECT user_id, final_amount FROM public.payments WHERE id = $1`, [paymentId]);
    if (paymentRes.rows.length === 0) return;
    const { user_id: referredUserId, final_amount } = paymentRes.rows[0];

    // Note: Free plans don't trigger this because final_amount = 0 and no payment record is created 
    // unless they use 100% off coupon. Even then, we can check final_amount.
    if (final_amount === 0) return; 

    const refRes = await pool.query(
      `SELECT id, status FROM public.referrals WHERE referred_user_id = $1 AND status = 'pending'`,
      [referredUserId]
    );
    if (refRes.rows.length === 0) return;
    const referralId = refRes.rows[0].id;

    const creditEligibleAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await pool.query(
      `UPDATE public.referrals SET payment_id = $1, credit_eligible_at = $2, updated_at = NOW() WHERE id = $3`,
      [paymentId, creditEligibleAt.toISOString(), referralId]
    );

    // Enqueue delayed job to credit commission in 7 days
    await monetizationQueue.add(
      'referral.credit-commission',
      { referralId },
      { delay: 7 * 24 * 60 * 60 * 1000 }
    );

    return { referralId, creditEligibleAt };
  }

  /**
   * Credit the referral commission to the referrer's wallet.
   */
  static async creditReferralCommission(referralId: string) {
    const refRes = await pool.query(
      `SELECT r.*, p.status as payment_status, p.final_amount, rc.custom_commission_pct, rc.custom_commission_fixed
       FROM public.referrals r
       JOIN public.payments p ON p.id = r.payment_id
       LEFT JOIN public.referral_codes rc ON rc.id = r.referral_code_id
       WHERE r.id = $1`,
      [referralId]
    );
    
    if (refRes.rows.length === 0) return;
    const ref = refRes.rows[0];

    if (ref.status !== 'pending' && ref.status !== 'suspicious') return;
    
    if (ref.payment_status === 'refunded') {
      await pool.query(`UPDATE public.referrals SET status = 'expired', updated_at = NOW() WHERE id = $1`, [referralId]);
      return;
    }

    let commissionAmt = 0;
    let appliedPct = 0;

    if (ref.custom_commission_fixed != null) {
      commissionAmt = ref.custom_commission_fixed;
    } else {
      appliedPct = ref.custom_commission_pct != null ? ref.custom_commission_pct : await this.getCommissionPctForUser(ref.referrer_id);
      commissionAmt = Math.floor(ref.final_amount * appliedPct / 100);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userRes = await client.query(`SELECT wallet_balance FROM public.users WHERE id = $1 FOR UPDATE`, [ref.referrer_id]);
      if (userRes.rows.length === 0) throw new Error('Referrer not found');

      await client.query(
        `UPDATE public.users SET wallet_balance = wallet_balance + $1, total_referral_earnings = total_referral_earnings + $1 WHERE id = $2`,
        [commissionAmt, ref.referrer_id]
      );

      await client.query(
        `UPDATE public.referrals SET status = 'active', earned_amount = $1, commission_pct = $2, credited_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [commissionAmt, appliedPct, referralId]
      );

      await client.query(
        `UPDATE public.referral_codes SET total_referrals = total_referrals + 1, total_earnings = total_earnings + $1 WHERE id = $2`,
        [commissionAmt, ref.referral_code_id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('creditReferralCommission error', err);
    } finally {
      client.release();
    }
  }

  /**
   * Request UPI withdrawal.
   */
  static async requestWithdrawal(userId: string, amount: number, upiId: string) {
    if (amount < 10000) throw new Error('Minimum withdrawal is ₹100');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(`SELECT wallet_balance FROM public.users WHERE id = $1 FOR UPDATE`, [userId]);
      const balance = userRes.rows[0]?.wallet_balance || 0;
      
      if (balance < amount) throw new Error('Insufficient wallet balance');

      await client.query(`UPDATE public.users SET wallet_balance = wallet_balance - $1 WHERE id = $2`, [amount, userId]);
      
      const withRes = await client.query(
        `INSERT INTO public.withdrawals (user_id, amount, upi_id, status) VALUES ($1, $2, $3, 'pending') RETURNING *`,
        [userId, amount, upiId]
      );

      await client.query('COMMIT');
      return withRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Analytics & History

  static async getEarnings(userId: string) {
    const userRes = await pool.query(`SELECT wallet_balance, total_referral_earnings FROM public.users WHERE id = $1`, [userId]);
    const refCountRes = await pool.query(`SELECT status, COUNT(*) as count FROM public.referrals WHERE referrer_id = $1 GROUP BY status`, [userId]);
    const tiersRes = await pool.query(`SELECT * FROM public.referral_commission_tiers WHERE is_active = true ORDER BY sort_order ASC`);
    
    let activeCount = 0;
    let pendingCount = 0;
    refCountRes.rows.forEach(r => {
      if (r.status === 'active') activeCount = parseInt(r.count, 10);
      if (r.status === 'pending') pendingCount = parseInt(r.count, 10);
    });

    const currentTier = tiersRes.rows.find(t => activeCount >= t.min_referrals && (!t.max_referrals || activeCount <= t.max_referrals)) || tiersRes.rows[0];

    return {
      walletBalance: userRes.rows[0]?.wallet_balance || 0,
      totalEarnings: userRes.rows[0]?.total_referral_earnings || 0,
      activeReferrals: activeCount,
      pendingReferrals: pendingCount,
      currentTier,
      tiers: tiersRes.rows
    };
  }

  static async getMyReferrals(userId: string) {
    const res = await pool.query(
       `SELECT r.id, r.status, r.earned_amount, r.created_at, r.credit_eligible_at, u.full_name
       FROM public.referrals r
       JOIN public.users u ON u.id = r.referred_user_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({
      ...r,
      // full_name is the canonical column; gracefully abbreviate the last word
      name: (() => {
        const parts = (r.full_name || '').trim().split(' ');
        if (parts.length === 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      })()
    }));
  }

  static async getWithdrawalHistory(userId: string) {
    const res = await pool.query(`SELECT * FROM public.withdrawals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    return res.rows;
  }

  static async getLeaderboard() {
    const cached = await CacheService.get('referral:leaderboard');
    if (cached) return cached;

    const res = await pool.query(
      `SELECT u.first_name, u.last_name, u.total_referral_earnings, 
         (SELECT COUNT(*) FROM public.referrals r WHERE r.referrer_id = u.id AND r.status = 'active') as referral_count
       FROM public.users u
       WHERE u.total_referral_earnings > 0
       ORDER BY u.total_referral_earnings DESC
       LIMIT 20`
    );

    const mapped = res.rows.map((r, i) => ({
      rank: i + 1,
      name: `${r.first_name} ${r.last_name ? r.last_name[0] + '.' : ''}`,
      earnings: r.total_referral_earnings,
      referrals: r.referral_count
    }));

    await CacheService.set('referral:leaderboard', mapped, 3600);
    return mapped;
  }

  // Private helpers

  private static async getCommissionPctForUser(userId: string) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM public.referrals WHERE referrer_id = $1 AND status = 'active'`, [userId]);
    const count = parseInt(countRes.rows[0].count, 10);
    
    const tierRes = await pool.query(
      `SELECT commission_pct FROM public.referral_commission_tiers WHERE min_referrals <= $1 AND (max_referrals IS NULL OR max_referrals >= $1) ORDER BY sort_order DESC LIMIT 1`,
      [count]
    );
    return tierRes.rows.length > 0 ? tierRes.rows[0].commission_pct : 10;
  }

  private static async calculateFraudScore(referrerId: string, ip?: string, fingerprint?: string) {
    let score = 0;
    const reasons: string[] = [];

    if (ip) {
      const ipRes = await pool.query(`SELECT id FROM public.referrals WHERE referrer_id = $1 AND signup_ip = $2`, [referrerId, ip]);
      if (ipRes.rows.length > 0) {
        score += 40;
        reasons.push('Same IP as previous referral');
      }
    }

    if (fingerprint) {
      const fpRes = await pool.query(`SELECT id FROM public.referrals WHERE referrer_id = $1 AND signup_device_fingerprint = $2`, [referrerId, fingerprint]);
      if (fpRes.rows.length > 0) {
        score += 30;
        reasons.push('Same device as previous referral');
      }
    }

    const velocityRes = await pool.query(`SELECT COUNT(*) FROM public.referrals WHERE referrer_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [referrerId]);
    if (parseInt(velocityRes.rows[0].count, 10) >= 3) {
      score += 30;
      reasons.push('High referral velocity (>3 per hour)');
    }

    return { score, reasons };
  }
}
