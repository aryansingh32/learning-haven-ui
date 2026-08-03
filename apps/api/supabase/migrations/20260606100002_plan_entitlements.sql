-- ============================================
-- Migration 2: Plan entitlements — feature flags per plan
-- ============================================
-- UP

DROP TYPE IF EXISTS public.entitlement_type CASCADE;

CREATE TYPE public.entitlement_type AS ENUM (
  'boolean',
  'numeric_limit',
  'resource_access'
);

-- Each row = one feature flag for one plan
-- Admin can add/edit/remove entitlements per plan dynamically
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  label TEXT,                                                 -- human-readable: "AI Queries per Day"
  entitlement_type public.entitlement_type NOT NULL,
  bool_value BOOLEAN,                                         -- for 'boolean' type
  numeric_value INTEGER,                                      -- for 'numeric_limit' (-1 = unlimited)
  resource_type TEXT,                                         -- for 'resource_access' (e.g. 'career_path')
  resource_id UUID,                                           -- specific resource ID
  description TEXT,                                           -- admin notes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, feature_key, resource_type, resource_id)
);

CREATE TRIGGER update_plan_entitlements_updated_at
  BEFORE UPDATE ON public.plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_plan_entitlements_plan ON public.plan_entitlements(plan_id);
CREATE INDEX idx_plan_entitlements_feature ON public.plan_entitlements(feature_key);

-- ============================================
-- FEATURE KEY CONSTANTS (use these everywhere in code):
-- ============================================
-- ai_queries_per_day          → numeric_limit (5 free, 20 path_pack, -1 pro/career_acc)
-- challenge_limit             → numeric_limit (3 free, -1 paid)
-- career_paths_access         → boolean (false free, false path_pack, true pro)
-- certificates_access         → boolean (false free, true path_pack+)
-- resume_builder_access       → boolean (false free, true pro+)
-- mock_interviews_count       → numeric_limit (0 free, 0 pro, 3 career_acc)
-- placement_support_access    → boolean (only career_acc)
-- analytics_advanced          → boolean (pro+)
-- priority_support            → boolean (pro+)

-- ============================================
-- Seed entitlements for FREE plan
-- ============================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', 5
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'challenge_limit', 'Build Challenges', 'numeric_limit', 3
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'career_paths_access', 'Career Paths', 'boolean', false
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'certificates_access', 'Certificates', 'boolean', false
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'resume_builder_access', 'Resume Builder', 'boolean', false
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_interviews_count', 'Mock Interviews', 'numeric_limit', 0
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'placement_support_access', 'Placement Support', 'boolean', false
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'analytics_advanced', 'Advanced Analytics', 'boolean', false
  FROM public.plans WHERE slug = 'free';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'priority_support', 'Priority Support', 'boolean', false
  FROM public.plans WHERE slug = 'free';

-- ============================================
-- Seed entitlements for PATH PACK plan
-- ============================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', 20
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'challenge_limit', 'Build Challenges', 'numeric_limit', -1
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'career_paths_access', 'Career Paths', 'boolean', false
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'certificates_access', 'Certificates', 'boolean', true
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'resume_builder_access', 'Resume Builder', 'boolean', false
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_interviews_count', 'Mock Interviews', 'numeric_limit', 0
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'placement_support_access', 'Placement Support', 'boolean', false
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'analytics_advanced', 'Advanced Analytics', 'boolean', false
  FROM public.plans WHERE slug = 'path_pack';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'priority_support', 'Priority Support', 'boolean', true
  FROM public.plans WHERE slug = 'path_pack';

-- ============================================
-- Seed entitlements for PRO plan
-- ============================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', -1
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'challenge_limit', 'Build Challenges', 'numeric_limit', -1
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'career_paths_access', 'Career Paths', 'boolean', true
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'certificates_access', 'Certificates', 'boolean', true
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'resume_builder_access', 'Resume Builder', 'boolean', true
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_interviews_count', 'Mock Interviews', 'numeric_limit', 0
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'placement_support_access', 'Placement Support', 'boolean', false
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'analytics_advanced', 'Advanced Analytics', 'boolean', true
  FROM public.plans WHERE slug = 'pro';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'priority_support', 'Priority Support', 'boolean', true
  FROM public.plans WHERE slug = 'pro';

-- ============================================
-- Seed entitlements for CAREER ACCELERATOR plan
-- ============================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', -1
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'challenge_limit', 'Build Challenges', 'numeric_limit', -1
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'career_paths_access', 'Career Paths', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'certificates_access', 'Certificates', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'resume_builder_access', 'Resume Builder', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_interviews_count', 'Mock Interviews', 'numeric_limit', 3
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'placement_support_access', 'Placement Support', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'analytics_advanced', 'Advanced Analytics', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'priority_support', 'Priority Support', 'boolean', true
  FROM public.plans WHERE slug = 'career_accelerator';

-- ============================================
-- DOWN (rollback)
-- ============================================
-- DROP TABLE IF EXISTS public.plan_entitlements CASCADE;
-- DROP TYPE IF EXISTS public.entitlement_type CASCADE;
