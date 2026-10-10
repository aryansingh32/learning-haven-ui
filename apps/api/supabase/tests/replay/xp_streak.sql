-- =============================================================================
-- XP and streak functions (20260828000002/3/5), on the replayed live database:
-- browser roles can't call them, a streak counts days and keeps `streak` and
-- `streak_count` equal, and XP updates the level.
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

-- Who may call them
select pg_temp.check_eq(has_function_privilege('authenticated', 'public.increment_xp(uuid,integer,text,text,jsonb)', 'execute')::int, 0,
  'signed-in users cannot call increment_xp');
select pg_temp.check_eq(has_function_privilege('anon', 'public.increment_xp(uuid,integer,text,text,jsonb)', 'execute')::int, 0,
  'anonymous users cannot call increment_xp');
select pg_temp.check_eq(has_function_privilege('authenticated', 'public.update_streak(uuid)', 'execute')::int, 0,
  'signed-in users cannot call update_streak');
select pg_temp.check_eq(has_function_privilege('anon', 'public.update_streak(uuid)', 'execute')::int, 0,
  'anonymous users cannot call update_streak');
select pg_temp.check_eq(has_function_privilege('service_role', 'public.increment_xp(uuid,integer,text,text,jsonb)', 'execute')::int, 1,
  'the service role can call increment_xp');
select pg_temp.check_eq(has_function_privilege('service_role', 'public.update_streak(uuid)', 'execute')::int, 1,
  'the service role can call update_streak');

insert into auth.users (id, email, email_confirmed_at) values
  ('84000000-0000-0000-0000-000000000001', 's1@xs.test', now()),
  ('84000000-0000-0000-0000-000000000002', 's2@xs.test', now());
insert into public.users (id, email, full_name, xp, level, streak, streak_count, longest_streak, last_active_date) values
  ('84000000-0000-0000-0000-000000000001', 's1@xs.test', 's1', 0, 1, 0, 2, 2, current_date - 1),
  ('84000000-0000-0000-0000-000000000002', 's2@xs.test', 's2', 0, 1, 0, 0, 0, null);

-- Streaks: the value kept in streak_count (as on live) carries on.
select pg_temp.check_eq(public.update_streak('84000000-0000-0000-0000-000000000001'), 3, 'active yesterday: streak 2 becomes 3');
select pg_temp.check_eq((select streak from public.users where id = '84000000-0000-0000-0000-000000000001'), 3, 'streak is written');
select pg_temp.check_eq((select streak_count from public.users where id = '84000000-0000-0000-0000-000000000001'), 3, 'streak_count is written too');
select pg_temp.check_eq((select longest_streak from public.users where id = '84000000-0000-0000-0000-000000000001'), 3, 'longest streak follows');
select pg_temp.check_eq(public.update_streak('84000000-0000-0000-0000-000000000001'), 3, 'a second call the same day changes nothing');
update public.users set last_active_date = current_date - 3 where id = '84000000-0000-0000-0000-000000000001';
select pg_temp.check_eq(public.update_streak('84000000-0000-0000-0000-000000000001'), 1, 'a missed day resets the streak to 1');
select pg_temp.check_eq((select longest_streak from public.users where id = '84000000-0000-0000-0000-000000000001'), 3, 'but keeps the longest');
select pg_temp.check_eq(public.update_streak('84000000-0000-0000-0000-000000000002'), 1, 'a first activity starts at 1');
select pg_temp.check_eq(public.update_streak('84000000-0000-0000-0000-0000000000ff'), 0, 'an unknown user changes nothing');

-- XP sets the level.
select pg_temp.check_eq(public.increment_xp('84000000-0000-0000-0000-000000000002', 300, 'admin_grant', 'xs-test-1'), 300, 'XP is added');
select pg_temp.check_eq((select level from public.users where id = '84000000-0000-0000-0000-000000000002'), 3, 'and 300 XP is level 3');
select pg_temp.check_eq(public.increment_xp('84000000-0000-0000-0000-000000000002', 300, 'admin_grant', 'xs-test-1'), 300, 'the same key pays once');

-- A signed-in learner trying it from the browser
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '84000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select pg_temp.check_denied($$select public.increment_xp('84000000-0000-0000-0000-000000000002', 100000)$$, 'a learner cannot give themselves XP');
select pg_temp.check_denied($$select public.update_streak('84000000-0000-0000-0000-000000000001')$$, 'or change someone''s streak');
reset role;

rollback;

\o
\echo 'ALL XP AND STREAK CHECKS PASSED'
