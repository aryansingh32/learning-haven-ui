-- Content-to-plan assignments.
-- UP

CREATE TYPE public.plan_content_type AS ENUM (
  'course',
  'challenge',
  'career_path',
  'feature'
);

CREATE TABLE IF NOT EXISTS public.content_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  content_type public.plan_content_type NOT NULL,
  content_id UUID,
  feature_key TEXT,
  feature_limit INTEGER DEFAULT -1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_or_feature CHECK (
    (content_id IS NOT NULL AND feature_key IS NULL) OR
    (content_id IS NULL AND feature_key IS NOT NULL)
  ),
  UNIQUE (plan_id, content_type, content_id),
  UNIQUE (plan_id, feature_key)
);

COMMENT ON TABLE public.content_plan_assignments IS
  'Single source of truth for which plans include which content and monetized feature limits.';
COMMENT ON COLUMN public.content_plan_assignments.feature_limit IS
  '-1 = unlimited, 0 = disabled, positive value = capped usage.';

CREATE INDEX IF NOT EXISTS idx_cpa_plan ON public.content_plan_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_cpa_content ON public.content_plan_assignments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_cpa_feature ON public.content_plan_assignments(plan_id, feature_key);

ALTER TABLE public.content_plan_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpa_read_authenticated" ON public.content_plan_assignments;
CREATE POLICY "cpa_read_authenticated" ON public.content_plan_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cpa_admin_write" ON public.content_plan_assignments;
CREATE POLICY "cpa_admin_write" ON public.content_plan_assignments
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin'))
  );

GRANT SELECT ON public.content_plan_assignments TO authenticated;

-- DOWN
-- DROP POLICY IF EXISTS "cpa_admin_write" ON public.content_plan_assignments;
-- DROP POLICY IF EXISTS "cpa_read_authenticated" ON public.content_plan_assignments;
-- DROP TABLE IF EXISTS public.content_plan_assignments;
-- DROP TYPE IF EXISTS public.plan_content_type;
