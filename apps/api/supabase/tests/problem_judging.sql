-- =============================================================================
-- Problem judging checks: test cases (especially hidden ones) are server-only,
-- the judge settings are validated, and the seed is safe to re-run.
-- Runs inside a rolled-back transaction, like the other suites.
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
  when insufficient_privilege or check_violation then
    raise notice 'ok  % (denied)', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values ('c1000000-0000-0000-0000-000000000001', 'learner@p.test', now());
insert into public.users (id, email, full_name) values ('c1000000-0000-0000-0000-000000000001', 'learner@p.test', 'learner');

insert into public.problems (id, slug, title, description, difficulty, topic, order_index)
values ('ccccc000-0000-0000-0000-000000000001', 'judge-check', 'Judge check', 'x', 'easy', 'Arrays & Hashing', 9999);
insert into public.problem_test_cases (problem_id, input, expected_output, is_sample, sort_order) values
  ('ccccc000-0000-0000-0000-000000000001', 'nums = [1]', '1', true, 1),
  ('ccccc000-0000-0000-0000-000000000001', 'nums = [2]', '2', false, 2);

-- Learners and anonymous visitors read nothing directly — not even samples (the API serves those).
select set_config('request.jwt.claims', json_build_object('sub', 'c1000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.problem_test_cases), 0, 'a signed-in learner cannot read test cases');
select pg_temp.check_denied($$insert into public.problem_test_cases (problem_id, input, expected_output) values ('ccccc000-0000-0000-0000-000000000001', 'x', 'y')$$,
  'a learner cannot add test cases');
select pg_temp.check_eq((select count(*) from public.problems), 0, 'problems stay server-only too');
reset role;

set local role anon;
select pg_temp.check_eq((select count(*) from public.problem_test_cases where not is_sample), 0, 'anonymous visitors cannot read hidden tests');
reset role;

-- Judge settings are validated.
select pg_temp.check_denied($$update public.problems set judge_config = '{"compare": "fuzzy"}' where slug = 'judge-check'$$,
  'an unknown compare mode is refused');
update public.problems set judge_config = '{"compare": "unordered_deep"}' where slug = 'judge-check';
select pg_temp.check_eq((select count(*) from public.problems where slug = 'judge-check' and judge_config->>'compare' = 'unordered_deep'), 1, 'a known compare mode is accepted');

-- Deleting a problem removes its tests.
delete from public.problems where slug = 'judge-check';
select pg_temp.check_eq((select count(*) from public.problem_test_cases where problem_id = 'ccccc000-0000-0000-0000-000000000001'), 0, 'tests are removed with their problem');

rollback;

\o
\echo 'ALL PROBLEM JUDGING CHECKS PASSED'
