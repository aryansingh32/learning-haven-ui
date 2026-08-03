-- Resource-level monetization and SaaS-style plan access rules.
-- Supports:
-- - broad subscription plans such as free/pro/super
-- - individual purchases for courses, career paths, projects, and apprenticeship programs
-- - admin-managed access rules through plan_entitlements

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_current_plan_check;
ALTER TABLE public.users ADD CONSTRAINT users_current_plan_check
  CHECK (current_plan IN ('free', 'path_pack', 'pro', 'super', 'career_accelerator'));

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  entitlement_type public.entitlement_type NOT NULL DEFAULT 'resource_access',
  bool_value BOOLEAN,
  numeric_value INTEGER,
  resource_type TEXT,
  resource_id UUID,
  label TEXT,
  description TEXT,
  source_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  source_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feature_key, resource_type, resource_id)
);

CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON public.user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_feature ON public.user_entitlements(feature_key);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_resource ON public.user_entitlements(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_expires ON public.user_entitlements(expires_at);

INSERT INTO public.plans (
  name, slug, description, tagline, price_monthly, price_annual, price_one_time,
  is_highlighted, highlight_label, features, sort_order, metadata
) VALUES (
  'Super',
  'super',
  'Career-focused plan with projects, AI help, certificates, and placement features.',
  'For serious job preparation',
  19900,
  149900,
  null,
  false,
  'Best for careers',
  '["Everything in Pro", "Career paths included", "Apprenticeship projects", "Project AI help", "Mock interviews", "Placement support"]'::jsonb,
  3,
  '{"audience":"career-track learners"}'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  features = EXCLUDED.features,
  updated_at = NOW();

-- New common access keys. Existing rows are left intact and can be edited in admin.
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value, numeric_value, description)
SELECT p.id, x.feature_key, x.label, x.entitlement_type::public.entitlement_type, x.bool_value, x.numeric_value, x.description
FROM public.plans p
JOIN (
  VALUES
    ('free', 'all_courses_access', 'All Courses', 'boolean', false, null, 'Access every course without individual purchase'),
    ('free', 'project_access', 'Projects', 'numeric_limit', null, 2, 'Free project starts'),
    ('free', 'ai_project_help_per_day', 'Project AI Help per Day', 'numeric_limit', null, 0, 'Apprenticeship/project AI help'),

    ('pro', 'all_courses_access', 'All Courses', 'boolean', true, null, 'Full course catalog'),
    ('pro', 'career_path_access', 'Career Paths', 'boolean', true, null, 'All career paths'),
    ('pro', 'project_access', 'Projects', 'numeric_limit', null, -1, 'Unlimited projects'),
    ('pro', 'ai_project_help_per_day', 'Project AI Help per Day', 'numeric_limit', null, 20, 'Daily project AI help'),

    ('super', 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', null, -1, 'Unlimited AI mentor'),
    ('super', 'challenge_limit', 'Build Challenges', 'numeric_limit', null, -1, 'Unlimited build challenges'),
    ('super', 'all_courses_access', 'All Courses', 'boolean', true, null, 'Full course catalog'),
    ('super', 'career_path_access', 'Career Paths', 'boolean', true, null, 'All career paths'),
    ('super', 'project_access', 'Projects', 'numeric_limit', null, -1, 'Unlimited projects'),
    ('super', 'apprenticeship_access', 'Apprenticeship Programs', 'boolean', true, null, 'All apprenticeship programs'),
    ('super', 'ai_project_help_per_day', 'Project AI Help per Day', 'numeric_limit', null, -1, 'Unlimited project AI help'),
    ('super', 'certificates_access', 'Certificates', 'boolean', true, null, 'All certificates'),
    ('super', 'resume_builder_access', 'Resume Builder', 'boolean', true, null, 'Resume builder'),
    ('super', 'mock_interviews_count', 'Mock Interviews', 'numeric_limit', null, 3, 'Mock interviews per month'),
    ('super', 'placement_support_access', 'Placement Support', 'boolean', true, null, 'Placement support'),
    ('super', 'analytics_advanced', 'Advanced Analytics', 'boolean', true, null, 'Advanced analytics'),
    ('super', 'priority_support', 'Priority Support', 'boolean', true, null, 'Priority support'),

    ('career_accelerator', 'all_courses_access', 'All Courses', 'boolean', true, null, 'Full course catalog'),
    ('career_accelerator', 'career_path_access', 'Career Paths', 'boolean', true, null, 'All career paths'),
    ('career_accelerator', 'project_access', 'Projects', 'numeric_limit', null, -1, 'Unlimited projects'),
    ('career_accelerator', 'apprenticeship_access', 'Apprenticeship Programs', 'boolean', true, null, 'All apprenticeship programs'),
    ('career_accelerator', 'ai_project_help_per_day', 'Project AI Help per Day', 'numeric_limit', null, -1, 'Unlimited project AI help')
) AS x(plan_slug, feature_key, label, entitlement_type, bool_value, numeric_value, description)
  ON p.slug::text = x.plan_slug
ON CONFLICT (plan_id, feature_key, resource_type, resource_id) DO UPDATE SET
  label = EXCLUDED.label,
  entitlement_type = EXCLUDED.entitlement_type,
  bool_value = EXCLUDED.bool_value,
  numeric_value = EXCLUDED.numeric_value,
  description = EXCLUDED.description,
  updated_at = NOW();

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can view own entitlements"
  ON public.user_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);
