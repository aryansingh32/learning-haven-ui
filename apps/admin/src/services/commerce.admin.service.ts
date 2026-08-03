import api from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdminPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tagline?: string;
  price_monthly: number;
  price_annual: number;
  price_lifetime?: number | null;
  price_one_time?: number | null;
  features: string[];
  entitlements?: AdminPlanEntitlement[];
  is_active: boolean;
  is_highlighted?: boolean;
  highlight_label?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AdminPlanEntitlement {
  id?: string;
  feature_key: string;
  label?: string;
  entitlement_type: 'boolean' | 'numeric_limit' | 'resource_access';
  bool_value?: boolean | null;
  numeric_value?: number | null;
  resource_type?: string | null;
  resource_id?: string | null;
  description?: string | null;
}

export interface AdminCoupon {
  id: string;
  code: string;
  discount_percent?: number;
  discount_fixed?: number;
  min_amount?: number;
  max_discount?: number;
  max_uses?: number;
  used_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  applicable_plans?: string[];
  created_at: string;
}

export interface RevenueStats {
  total_revenue: number;
  revenue_today: number;
  revenue_this_month: number;
  revenue_last_month: number;
  mrr: number;
  arr: number;
  active_subscriptions: number;
  new_subscriptions_today: number;
  churn_rate: number;
  avg_revenue_per_user: number;
  ltv: number;
  total_orders: number;
  failed_orders: number;
  refunded_orders: number;
  pending_withdrawals: number;
  total_referral_payouts: number;
  conversion_rate: number;
  daily_revenue: Array<{ date: string; amount: number }>;
  plan_distribution: Array<{ plan: string; count: number; revenue: number }>;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const commerceAdminService = {
  // ── Plans ─────────────────────────────────────────────────────────────
  listPlans: async (): Promise<AdminPlan[]> => {
    const res = await api.get('/admin/commerce/v2/plans');
    return res.data?.data || res.data;
  },
  createPlan: async (data: Partial<AdminPlan>) => {
    const res = await api.post('/admin/commerce/v2/plans', data);
    return res.data?.data || res.data;
  },
  updatePlan: async (id: string, data: Partial<AdminPlan>) => {
    const res = await api.patch(`/admin/commerce/v2/plans/${id}`, data);
    return res.data?.data || res.data;
  },
  deletePlan: async (id: string) => {
    const res = await api.delete(`/admin/commerce/v2/plans/${id}`);
    return res.data?.data || res.data;
  },
  listPlanEntitlements: async (id: string): Promise<AdminPlanEntitlement[]> => {
    const res = await api.get(`/admin/commerce/v2/plans/${id}/entitlements`);
    return res.data?.data || res.data;
  },
  upsertPlanEntitlement: async (id: string, data: Partial<AdminPlanEntitlement>) => {
    const res = await api.post(`/admin/commerce/v2/plans/${id}/entitlements`, data);
    return res.data?.data || res.data;
  },
  deletePlanEntitlement: async (planId: string, entitlementId: string) => {
    const res = await api.delete(`/admin/commerce/v2/plans/${planId}/entitlements/${entitlementId}`);
    return res.data?.data || res.data;
  },

  // ── Coupons ───────────────────────────────────────────────────────────
  listCoupons: async (): Promise<AdminCoupon[]> => {
    const res = await api.get('/admin/coupons');
    return res.data;
  },
  createCoupon: async (data: Partial<AdminCoupon>) => {
    const res = await api.post('/admin/coupons', data);
    return res.data;
  },
  updateCoupon: async (id: string, data: Partial<AdminCoupon>) => {
    const res = await api.put(`/admin/coupons/${id}`, data);
    return res.data;
  },
  deleteCoupon: async (id: string) => {
    const res = await api.delete(`/admin/coupons/${id}`);
    return res.data;
  },

  // ── Revenue Analytics ─────────────────────────────────────────────────
  getRevenueStats: async (): Promise<RevenueStats> => {
    const res = await api.get('/admin/analytics/revenue');
    return res.data;
  },

  // ── Orders ────────────────────────────────────────────────────────────
  listOrders: async (page = 1, limit = 20) => {
    const res = await api.get(`/admin/orders?page=${page}&limit=${limit}`);
    return res.data;
  },
  refundOrder: async (orderId: string) => {
    const res = await api.post(`/admin/orders/${orderId}/refund`);
    return res.data;
  },
};
