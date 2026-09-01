-- ============================================================
-- Migration: Quiz Answers
-- Purpose: Persist the learner's actual per-question quiz answers
--          (not just the aggregate score) so the notebook can show
--          real question/answer review with tick/cross marks.
-- ============================================================

ALTER TABLE public.user_chapter_progress
  ADD COLUMN IF NOT EXISTS quiz_answers JSONB;

COMMENT ON COLUMN public.user_chapter_progress.quiz_answers IS
  'Array of {question, options, selected_index, selected_text, is_correct, correct_option, explanation} for the learner''s most recent quiz submission on this chapter.';
