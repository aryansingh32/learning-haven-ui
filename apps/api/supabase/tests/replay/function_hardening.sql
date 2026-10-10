-- =============================================================================
-- Function hardening (20261029000003): trigger functions aren't callable by
-- browser roles, functions that had no search_path now have one, and the
-- updated_at triggers still work with it. Runs inside a rolled-back transaction.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

create function pg_temp.check_eq(actual bigint, expected bigint, label text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok  %', label;
end $$;

select pg_temp.check_eq((select count(*) from unnest(array['public.learner_portfolio_guard()', 'public.test_question_section_matches()']) f
  where has_function_privilege('anon', f::regprocedure, 'execute') or has_function_privilege('authenticated', f::regprocedure, 'execute')), 0,
  'browser roles cannot execute the trigger functions');
select pg_temp.check_eq((select count(*) from pg_proc
  where oid in ('public.calculate_level(integer)'::regprocedure, 'public.update_updated_at()'::regprocedure,
                'public.update_apprenticeship_updated_at()'::regprocedure, 'public.update_updated_at_column()'::regprocedure)
    and 'search_path=""' = any(proconfig)), 4, 'the four functions have a fixed search_path');

insert into public.categories (name, slug) values ('fh test', 'fh-test');
update public.categories set updated_at = now() - interval '1 day' where slug = 'fh-test';
update public.categories set name = 'fh test 2' where slug = 'fh-test';
select pg_temp.check_eq((select (updated_at > now() - interval '1 minute')::int from public.categories where slug = 'fh-test'), 1,
  'update_updated_at still stamps updated_at');
select pg_temp.check_eq(public.calculate_level(300), 3, 'calculate_level still works');

rollback;

\o
\echo 'ALL FUNCTION HARDENING CHECKS PASSED'
