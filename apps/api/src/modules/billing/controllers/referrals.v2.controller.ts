import { Request, Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { ReferralsV2Service } from '../services/referrals.v2.service';
import { ok, badRequest, serverError } from '../../../utils/api-response';
import logger from '../../../config/logger';

export class ReferralsV2Controller {
  static async getMyCode(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await ReferralsV2Service.getOrCreateReferralCode(userId);
      return ok(res, result);
    } catch (error) {
      logger.error('Get referral code error', error);
      return serverError(res);
    }
  }

  static async getMyReferrals(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await ReferralsV2Service.getMyReferrals(userId);
      return ok(res, result);
    } catch (error) {
      logger.error('Get referrals error', error);
      return serverError(res);
    }
  }

  static async getEarnings(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await ReferralsV2Service.getEarnings(userId);
      return ok(res, result);
    } catch (error) {
      logger.error('Get earnings error', error);
      return serverError(res);
    }
  }

  static async getLeaderboard(req: Request, res: Response) {
    try {
      const result = await ReferralsV2Service.getLeaderboard();
      return ok(res, result);
    } catch (error) {
      logger.error('Get leaderboard error', error);
      return serverError(res);
    }
  }

  static async requestWithdrawal(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { amount, upi_id } = req.body;
      const result = await ReferralsV2Service.requestWithdrawal(userId, amount, upi_id);
      return ok(res, result);
    } catch (error: any) {
      logger.error('Withdrawal error', error);
      return badRequest(res, error.message);
    }
  }

  static async getWithdrawalHistory(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const result = await ReferralsV2Service.getWithdrawalHistory(userId);
      return ok(res, result);
    } catch (error) {
      logger.error('Get withdrawal history error', error);
      return serverError(res);
    }
  }
}
