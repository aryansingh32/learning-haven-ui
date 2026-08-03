-- ============================================
-- Migration 5: Row Level Security for all monetization tables
-- ============================================
-- UP

-- Enable RLS on all monetization tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Plans & Entitlements: public read, admin write
-- (Like Coursera — plans are visible to everyone)
-- ============================================
DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
CREATE POLICY "plans_public_read" ON public.plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "plans_admin_all" ON public.plans;
CREATE POLICY "plans_admin_all" ON public.plans
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "entitlements_public_read" ON public.plan_entitlements;
CREATE POLICY "entitlements_public_read" ON public.plan_entitlements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "entitlements_admin_all" ON public.plan_entitlements;
CREATE POLICY "entitlements_admin_all" ON public.plan_entitlements
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Subscriptions: user sees own, admin sees/manages all
-- ============================================
DROP POLICY IF EXISTS "subscriptions_user_read" ON public.subscriptions;
CREATE POLICY "subscriptions_user_read" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Payments: user sees own, admin sees all
-- ============================================
DROP POLICY IF EXISTS "payments_user_read" ON public.payments;
CREATE POLICY "payments_user_read" ON public.payments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Coupons: authenticated users read active (for validation), admin manages
-- ============================================
DROP POLICY IF EXISTS "coupons_authenticated_read" ON public.coupons;
CREATE POLICY "coupons_authenticated_read" ON public.coupons
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupons;
CREATE POLICY "coupons_admin_all" ON public.coupons
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Coupon Usages: user sees own, admin sees all
-- ============================================
DROP POLICY IF EXISTS "coupon_usages_user_read" ON public.coupon_usages;
CREATE POLICY "coupon_usages_user_read" ON public.coupon_usages
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coupon_usages_admin_all" ON public.coupon_usages;
CREATE POLICY "coupon_usages_admin_all" ON public.coupon_usages
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Referral Codes: user sees own, admin manages all
-- ============================================
DROP POLICY IF EXISTS "referral_codes_user_read" ON public.referral_codes;
CREATE POLICY "referral_codes_user_read" ON public.referral_codes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "referral_codes_user_insert" ON public.referral_codes;
CREATE POLICY "referral_codes_user_insert" ON public.referral_codes
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_custom = false);

DROP POLICY IF EXISTS "referral_codes_admin_all" ON public.referral_codes;
CREATE POLICY "referral_codes_admin_all" ON public.referral_codes
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Referrals: referrer sees own, admin sees/manages all
-- ============================================
DROP POLICY IF EXISTS "referrals_referrer_read" ON public.referrals;
CREATE POLICY "referrals_referrer_read" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid());

DROP POLICY IF EXISTS "referrals_admin_all" ON public.referrals;
CREATE POLICY "referrals_admin_all" ON public.referrals
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Commission Tiers: public read, admin manages
-- ============================================
DROP POLICY IF EXISTS "commission_tiers_public_read" ON public.referral_commission_tiers;
CREATE POLICY "commission_tiers_public_read" ON public.referral_commission_tiers
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "commission_tiers_admin_all" ON public.referral_commission_tiers;
CREATE POLICY "commission_tiers_admin_all" ON public.referral_commission_tiers
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Withdrawals: user sees/creates own, admin processes
-- ============================================
DROP POLICY IF EXISTS "withdrawals_user_read" ON public.withdrawals;
CREATE POLICY "withdrawals_user_read" ON public.withdrawals
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawals_user_insert" ON public.withdrawals;
CREATE POLICY "withdrawals_user_insert" ON public.withdrawals
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawals_admin_all" ON public.withdrawals;
CREATE POLICY "withdrawals_admin_all" ON public.withdrawals
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

-- ============================================
-- Service role bypass (for backend API server)
-- The service role key bypasses RLS by default in Supabase,
-- so no additional policies needed for server-side operations.
-- ============================================

-- ============================================
-- DOWN (rollback)
-- ============================================
-- Drop all policies and disable RLS (reverse order)
-- ALTER TABLE public.withdrawals DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.referral_commission_tiers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.referrals DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.referral_codes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coupon_usages DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.plan_entitlements DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
