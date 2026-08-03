import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';
import { PublicPaymentsController } from '../controllers/payments.public.controller';
import { authenticateUser } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { createOrderSchema, verifyPaymentSchema } from '../../../utils/validators';
import { requireIdempotencyKey } from '../../../middleware/idempotency';
import { webhookRateLimit, writeRateLimit } from '../../../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/payments/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', PublicPaymentsController.getPlans);

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay order for a plan
 * @access  Private
 */
router.post(
    '/create-order',
    authenticateUser,
    writeRateLimit,
    requireIdempotencyKey,
    validate(createOrderSchema),
    PaymentsController.createOrder
);

/**
 * @route   POST /api/payments/validate-coupon
 * @desc    Validate a discount coupon
 * @access  Private
 */
router.post(
    '/validate-coupon',
    authenticateUser,
    PaymentsController.validateCoupon
);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment and activate subscription
 * @access  Private
 */
router.post(
    '/verify',
    authenticateUser,
    writeRateLimit,
    requireIdempotencyKey,
    validate(verifyPaymentSchema),
    PaymentsController.verifyPayment
);

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
