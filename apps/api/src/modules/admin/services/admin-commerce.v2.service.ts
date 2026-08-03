import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';

export class AdminCommerceV2Service {
  /**
   * Plans Management
   */
  static async getPlans() {
    const res = await pool.query(`
      SELECT p.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pe.id,
              'feature_key', pe.feature_key,
              'label', pe.label,
              'entitlement_type', pe.entitlement_type,
              'bool_value', pe.bool_value,
              'numeric_value', pe.numeric_value,
              'resource_type', pe.resource_type,
              'resource_id', pe.resource_id,
              'description', pe.description
            )
          ) FILTER (WHERE pe.id IS NOT NULL),
          '[]'::json
        ) AS entitlements
      FROM public.plans p
      LEFT JOIN public.plan_entitlements pe ON pe.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.sort_order ASC
    `);
    return res.rows;
  }

  static async createPlan(data: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO public.plans (
           name, slug, description, tagline, price_monthly, price_annual,
           price_lifetime, price_one_time, is_active, is_highlighted,
           highlight_label, badge_color, features, sort_order, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          data.name,
          data.slug,
          data.description || null,
          data.tagline || null,
          data.price_monthly ?? 0,
          data.price_annual ?? 0,
          data.price_lifetime ?? null,
          data.price_one_time ?? null,
          data.is_active !== false,
          data.is_highlighted === true || data.is_popular === true,
          data.highlight_label || null,
          data.badge_color || '#6366f1',
          JSON.stringify(data.features || []),
          data.sort_order ?? 0,
          JSON.stringify(data.metadata || {}),
        ]
      );

      for (const entitlement of data.entitlements || []) {
        await this.upsertPlanEntitlementWithClient(client, res.rows[0].id, entitlement);
      }

      await client.query('COMMIT');
      await CacheService.delPattern('plan_entitlements:*');
      await CacheService.delPattern('entitlements:*');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async updatePlan(planId: string, updates: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (['name', 'description', 'tagline', 'price_monthly', 'price_annual', 'price_lifetime', 'price_one_time', 'is_active', 'is_highlighted', 'highlight_label', 'badge_color', 'sort_order', 'features', 'metadata'].includes(key)) {
        fields.push(`${key} = $${idx}`);
        values.push(key === 'features' || key === 'metadata' ? JSON.stringify(val || (key === 'features' ? [] : {})) : val);
        idx++;
      }
    }

    let updatedPlan = null;

    if (fields.length > 0) {
      values.push(planId);
      const res = await pool.query(
        `UPDATE public.plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        values
      );
      updatedPlan = res.rows[0];
    }

    for (const entitlement of updates.entitlements || []) {
      await this.upsertPlanEntitlement(planId, entitlement);
    }

    await CacheService.delPattern('plan_entitlements:*');
    await CacheService.delPattern('entitlements:*');
    return updatedPlan || (await pool.query(`SELECT * FROM public.plans WHERE id = $1`, [planId])).rows[0];
  }

  static async deletePlan(planId: string) {
    const res = await pool.query(
      `UPDATE public.plans SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [planId]
    );
    await CacheService.delPattern('plan_entitlements:*');
    await CacheService.delPattern('entitlements:*');
    return res.rows[0];
  }

  static async getPlanEntitlements(planId: string) {
    const res = await pool.query(`SELECT * FROM public.plan_entitlements WHERE plan_id = $1`, [planId]);
    return res.rows;
  }

  static async upsertPlanEntitlement(planId: string, entitlement: any) {
    return this.upsertPlanEntitlementWithClient(pool, planId, entitlement);
  }

  private static async upsertPlanEntitlementWithClient(client: Pick<typeof pool, 'query'>, planId: string, entitlement: any) {
    const check = await client.query(
      `SELECT id FROM public.plan_entitlements 
       WHERE plan_id = $1 AND feature_key = $2 
         AND (resource_type = $3 OR (resource_type IS NULL AND $3 IS NULL))
         AND (resource_id = $4 OR (resource_id IS NULL AND $4 IS NULL))`,
      [planId, entitlement.feature_key, entitlement.resource_type || null, entitlement.resource_id || null]
    );

    let res;
    if (check.rows.length > 0) {
      res = await client.query(
        `UPDATE public.plan_entitlements SET
           entitlement_type = $1,
           bool_value = $2,
           numeric_value = $3,
           label = $4,
           description = $5,
           updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [entitlement.entitlement_type, entitlement.bool_value, entitlement.numeric_value, entitlement.label, entitlement.description || null, check.rows[0].id]
      );
    } else {
      res = await client.query(
        `INSERT INTO public.plan_entitlements (plan_id, feature_key, entitlement_type, bool_value, numeric_value, resource_type, resource_id, label, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [planId, entitlement.feature_key, entitlement.entitlement_type, entitlement.bool_value, entitlement.numeric_value, entitlement.resource_type || null, entitlement.resource_id || null, entitlement.label, entitlement.description || null]
      );
    }

    await CacheService.delPattern('plan_entitlements:*');
    await CacheService.delPattern('entitlements:*');
    return res.rows[0];
  }

  static async deletePlanEntitlement(entitlementId: string) {
    const res = await pool.query(`DELETE FROM public.plan_entitlements WHERE id = $1 RETURNING *`, [entitlementId]);
    await CacheService.delPattern('plan_entitlements:*');
    await CacheService.delPattern('entitlements:*');
    return res.rows[0];
  }

  /**
   * Coupons Management
   */
  static async getCoupons() {
    const res = await pool.query(`SELECT * FROM public.coupons ORDER BY created_at DESC`);
    return res.rows;
  }

  static async createCoupon(adminId: string, data: any) {
    const res = await pool.query(
      `INSERT INTO public.coupons (code, name, type, value, max_discount, max_uses, min_order_amount, applicable_plan_slugs, applicable_billing_cycles, one_use_per_user, valid_from, expires_at, is_public, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        data.code.toUpperCase(), data.name, data.type, data.value, data.max_discount, data.max_uses,
        data.min_order_amount || 0, data.applicable_plan_slugs || '{}', data.applicable_billing_cycles || '{}',
        data.one_use_per_user !== false, data.valid_from, data.expires_at, data.is_public === true, data.description, adminId
      ]
    );
    return res.rows[0];
  }

  static async toggleCoupon(couponId: string, isActive: boolean) {
    const res = await pool.query(`UPDATE public.coupons SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [isActive, couponId]);
    return res.rows[0];
  }

  /**
   * Referrals & Withdrawals
   */
  static async getSuspiciousReferrals() {
    const res = await pool.query(
      `SELECT r.*, u1.first_name as referrer_first, u1.last_name as referrer_last, u2.first_name as referred_first, u2.last_name as referred_last
       FROM public.referrals r
       JOIN public.users u1 ON u1.id = r.referrer_id
       JOIN public.users u2 ON u2.id = r.referred_user_id
       WHERE r.status = 'suspicious' ORDER BY r.created_at DESC`
    );
    return res.rows;
  }

  static async reviewReferral(adminId: string, referralId: string, approve: boolean, note: string) {
    const newStatus = approve ? 'pending' : 'rejected'; // pending means it waits for payment/credit
    const res = await pool.query(
      `UPDATE public.referrals SET status = $1, reviewed_by = $2, reviewed_at = NOW(), admin_note = $3, is_suspicious = false, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [newStatus, adminId, note, referralId]
    );
    return res.rows[0];
  }

  static async getPendingWithdrawals() {
    const res = await pool.query(
      `SELECT w.*, u.first_name, u.last_name, u.email 
       FROM public.withdrawals w
       JOIN public.users u ON u.id = w.user_id
       WHERE w.status = 'pending' ORDER BY w.created_at ASC`
    );
    return res.rows;
  }

  static async processWithdrawal(adminId: string, withdrawalId: string, transactionId: string, failureReason?: string) {
    const status = failureReason ? 'failed' : 'completed';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const wRes = await client.query(`SELECT user_id, amount, status FROM public.withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId]);
      if (wRes.rows.length === 0) throw new Error('Not found');
      if (wRes.rows[0].status !== 'pending') throw new Error('Already processed');

      await client.query(
        `UPDATE public.withdrawals SET status = $1, transaction_id = $2, failure_reason = $3, processed_by = $4, processed_at = NOW(), updated_at = NOW() WHERE id = $5`,
        [status, transactionId, failureReason, adminId, withdrawalId]
      );

      // If failed, refund wallet
      if (failureReason) {
        await client.query(`UPDATE public.users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [wRes.rows[0].amount, wRes.rows[0].user_id]);
      }

      await client.query('COMMIT');
      return { success: true, status };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Custom Referrals for Influencers
   */
  static async createInfluencerCode(adminId: string, userId: string, code: string, pct: number, fixed: number | null, label: string) {
    const res = await pool.query(
      `INSERT INTO public.referral_codes (user_id, code, is_custom, custom_label, custom_commission_pct, custom_commission_fixed, created_by_admin)
       VALUES ($1, $2, true, $3, $4, $5, $6) RETURNING *`,
      [userId, code.toUpperCase(), label, pct, fixed, adminId]
    );
    return res.rows[0];
  }
}
