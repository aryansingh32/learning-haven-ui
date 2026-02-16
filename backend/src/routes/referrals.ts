import { Router } from 'express';
import { ReferralsController } from '../controllers/referrals.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { applyReferralSchema, withdrawalSchema } from '../utils/validators';

const router = Router();

/**
 * @route   GET /api/referrals/info
 * @desc    Get user's referral info, code, and stats
 * @access  Private
 */
router.get('/info', authenticateUser, ReferralsController.getReferralInfo);

/**
 * @route   POST /api/referrals/apply
 * @desc    Apply a referral code
 * @access  Private
 */
router.post(
    '/apply',
    authenticateUser,
    validate(applyReferralSchema),
    ReferralsController.applyReferralCode
);

/**
 * @route   GET /api/referrals/leaderboard
 * @desc    Get referral leaderboard
 * @access  Public
 */
router.get('/leaderboard', ReferralsController.getLeaderboard);

/**
 * @route   POST /api/referrals/withdraw
 * @desc    Request wallet withdrawal
 * @access  Private
 */
router.post(
    '/withdraw',
    authenticateUser,
    validate(withdrawalSchema),
    ReferralsController.requestWithdrawal
);

export default router;
