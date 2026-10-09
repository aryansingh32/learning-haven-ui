-- =============================================================================
-- Practice content checks: the editorial migration fills empty editorials,
-- never overwrites a written one, and is safe to re-run.
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

insert into public.problems (slug, title, description, difficulty, topic, order_index, solution_explanation) values
  ('two-sum', 'Two Sum', 'x', 'easy', 'Arrays & Hashing', 1, null),
  ('valid-anagram', 'Valid Anagram', 'x', 'easy', 'Arrays & Hashing', 2, '   '),
  ('contains-duplicate', 'Contains Duplicate', 'x', 'easy', 'Arrays & Hashing', 3, 'Reviewed by the team');

\ir ../migrations/20261023000001_problem_editorials.sql

select pg_temp.check_eq((select count(*) from public.problems where slug = 'two-sum' and solution_explanation like '%hash map%'), 1,
  'an empty editorial is filled');
select pg_temp.check_eq((select count(*) from public.problems where slug = 'valid-anagram' and solution_explanation like '%count the letters%'), 1,
  'a blank editorial is filled');
select pg_temp.check_eq((select count(*) from public.problems where slug = 'contains-duplicate' and solution_explanation = 'Reviewed by the team'), 1,
  'a written editorial is never overwritten');

\ir ../migrations/20261023000001_problem_editorials.sql
select pg_temp.check_eq((select count(*) from public.problems where slug = 'two-sum' and solution_explanation like '%hash map%'), 1,
  'running it again changes nothing');

rollback;

\o
\echo 'ALL PRACTICE CHECKS PASSED'
