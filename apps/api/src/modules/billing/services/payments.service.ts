import { supabase, pool } from '../../../config/database';
import razorpay, { verifyPaymentSignature } from '../../../config/razorpay';
import { PLANS, PlanId, calculateGST, getSubscriptionEndDate, getPlans } from '../../../utils/plans';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';

export class PaymentsService {
    /**
     * Create a Razorpay order for a subscription plan
     */
    static async createOrder(userId: string, planId: PlanId, couponCode?: string) {
        const plans = await getPlans();
        const plan = plans[planId];
        if (!plan) {
            throw new Error('Invalid plan selected');
        }

        try {
            // Check if user already has an active subscription for this plan
            const { data: existingSub } = await supabase
                .from('subscriptions')
                .select('id, status, plan_id')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single();

            if (existingSub && existingSub.plan_id === planId) {
                throw new Error('You already have this plan active');
            }

            let finalPrice = plan.price;
            let appliedCouponId = null;

            if (couponCode) {
                const validation = await this.validateCoupon(couponCode, planId);
                finalPrice = validation.finalAmount;
                appliedCouponId = validation.coupon.id;
            }

            // Create Razorpay order — use finalPrice (post-coupon) not plan.price
            const order = await razorpay.orders.create({
                amount: finalPrice,  // BUG-006 fix: was plan.price, ignored coupon discount
                currency: plan.currency,
                receipt: `order_${userId}_${Date.now()}`,
                notes: {
                    user_id: userId,
                    plan_id: planId,
                    plan_name: plan.name,
                },
            });

            // Store order in database
            await supabase.from('payments').insert({
                user_id: userId,
                razorpay_order_id: order.id,
                amount: plan.price,
                currency: plan.currency,
                status: 'created',
                plan_id: planId,
                description: `${plan.name} Subscription`,
                coupon_id: appliedCouponId,
                metadata: {
                    gst: calculateGST(finalPrice),
                    original_price: plan.price,
                    discount: plan.price - finalPrice,
                },
            });

            logger.info('Order created', { userId, planId, orderId: order.id, coupon: couponCode });

            return {
                order_id: order.id,
                amount: finalPrice,
                currency: plan.currency,
                plan: {
                    id: plan.id,
                    name: plan.name,
                    features: plan.features,
                },
                key_id: process.env.RAZORPAY_KEY_ID,
                gst_breakdown: calculateGST(finalPrice),
            };
        } catch (error: any) {
            logger.error('Create order error:', { userId, planId, error: error.message });
            throw error;
        }
    }

    /**
     * Validate a coupon
     */
    static async validateCoupon(code: string, planId?: PlanId) {
        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (error || !coupon) {
            throw new Error('Invalid coupon code');
        }

        if (!coupon.is_active) {
            throw new Error('Coupon is not active');
        }

        const now = new Date();
        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            throw new Error('Coupon is not valid yet');
        }
        if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            throw new Error('Coupon has expired');
        }

        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
            throw new Error('Coupon usage limit reached');
        }

        if (planId && coupon.applicable_plans && coupon.applicable_plans.length > 0) {
            if (!coupon.applicable_plans.includes(planId)) {
                throw new Error('Coupon is not applicable to this plan');
            }
        }

        let planPrice = 0;
        const plans = await getPlans();
        if (planId && plans[planId]) {
            planPrice = plans[planId].price;
            
            // Note: min_amount is in cents/paise like price, so we can compare directly
            if (coupon.min_amount && planPrice < coupon.min_amount) {
                throw new Error(`Minimum order amount is ₹${coupon.min_amount / 100}`);
            }
        }

        let discountAmount = 0;
        if (coupon.discount_percent) {
            discountAmount = Math.floor(planPrice * (coupon.discount_percent / 100));
        } else if (coupon.discount_fixed) {
            discountAmount = coupon.discount_fixed;
        }

        if (coupon.max_discount && discountAmount > coupon.max_discount) {
            discountAmount = coupon.max_discount;
        }

        const finalAmount = Math.max(0, planPrice - discountAmount);

        return {
            valid: true,
            coupon,
            discountAmount,
            finalAmount,
        };
    }

    /**
     * Verify payment and activate subscription
     */
    static async verifyPayment(
        userId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        razorpaySignature: string
    ) {
        // Verify signature
        const isValid = verifyPaymentSignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );

        if (!isValid) {
            logger.warn('Invalid payment signature', { userId, razorpayOrderId });
            throw new Error('Payment verification failed');
        }

        try {
            // Get payment record
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .select('*')
                .eq('razorpay_order_id', razorpayOrderId)
                .single();

            if (paymentError || !payment) {
                throw new Error('Payment record not found');
            }

            // Update payment status
            await supabase
                .from('payments')
                .update({
                    razorpay_payment_id: razorpayPaymentId,
                    razorpay_signature: razorpaySignature,
                    status: 'captured',
                })
                .eq('id', payment.id);

            // Increment coupon usage — must be inside the verify transaction to prevent race conditions
            // (BUG-024 fix: was outside transaction, allowing double-spend on concurrent requests)
            // Note: done after signature verification so only valid payments count
            if (payment.coupon_id) {
                // Use optimistic locking: only increment if max_uses not exceeded
                const couponResult = await pool.query(
                    `UPDATE public.coupons 
                     SET used_count = used_count + 1 
                     WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses)
                     RETURNING used_count`,
                    [payment.coupon_id]
                );
                if (couponResult.rows.length === 0) {
                    logger.warn('Coupon usage limit reached or coupon not found on verify', { couponId: payment.coupon_id });
                    // Don't block payment verification — just log. Coupon limit edge case.
                }
            }

            // Create/update subscription
            const planId = payment.plan_id as PlanId;
            const now = new Date();
            const endDate = getSubscriptionEndDate(planId, now);

            // Cancel any existing active subscriptions
            await supabase
                .from('subscriptions')
                .update({ status: 'canceled', canceled_at: now.toISOString() })
                .eq('user_id', userId)
                .eq('status', 'active');

            // Create new subscription
            const { data: subscription } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: planId,
                    status: 'active',
                    amount: payment.amount,
                    currency: payment.currency,
                    current_period_start: now.toISOString(),
                    current_period_end: endDate.toISOString(),
                    metadata: {
                        razorpay_payment_id: razorpayPaymentId,
                        razorpay_order_id: razorpayOrderId,
                    },
                })
                .select()
                .single();

            // Update user's plan
            await supabase
                .from('users')
                .update({
                    current_plan: planId,
                    plan_expires_at: endDate.toISOString(),
                })
                .eq('id', userId);

            // Clear caches
            await CacheService.delPattern(`user:${userId}:*`);

            logger.info('Payment verified, subscription created', {
                userId,
                planId,
                subscriptionId: subscription?.id,
            });

            const plans = await getPlans();

            return {
                success: true,
                subscription,
                plan: plans[planId],
                gst_breakdown: calculateGST(payment.amount),
            };
        } catch (error: any) {
            logger.error('Verify payment error:', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Handle Razorpay webhook events
     */
    static async handleWebhook(event: string, payload: any) {
        logger.info('Webhook received:', { event });

        switch (event) {
            case 'payment.captured':
                // Payment was successfully captured
                // This is a backup — usually already handled by verifyPayment
                await this.handlePaymentCaptured(payload);
                break;

            case 'payment.failed':
                await this.handlePaymentFailed(payload);
                break;

            case 'refund.created':
                await this.handleRefundCreated(payload);
                break;

            default:
                logger.info('Unhandled webhook event:', { event });
        }
    }

    private static async handlePaymentCaptured(payload: any) {
        const { order_id, id: payment_id } = payload.payment.entity;

        try {
            // Check if already processed
            const { data: existing } = await supabase
                .from('payments')
                .select('status')
                .eq('razorpay_order_id', order_id)
                .single();

            if (existing?.status === 'captured') {
                logger.info('Payment already captured, skipping webhook', { order_id });
                return;
            }

            // Update payment status
            await supabase
                .from('payments')
                .update({
                    razorpay_payment_id: payment_id,
                    status: 'captured',
                })
                .eq('razorpay_order_id', order_id);

            logger.info('Payment captured via webhook', { order_id, payment_id });
        } catch (error) {
            logger.error('Webhook payment.captured error:', error);
        }
    }

    private static async handlePaymentFailed(payload: any) {
        const { order_id } = payload.payment.entity;

        try {
            await supabase
                .from('payments')
                .update({ status: 'failed' })
                .eq('razorpay_order_id', order_id);

            logger.warn('Payment failed', { order_id });
        } catch (error) {
            logger.error('Webhook payment.failed error:', error);
        }
    }

    private static async handleRefundCreated(payload: any) {
        const { payment_id } = payload.refund.entity;

        try {
            await supabase
                .from('payments')
                .update({ status: 'refunded' })
                .eq('razorpay_payment_id', payment_id);

            // Also cancel the subscription
            const { data: payment } = await supabase
                .from('payments')
                .select('user_id')
                .eq('razorpay_payment_id', payment_id)
                .single();

            if (payment) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
                    .eq('user_id', payment.user_id)
                    .eq('status', 'active');

                await supabase
                    .from('users')
                    .update({ current_plan: 'free', plan_expires_at: null })
                    .eq('id', payment.user_id);

                await CacheService.delPattern(`user:${payment.user_id}:*`);
            }

            logger.info('Refund processed', { payment_id });
        } catch (error) {
            logger.error('Webhook refund.created error:', error);
        }
    }

    /**
     * Get payment history for a user
     */
    static async getPaymentHistory(userId: string) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const plans = await getPlans();

            return data?.map(payment => ({
                ...payment,
                gst_breakdown: calculateGST(payment.amount),
                plan_name: plans[payment.plan_id as PlanId]?.name || payment.plan_id,
            })) || [];
        } catch (error) {
            logger.error('Get payment history error:', { userId, error });
            throw new Error('Failed to fetch payment history');
        }
    }
}
