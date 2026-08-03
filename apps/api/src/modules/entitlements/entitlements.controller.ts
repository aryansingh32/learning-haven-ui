import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { EntitlementsService } from './entitlements.service';
import { ok, badRequest, serverError } from '../../utils/api-response';
import logger from '../../config/logger';

export class EntitlementsController {
  /**
   * GET /api/entitlements/check?feature=ai_queries_per_day
   */
  static async checkFeature(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const feature = req.query.feature as string;
      const resourceId = req.query.resource_id as string | undefined;

      if (!feature) {
        return badRequest(res, 'Query parameter "feature" is required');
      }

      const result = await EntitlementsService.checkEntitlement(userId, feature, resourceId);
      return ok(res, result);
    } catch (error) {
      logger.error('checkFeature error:', error);
      return serverError(res);
    }
  }

  /**
   * GET /api/entitlements/map
   * Returns all entitlements for the authenticated user.
   */
  static async getEntitlementMap(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const map = await EntitlementsService.getUserEntitlementMap(userId);
      return ok(res, map);
    } catch (error) {
      logger.error('getEntitlementMap error:', error);
      return serverError(res);
    }
  }
}
