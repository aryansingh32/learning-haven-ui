import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';
import { PublicPaymentsController } from '../controllers/payments.public.controller';
import { authenticateUser } from '../../../middleware/auth';
import { requireIdempotencyKey } from '../../../middleware/idempotency';
import { webhookRateLimit } from '../../../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/payments/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', PublicPaymentsController.getPlans);

/**
 * Retired: create-order, validate-coupon and verify moved to /api/v2/payments, which
 * checks that an order belongs to the person confirming it and handles courses and
 * bundles. These answered for nobody in the apps any more; they now say where to go.
 */
const retired = (_req: unknown, res: any) =>
    res.status(410).json({ success: false, error: { code: 'GONE', message: 'Use /api/v2/payments instead.' } });
router.post('/create-order', retired);
router.post('/validate-coupon', retired);
router.post('/verify', retired);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Razorpay webhook events
 * @access  Public (verified by webhook signature)
 */
router.post('/webhook', webhookRateLimit, requireIdempotencyKey, PaymentsController.handleWebhook);

/**
 * @route   GET /api/payments/history
 * @desc    Get user's payment history
 * @access  Private
 */
router.get('/history', authenticateUser, PaymentsController.getPaymentHistory);

export default router;
