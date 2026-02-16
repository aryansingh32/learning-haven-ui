import { supabase } from '../config/database';
import { PLANS, PlanId, getSubscriptionEndDate } from '../utils/plans';
import { CacheService } from './cache.service';
import logger from '../config/logger';

export class SubscriptionsService {
    /**
     * Get user's current active subscription
     */
    static async getActiveSubscription(userId: string) {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (!data) {
                return {
                    plan: 'free',
                    status: 'none',
                    features: ['Access to free problems', 'Basic progress tracking'],
                };
            }

            const plan = PLANS[data.plan_id as PlanId];

            return {
                id: data.id,
                plan: data.plan_id,
                plan_name: plan?.name || data.plan_id,
                status: data.status,
                features: plan?.features || [],
                current_period_start: data.current_period_start,
                current_period_end: data.current_period_end,
                cancel_at_period_end: data.cancel_at_period_end,
                amount: data.amount,
                currency: data.currency,
            };
        } catch (error) {
            logger.error('Get active subscription error:', { userId, error });
            throw new Error('Failed to fetch subscription');
        }
    }

    /**
     * Get all available plans
     */
    static getPlans() {
        return Object.values(PLANS).map(plan => ({
            id: plan.id,
            name: plan.name,
            price: plan.price,
            price_display: `₹${(plan.price / 100).toLocaleString('en-IN')}`,
            currency: plan.currency,
            interval: plan.interval,
            features: plan.features,
        }));
    }

    /**
     * Cancel subscription (at period end)
     */
    static async cancelSubscription(userId: string) {
        try {
            const { data: sub, error: fetchError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single();

            if (fetchError || !sub) {
                throw new Error('No active subscription found');
            }

            // Mark for cancellation at period end
            await supabase
                .from('subscriptions')
                .update({
                    cancel_at_period_end: true,
                    canceled_at: new Date().toISOString(),
                })
                .eq('id', sub.id);

            // Clear cache
            await CacheService.delPattern(`user:${userId}:*`);

            logger.info('Subscription scheduled for cancellation', {
                userId,
                subscriptionId: sub.id,
                cancelAt: sub.current_period_end,
            });

            return {
                message: 'Subscription will be canceled at the end of the current billing period',
                cancel_at: sub.current_period_end,
            };
        } catch (error: any) {
            logger.error('Cancel subscription error:', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Immediately cancel subscription (for refunds)
     */
    static async cancelImmediately(userId: string) {
        try {
            await supabase
                .from('subscriptions')
                .update({
                    status: 'canceled',
                    canceled_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .eq('status', 'active');

            // Downgrade user to free
            await supabase
                .from('users')
                .update({
                    current_plan: 'free',
                    plan_expires_at: null,
                })
                .eq('id', userId);

            // Clear cache
            await CacheService.delPattern(`user:${userId}:*`);

            logger.info('Subscription canceled immediately', { userId });

            return { message: 'Subscription canceled. Plan downgraded to free.' };
        } catch (error) {
            logger.error('Cancel immediately error:', { userId, error });
            throw new Error('Failed to cancel subscription');
        }
    }

    /**
     * Check and expire overdue subscriptions (cron job)
     */
    static async expireOverdueSubscriptions() {
        try {
            const now = new Date().toISOString();

            // Find subscriptions that need to expire
            const { data: expired } = await supabase
                .from('subscriptions')
                .select('id, user_id')
                .eq('status', 'active')
                .eq('cancel_at_period_end', true)
                .lte('current_period_end', now);

            if (!expired || expired.length === 0) {
                logger.info('No subscriptions to expire');
                return;
            }

            for (const sub of expired) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'expired' })
                    .eq('id', sub.id);

                await supabase
                    .from('users')
                    .update({ current_plan: 'free', plan_expires_at: null })
                    .eq('id', sub.user_id);

                await CacheService.delPattern(`user:${sub.user_id}:*`);
            }

            logger.info(`Expired ${expired.length} subscriptions`);
        } catch (error) {
            logger.error('Expire subscriptions cron error:', error);
        }
    }
}
