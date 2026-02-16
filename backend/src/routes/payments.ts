import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';
import { authenticateUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, verifyPaymentSchema } from '../utils/validators';

const router = Router();

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay order for a plan
 * @access  Private
 */
router.post(
    '/create-order',
    authenticateUser,
    validate(createOrderSchema),
    PaymentsController.createOrder
);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment and activate subscription
 * @access  Private
 */
router.post(
    '/verify',
    authenticateUser,
    validate(verifyPaymentSchema),
    PaymentsController.verifyPayment
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Razorpay webhook events
 * @access  Public (verified by webhook signature)
 */
router.post('/webhook', PaymentsController.handleWebhook);

/**
 * @route   GET /api/payments/history
 * @desc    Get user's payment history
 * @access  Private
 */
router.get('/history', authenticateUser, PaymentsController.getPaymentHistory);

export default router;
