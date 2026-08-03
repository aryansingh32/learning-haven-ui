import { supabase, pool } from '../../../config/database';
import logger from '../../../config/logger';

export class AdminCommerceService {
    // ── Plans ─────────────────────────────────────────────────────────────
    static async listPlans() {
        const { data, error } = await supabase
            .from('plans_config')
            .select('*')
            .order('order_index', { ascending: true });
        if (error) throw error;
        return data;
    }

    static async createPlan(data: any) {
        const { data: created, error } = await supabase
            .from('plans_config')
            .insert([data])
            .select()
            .single();
        if (error) throw error;
        
        // Invalidate cache (could trigger an API route or let utils/plans handle it over time,
        // but we'll manually clear if needed, or let 5 min TTL expire)
        return created;
    }

    static async updatePlan(id: string, data: any) {
        const { data: updated, error } = await supabase
            .from('plans_config')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return updated;
    }

    static async deletePlan(id: string) {
        const { error } = await supabase
            .from('plans_config')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { success: true };
    }
    // ── Coupons ───────────────────────────────────────────────────────────
    static async listCoupons() {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    static async createCoupon(data: any) {
        const { data: created, error } = await supabase
            .from('coupons')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return created;
    }

    static async updateCoupon(id: string, data: any) {
        const { data: updated, error } = await supabase
            .from('coupons')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return updated;
    }

    static async deleteCoupon(id: string) {
        const { error } = await supabase
            .from('coupons')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    }

    // ── Revenue Analytics ─────────────────────────────────────────────────
    static async getRevenueStats() {
        try {
            // Get total revenue from payments
            const paymentsResult = await pool.query(`
                SELECT 
                    SUM(amount) as total_revenue,
                    SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount ELSE 0 END) as revenue_today,
                    SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END) as revenue_this_month,
                    SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') 
                             AND created_at < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END) as revenue_last_month,
                    COUNT(*) as total_orders
                FROM public.payments
                WHERE status = 'captured' OR status = 'paid'
            `);
            
            const stats = paymentsResult.rows[0];

            // Get subscriptions count
            const subsResult = await pool.query(`
                SELECT COUNT(*) as active_subscriptions
                FROM public.subscriptions
                WHERE status = 'active'
            `);

            // Compute daily revenue for chart
            const dailyResult = await pool.query(`
                SELECT date_trunc('day', created_at) as date, SUM(amount) as amount
                FROM public.payments
                WHERE (status = 'captured' OR status = 'paid') 
                  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY date_trunc('day', created_at)
                ORDER BY date ASC
            `);

            return {
                total_revenue: parseFloat(stats.total_revenue || '0'),
                revenue_today: parseFloat(stats.revenue_today || '0'),
                revenue_this_month: parseFloat(stats.revenue_this_month || '0'),
                revenue_last_month: parseFloat(stats.revenue_last_month || '0'),
                total_orders: parseInt(stats.total_orders || '0', 10),
                active_subscriptions: parseInt(subsResult.rows[0].active_subscriptions || '0', 10),
                daily_revenue: dailyResult.rows.map(row => ({
                    date: row.date.toISOString().split('T')[0],
                    amount: parseFloat(row.amount)
                })),
                // Placeholders for advanced metrics
                mrr: 0,
                arr: 0,
                new_subscriptions_today: 0,
                churn_rate: 0,
                avg_revenue_per_user: 0,
                ltv: 0,
                failed_orders: 0,
                refunded_orders: 0,
                pending_withdrawals: 0,
                total_referral_payouts: 0,
                conversion_rate: 0,
                plan_distribution: []
            };
        } catch (error) {
            logger.error('Admin getRevenueStats error:', error);
            throw new Error('Failed to get revenue stats');
        }
    }
}
