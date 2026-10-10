-- =============================================================================
-- Gamification rewards (slice W2-G1): a reward is recorded and paid once, the
-- daily XP limit holds, badges are given once, learners read only their own
-- rewards and can't write rewards, week snapshots or solves from the browser.
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

create function pg_temp.check_text(actual text, expected text, label text) returns void
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
  when insufficient_privilege or check_violation or foreign_key_violation or invalid_parameter_value then
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
  ('83000000-0000-0000-0000-000000000001', 'm1@gm.test', now()),
  ('83000000-0000-0000-0000-000000000002', 'm2@gm.test', now());
insert into public.users (id, email, full_name, xp)
  select id, email, split_part(email, '@', 1), 0 from auth.users where email like '%@gm.test';
insert into public.problems (id, slug, title, description, difficulty, topic, order_index)
  values ('83000000-0000-0000-0000-0000000000a1', 'gm-test-problem', 'GM test', 'x', 'easy', 'Arrays', 99001);

-- ---------------------------------------------------------------------------
-- Without the XP ledger installed (as on live today): XP goes straight to users.xp, once.
-- ---------------------------------------------------------------------------
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000001', 'milestone:solved_1', 'milestone', 25,
  'milestone_solved_1', 'First Solve', '🥇', 100), 'paid', 'a new milestone is paid');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000001'), 25, 'and adds its XP');
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000001', 'milestone:solved_1', 'milestone', 25,
  'milestone_solved_1', 'First Solve', '🥇', 100), 'already_paid', 'claiming it again pays nothing');
select pg_temp.check_text(public.pay_gamification_reward('83000000-0000-0000-0000-000000000001', 'milestone:solved_1', 100), 'already_paid',
  'paying it again pays nothing');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000001'), 25, 'XP is still 25');
select pg_temp.check_eq((select count(*) from public.user_badges where user_id = '83000000-0000-0000-0000-000000000001' and badge_id = 'milestone_solved_1'), 1,
  'the badge is given once');

-- Daily limit 100: 25 + 60 fits, + 80 more waits for another day.
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000001', 'weekly:2026-10-05:solve_problems', 'weekly_mission', 60,
  null, null, null, 100), 'paid', 'a reward within the daily limit is paid');
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000001', 'weekly:2026-10-05:active_days', 'weekly_mission', 80,
  null, null, null, 100), 'capped', 'a reward over the daily limit waits');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000001'), 85, 'and adds no XP yet');
select pg_temp.check_text((select status from public.gamification_rewards where reward_key = 'weekly:2026-10-05:active_days'), 'pending',
  'but stays earned (pending)');
select pg_temp.check_text(public.pay_gamification_reward('83000000-0000-0000-0000-000000000001', 'weekly:2026-10-05:active_days', 100), 'capped',
  'retrying the same day is still held back');
-- Next day: today's total starts again.
update public.gamification_rewards set paid_day = paid_day - 1 where user_id = '83000000-0000-0000-0000-000000000001' and status = 'paid';
select pg_temp.check_text(public.pay_gamification_reward('83000000-0000-0000-0000-000000000001', 'weekly:2026-10-05:active_days', 100), 'paid',
  'the held reward is paid the next day');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000001'), 165, 'XP is 165');
-- One reward bigger than the limit is still paid when nothing else was paid that day.
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000002', 'milestone:solved_100', 'milestone', 500,
  null, null, null, 100), 'paid', 'a single big reward is not stuck behind the limit');
select pg_temp.check_text(public.pay_gamification_reward('83000000-0000-0000-0000-000000000002', 'no:such:reward', 100), 'missing',
  'an unknown reward pays nothing');

-- Shapes
select pg_temp.check_denied($$insert into public.gamification_rewards (user_id, reward_key, kind, xp) values ('83000000-0000-0000-0000-000000000002', 'Bad Key!', 'milestone', 5)$$,
  'a malformed reward key is refused');
select pg_temp.check_denied($$insert into public.gamification_rewards (user_id, reward_key, kind, xp) values ('83000000-0000-0000-0000-000000000002', 'x:y:z', 'milestone', 5000)$$,
  'a reward over 1000 XP is refused');
select pg_temp.check_denied($$insert into public.gamification_rewards (user_id, reward_key, kind, xp) values ('83000000-0000-0000-0000-000000000002', 'x:y:z', 'jackpot', 5)$$,
  'an unknown reward kind is refused');
select pg_temp.check_denied($$insert into public.gamification_rewards (user_id, reward_key, kind, xp, status) values ('83000000-0000-0000-0000-000000000002', 'x:y:z', 'milestone', 5, 'paid')$$,
  'a reward marked paid without a payment time is refused');

-- ---------------------------------------------------------------------------
-- With the XP ledger installed: the award goes through increment_xp with an idempotency key.
-- ---------------------------------------------------------------------------
\ir ../migrations/20260823000001_xp_ledger.sql
select pg_temp.check_text(public.grant_gamification_reward('83000000-0000-0000-0000-000000000002', 'weekly:2026-10-05:study_minutes', 'weekly_mission', 40,
  null, null, null, 0), 'paid', 'with the ledger, a reward is paid');
select pg_temp.check_eq((select count(*) from public.xp_ledger where idempotency_key = 'gamify:83000000-0000-0000-0000-000000000002:weekly:2026-10-05:study_minutes'), 1,
  'and written to the XP ledger with its key');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000002'), 540, 'XP is 540');
select pg_temp.check_text(public.pay_gamification_reward('83000000-0000-0000-0000-000000000002', 'weekly:2026-10-05:study_minutes', 0), 'already_paid',
  'and never paid twice');
select pg_temp.check_eq((select xp from public.users where id = '83000000-0000-0000-0000-000000000002'), 540, 'XP is still 540');

-- ---------------------------------------------------------------------------
-- Week snapshots
-- ---------------------------------------------------------------------------
select pg_temp.check_eq((select public.snapshot_week_xp('2026-10-05') >= 2)::int, 1, 'a week snapshot records every learner');
select pg_temp.check_eq(public.snapshot_week_xp('2026-10-05'), 0, 'taking it again changes nothing');
select pg_temp.check_eq((select xp from public.xp_week_start where user_id = '83000000-0000-0000-0000-000000000001' and week_start = '2026-10-05'), 165,
  'it holds the XP at the start of the week');
select pg_temp.check_denied($$select public.snapshot_week_xp('2026-10-07')$$, 'a week that does not start on Monday is refused');
insert into public.xp_week_start (user_id, week_start, xp) values ('83000000-0000-0000-0000-000000000001', '2026-06-01', 1);
select public.snapshot_week_xp('2026-10-12');
select pg_temp.check_eq((select count(*) from public.xp_week_start where week_start = '2026-06-01'), 0, 'weeks older than eight weeks are dropped');

insert into public.user_problem_status (user_id, problem_id, status, solved_at)
  values ('83000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-0000000000a1', 'tried', null);

-- ---------------------------------------------------------------------------
-- As a signed-in learner (the browser)
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('83000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.gamification_rewards), 3, 'a learner sees only their own rewards');
select pg_temp.check_denied($$insert into public.gamification_rewards (user_id, reward_key, kind, xp) values ('83000000-0000-0000-0000-000000000001', 'milestone:solved_50', 'milestone', 150)$$,
  'and cannot record a reward');
select pg_temp.check_denied($$update public.gamification_rewards set status = 'pending', paid_at = null, paid_day = null$$, 'or reset one to be paid again');
select pg_temp.check_denied($$select public.grant_gamification_reward('83000000-0000-0000-0000-000000000001', 'milestone:solved_50', 'milestone', 150, null, null, null, 0)$$,
  'or grant one');
select pg_temp.check_denied($$select public.pay_gamification_reward('83000000-0000-0000-0000-000000000001', 'weekly:2026-10-05:active_days', 0)$$, 'or pay one');
select pg_temp.check_denied($$select public.snapshot_week_xp('2026-10-19')$$, 'or take a week snapshot');
select pg_temp.check_denied($$select count(*) from public.xp_week_start$$, 'or read week snapshots');
select pg_temp.check_eq((select count(*) from public.user_problem_status), 1, 'a learner still reads their own problem status');
select pg_temp.check_denied($$update public.user_problem_status set status = 'solved', solved_at = now()$$, 'but cannot mark a problem solved');
select pg_temp.check_denied($$insert into public.user_problem_status (user_id, problem_id, status, solved_at) values ('83000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-0000000000a1', 'solved', now())$$,
  'or insert a solve');
reset role;

rollback;

\o
\echo 'ALL GAMIFICATION CHECKS PASSED'
