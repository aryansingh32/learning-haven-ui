import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { accessService, PlanContentType } from '../modules/entitlements/access.service';
import { fail } from '../utils/api-response';

function getPathValue(req: Request, source: string): unknown {
  return source.split('.').reduce((value: any, key) => value?.[key], req as any);
}

export const requireAccess = (contentType: PlanContentType, contentIdSource: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');

    const contentId = getPathValue(req, contentIdSource);
    if (!contentId || typeof contentId !== 'string') {
      return fail(res, 400, 'MISSING_CONTENT_ID', 'Content ID required');
    }

    const result = await accessService.canAccess(userId, contentType, contentId);
    if (result.allowed) return next();

    return fail(res, 403, 'ACCESS_DENIED', `This content requires ${result.requiredPlanName || 'an upgrade'}`, {
      upgradeRequired: true,
      requiredPlanSlug: result.requiredPlanSlug,
      requiredPlanName: result.requiredPlanName,
      requiredPlanPrice: result.requiredPlanPrice,
    });
  };

export const requireFeature = (featureKey: string, consume = false) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');

    const result = consume
      ? await accessService.consumeFeatureUsage(userId, featureKey)
      : await accessService.canUseFeature(userId, featureKey);

    (req as any).featureUsage = result;
    if (result.allowed) return next();

    return fail(
      res,
      403,
      'FEATURE_LIMIT_REACHED',
      result.limit === 0 ? `${featureKey} requires an upgrade` : `Daily limit reached (${result.used}/${result.limit})`,
      {
        upgradeRequired: true,
        featureKey,
        limit: result.limit,
        used: result.used,
        requiredPlanSlug: result.requiredPlanSlug,
        requiredPlanName: result.requiredPlanName,
        requiredPlanPrice: result.requiredPlanPrice,
      },
    );
  };
