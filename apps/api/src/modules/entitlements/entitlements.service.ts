import redis from '../../config/redis';
import { pool } from '../../config/database';
import {
  EntitlementsRepository,
  type EntitlementResult,
  type UserEntitlement,
} from './entitlements.repository';
import logger from '../../config/logger';
import { accessService, type AccessResult } from './access.service';

// ── Helpers ──────────────────────────────────────────────────

/** Today's date string in IST (YYYY-MM-DD) */
function todayIST(): string {
  const now = new Date();
  // IST = UTC+5:30
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Seconds remaining until end of day IST */
function secondsUntilMidnightIST(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const endOfDay = new Date(ist);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const diff = endOfDay.getTime() - ist.getTime();
  return Math.max(Math.ceil(diff / 1000), 60); // min 60s
}

function usageKey(userId: string, featureKey: string, date: string): string {
  return `usage:${userId}:${featureKey}:${date}`;
}

function matchesResource(ent: UserEntitlement, resourceId?: string): boolean {
  if (!resourceId) return true;
  if (ent.entitlementType === 'resource_access') return ent.resourceId === resourceId;
  return !ent.resourceId || ent.resourceId === resourceId;
}

// ── Service ──────────────────────────────────────────────────

export class EntitlementsService {
  /**
   * Check if a user can access a feature.
   */
  static async checkEntitlement(
    userId: string,
    featureKey: string,
    resourceId?: string,
  ): Promise<EntitlementResult> {
    const info = await EntitlementsRepository.getUserPlanAndEntitlements(userId);
    const ent = info.entitlements.find((e) => e.featureKey === featureKey && matchesResource(e, resourceId));

    if (!ent) {
      // Feature not defined for this plan → denied
      const upgrade = await this.getUpgradePlanForFeature(featureKey);
      return {
        allowed: false,
        limit: null,
        reason: `Feature "${featureKey}" is not available on the ${info.planName} plan`,
        upgradeRequiredPlan: upgrade?.planSlug,
        upgradeRequiredPlanName: upgrade?.planName,
        upgradePrice: upgrade?.priceMonthly,
      };
    }

    switch (ent.entitlementType) {
      case 'boolean': {
        if (ent.boolValue) {
          return { allowed: true, limit: null };
        }
        const upgrade = await this.getUpgradePlanForFeature(featureKey);
        return {
          allowed: false,
          limit: null,
          reason: `This feature requires ${upgrade?.planName || 'an upgrade'}`,
          upgradeRequiredPlan: upgrade?.planSlug,
          upgradeRequiredPlanName: upgrade?.planName,
          upgradePrice: upgrade?.priceMonthly,
        };
      }

      case 'numeric_limit': {
        const limit = ent.numericValue ?? 0;
        if (limit === -1) {
          // Unlimited
          return { allowed: true, limit: -1, remaining: -1 };
        }
        let used = 0;
        if (featureKey === 'challenge_limit' || featureKey === 'project_access') {
          const countRes = await pool.query(
            `SELECT COUNT(DISTINCT program_id) as count FROM public.build_enrollments WHERE user_id = $1`,
            [userId]
          );
          used = parseInt(countRes.rows[0].count, 10);
        } else {
          // Check current usage from Redis (daily limits like ai_queries_per_day)
          const today = todayIST();
          const key = usageKey(userId, featureKey, today);
          const usedStr = await redis.get(key);
          used = usedStr ? parseInt(usedStr, 10) : 0;
        }
        const remaining = Math.max(0, limit - used);

        if (remaining <= 0) {
          const upgrade = await this.getUpgradePlanForFeature(featureKey);
          return {
            allowed: false,
            limit,
            used,
            remaining: 0,
            reason: `Daily limit of ${limit} reached for ${ent.label || featureKey}`,
            upgradeRequiredPlan: upgrade?.planSlug,
            upgradeRequiredPlanName: upgrade?.planName,
            upgradePrice: upgrade?.priceMonthly,
          };
        }

        return { allowed: true, limit, used, remaining };
      }

      case 'resource_access': {
        // For resource_access, existence of the entitlement = access granted
        return { allowed: true, limit: null };
      }

      default:
        return { allowed: false, limit: null, reason: 'Unknown entitlement type' };
    }
  }

  /**
   * Check entitlement AND atomically consume one usage unit.
   * For rate-limited features like ai_queries_per_day.
   */
  static async checkAndConsumeUsage(
    userId: string,
    featureKey: string,
  ): Promise<EntitlementResult> {
    const info = await EntitlementsRepository.getUserPlanAndEntitlements(userId);
    const ent = info.entitlements.find((e) => e.featureKey === featureKey);

    if (!ent) {
      const upgrade = await this.getUpgradePlanForFeature(featureKey);
      return {
        allowed: false,
        limit: null,
        reason: `Feature "${featureKey}" is not available on the ${info.planName} plan`,
        upgradeRequiredPlan: upgrade?.planSlug,
        upgradeRequiredPlanName: upgrade?.planName,
        upgradePrice: upgrade?.priceMonthly,
      };
    }

    if (ent.entitlementType !== 'numeric_limit') {
      // Non-numeric features: just check boolean
      return this.checkEntitlement(userId, featureKey);
    }

    const limit = ent.numericValue ?? 0;
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }

    const today = todayIST();
    const key = usageKey(userId, featureKey, today);

    // Atomic increment
    const current = await redis.incr(key);

    // Set TTL on first use
    if (current === 1) {
      const ttl = secondsUntilMidnightIST();
      await redis.expire(key, ttl);
    }

    if (current > limit) {
      // Over limit — decrement back
      await redis.decr(key);
      const upgrade = await this.getUpgradePlanForFeature(featureKey);
      return {
        allowed: false,
        limit,
        used: limit,
        remaining: 0,
        reason: `Daily limit of ${limit} reached for ${ent.label || featureKey}`,
        upgradeRequiredPlan: upgrade?.planSlug,
        upgradeRequiredPlanName: upgrade?.planName,
        upgradePrice: upgrade?.priceMonthly,
      };
    }

    return {
      allowed: true,
      limit,
      used: current,
      remaining: limit - current,
    };
  }

  /**
   * Get all entitlements for a user (frontend uses this to show lock icons).
   */
  static async getUserEntitlementMap(
    userId: string,
  ): Promise<Record<string, EntitlementResult | AccessResult>> {
    const info = await EntitlementsRepository.getUserPlanAndEntitlements(userId);
    const map: Record<string, EntitlementResult> = {};
    const today = todayIST();

    for (const ent of info.entitlements) {
      switch (ent.entitlementType) {
        case 'boolean':
          map[ent.featureKey] = {
            allowed: !!ent.boolValue,
            limit: null,
          };
          break;

        case 'numeric_limit': {
          const limit = ent.numericValue ?? 0;
          if (limit === -1) {
            map[ent.featureKey] = { allowed: true, limit: -1, remaining: -1 };
          } else {
            let used = 0;
            if (ent.featureKey === 'challenge_limit' || ent.featureKey === 'project_access') {
              const countRes = await pool.query(
                `SELECT COUNT(DISTINCT program_id) as count FROM public.build_enrollments WHERE user_id = $1`,
                [userId]
              );
              used = parseInt(countRes.rows[0].count, 10);
            } else {
              const key = usageKey(userId, ent.featureKey, today);
              const usedStr = await redis.get(key);
              used = usedStr ? parseInt(usedStr, 10) : 0;
            }
            map[ent.featureKey] = {
              allowed: used < limit,
              limit,
              used,
              remaining: Math.max(0, limit - used),
            };
          }
          break;
        }

        case 'resource_access':
          map[ent.featureKey] = { allowed: true, limit: null };
          break;
      }
    }

    // Add plan meta
    (map as any)._plan = {
      slug: info.planSlug,
      name: info.planName,
      periodEnd: info.periodEnd,
    };

    try {
      const contentEntitlements = await accessService.getUserEntitlementMap(userId);
      return { ...map, ...contentEntitlements };
    } catch (error) {
      logger.warn('Content entitlement map unavailable; returning feature entitlements only', { userId, error });
      return map;
    }
  }

  /**
   * Find the cheapest plan that unlocks a feature (for upgrade prompts).
   */
  static async getUpgradePlanForFeature(
    featureKey: string,
  ): Promise<{
    planSlug: string;
    planName: string;
    priceMonthly: number;
    priceAnnual: number;
  } | null> {
    try {
      const result = await pool.query(
        `
        SELECT p.slug::text AS plan_slug, p.name AS plan_name,
               p.price_monthly, p.price_annual
        FROM public.plan_entitlements pe
        JOIN public.plans p ON p.id = pe.plan_id
        WHERE pe.feature_key = $1
          AND p.is_active = true
          AND p.slug::text != 'free'
          AND (
            (pe.entitlement_type = 'boolean' AND pe.bool_value = true) OR
            (pe.entitlement_type = 'numeric_limit' AND (pe.numeric_value = -1 OR pe.numeric_value > 0))
          )
        ORDER BY p.sort_order ASC
        LIMIT 1
        `,
        [featureKey],
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        planSlug: row.plan_slug,
        planName: row.plan_name,
        priceMonthly: row.price_monthly,
        priceAnnual: row.price_annual,
      };
    } catch (error) {
      logger.error('getUpgradePlanForFeature error:', { featureKey, error });
      return null;
    }
  }

  /**
   * Invalidate a user's entitlement cache (after plan change).
   */
  static async invalidateCache(userId: string): Promise<void> {
    await EntitlementsRepository.invalidateUserCache(userId);
    await accessService.invalidateUserCache(userId);
  }

  /**
   * Invalidate all caches (after admin edits plans/entitlements).
   */
  static async invalidateAllCaches(): Promise<void> {
    await EntitlementsRepository.invalidateAllCaches();
  }
}
