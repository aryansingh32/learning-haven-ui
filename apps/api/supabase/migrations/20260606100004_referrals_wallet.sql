-- ============================================
-- Migration 4: Referrals, Wallet, Withdrawals
-- ============================================
-- UP

DROP TYPE IF EXISTS public.referral_status CASCADE;
DROP TYPE IF EXISTS public.withdrawal_status CASCADE;

CREATE TYPE public.referral_status AS ENUM ('pending', 'active', 'suspicious', 'rejected', 'expired');
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'rejected');

-- ============================================
-- Referral Codes — one per user, optionally custom for influencers
-- ============================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_custom BOOLEAN NOT NULL DEFAULT false,                   -- admin-created influencer code
  custom_label TEXT,                                           -- e.g. "Priya's Code" for admin tracking
  custom_commission_pct INTEGER CHECK (custom_commission_pct IS NULL OR (custom_commission_pct BETWEEN 0 AND 100)),
  custom_commission_fixed INTEGER CHECK (custom_commission_fixed IS NULL OR custom_commission_fixed >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings INTEGER NOT NULL DEFAULT 0,                   -- paise
  created_by_admin UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_code_per_user UNIQUE(user_id, is_custom) -- only 1 default code per user
);

-- Note: the UNIQUE constraint above prevents duplicate default codes but allows 
-- multiple custom codes. We'll handle the business logic in the service layer.

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_referral_codes_user ON public.referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

-- ============================================
-- Referrals — tracks each referral relationship
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  referral_code_id UUID REFERENCES public.referral_codes(id),
  referral_code_used TEXT NOT NULL,                            -- snapshot of code used
  
  -- Status & Reward
  status public.referral_status NOT NULL DEFAULT 'pending',
  payment_id UUID,                                             -- first payment by referred user
  earned_amount INTEGER NOT NULL DEFAULT 0,                    -- commission earned (paise)
  commission_pct INTEGER NOT NULL DEFAULT 10,                  -- commission % applied
  
  -- Fraud Detection
  fraud_score INTEGER NOT NULL DEFAULT 0 CHECK (fraud_score BETWEEN 0 AND 100),
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  signup_ip INET,
  signup_device_fingerprint TEXT,
  fraud_reasons JSONB DEFAULT '[]',                            -- array of reasons
  
  -- Commission timing
  credit_eligible_at TIMESTAMPTZ,                              -- NOW() + 7 days after payment
  credited_at TIMESTAMPTZ,
  
  -- Admin actions
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT no_self_referral CHECK (referrer_id != referred_user_id)
);

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_credit_eligible ON public.referrals(credit_eligible_at) WHERE status = 'pending';

-- ============================================
-- Referral Commission Tiers — admin-managed progression
-- ============================================
CREATE TABLE IF NOT EXISTS public.referral_commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  emoji TEXT DEFAULT '🥉',
  min_referrals INTEGER NOT NULL,
  max_referrals INTEGER,                                       -- null = unlimited
  commission_pct INTEGER NOT NULL CHECK (commission_pct BETWEEN 0 AND 100),
  bonus_amount INTEGER DEFAULT 0,                              -- flat bonus per referral (paise)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_referral_commission_tiers_updated_at
  BEFORE UPDATE ON public.referral_commission_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed default tiers
INSERT INTO public.referral_commission_tiers (tier_name, emoji, min_referrals, max_referrals, commission_pct, sort_order) VALUES
('Bronze', '🥉', 0, 4, 10, 0),
('Silver', '🥈', 5, 14, 15, 1),
('Gold', '🥇', 15, 29, 20, 2),
('Platinum', '💎', 30, null, 25, 3);

-- ============================================
-- Withdrawals — UPI payout requests
-- ============================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 10000),             -- minimum ₹100 = 10000 paise
  upi_id TEXT NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  
  -- Processing
  transaction_id TEXT,                                         -- UPI transaction ref
  failure_reason TEXT,
  admin_note TEXT,
  
  -- Admin tracking
  processed_by UUID REFERENCES public.users(id),
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);

-- ============================================
-- Update users table for new monetization fields
-- ============================================

-- Update current_plan CHECK constraint for new plan slugs
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS valid_current_plan;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_current_plan_check;

-- Add new columns if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_referral_earnings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_subscription_id UUID;

-- Update current_plan to accept new slugs (alter the check)
DO $$
BEGIN
  -- Drop any existing check on current_plan
  EXECUTE (
    SELECT string_agg('ALTER TABLE public.users DROP CONSTRAINT ' || conname || ';', ' ')
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%current_plan%'
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if no constraint exists
END;
$$;

ALTER TABLE public.users ADD CONSTRAINT users_current_plan_check 
  CHECK (current_plan IN ('free', 'path_pack', 'pro', 'career_accelerator'));

-- Reset all users to 'free' since we're starting fresh
UPDATE public.users SET current_plan = 'free' WHERE current_plan NOT IN ('free', 'path_pack', 'pro', 'career_accelerator');

-- ============================================
-- DOWN (rollback)
-- ============================================
-- DROP TABLE IF EXISTS public.withdrawals CASCADE;
-- DROP TABLE IF EXISTS public.referral_commission_tiers CASCADE;
-- DROP TABLE IF EXISTS public.referrals CASCADE;
-- DROP TABLE IF EXISTS public.referral_codes CASCADE;
-- DROP TYPE IF EXISTS public.referral_status CASCADE;
-- DROP TYPE IF EXISTS public.withdrawal_status CASCADE;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS total_referral_earnings;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS active_subscription_id;
