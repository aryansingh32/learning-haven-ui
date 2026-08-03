import { Router } from 'express';
import { ReferralsV2Controller } from '../controllers/referrals.v2.controller';
import { authenticateUser } from '../../../middleware/auth';
import { writeRateLimit } from '../../../middleware/rateLimit';
import { validate } from '../../../middleware/validate';
import { z } from 'zod';

const router = Router();

const withdrawalV2Schema = z.object({
  body: z.object({
    amount: z.number().int().min(10000, 'Minimum withdrawal is ₹100'),
    upi_id: z.string().min(5).max(50).regex(/.+@.+/, 'Invalid UPI ID format'),
  }),
});

// Public routes
router.get('/leaderboard', ReferralsV2Controller.getLeaderboard);

// Authenticated routes
router.use(authenticateUser);

router.get('/my-code', ReferralsV2Controller.getMyCode);
router.get('/my-referrals', ReferralsV2Controller.getMyReferrals);
router.get('/earnings', ReferralsV2Controller.getEarnings);
router.get('/withdrawals', ReferralsV2Controller.getWithdrawalHistory);

router.post(
  '/withdraw',
  writeRateLimit,
  validate(withdrawalV2Schema),
  ReferralsV2Controller.requestWithdrawal
);

export default router;
