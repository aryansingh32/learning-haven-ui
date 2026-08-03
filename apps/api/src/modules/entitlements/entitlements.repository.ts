import { pool } from '../../config/database';
import { CacheService } from '../core/services/cache.service';
import logger from '../../config/logger';

// ── Types ────────────────────────────────────────────────────

export interface UserEntitlement {
  featureKey: string;
  entitlementType: 'boolean' | 'numeric_limit' | 'resource_access';
  boolValue: boolean | null;
  numericValue: number | null;
  resourceType: string | null;
  resourceId: string | null;
  label: string | null;
}

export interface UserPlanInfo {
  userId: string;
  planId: string | null;
  planSlug: string;
  planName: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  periodEnd: string | null;
  entitlements: UserEntitlement[];
}

export interface EntitlementResult {
  allowed: boolean;
  limit: number | null;
  used?: number;
  remaining?: number;
  reason?: string;
  upgradeRequiredPlan?: string;
  upgradeRequiredPlanName?: string;
  upgradePrice?: number;
}

// ── Cache keys & TTL ─────────────────────────────────────────

const USER_ENTITLEMENTS_TTL = 300;          // 5 minutes
const PLAN_ENTITLEMENTS_TTL = 300;
const userCacheKey = (uid: string) => `entitlements:${uid}`;
const planCacheKey = (slug: string) => `plan_entitlements:${slug}`;

// ── Repository ───────────────────────────────────────────────

export class EntitlementsRepository {
  /**
   * Fetch user's active plan + entitlements.
   * Falls back to 'free' plan entitlements if no active subscription.
   */
  static async getUserPlanAndEntitlements(userId: string): Promise<UserPlanInfo> {
    // Check cache first
    const cached = await CacheService.get<UserPlanInfo>(userCacheKey(userId));
    if (cached) return cached;

    try {
      // Find active subscription → plan → entitlements in one query
      const result = await pool.query(
        `
        SELECT
          s.id          AS subscription_id,
          s.status      AS subscription_status,
          s.current_period_end,
          p.id          AS plan_id,
          p.slug::text  AS plan_slug,
          p.name        AS plan_name
        FROM public.users u
        LEFT JOIN public.subscriptions s
          ON  s.user_id = u.id
          AND s.status = 'active'
          AND s.current_period_end > NOW()
        LEFT JOIN public.plans p ON p.id = s.plan_id
        WHERE u.id = $1
        ORDER BY s.created_at DESC
        LIMIT 1
        `,
        [userId],
      );

      let planSlug = 'free';
      let planId: string | null = null;
      let planName = 'Free';
      let subscriptionId: string | null = null;
      let subscriptionStatus: string | null = null;
      let periodEnd: string | null = null;

      if (result.rows.length > 0 && result.rows[0].plan_slug) {
        const row = result.rows[0];
        planSlug = row.plan_slug;
        planId = row.plan_id;
        planName = row.plan_name;
        subscriptionId = row.subscription_id;
        subscriptionStatus = row.subscription_status;
        periodEnd = row.current_period_end;
      }

      // Fetch entitlements for this plan
      const planEntitlements = await this.getPlanEntitlementsBySlug(planSlug);
      const userEntitlements = await this.getUserResourceEntitlements(userId);
      const entitlements = [...planEntitlements, ...userEntitlements];

      const info: UserPlanInfo = {
        userId,
        planId,
        planSlug,
        planName,
        subscriptionId,
        subscriptionStatus,
        periodEnd,
        entitlements,
      };

      await CacheService.set(userCacheKey(userId), info, USER_ENTITLEMENTS_TTL);
      return info;
    } catch (error) {
      logger.error('getUserPlanAndEntitlements error:', { userId, error });
      // Return free-tier entitlements as fallback
      const freeEntitlements = await this.getPlanEntitlementsBySlug('free');
      const userEntitlements = await this.getUserResourceEntitlements(userId);
      return {
        userId,
        planId: null,
        planSlug: 'free',
        planName: 'Free',
        subscriptionId: null,
        subscriptionStatus: null,
        periodEnd: null,
        entitlements: [...freeEntitlements, ...userEntitlements],
      };
    }
  }

  /**
   * Fetch entitlements for a given plan slug (cached).
   */
  static async getPlanEntitlementsBySlug(slug: string): Promise<UserEntitlement[]> {
    const cached = await CacheService.get<UserEntitlement[]>(planCacheKey(slug));
    if (cached) return cached;

    try {
      const result = await pool.query(
        `
        SELECT
          pe.feature_key,
          pe.entitlement_type::text,
          pe.bool_value,
          pe.numeric_value,
          pe.resource_type,
          pe.resource_id,
          pe.label
        FROM public.plan_entitlements pe
        JOIN public.plans p ON p.id = pe.plan_id
        WHERE p.slug::text = $1
        `,
        [slug],
      );

      const entitlements: UserEntitlement[] = result.rows.map((row) => ({
        featureKey: row.feature_key,
        entitlementType: row.entitlement_type,
        boolValue: row.bool_value,
        numericValue: row.numeric_value,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        label: row.label,
      }));

      await CacheService.set(planCacheKey(slug), entitlements, PLAN_ENTITLEMENTS_TTL);
      return entitlements;
    } catch (error) {
      logger.error('getPlanEntitlementsBySlug error:', { slug, error });
      return [];
    }
  }

  /**
   * Fetch direct purchases/resource grants for a user.
   * These are used for individual course, career path, and project purchases.
   */
  static async getUserResourceEntitlements(userId: string): Promise<UserEntitlement[]> {
    try {
      const result = await pool.query(
        `
        SELECT
          feature_key,
          entitlement_type::text,
          bool_value,
          numeric_value,
          resource_type,
          resource_id,
          label
        FROM public.user_entitlements
        WHERE user_id = $1
          AND starts_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        `,
        [userId],
      );

      return result.rows.map((row) => ({
        featureKey: row.feature_key,
        entitlementType: row.entitlement_type,
        boolValue: row.bool_value,
        numericValue: row.numeric_value,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        label: row.label,
      }));
    } catch (error) {
      logger.error('getUserResourceEntitlements error:', { userId, error });
      return [];
    }
  }

  /**
   * Invalidate cached entitlements for a user (call after plan change).
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    await CacheService.del(userCacheKey(userId));
  }

  /**
   * Invalidate ALL entitlement caches (call after admin edits a plan).
   */
  static async invalidateAllCaches(): Promise<void> {
    await CacheService.delPattern('entitlements:*');
    await CacheService.delPattern('plan_entitlements:*');
  }
}
