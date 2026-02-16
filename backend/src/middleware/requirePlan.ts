import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { supabase } from '../config/database';
import logger from '../config/logger';

/**
 * Middleware to require a specific subscription plan
 * Usage: requirePlan('basic-monthly', 'basic-yearly', 'pro-monthly', 'pro-yearly')
 */
export function requirePlan(...allowedPlans: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as AuthRequest).user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get user's current plan
            const { data: user, error } = await supabase
                .from('users')
                .select('current_plan, plan_expires_at')
                .eq('id', userId)
                .single();

            if (error || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if plan is expired
            if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
                return res.status(403).json({
                    error: 'Your subscription has expired',
                    upgrade_url: '/subscriptions/plans',
                });
            }

            // Check if user's plan is in allowed plans
            if (user.current_plan === 'free' || !allowedPlans.includes(user.current_plan)) {
                return res.status(403).json({
                    error: 'This feature requires a premium subscription',
                    current_plan: user.current_plan,
                    required_plans: allowedPlans,
                    upgrade_url: '/subscriptions/plans',
                });
            }

            next();
        } catch (error) {
            logger.error('requirePlan middleware error:', error);
            res.status(500).json({ error: 'Failed to verify subscription' });
        }
    };
}

/**
 * Shortcut: require any paid plan
 */
export const requireAnyPlan = requirePlan(
    'basic-monthly',
    'basic-yearly',
    'pro-monthly',
    'pro-yearly'
);

/**
 * Shortcut: require Pro plan
 */
export const requireProPlan = requirePlan(
    'pro-monthly',
    'pro-yearly'
);
