import redis from '../../config/redis';
import { pool } from '../../config/database';
import { CacheService } from '../core/services/cache.service';

export type PlanContentType = 'course' | 'challenge' | 'career_path';

export interface AccessResult {
  allowed: boolean;
  requiredPlanSlug?: string;
  requiredPlanName?: string;
  requiredPlanPrice?: number;
  featureKey?: string;
  limit?: number;
  used?: number;
  remaining?: number;
}

const CACHE_TTL = 300;

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function secondsUntilMidnightIST(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const endOfDay = new Date(ist);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return Math.max(Math.ceil((endOfDay.getTime() - ist.getTime()) / 1000), 60);
}

export class AccessService {
  async canAccess(userId: string, contentType: PlanContentType, contentId: string): Promise<AccessResult> {
    const userPlan = await this.getUserPlan(userId);
    const owned = await pool.query(
      `
      SELECT 1
      FROM public.content_plan_assignments
      WHERE plan_id = $1
        AND content_type::text = $2
        AND content_id = $3
      LIMIT 1
      `,
      [userPlan.planId, contentType, contentId],
    );

    if (owned.rows.length > 0) return { allowed: true };

    const directGrant = await pool.query(
      `
      SELECT 1
      FROM public.user_entitlements
      WHERE user_id = $1
        AND entitlement_type::text = 'resource_access'
        AND resource_type = $2
        AND resource_id = $3
        AND starts_at <= NOW()
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
      `,
      [userId, contentType, contentId],
    );

    if (directGrant.rows.length > 0) return { allowed: true };

    const upgrade = await this.getCheapestPlanForContent(contentType, contentId);
    return { allowed: false, ...upgrade };
  }

  async canUseFeature(userId: string, featureKey: string): Promise<AccessResult> {
    const userPlan = await this.getUserPlan(userId);
    const assignment = await pool.query(
      `
      SELECT feature_limit
      FROM public.content_plan_assignments
      WHERE plan_id = $1
        AND feature_key = $2
      LIMIT 1
      `,
      [userPlan.planId, featureKey],
    );

    if (assignment.rows.length === 0) {
      const upgrade = await this.getCheapestPlanForFeature(featureKey);
      return { allowed: false, featureKey, ...upgrade };
    }

    const limit = Number(assignment.rows[0].feature_limit ?? 0);
    if (limit === -1) return { allowed: true, featureKey, limit: -1, remaining: -1 };
    if (limit === 0) {
      const upgrade = await this.getCheapestPlanForFeature(featureKey);
      return { allowed: false, featureKey, limit, ...upgrade };
    }

    const key = `usage:${userId}:${featureKey}:${todayIST()}`;
    const used = parseInt((await redis.get(key)) || '0', 10);
    if (used >= limit) {
      const upgrade = await this.getCheapestUpgradeForFeature(featureKey, limit);
      return { allowed: false, featureKey, limit, used, remaining: 0, ...upgrade };
    }

    return { allowed: true, featureKey, limit, used, remaining: limit - used };
  }

  async consumeFeatureUsage(userId: string, featureKey: string): Promise<AccessResult> {
    const check = await this.canUseFeature(userId, featureKey);
    if (!check.allowed || check.limit === -1) return check;

    const key = `usage:${userId}:${featureKey}:${todayIST()}`;
    const newUsed = await redis.incr(key);
    if (newUsed === 1) await redis.expire(key, secondsUntilMidnightIST());

    if (check.limit !== undefined && newUsed > check.limit) {
      await redis.decr(key);
      const upgrade = await this.getCheapestUpgradeForFeature(featureKey, check.limit);
      return {
        allowed: false,
        featureKey,
        limit: check.limit,
        used: check.limit,
        remaining: 0,
        ...upgrade,
      };
    }

    return {
      allowed: true,
      featureKey,
      limit: check.limit,
      used: newUsed,
      remaining: Math.max(0, (check.limit ?? 0) - newUsed),
    };
  }

  async getUserEntitlementMap(userId: string): Promise<Record<string, AccessResult>> {
    const cacheKey = `content_entitlements:${userId}`;
    const cached = await CacheService.get<Record<string, AccessResult>>(cacheKey);
    if (cached) return cached;

    const userPlan = await this.getUserPlan(userId);
    const result = await pool.query(
      `
      SELECT content_type::text, content_id, feature_key, feature_limit
      FROM public.content_plan_assignments
      WHERE plan_id = $1
      `,
      [userPlan.planId],
    );

    const map: Record<string, AccessResult> = {};
    for (const row of result.rows) {
      const key = row.feature_key || `${row.content_type}:${row.content_id}`;
      map[key] = {
        allowed: true,
        featureKey: row.feature_key || undefined,
        limit: row.feature_key ? Number(row.feature_limit ?? -1) : undefined,
      };
    }

    await CacheService.set(cacheKey, map, CACHE_TTL);
    return map;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await CacheService.del(`content_entitlements:${userId}`);
    await CacheService.del(`user_plan:${userId}`);
    await CacheService.del(`entitlements:${userId}`);
  }

  private async getUserPlan(userId: string): Promise<{ planId: string; slug: string; name: string }> {
    const cacheKey = `user_plan:${userId}`;
    const cached = await CacheService.get<{ planId: string; slug: string; name: string }>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `
      SELECT p.id AS plan_id, p.slug::text AS slug, p.name
      FROM public.users u
      LEFT JOIN public.subscriptions s
        ON s.user_id = u.id
       AND s.status = 'active'
       AND s.current_period_end > NOW()
      LEFT JOIN public.plans p ON p.id = s.plan_id
      WHERE u.id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
      `,
      [userId],
    );

    let plan = result.rows[0];
    if (!plan?.plan_id) {
      const free = await pool.query(
        `SELECT id AS plan_id, slug::text AS slug, name FROM public.plans WHERE slug::text = 'free' LIMIT 1`,
      );
      plan = free.rows[0];
    }

    const value = { planId: plan.plan_id, slug: plan.slug, name: plan.name };
    await CacheService.set(cacheKey, value, CACHE_TTL);
    return value;
  }

  private async getCheapestPlanForContent(contentType: PlanContentType, contentId: string) {
    const result = await pool.query(
      `
      SELECT p.slug::text AS required_plan_slug, p.name AS required_plan_name, p.price_annual AS required_plan_price
      FROM public.content_plan_assignments cpa
      JOIN public.plans p ON p.id = cpa.plan_id
      WHERE cpa.content_type::text = $1
        AND cpa.content_id = $2
        AND p.is_active = true
      ORDER BY p.price_annual ASC, p.sort_order ASC
      LIMIT 1
      `,
      [contentType, contentId],
    );
    return this.toUpgrade(result.rows[0]);
  }

  private async getCheapestPlanForFeature(featureKey: string) {
    const result = await pool.query(
      `
      SELECT p.slug::text AS required_plan_slug, p.name AS required_plan_name, p.price_annual AS required_plan_price
      FROM public.content_plan_assignments cpa
      JOIN public.plans p ON p.id = cpa.plan_id
      WHERE cpa.feature_key = $1
        AND cpa.feature_limit != 0
        AND p.is_active = true
      ORDER BY p.price_annual ASC, p.sort_order ASC
      LIMIT 1
      `,
      [featureKey],
    );
    return this.toUpgrade(result.rows[0]);
  }

  private async getCheapestUpgradeForFeature(featureKey: string, currentLimit: number) {
    const result = await pool.query(
      `
      SELECT p.slug::text AS required_plan_slug, p.name AS required_plan_name, p.price_annual AS required_plan_price
      FROM public.content_plan_assignments cpa
      JOIN public.plans p ON p.id = cpa.plan_id
      WHERE cpa.feature_key = $1
        AND (cpa.feature_limit = -1 OR cpa.feature_limit > $2)
        AND p.is_active = true
      ORDER BY CASE WHEN cpa.feature_limit = -1 THEN 2147483647 ELSE cpa.feature_limit END ASC,
               p.price_annual ASC
      LIMIT 1
      `,
      [featureKey, currentLimit],
    );
    return this.toUpgrade(result.rows[0]);
  }

  private toUpgrade(row?: any) {
    if (!row) return {};
    return {
      requiredPlanSlug: row.required_plan_slug,
      requiredPlanName: row.required_plan_name,
      requiredPlanPrice: row.required_plan_price,
    };
  }
}

export const accessService = new AccessService();
