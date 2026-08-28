-- ============================================================
-- Migration: Atomic streak update
-- Purpose: apps/api/src/utils/streak.ts previously did a JS-side
--          read-modify-write (SELECT last_active_date/streak_count,
--          compute in Node, then UPDATE) with no row lock — concurrent
--          requests for the same user on the same day (double-click,
--          two tabs, retried request) could each read the same starting
--          streak and one write would clobber the other, double-
--          incrementing or losing the streak. Moved to a single
--          SELECT ... FOR UPDATE + UPDATE inside one Postgres function,
--          matching the pattern already used by increment_xp().
--
--          Also fixes a separate, pre-existing bug: streak.ts selected a
--          column named `streak_count`, but public.users has no such
--          column — the real column is `streak` (see init migration).
--          Every call to updateStreak() therefore errored on the SELECT
--          and silently returned {streak: 0} without updating anything;
--          chapter-completion streaks were never actually persisted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_active   DATE;
  v_streak        INTEGER;
  v_longest       INTEGER;
  v_today         DATE := CURRENT_DATE;
  v_diff_days     INTEGER;
  v_new_streak    INTEGER;
BEGIN
  -- Row lock prevents a concurrent call for the same user from reading the
  -- same pre-update streak value before this transaction commits.
  SELECT last_active_date::date, COALESCE(streak, 0), COALESCE(longest_streak, 0)
  INTO v_last_active, v_streak, v_longest
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_last_active IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_diff_days := v_today - v_last_active;
    IF v_diff_days = 0 THEN
      v_new_streak := v_streak; -- already counted today, no change
    ELSIF v_diff_days = 1 THEN
      v_new_streak := v_streak + 1;
    ELSE
      v_new_streak := 1; -- missed a day, reset
    END IF;
  END IF;

  UPDATE public.users
  SET last_active_date = v_today,
      streak = v_new_streak,
      longest_streak = GREATEST(v_longest, v_new_streak)
  WHERE id = p_user_id;

  RETURN v_new_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_streak(UUID) TO authenticated, service_role;
