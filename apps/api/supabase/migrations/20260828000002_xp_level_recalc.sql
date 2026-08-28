-- ============================================================
-- Migration: XP level recalculation
-- Purpose: public.increment_xp() (added in 20260823000001_xp_ledger.sql)
--          only updated users.xp, never users.level. XP awarded through
--          chapter unlocks, daily quests, and task completion — all of
--          which call increment_xp — left the stored level stale, so a
--          learner's level badge and any leaderboard sorted/filtered by
--          level could silently fall out of sync with their real XP.
--          Mirrors the LEVELS thresholds in apps/api/src/utils/xp.ts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_level(p_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_xp < 100 THEN 1
    WHEN p_xp < 250 THEN 2
    WHEN p_xp < 500 THEN 3
    WHEN p_xp < 850 THEN 4
    WHEN p_xp < 1300 THEN 5
    WHEN p_xp < 1850 THEN 6
    WHEN p_xp < 2500 THEN 7
    WHEN p_xp < 3250 THEN 8
    WHEN p_xp < 4100 THEN 9
    WHEN p_xp < 5050 THEN 10
    WHEN p_xp < 6100 THEN 11
    WHEN p_xp < 7250 THEN 12
    WHEN p_xp < 8500 THEN 13
    WHEN p_xp < 9850 THEN 14
    ELSE 15
  END;
$$;

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
  v_key := COALESCE(p_idempotency_key, p_source || ':' || p_user_id::TEXT || ':' || extract(epoch from now())::TEXT);

  INSERT INTO public.xp_ledger (user_id, amount, source, idempotency_key, meta)
  VALUES (p_user_id, p_amount, p_source, v_key, p_meta)
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    UPDATE public.users
    SET xp = xp + p_amount,
        level = public.calculate_level(xp + p_amount)
    WHERE id = p_user_id
    RETURNING xp INTO v_new_xp;
  ELSE
    SELECT xp INTO v_new_xp FROM public.users WHERE id = p_user_id;
  END IF;

  RETURN COALESCE(v_new_xp, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_level(INTEGER) TO authenticated, service_role;

-- One-off backfill so existing users' stored level matches their current xp.
UPDATE public.users
SET level = public.calculate_level(xp)
WHERE level IS DISTINCT FROM public.calculate_level(xp);
