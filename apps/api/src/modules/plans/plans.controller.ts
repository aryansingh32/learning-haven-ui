import { Request, Response } from 'express';
import { pool } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { ok, serverError } from '../../utils/api-response';
import { CacheService } from '../core/services/cache.service';
import { accessService } from '../entitlements/access.service';
import logger from '../../config/logger';

const PUBLIC_PLANS_CACHE_KEY = 'public:plans:full';

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  price_monthly: number;
  price_annual: number;
  price_lifetime: number | null;
  price_one_time: number | null;
  is_highlighted: boolean;
  highlight_label: string | null;
  sort_order: number;
  features_copy: unknown;
  content_type: string | null;
  content_id: string | null;
  feature_key: string | null;
  feature_limit: number | null;
  content_title: string | null;
  content_difficulty: string | null;
};

function emptyPlan(row: PlanRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    tagline: row.tagline,
    price_monthly: row.price_monthly,
    price_annual: row.price_annual,
    price_lifetime: row.price_lifetime,
    price_one_time: row.price_one_time,
    is_highlighted: row.is_highlighted,
    highlight_label: row.highlight_label,
    sort_order: row.sort_order,
    features_copy: row.features_copy,
    courses: [] as Array<{ id: string; title: string; difficulty: string | null }>,
    challenges: [] as Array<{ id: string; title: string; difficulty: string | null }>,
    career_paths: [] as Array<{ id: string; title: string; difficulty: string | null }>,
    features: {} as Record<string, number>,
  };
}

function buildPlans(rows: PlanRow[]) {
  const plans = new Map<string, ReturnType<typeof emptyPlan>>();

  for (const row of rows) {
    if (!plans.has(row.id)) plans.set(row.id, emptyPlan(row));
    const plan = plans.get(row.id)!;

    if (row.feature_key) {
      plan.features[row.feature_key] = Number(row.feature_limit ?? 0);
      continue;
    }

    if (!row.content_id || !row.content_title) continue;

    const item = {
      id: row.content_id,
      title: row.content_title,
      difficulty: row.content_difficulty,
    };

    if (row.content_type === 'course') plan.courses.push(item);
    if (row.content_type === 'challenge') plan.challenges.push(item);
    if (row.content_type === 'career_path') plan.career_paths.push(item);
  }

  return Array.from(plans.values()).sort((a, b) => a.sort_order - b.sort_order);
}

export class PlansController {
  static async getPlansWithContent(_req: Request, res: Response) {
    try {
      const cached = await CacheService.get<ReturnType<typeof buildPlans>>(PUBLIC_PLANS_CACHE_KEY);
      if (cached) return ok(res, cached);

      const result = await pool.query<PlanRow>(
        `
        SELECT
          p.id,
          p.name,
          p.slug::text AS slug,
          p.description,
          p.tagline,
          p.price_monthly,
          p.price_annual,
          p.price_lifetime,
          p.price_one_time,
          p.is_highlighted,
          p.highlight_label,
          p.sort_order,
          p.features AS features_copy,
          cpa.content_type::text,
          cpa.content_id,
          cpa.feature_key,
          cpa.feature_limit,
          COALESCE(pr.title, c.title) AS content_title,
          COALESCE(pr.difficulty, c.difficulty_level) AS content_difficulty
        FROM public.plans p
        LEFT JOIN public.content_plan_assignments cpa ON cpa.plan_id = p.id
        LEFT JOIN public.programs pr ON pr.id = cpa.content_id
        LEFT JOIN public.courses c ON c.id = cpa.content_id
        WHERE p.is_active = true
        ORDER BY p.sort_order ASC, pr.title ASC
        `,
      );

      const plans = buildPlans(result.rows);
      await CacheService.set(PUBLIC_PLANS_CACHE_KEY, plans, 600);
      return ok(res, plans);
    } catch (error) {
      logger.error('getPlansWithContent error:', error);
      return serverError(res);
    }
  }

  static async getMyPlan(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const [entitlements, userResult] = await Promise.all([
        accessService.getUserEntitlementMap(userId),
        pool.query(
          `
          SELECT p.name, p.slug::text AS slug, s.current_period_end AS expires_at
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
        ),
      ]);

      const active = userResult.rows[0];
      return ok(res, {
        plan: active?.slug ? { name: active.name, slug: active.slug } : { name: 'Free', slug: 'free' },
        expires_at: active?.expires_at || null,
        entitlements,
      });
    } catch (error) {
      logger.error('getMyPlan error:', error);
      return serverError(res);
    }
  }

  static async invalidatePublicPlansCache() {
    await CacheService.del(PUBLIC_PLANS_CACHE_KEY);
  }
}
