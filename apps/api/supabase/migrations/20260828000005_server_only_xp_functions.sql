-- ============================================================
-- Migration: XP functions are server-only
-- Purpose: 20260823000001_xp_ledger granted public.increment_xp() to
--          `authenticated`. It is SECURITY DEFINER and takes any user id
--          and amount, so any signed-in learner could call
--          supabase.rpc('increment_xp', ...) with the public anon key and
--          give anyone unlimited XP. Only the API calls it, over its own
--          database connection, so revoke it from browser roles.
-- ============================================================

REVOKE ALL ON FUNCTION public.increment_xp(UUID, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_xp(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
