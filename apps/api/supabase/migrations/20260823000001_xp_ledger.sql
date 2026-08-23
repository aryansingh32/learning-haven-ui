-- ============================================================
-- Migration: XP Ledger
-- Purpose: Replace ad-hoc non-atomic XP updates with a single
--          server-authoritative ledger + atomic increment function.
-- Fixes:
--   BH-007: Non-atomic read-modify-write in chapters.service.ts
--   BH-008: increment_xp RPC called but undefined in migrations
-- ============================================================

-- 1. XP source enum (extend as needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'xp_source_enum') THEN
    CREATE TYPE public.xp_source_enum AS ENUM (
      'chapter_unlock',
      'daily_quest',
      'task_completion',
      'apprenticeship',
      'admin_grant',
      'referral_bonus',
      'streak_bonus'
    );
  END IF;
END$$;

-- 2. XP ledger table (one row per award event, idempotent via key)
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL CHECK (amount > 0),
  source           TEXT NOT NULL,
  idempotency_key  TEXT UNIQUE NOT NULL,
  meta             JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user
  ON public.xp_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_source
  ON public.xp_ledger(source);

-- Row Level Security
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp ledger" ON public.xp_ledger;
CREATE POLICY "Users can view own xp ledger"
  ON public.xp_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Atomic, idempotent increment_xp function
--    Called by all XP award paths to replace non-atomic updates.
--    Returns the user's new total XP after the award (or current XP if
--    this idempotency_key was already processed — safe to retry).
CREATE OR REPLACE FUNCTION public.increment_xp(
  p_user_id        UUID,
  p_amount         INTEGER,
  p_source         TEXT        DEFAULT 'admin_grant',
  p_idempotency_key TEXT       DEFAULT NULL,
  p_meta           JSONB       DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      TEXT;
  v_inserted BOOLEAN := FALSE;
  v_new_xp   INTEGER;
BEGIN
  -- Derive idempotency key if not provided
  v_key := COALESCE(p_idempotency_key, p_source || ':' || p_user_id::TEXT || ':' || extract(epoch from now())::TEXT);

  -- Insert ledger row idempotently
  INSERT INTO public.xp_ledger (user_id, amount, source, idempotency_key, meta)
  VALUES (p_user_id, p_amount, p_source, v_key, p_meta)
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Only update users.xp if the ledger row was actually new (not a duplicate)
  IF v_inserted THEN
    UPDATE public.users
    SET xp = xp + p_amount
    WHERE id = p_user_id
    RETURNING xp INTO v_new_xp;
  ELSE
    -- Idempotent no-op: return current XP without modifying
    SELECT xp INTO v_new_xp FROM public.users WHERE id = p_user_id;
  END IF;

  RETURN COALESCE(v_new_xp, 0);
END;
$$;

-- Grant execute to authenticated role (Express backend uses service-role key,
-- but this lets the function be called via supabase.rpc() as well)
GRANT EXECUTE ON FUNCTION public.increment_xp(UUID, INTEGER, TEXT, TEXT, JSONB)
  TO authenticated, service_role;

-- 4. Backfill: ensure existing XP balances are correct.
--    We can't back-derive the ledger from scratch (no historical records exist),
--    so we leave existing users.xp as-is but mark a synthetic ledger entry
--    to record the baseline.
INSERT INTO public.xp_ledger (user_id, amount, source, idempotency_key, meta)
SELECT
  id,
  GREATEST(xp, 0),
  'admin_grant',
  'backfill_baseline:' || id::TEXT,
  '{"note": "Pre-ledger XP backfill"}'::jsonb
FROM public.users
WHERE xp > 0
ON CONFLICT (idempotency_key) DO NOTHING;
