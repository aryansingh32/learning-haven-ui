import { supabase } from '../config/database';
import razorpay, { verifyPaymentSignature } from '../config/razorpay';
import { PLANS, PlanId, calculateGST, getSubscriptionEndDate } from '../utils/plans';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class PaymentsService {
    /**
     * Create a Razorpay order for a subscription plan
     */
    static async createOrder(userId: string, planId: PlanId) {
        const plan = PLANS[planId];
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

            // Create Razorpay order
            const order = await razorpay.orders.create({
                amount: plan.price,
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
                metadata: {
                    gst: calculateGST(plan.price),
                },
            });

            logger.info('Order created', { userId, planId, orderId: order.id });

            return {
                order_id: order.id,
                amount: plan.price,
                currency: plan.currency,
                plan: {
                    id: plan.id,
                    name: plan.name,
                    features: plan.features,
                },
                key_id: process.env.RAZORPAY_KEY_ID,
                gst_breakdown: calculateGST(plan.price),
            };
        } catch (error: any) {
            logger.error('Create order error:', { userId, planId, error: error.message });
            throw error;
        }
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

            return {
                success: true,
                subscription,
                plan: PLANS[planId],
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

            return data?.map(payment => ({
                ...payment,
                gst_breakdown: calculateGST(payment.amount),
                plan_name: PLANS[payment.plan_id as PlanId]?.name || payment.plan_id,
            })) || [];
        } catch (error) {
            logger.error('Get payment history error:', { userId, error });
            throw new Error('Failed to fetch payment history');
        }
    }
}
