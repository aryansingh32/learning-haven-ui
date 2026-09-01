-- ============================================================
-- Migration: Mock Test
-- Purpose: Timed, multi-chapter tests pulling questions from a
--          course's quiz pool, graded server-side. Results feed
--          into the course notebook.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mock_test_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id          UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  duration_seconds   INTEGER NOT NULL,
  total_questions    INTEGER NOT NULL,
  correct_count      INTEGER,
  score_percent      INTEGER,
  -- Full questions + correct answers, server-only, never sent to the client.
  questions_snapshot JSONB NOT NULL,
  -- Learner's graded answers, public-safe shape (same as quiz_answers).
  answers            JSONB,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_user_course
  ON public.mock_test_attempts(user_id, course_id, created_at DESC);

COMMENT ON TABLE public.mock_test_attempts IS
  'Timed multi-chapter mock tests. questions_snapshot carries correct answers server-side only.';

-- ============================================================
-- Entitlement: daily mock test attempts (free gets a taste, paid unlimited)
-- ============================================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_test_attempts_per_day', 'Mock Test Attempts / Day', 'numeric_limit', 1
  FROM public.plans p
  WHERE p.slug = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'mock_test_attempts_per_day'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_test_attempts_per_day', 'Mock Test Attempts / Day', 'numeric_limit', -1
  FROM public.plans p
  WHERE p.slug = 'path_pack'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'mock_test_attempts_per_day'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_test_attempts_per_day', 'Mock Test Attempts / Day', 'numeric_limit', -1
  FROM public.plans p
  WHERE p.slug = 'pro'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'mock_test_attempts_per_day'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, numeric_value)
  SELECT id, 'mock_test_attempts_per_day', 'Mock Test Attempts / Day', 'numeric_limit', -1
  FROM public.plans p
  WHERE p.slug = 'career_accelerator'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'mock_test_attempts_per_day'
    );
