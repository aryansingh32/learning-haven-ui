/**
 * CommerceService — Frontend data layer for Products, Plans, and Orders.
 *
 * Provides hooks and types for the commerce system.
 * Works with existing backend endpoints:
 *   - GET /payments/plans → available plans
 *   - POST /payments/create-order → Razorpay order creation
 *   - POST /payments/verify → payment verification
 *   - GET /subscriptions/current → active subscription
 *
 * Extends with new product types and coupon support.
 */

import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { useAuth } from '@/context/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProductType =
  | 'course'
  | 'learning_path'
  | 'project_pack'
  | 'certificate_program'
  | 'career_accelerator'
  | 'subscription'
  | 'ai_upgrade';

export type BillingInterval = 'one_time' | 'monthly' | 'yearly' | 'lifetime';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  description: string;
  price: number;              // in smallest currency unit (paise)
  currency: string;
  discount_price?: number;
  billing_interval: BillingInterval;
  features: string[];
  not_included?: string[];
  thumbnail?: string;
  banner?: string;
  is_visible: boolean;
  is_popular?: boolean;
  included_content?: string[];
  included_projects?: string[];
  included_certificates?: string[];
  included_ai_features?: string[];
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: BillingInterval;
  features: string[];
  not_included?: string[];
  is_popular?: boolean;
  trial_days?: number;
  included_products?: string[];
  ai_queries_per_day?: number;
  status: 'active' | 'inactive';
}

export interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface Order {
  id: string;
  product_id?: string;
  plan_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  coupon_code?: string;
  discount_amount?: number;
  referral_code?: string;
  created_at: string;
}

export interface Coupon {
  code: string;
  discount_percent?: number;
  discount_fixed?: number;
  valid: boolean;
  message?: string;
  min_amount?: number;
  max_discount?: number;
  expires_at?: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** Fetch available pricing plans */
export function usePlans(interval?: BillingInterval) {
  const query = useApiQuery<Plan[]>(
    ['pricing-plans', interval],
    '/payments/plans',
    { staleTime: 60_000 },
  );

  const filteredPlans = interval
    ? query.data?.filter(p => p.interval === interval)
    : query.data;

  return { ...query, data: filteredPlans };
}

/** Fetch current user subscription */
export function useSubscription() {
  const { isAuthenticated } = useAuth();
  return useApiQuery<Subscription>(
    ['current-subscription'],
    '/subscriptions/current',
    { enabled: isAuthenticated, staleTime: 30_000 },
  );
}

/** Fetch user's order history */
export function useOrders() {
  const { isAuthenticated } = useAuth();
  return useApiQuery<Order[]>(
    ['user-orders'],
    '/payments/orders',
    { enabled: isAuthenticated },
  );
}

/** Validate a coupon code */
export function useValidateCoupon() {
  return useApiMutation<Coupon, { code: string; plan_id?: string }>(
    (variables) => api.post('/payments/validate-coupon', variables),
  );
}

/** Create a Razorpay order */
export function useCreateOrder() {
  return useApiMutation<any, { plan_id: string; coupon_code?: string; referral_code?: string }>(
    (variables) => api.post('/payments/create-order', variables),
  );
}

/** Verify Razorpay payment */
export function useVerifyPayment() {
  return useApiMutation<any, {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>(
    (variables) => api.post('/payments/verify', variables),
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Format price from paise to rupees */
export function formatPrice(paise: number, currency = 'INR'): string {
  const amount = paise / 100;
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  return `${amount} ${currency}`;
}

/** Get interval display text */
export function formatInterval(interval: BillingInterval): string {
  switch (interval) {
    case 'monthly': return '/month';
    case 'yearly': return '/year';
    case 'lifetime': return 'lifetime';
    case 'one_time': return 'one-time';
    default: return '';
  }
}

/** Calculate savings between monthly and yearly */
export function calculateSavings(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyEquivalent = monthlyPrice * 12;
  return Math.round(((yearlyEquivalent - yearlyPrice) / yearlyEquivalent) * 100);
}

/** Load Razorpay SDK dynamically */
export function loadRazorpaySDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
