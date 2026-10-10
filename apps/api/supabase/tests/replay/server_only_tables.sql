-- =============================================================================
-- Server-only tables from the older migrations (20260901000005): chapter notes
-- and mock test attempts (which hold correct answers) are not reachable with
-- the public anon key or as a signed-in learner.
-- Runs inside a rolled-back transaction.
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

create function pg_temp.check_denied(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege then
    raise notice 'ok  % (denied)', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

select pg_temp.check_eq((select count(*) from pg_class where oid in ('public.chapter_notes'::regclass, 'public.mock_test_attempts'::regclass)
  and relrowsecurity), 2, 'RLS is on for chapter_notes and mock_test_attempts');
select pg_temp.check_eq((select count(*) from pg_policies where tablename in ('chapter_notes', 'mock_test_attempts')), 0,
  'and they have no policies (server only)');

set local role anon;
select pg_temp.check_denied($$select questions_snapshot from public.mock_test_attempts$$, 'the anon key cannot read mock test answers');
select pg_temp.check_denied($$select content from public.chapter_notes$$, 'or chapter notes');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '85000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select pg_temp.check_denied($$select questions_snapshot from public.mock_test_attempts$$, 'a signed-in learner cannot read mock test answers');
select pg_temp.check_denied($$update public.chapter_notes set content = 'x'$$, 'or edit chapter notes');
reset role;

rollback;

\o
\echo 'ALL SERVER-ONLY TABLE CHECKS PASSED'
