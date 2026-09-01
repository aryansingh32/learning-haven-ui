-- ============================================================
-- Migration: Notebook Edit Access
-- Purpose: Gate manual notebook editing (copying doc highlights in,
--          writing custom entries) behind a paid-plan entitlement,
--          same tiering as notebook_pdf_export / certificates_access.
--          Basic per-chapter note-taking stays free.
-- ============================================================

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_edit_access', 'Notebook Manual Editing', 'boolean', false
  FROM public.plans p
  WHERE p.slug = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_edit_access'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_edit_access', 'Notebook Manual Editing', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'path_pack'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_edit_access'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_edit_access', 'Notebook Manual Editing', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'pro'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_edit_access'
    );

INSERT INTO public.plan_entitlements (plan_id, feature_key, label, entitlement_type, bool_value)
  SELECT id, 'notebook_edit_access', 'Notebook Manual Editing', 'boolean', true
  FROM public.plans p
  WHERE p.slug = 'career_accelerator'
    AND NOT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      WHERE pe.plan_id = p.id AND pe.feature_key = 'notebook_edit_access'
    );
