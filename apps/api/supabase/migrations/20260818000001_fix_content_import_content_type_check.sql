-- =============================================
-- Fix: Update content_import_batches.content_type check constraint
--
-- The original migration only allowed ('chapters', 'problems', 'build_stages').
-- The TypeScript service was later refactored to split 'chapters' into:
--   - 'chapters_meta'  (metadata: title, topic_tag, difficulty, est_minutes …)
--   - 'chapter_steps'  (one row per step with step_content_json)
--
-- This migration drops the old constraint and replaces it with one that
-- matches the current ContentType union in contentImport.schemas.ts.
-- =============================================

alter table public.content_import_batches
  drop constraint if exists content_import_batches_content_type_check;

alter table public.content_import_batches
  add constraint content_import_batches_content_type_check
  check (content_type in ('chapters_meta', 'chapter_steps', 'problems', 'build_stages'));
