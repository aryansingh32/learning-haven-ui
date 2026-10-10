-- ============================================================
-- Migration: skip_tokens_remaining column
-- Purpose: apps/api/src/modules/learning/services/chapters.service.ts and
--          apps/api/src/modules/core/routes/cron.ts read/write
--          public.users.skip_tokens_remaining (chapter-skip feature +
--          monthly plan-based token reset) but no migration in this repo
--          ever created the column — classic schema-drift risk. Adding it
--          idempotently so a fresh/rebuilt database matches what the app
--          code already assumes is there.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS skip_tokens_remaining INTEGER NOT NULL DEFAULT 0 CHECK (skip_tokens_remaining >= 0);
