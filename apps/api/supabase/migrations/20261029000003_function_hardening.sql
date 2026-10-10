-- =============================================================================
-- Function hardening (security advisor, 2026-10-10)
--
-- * Trigger functions are never called directly: take EXECUTE away from the
--   browser roles (Supabase grants it to anon/authenticated by default).
-- * Fix the search_path of functions that had none, so a caller's search_path
--   can't change what they resolve. They only use pg_catalog (now(), CASE).
-- Guarded, so it applies to databases that lack some of these functions.
-- =============================================================================

do $$
declare f text;
begin
  foreach f in array array['public.learner_portfolio_guard()', 'public.test_question_section_matches()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
    end if;
  end loop;
  foreach f in array array['public.calculate_level(integer)', 'public.update_updated_at()',
                           'public.update_apprenticeship_updated_at()', 'public.update_updated_at_column()'] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = %L', f, '');
    end if;
  end loop;
end $$;
