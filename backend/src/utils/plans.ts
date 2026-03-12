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
        name: 'Basic',
        price: 29900, // ₹299
        currency: 'INR',
        interval: 'monthly',
        features: [
            'Guided 30-day roadmap',
            'Chapters 1-20',
            'WhatsApp daily tasks',
            '5 problems per chapter',
            '2 skip tokens/month'
        ],
        not_included: [
            'AI Doubt Solver',
            'Explorer Mode',
            'Resume Builder'
        ],
        problem_access: 'basic',
        ai_queries_limit: 0,
    },
    'standard-monthly': {
        id: 'standard-monthly',
        name: 'Standard',
        price: 49900, // ₹499
        currency: 'INR',
        interval: 'monthly',
        features: [
            'All roadmaps',
            'All chapters',
            'All problems',
            'College PYQs',
            'Daily job alerts',
            'Resume Builder',
            '4 skip tokens/month'
        ],
        not_included: [
            'AI Doubt Solver',
            'Explorer Mode'
        ],
        problem_access: 'standard',
        ai_queries_limit: 0,
    },
    'pro-monthly': {
        id: 'pro-monthly',
        name: 'Pro',
        price: 79900, // ₹799
        currency: 'INR',
        interval: 'monthly',
        features: [
            'Everything in Standard',
            'AI Doubt Solver (50/month)',
            'Explorer Mode (all chapters unlocked)',
            '10 skip tokens/month',
            'Priority college rank'
        ],
        not_included: [],
        problem_access: 'pro',
        ai_queries_limit: 50,
    },
    'basic-yearly': {
        id: 'basic-yearly',
        name: 'Basic',
        price: 299900, // ₹2,999
        currency: 'INR',
        interval: 'yearly',
        features: [
            'Guided 30-day roadmap',
            'Chapters 1-20',
            'WhatsApp daily tasks',
            '5 problems per chapter',
            '2 skip tokens/month'
        ],
        not_included: [
            'AI Doubt Solver',
            'Explorer Mode',
            'Resume Builder'
        ],
        problem_access: 'basic',
        ai_queries_limit: 0,
    },
    'standard-yearly': {
        id: 'standard-yearly',
        name: 'Standard',
        price: 449900, // ₹4,499
        currency: 'INR',
        interval: 'yearly',
        features: [
            'All roadmaps',
            'All chapters',
            'All problems',
            'College PYQs',
            'Daily job alerts',
            'Resume Builder',
            '4 skip tokens/month'
        ],
        not_included: [
            'AI Doubt Solver',
            'Explorer Mode'
        ],
        problem_access: 'standard',
        ai_queries_limit: 0,
    },
    'pro-yearly': {
        id: 'pro-yearly',
        name: 'Pro',
        price: 699900, // ₹6,999
        currency: 'INR',
        interval: 'yearly',
        features: [
            'Everything in Standard',
            'AI Doubt Solver (50/month)',
            'Explorer Mode (all chapters unlocked)',
            '10 skip tokens/month',
            'Priority college rank'
        ],
        not_included: [],
        problem_access: 'pro',
        ai_queries_limit: 50,
    }
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
                not_included: plan.metadata?.not_included || [],
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
