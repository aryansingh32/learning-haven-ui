-- ============================================================
-- Migration: user_chapter_progress performance index
-- Purpose: user_chapter_progress is queried on every chapter load,
--          quiz check, task submission, and progress list — always
--          filtered by (user_id, chapter_id) or user_id alone — but
--          had no explicit index defined anywhere in this repo's
--          migrations, risking sequential scans as progress rows grow.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_user_chapter
  ON public.user_chapter_progress (user_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_user
  ON public.user_chapter_progress (user_id);
