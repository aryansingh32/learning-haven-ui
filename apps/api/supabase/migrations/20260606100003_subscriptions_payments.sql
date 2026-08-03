-- ============================================
-- Migration 3: Subscriptions, Payments, Coupons
-- ============================================
-- UP

DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.coupon_type CASCADE;

CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'past_due', 'trialing');
CREATE TYPE public.payment_status AS ENUM ('created', 'authorized', 'captured', 'failed', 'refunded');
CREATE TYPE public.coupon_type AS ENUM ('percentage', 'fixed_amount');

-- ============================================
-- Subscriptions — tracks active plan ownership
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  billing_cycle public.plan_billing_cycle NOT NULL,
  amount_paid INTEGER NOT NULL CHECK (amount_paid >= 0),       -- actual amount charged (paise)
  currency TEXT NOT NULL DEFAULT 'INR',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  razorpay_subscription_id TEXT,
  trial_end TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- ============================================
-- Payments — immutable ledger of all transactions
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  
  -- Amounts (all in paise)
  amount INTEGER NOT NULL CHECK (amount >= 0),                 -- base price
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),  -- GST
  final_amount INTEGER NOT NULL CHECK (final_amount >= 0),     -- what was charged
  currency TEXT NOT NULL DEFAULT 'INR',
  
  -- Status
  status public.payment_status NOT NULL DEFAULT 'created',
  
  -- Razorpay
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  
  -- Coupon & Referral tracking
  coupon_id UUID,
  coupon_code TEXT,
  referral_id UUID,
  
  -- Product info
  billing_cycle public.plan_billing_cycle NOT NULL,
  description TEXT,
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  
  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_razorpay_order ON public.payments(razorpay_order_id);
CREATE INDEX idx_payments_razorpay_payment ON public.payments(razorpay_payment_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_plan ON public.payments(plan_id);
CREATE INDEX idx_payments_created ON public.payments(created_at DESC);

-- ============================================
-- Coupons — admin-managed discount codes
-- ============================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,                                                    -- admin label
  type public.coupon_type NOT NULL,
  value INTEGER NOT NULL CHECK (value > 0),                    -- paise for fixed, percentage for %
  max_discount INTEGER,                                         -- cap for percentage coupons (paise)
  max_uses INTEGER,                                             -- null = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  min_order_amount INTEGER NOT NULL DEFAULT 0,                 -- minimum order value (paise)
  applicable_plan_slugs TEXT[] DEFAULT '{}',                   -- empty = all plans
  applicable_billing_cycles TEXT[] DEFAULT '{}',               -- empty = all cycles
  one_use_per_user BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT false,                    -- show on pricing page
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_active ON public.coupons(is_active);

-- ============================================
-- Coupon Usages — track who used what
-- ============================================
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id),
  discount_applied INTEGER NOT NULL DEFAULT 0,                 -- actual discount given (paise)
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

CREATE INDEX idx_coupon_usages_coupon ON public.coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON public.coupon_usages(user_id);

-- ============================================
-- Seed a sample launch coupon (admin can create more via panel)
-- ============================================
INSERT INTO public.coupons (code, name, type, value, max_discount, max_uses, description, is_public)
VALUES ('LAUNCH50', 'Launch Day 50% Off', 'percentage', 50, 5000, 1000, '50% off on any plan, max ₹50 discount', true);

-- ============================================
-- DOWN (rollback)
-- ============================================
-- DROP TABLE IF EXISTS public.coupon_usages CASCADE;
-- DROP TABLE IF EXISTS public.coupons CASCADE;
-- DROP TABLE IF EXISTS public.payments CASCADE;
-- DROP TABLE IF EXISTS public.subscriptions CASCADE;
-- DROP TYPE IF EXISTS public.subscription_status CASCADE;
-- DROP TYPE IF EXISTS public.payment_status CASCADE;
-- DROP TYPE IF EXISTS public.coupon_type CASCADE;
