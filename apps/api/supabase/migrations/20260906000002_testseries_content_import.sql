-- ============================================================
-- Migration: allow 'testseries_questions' through the existing
-- generic content-import pipeline (content_import_batches /
-- content_import_rows), so the question bank gets bulk CSV /
-- Google-Sheet import via the same staged review+publish flow
-- already used for chapters/problems/build_stages.
-- ============================================================

alter table public.content_import_batches
  drop constraint if exists content_import_batches_content_type_check;

alter table public.content_import_batches
  add constraint content_import_batches_content_type_check
  check (content_type in ('chapters_meta', 'chapter_steps', 'problems', 'build_stages', 'testseries_questions'));
