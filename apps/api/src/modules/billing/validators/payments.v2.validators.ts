import { z } from 'zod';

export const createOrderV2Schema = z.object({
  body: z.object({
    plan_id: z.string().uuid('Invalid plan ID format'),
    billing_cycle: z.enum(['monthly', 'annual', 'lifetime', 'one_time']),
    coupon_code: z.string().max(50).optional(),
  }),
});

export const verifyPaymentV2Schema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1, 'Order ID is required'),
    razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
    razorpay_signature: z.string().min(1, 'Signature is required'),
  }),
});

export const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(50),
    plan_slug: z.string().optional(),
  }),
});

export const cancelSubscriptionSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});
