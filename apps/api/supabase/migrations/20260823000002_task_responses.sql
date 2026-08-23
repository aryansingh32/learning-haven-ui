-- ============================================================
-- Migration: Task Responses
-- Purpose: Persist learner task responses server-side instead of
--          only storing them in localStorage.
-- Fixes:
--   BH-009: Task submission notes never persisted server-side
-- ============================================================

-- Add response columns to user_chapter_progress
ALTER TABLE public.user_chapter_progress
  ADD COLUMN IF NOT EXISTS task_response       TEXT,
  ADD COLUMN IF NOT EXISTS task_submitted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS task_draft          TEXT,
  ADD COLUMN IF NOT EXISTS task_draft_saved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_chapter_progress.task_response IS
  'Learner''s final submitted task response for this chapter.';
COMMENT ON COLUMN public.user_chapter_progress.task_submitted_at IS
  'Timestamp of most recent task submission.';
COMMENT ON COLUMN public.user_chapter_progress.task_draft IS
  'Auto-saved draft of learner''s in-progress task response.';
COMMENT ON COLUMN public.user_chapter_progress.task_draft_saved_at IS
  'Timestamp of most recent draft auto-save.';
