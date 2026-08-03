import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { AdminCommerceV2Service } from '../services/admin-commerce.v2.service';
import { ok, badRequest, serverError } from '../../../utils/api-response';
import logger from '../../../config/logger';

export class AdminCommerceV2Controller {
  static async getPlans(req: Request, res: Response) {
    try {
      const plans = await AdminCommerceV2Service.getPlans();
      return ok(res, plans);
    } catch (e) {
      logger.error('Admin get plans error', e);
      return serverError(res);
    }
  }

  static async updatePlan(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await AdminCommerceV2Service.updatePlan(id, req.body);
      return ok(res, result);
    } catch (e) {
      logger.error('Admin update plan error', e);
      return serverError(res);
    }
  }

  static async createPlan(req: Request, res: Response) {
    try {
      const result = await AdminCommerceV2Service.createPlan(req.body);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin create plan error', e);
      return badRequest(res, e.message || 'Failed to create plan');
    }
  }

  static async deletePlan(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await AdminCommerceV2Service.deletePlan(id);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin delete plan error', e);
      return badRequest(res, e.message || 'Failed to delete plan');
    }
  }

  static async getPlanEntitlements(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await AdminCommerceV2Service.getPlanEntitlements(id);
      return ok(res, result);
    } catch (e) {
      logger.error('Admin get entitlements error', e);
      return serverError(res);
    }
  }

  static async upsertEntitlement(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await AdminCommerceV2Service.upsertPlanEntitlement(id, req.body);
      return ok(res, result);
    } catch (e) {
      logger.error('Admin upsert entitlement error', e);
      return serverError(res);
    }
  }

  static async deleteEntitlement(req: Request, res: Response) {
    try {
      const id = req.params.entitlementId as string;
      const result = await AdminCommerceV2Service.deletePlanEntitlement(id);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin delete entitlement error', e);
      return badRequest(res, e.message || 'Failed to delete entitlement');
    }
  }

  static async getCoupons(req: Request, res: Response) {
    try {
      const result = await AdminCommerceV2Service.getCoupons();
      return ok(res, result);
    } catch (e) {
      logger.error('Admin get coupons error', e);
      return serverError(res);
    }
  }

  static async createCoupon(req: Request, res: Response) {
    try {
      const adminId = (req as AuthRequest).user!.id;
      const result = await AdminCommerceV2Service.createCoupon(adminId, req.body);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin create coupon error', e);
      return badRequest(res, e.message);
    }
  }

  static async toggleCoupon(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { is_active } = req.body;
      const result = await AdminCommerceV2Service.toggleCoupon(id, is_active);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin toggle coupon error', e);
      return badRequest(res, e.message);
    }
  }

  static async getSuspiciousReferrals(req: Request, res: Response) {
    try {
      const result = await AdminCommerceV2Service.getSuspiciousReferrals();
      return ok(res, result);
    } catch (e) {
      logger.error('Admin get suspicious referrals error', e);
      return serverError(res);
    }
  }

  static async reviewReferral(req: Request, res: Response) {
    try {
      const adminId = (req as AuthRequest).user!.id;
      const id = req.params.id as string;
      const { approve, note } = req.body;
      const result = await AdminCommerceV2Service.reviewReferral(adminId, id, approve, note);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin review referral error', e);
      return badRequest(res, e.message);
    }
  }

  static async getPendingWithdrawals(req: Request, res: Response) {
    try {
      const result = await AdminCommerceV2Service.getPendingWithdrawals();
      return ok(res, result);
    } catch (e) {
      logger.error('Admin get withdrawals error', e);
      return serverError(res);
    }
  }

  static async processWithdrawal(req: Request, res: Response) {
    try {
      const adminId = (req as AuthRequest).user!.id;
      const id = req.params.id as string;
      const { transaction_id, failure_reason } = req.body;
      const result = await AdminCommerceV2Service.processWithdrawal(adminId, id, transaction_id, failure_reason);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin process withdrawal error', e);
      return badRequest(res, e.message);
    }
  }

  static async createInfluencerCode(req: Request, res: Response) {
    try {
      const adminId = (req as AuthRequest).user!.id;
      const { user_id, code, pct, fixed, label } = req.body;
      const result = await AdminCommerceV2Service.createInfluencerCode(adminId, user_id, code, pct, fixed, label);
      return ok(res, result);
    } catch (e: any) {
      logger.error('Admin create influencer code error', e);
      return badRequest(res, e.message);
    }
  }
}
