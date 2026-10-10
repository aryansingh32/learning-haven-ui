-- ============================================================
-- Migration: chapter notes and mock tests are server-only
-- Purpose: 20260901000001 (chapter_notes) and 20260901000004
--          (mock_test_attempts) created their tables without row level
--          security. On Supabase that exposes them to the public anon key
--          through PostgREST: anyone could read or edit every learner's
--          notes, and read mock_test_attempts.questions_snapshot, which
--          holds the correct answers. Only the API reads and writes them,
--          over its own database connection, so lock them like the other
--          server-only tables: RLS on, no policies, no browser grants.
-- ============================================================

ALTER TABLE public.chapter_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chapter_notes FROM anon, authenticated;
REVOKE ALL ON public.mock_test_attempts FROM anon, authenticated;
