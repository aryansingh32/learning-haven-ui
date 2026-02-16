/**
 * Subscription plan definitions
 * Supports both DB-driven (plans_config table) and hardcoded fallback.
 * Admin can manage plans dynamically via /api/admin/plans
 */
import { supabase } from '../config/database';
import logger from '../config/logger';

// ── Hardcoded fallback (used if DB is unavailable) ──────
export const PLANS_FALLBACK = {
    'basic-monthly': {
        id: 'basic-monthly',
        name: 'Basic Monthly',
        price: 29900, // ₹299
        currency: 'INR',
        interval: 'monthly',
        features: [
            'All free problems',
            'Hints for all problems',
            'Basic AI coach (50 queries/month)',
            'Progress tracking',
        ],
        problem_access: 'basic',
        ai_queries_limit: 50,
    },
    'basic-yearly': {
        id: 'basic-yearly',
        name: 'Basic Yearly',
        price: 249900, // ₹2,499 (save ~30%)
        currency: 'INR',
        interval: 'yearly',
        features: [
            'All Basic Monthly features',
            'Save 30% vs monthly',
        ],
        problem_access: 'basic',
        ai_queries_limit: 50,
    },
    'pro-monthly': {
        id: 'pro-monthly',
        name: 'Pro Monthly',
        price: 59900, // ₹599
        currency: 'INR',
        interval: 'monthly',
        features: [
            'All problems including premium',
            'Full solutions with explanations',
            'Unlimited AI coach',
            'Priority support',
            'Certificates',
            'Company-wise problem sets',
        ],
        problem_access: 'pro',
        ai_queries_limit: -1, // unlimited
    },
    'pro-yearly': {
        id: 'pro-yearly',
        name: 'Pro Yearly',
        price: 499900, // ₹4,999 (save ~30%)
        currency: 'INR',
        interval: 'yearly',
        features: [
            'All Pro Monthly features',
            'Save 30% vs monthly',
        ],
        problem_access: 'pro',
        ai_queries_limit: -1,
    },
} as Record<string, any>;

export type PlanId = string;

/**
 * Get plans from DB, falling back to hardcoded if unavailable
 */
let _cachedPlans: Record<string, any> | null = null;
let _cacheExpiry = 0;

export async function getPlans(): Promise<Record<string, any>> {
    // Return cache if fresh (5 min TTL)
    if (_cachedPlans && Date.now() < _cacheExpiry) {
        return _cachedPlans;
    }

    try {
        const { data, error } = await supabase
            .from('plans_config')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error || !data || data.length === 0) {
            logger.warn('plans_config table unavailable, using hardcoded fallback');
            return PLANS_FALLBACK;
        }

        const plans: Record<string, any> = {};
        for (const plan of data) {
            plans[plan.id] = {
                id: plan.id,
                name: plan.name,
                price: plan.price,
                currency: plan.currency || 'INR',
                interval: plan.interval,
                features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
                problem_access: plan.problem_access || 'basic',
                ai_queries_limit: plan.ai_queries_limit ?? 50,
                free_question_limit: plan.free_question_limit ?? 20,
            };
        }

        _cachedPlans = plans;
        _cacheExpiry = Date.now() + 5 * 60 * 1000;

        return plans;
    } catch (error) {
        logger.error('Error fetching plans from DB:', error);
        return PLANS_FALLBACK;
    }
}

/**
 * Invalidate plans cache (called after admin updates)
 */
export function invalidatePlansCache() {
    _cachedPlans = null;
    _cacheExpiry = 0;
}

/**
 * Keep backward compatibility — synchronous accessor for the hardcoded plans
 */
export const PLANS = PLANS_FALLBACK;

/**
 * GST rate (18% for digital services in India)
 */
export const GST_RATE = 0.18;

/**
 * Calculate amounts with GST breakdown
 */
export function calculateGST(amountInPaise: number) {
    // amount_in_paise includes GST already (MRP model)
    const baseAmount = Math.round(amountInPaise / (1 + GST_RATE));
    const gstAmount = amountInPaise - baseAmount;
    const cgst = Math.round(gstAmount / 2);
    const sgst = gstAmount - cgst;

    return {
        total: amountInPaise,
        base_amount: baseAmount,
        gst_amount: gstAmount,
        cgst,
        sgst,
        gst_rate: GST_RATE * 100, // 18%
    };
}

/**
 * Get subscription end date based on plan interval
 */
export function getSubscriptionEndDate(planId: PlanId, startDate: Date = new Date()): Date {
    const plan = PLANS_FALLBACK[planId as keyof typeof PLANS_FALLBACK];
    const endDate = new Date(startDate);

    if (plan?.interval === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
        endDate.setMonth(endDate.getMonth() + 1);
    }

    return endDate;
}
