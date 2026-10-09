-- =============================================================================
-- Learner goals and study time (slice W2-D1): own rows only, servers write, goals in range.
-- Runs as real signed-in users inside a rolled-back transaction.
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

create function pg_temp.check_true(actual boolean, label text) returns void
language plpgsql as $$
begin
  if actual is not true then raise exception 'FAIL: % (got %)', label, actual; end if;
  raise notice 'ok  %', label;
end $$;

create function pg_temp.check_denied(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'ok  % (denied)', label;
end $$;

create function pg_temp.rows_changed(stmt text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.act_as(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values
  ('82000000-0000-0000-0000-000000000001', 'g1@g.test', now()), ('82000000-0000-0000-0000-000000000002', 'g2@g.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@g.test';

-- The API adds to today's row; a day can't exceed 24 hours.
insert into public.study_time_daily (user_id, day, seconds) values ('82000000-0000-0000-0000-000000000001', '2026-10-09', 600),
  ('82000000-0000-0000-0000-000000000002', '2026-10-09', 900);
insert into public.study_time_daily (user_id, day, seconds) values ('82000000-0000-0000-0000-000000000001', '2026-10-09', 86000)
  on conflict (user_id, day) do update set seconds = least(public.study_time_daily.seconds + excluded.seconds, 86400);
select pg_temp.check_eq((select seconds from public.study_time_daily where user_id = '82000000-0000-0000-0000-000000000001')::bigint, 86400,
  'study time adds up and stops at 24 hours');
select pg_temp.check_denied($$insert into public.study_time_daily (user_id, day, seconds) values ('82000000-0000-0000-0000-000000000001', '2026-10-10', -5)$$,
  'negative study time is refused');
select pg_temp.check_denied($$update public.users set weekly_problem_goal = 0 where email = 'g1@g.test'$$, 'a weekly goal of 0 is refused');
select pg_temp.check_denied($$update public.users set daily_time_minutes = 1000 where email = 'g1@g.test'$$, 'a 1000-minute daily goal is refused');
update public.users set weekly_problem_goal = 10, daily_time_minutes = 45 where email = 'g1@g.test';
select pg_temp.check_eq((select count(*) from public.users where weekly_problem_goal = 10 and daily_time_minutes = 45), 1, 'goals in range are saved');

set local role authenticated;
select pg_temp.act_as('82000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.study_time_daily), 1, 'a learner sees only their own study time');
select pg_temp.check_denied($$insert into public.study_time_daily (user_id, day, seconds) values ('82000000-0000-0000-0000-000000000001', '2026-10-11', 60)$$,
  'and cannot write it from the browser');
select pg_temp.check_denied($$update public.study_time_daily set seconds = 1$$, 'or change it');
reset role;

rollback;

\o
\echo 'ALL LEARNER GOAL CHECKS PASSED'
