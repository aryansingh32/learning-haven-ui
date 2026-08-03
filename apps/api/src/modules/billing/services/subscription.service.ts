import { pool } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';

export class SubscriptionService {
  /**
   * Fetch current active subscription with plan details.
   */
  static async getCurrentSubscription(userId: string) {
    const result = await pool.query(
      `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.features
       FROM public.subscriptions s
       JOIN public.plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Cron job: expire subscriptions whose current_period_end < NOW().
   */
  static async checkAndExpireSubscriptions() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find expired active subscriptions
      const expiredRes = await client.query(
        `SELECT id, user_id FROM public.subscriptions 
         WHERE status = 'active' AND current_period_end <= NOW() FOR UPDATE`
      );

      if (expiredRes.rows.length === 0) {
        await client.query('COMMIT');
        return;
      }

      const expiredIds = expiredRes.rows.map((r) => r.id);
      const userIds = expiredRes.rows.map((r) => r.user_id);

      // Update subscription statuses to 'expired'
      await client.query(
        `UPDATE public.subscriptions SET status = 'expired', updated_at = NOW() 
         WHERE id = ANY($1)`,
        [expiredIds]
      );

      // Downgrade users to 'free'
      await client.query(
        `UPDATE public.users SET current_plan = 'free', active_subscription_id = NULL 
         WHERE id = ANY($1)`,
        [userIds]
      );

      await client.query('COMMIT');

      // Clear entitlement caches for downgraded users
      for (const userId of userIds) {
        await CacheService.delPattern(`entitlements:${userId}`);
      }

      logger.info(`Expired ${expiredIds.length} subscriptions successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('checkAndExpireSubscriptions error:', error);
    } finally {
      client.release();
    }
  }
}
