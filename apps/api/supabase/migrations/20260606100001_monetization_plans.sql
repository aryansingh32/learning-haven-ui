-- ============================================
-- Migration 1: Drop legacy monetization tables + Create plans
-- ============================================
-- UP

-- Drop legacy monetization tables (order matters for FK deps)
DROP TABLE IF EXISTS public.coupon_usages CASCADE;
DROP TABLE IF EXISTS public.user_referral_codes CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.plans_config CASCADE;

-- Drop legacy types if they exist
DROP TYPE IF EXISTS public.plan_billing_cycle CASCADE;
DROP TYPE IF EXISTS public.plan_slug CASCADE;

-- Create enum types
CREATE TYPE public.plan_billing_cycle AS ENUM ('monthly', 'annual', 'lifetime', 'one_time');
CREATE TYPE public.plan_slug AS ENUM ('free', 'path_pack', 'pro', 'career_accelerator');

-- Plans table — single source of truth for all pricing
-- Admin controls everything: prices, names, features, visibility
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug public.plan_slug NOT NULL UNIQUE,
  description TEXT,
  tagline TEXT,                                              -- e.g. "The complete DSA OS experience"
  price_monthly INTEGER NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),  -- in paise
  price_annual INTEGER NOT NULL DEFAULT 0 CHECK (price_annual >= 0),    -- in paise
  price_lifetime INTEGER CHECK (price_lifetime >= 0),                   -- in paise, null = not available
  price_one_time INTEGER CHECK (price_one_time >= 0),                   -- for path packs / bundles
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,             -- "Most popular" badge
  highlight_label TEXT,                                      -- custom badge text
  badge_color TEXT DEFAULT '#6366f1',                        -- badge color hex
  features JSONB NOT NULL DEFAULT '[]',                      -- display features list
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',                      -- extensible: trial_days, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_plans_slug ON public.plans(slug);
CREATE INDEX idx_plans_active ON public.plans(is_active);
CREATE INDEX idx_plans_sort ON public.plans(sort_order);

-- Seed default plans (all prices in paise: ₹1 = 100 paise)
INSERT INTO public.plans (name, slug, description, tagline, price_monthly, price_annual, price_one_time, is_highlighted, highlight_label, features, sort_order) VALUES
(
  'Free',
  'free',
  'Start your DSA journey. No credit card required.',
  'Get started for free',
  0, 0, null, false, null,
  '["All 4 courses", "3 build challenges", "5 AI queries/day", "Community access", "Progress tracking"]'::jsonb,
  0
),
(
  'Path Pack',
  'path_pack',
  'One career path, one certificate, for life.',
  'Your career roadmap',
  0, 0, 29900, false, null,
  '["1 career path (Backend, Frontend, etc.)", "Path completion certificate", "20 AI queries/month", "Priority community support"]'::jsonb,
  1
),
(
  'Pro',
  'pro',
  'The complete DSA OS experience. Unlimited everything.',
  'Everything unlocked',
  9900, 79900, null, true, 'Most popular',
  '["All career paths", "Unlimited AI Mentor", "All certificates", "Resume builder", "Advanced analytics", "All build challenges", "Priority support"]'::jsonb,
  2
),
(
  'Career Accelerator',
  'career_accelerator',
  'From zero to placed. Mock interviews, resume review, job pipeline.',
  'Get placed in 6 months',
  0, 0, 199900, false, 'Best value',
  '["Everything in Pro", "3 mock interviews/month", "1:1 resume review", "Placement support pipeline", "Company-specific prep", "LinkedIn optimization", "Salary negotiation guide"]'::jsonb,
  3
);

-- ============================================
-- DOWN (rollback)
-- ============================================
-- DROP TABLE IF EXISTS public.plans CASCADE;
-- DROP TYPE IF EXISTS public.plan_billing_cycle CASCADE;
-- DROP TYPE IF EXISTS public.plan_slug CASCADE;
-- Then re-run the original 20260215000001_init.sql and 20260216000002_advanced_admin.sql tables
