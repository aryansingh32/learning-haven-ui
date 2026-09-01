-- ============================================================
-- Migration: Chapter Notes + Notebook
-- Purpose: Per-chapter learner notes, aggregated (with quiz scores
--          and task responses) into a per-course "notebook" that
--          can be exported as a branded PDF.
-- ============================================================

-- One freeform notes entry per learner per chapter.
CREATE TABLE IF NOT EXISTS public.chapter_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_notes_user_course
  ON public.chapter_notes(user_id, course_id);

CREATE TRIGGER update_chapter_notes_updated_at
  BEFORE UPDATE ON public.chapter_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.chapter_notes IS
  'Learner-authored notes per chapter, aggregated into the course notebook.';

-- ============================================================
-- Entitlement: notebook PDF export (mirrors certificates_access)
-- ============================================================
INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_pdf_export', 'Notebook PDF Export', 'boolean', false
  FROM public.plans p
  WHERE p.slug = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_pdf_export'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_pdf_export', 'Notebook PDF Export', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'path_pack'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_pdf_export'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_pdf_export', 'Notebook PDF Export', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'pro'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_pdf_export'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_pdf_export', 'Notebook PDF Export', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'career_accelerator'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_pdf_export'
    );

-- ============================================================
-- DOWN (rollback)
-- ============================================================
-- DELETE FROM public.plan_entitlements WHERE feature_key = 'notebook_pdf_export';
-- DROP TABLE IF EXISTS public.chapter_notes CASCADE;
