import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { EntitlementsService } from './entitlements.service';
import { fail } from '../../utils/api-response';
import logger from '../../config/logger';

/**
 * Middleware factory: require that the user has a specific entitlement.
 * Returns 403 with structured upgrade info if denied.
 */
export function requireEntitlement(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
      }

      const result = await EntitlementsService.checkEntitlement(userId, featureKey);

      if (result.allowed) {
        // Attach entitlement info to request for downstream use
        (req as any).entitlement = result;
        return next();
      }

      return fail(res, 403, 'ENTITLEMENT_DENIED', result.reason || 'Feature not available', {
        featureKey,
        upgradeRequired: true,
        upgradeRequiredPlan: result.upgradeRequiredPlan,
        upgradeRequiredPlanName: result.upgradeRequiredPlanName,
        upgradePrice: result.upgradePrice,
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
      });
    } catch (error) {
      logger.error('requireEntitlement middleware error:', { featureKey, error });
      // Fail open on errors to avoid blocking users due to cache issues
      return next();
    }
  };
}

/**
 * Middleware factory: require entitlement AND consume one usage unit.
 * For rate-limited features like ai_queries_per_day.
 */
export function requireAndConsumeEntitlement(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
      }

      const result = await EntitlementsService.checkAndConsumeUsage(userId, featureKey);

      if (result.allowed) {
        (req as any).entitlement = result;
        return next();
      }

      return fail(res, 403, 'ENTITLEMENT_DENIED', result.reason || 'Feature limit reached', {
        featureKey,
        upgradeRequired: true,
        upgradeRequiredPlan: result.upgradeRequiredPlan,
        upgradeRequiredPlanName: result.upgradeRequiredPlanName,
        upgradePrice: result.upgradePrice,
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
      });
    } catch (error) {
      logger.error('requireAndConsumeEntitlement middleware error:', { featureKey, error });
      return next();
    }
  };
}
