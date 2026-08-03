-- Seed initial content and feature assignments.
-- UP

INSERT INTO public.content_plan_assignments (plan_id, content_type, content_id)
SELECT p.id, 'course', c.id
FROM public.plans p
CROSS JOIN public.programs c
WHERE p.slug::text = 'free'
  AND c.type = 'course'
  AND c.title IN ('Mindset Revolution', 'Programming Foundations')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.courses') IS NOT NULL THEN
    INSERT INTO public.content_plan_assignments (plan_id, content_type, content_id)
    SELECT p.id, 'course', c.id
    FROM public.plans p
    CROSS JOIN public.courses c
    WHERE p.slug::text = 'free'
      AND c.title IN ('Mindset Revolution', 'Programming Foundations')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'ai_queries_per_day', 5
FROM public.plans WHERE slug::text = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'challenges_per_account', 3
FROM public.plans WHERE slug::text = 'free'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, content_id)
SELECT p.id, 'course', c.id
FROM public.plans p
CROSS JOIN public.programs c
WHERE p.slug::text = 'pro'
  AND c.type = 'course'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.courses') IS NOT NULL THEN
    INSERT INTO public.content_plan_assignments (plan_id, content_type, content_id)
    SELECT p.id, 'course', c.id
    FROM public.plans p
    CROSS JOIN public.courses c
    WHERE p.slug::text = 'pro'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

INSERT INTO public.content_plan_assignments (plan_id, content_type, content_id)
SELECT p.id, 'challenge', c.id
FROM public.plans p
CROSS JOIN public.programs c
WHERE p.slug::text = 'pro'
  AND c.type IN ('build_haven', 'challenge', 'build')
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'ai_queries_per_day', -1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'challenges_per_account', -1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'certificates_access', 1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'career_paths_access', 1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT DO NOTHING;

INSERT INTO public.content_plan_assignments (plan_id, content_type, feature_key, feature_limit)
SELECT id, 'feature', 'resume_builder_access', 1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT DO NOTHING;

-- Keep legacy feature entitlement rows aligned for existing feature middleware.
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', 5
FROM public.plans WHERE slug::text = 'free'
ON CONFLICT (plan_id, feature_key, resource_type, resource_id) DO UPDATE SET numeric_value = EXCLUDED.numeric_value;

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
SELECT id, 'ai_queries_per_day', 'AI Queries per Day', 'numeric_limit', -1
FROM public.plans WHERE slug::text = 'pro'
ON CONFLICT (plan_id, feature_key, resource_type, resource_id) DO UPDATE SET numeric_value = EXCLUDED.numeric_value;

-- DOWN
-- DELETE FROM public.content_plan_assignments
-- WHERE feature_key IN (
--   'ai_queries_per_day',
--   'challenges_per_account',
--   'certificates_access',
--   'career_paths_access',
--   'resume_builder_access'
-- )
-- OR content_type IN ('course', 'challenge');
