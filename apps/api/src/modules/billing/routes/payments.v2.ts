import { Router } from 'express';
import { PaymentsV2Controller } from '../controllers/payments.v2.controller';
import { authenticateUser } from '../../../middleware/auth';
import { validate } from '../../../middleware/validate';
import { webhookRateLimit, writeRateLimit } from '../../../middleware/rateLimit';
import { z } from 'zod';

const router = Router();

// Zod schemas (inline for brevity, better in validators.ts)
const createOrderV2Schema = z.object({
  body: z.object({
    plan_id: z.string().uuid(),
    billing_cycle: z.enum(['monthly', 'annual', 'lifetime', 'one_time']),
    coupon_code: z.string().max(50).optional(),
    resource_type: z.enum(['course', 'career_path', 'project', 'apprenticeship_program']).optional(),
    resource_id: z.string().uuid().optional(),
  }),
});

const verifyPaymentV2Schema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});

const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(50),
    plan_slug: z.string().optional(),
    billing_cycle: z.enum(['monthly', 'annual', 'lifetime', 'one_time']).optional(),
  }),
});

// Routes
router.get('/plans', PaymentsV2Controller.getPlans);

router.get('/subscription', authenticateUser, PaymentsV2Controller.getCurrentSubscription);

router.post(
  '/create-order',
  authenticateUser,
  writeRateLimit,
  validate(createOrderV2Schema),
  PaymentsV2Controller.createOrder
);

router.post(
  '/verify',
  authenticateUser,
  writeRateLimit,
  validate(verifyPaymentV2Schema),
  PaymentsV2Controller.verifyPayment
);

router.post('/webhook', webhookRateLimit, PaymentsV2Controller.handleWebhook);

router.post(
  '/validate-coupon',
  authenticateUser,
  validate(validateCouponSchema),
  PaymentsV2Controller.validateCoupon
);

router.post('/cancel-subscription', authenticateUser, PaymentsV2Controller.cancelSubscription);

router.get('/history', authenticateUser, PaymentsV2Controller.getPaymentHistory);

export default router;
