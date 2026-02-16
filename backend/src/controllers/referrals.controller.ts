import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReferralsService } from '../services/referrals.service';
import logger from '../config/logger';

export class ReferralsController {
    /**
     * GET /api/referrals/info
     */
    static async getReferralInfo(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const info = await ReferralsService.getReferralInfo(userId);
            res.json(info);
        } catch (error) {
            logger.error('Get referral info error:', error);
            res.status(500).json({ error: 'Failed to fetch referral info' });
        }
    }

    /**
     * POST /api/referrals/apply
     */
    static async applyReferralCode(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { referral_code } = req.body;
            const signupIp = req.ip;

            const result = await ReferralsService.applyReferralCode(
                userId,
                referral_code,
                signupIp
            );

            res.json(result);
        } catch (error: any) {
            logger.error('Apply referral error:', error);

            const knownErrors = ['Invalid referral code', 'Cannot use your own referral code', 'Referral already applied'];
            if (knownErrors.includes(error.message)) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to apply referral code' });
        }
    }

    /**
     * GET /api/referrals/leaderboard
     */
    static async getLeaderboard(req: Request, res: Response) {
        try {
            const leaderboard = await ReferralsService.getReferralLeaderboard();
            res.json(leaderboard);
        } catch (error) {
            logger.error('Referral leaderboard error:', error);
            res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
    }

    /**
     * POST /api/referrals/withdraw
     */
    static async requestWithdrawal(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { amount, upi_id } = req.body;

            const result = await ReferralsService.requestWithdrawal(userId, amount, upi_id);
            res.json(result);
        } catch (error: any) {
            logger.error('Withdrawal error:', error);

            const knownErrors = ['Insufficient wallet balance', 'Minimum withdrawal amount is ₹1'];
            if (knownErrors.includes(error.message)) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Failed to process withdrawal' });
        }
    }
}
