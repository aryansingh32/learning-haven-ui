-- =============================================================================
-- Admin control centre (20261105000001): flag kinds and kill switches,
-- announcements, both server-only.
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
grant execute on all functions in schema pg_temp to authenticated, anon;

select pg_temp.check_eq((select count(*) from public.feature_flags where kind = 'kill_switch' and enabled), 6, 'six module switches, all on');
insert into public.feature_flags (key) values ('w3.test_flag');
select pg_temp.check_eq((select count(*) from public.feature_flags where key = 'w3.test_flag' and kind = 'release'), 1, 'flags default to release flags');
select pg_temp.check_eq((select count(*) from public.system_settings where key = 'maintenance_message'), 1, 'maintenance message seeded');
select pg_temp.check_eq((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'banned_at'), 1, 'users.banned_at exists');

do $$ begin
  insert into public.feature_flags (key, kind) values ('Bad Key!', 'release');
  raise exception 'FAIL: malformed flag key';
exception when check_violation then raise notice 'ok  flag keys are lower-case words (denied)';
end $$;
do $$ begin
  insert into public.feature_flags (key, kind) values ('some.flag', 'beta');
  raise exception 'FAIL: unknown flag kind';
exception when check_violation then raise notice 'ok  unknown flag kind (denied)';
end $$;
do $$ begin
  insert into public.announcements (title, starts_at, ends_at) values ('Window', now(), now() - interval '1 hour');
  raise exception 'FAIL: announcement ends before it starts';
exception when check_violation then raise notice 'ok  announcement window must be forward (denied)';
end $$;
do $$ begin
  insert into public.announcements (title, link_url) values ('Link', 'javascript:alert(1)');
  raise exception 'FAIL: non-https link';
exception when check_violation then raise notice 'ok  announcement links are https (denied)';
end $$;
do $$ begin
  insert into public.announcements (title, level) values ('Level', 'panic');
  raise exception 'FAIL: unknown level';
exception when check_violation then raise notice 'ok  unknown announcement level (denied)';
end $$;
insert into public.announcements (title, body) values ('Exams week', 'Practice is busy');
select pg_temp.check_eq((select count(*) from public.announcements), 1, 'admin (server) can add an announcement');

set local role authenticated;
do $$ begin
  perform 1 from public.feature_flags;
  raise exception 'FAIL: learners can read flags';
exception when insufficient_privilege then raise notice 'ok  flags are server-only (denied)';
end $$;
do $$ begin
  update public.feature_flags set enabled = false where key = 'module.ai';
  raise exception 'FAIL: learners can switch modules off';
exception when insufficient_privilege then raise notice 'ok  learners cannot change flags (denied)';
end $$;
do $$ begin
  perform 1 from public.announcements;
  raise exception 'FAIL: learners can read announcements directly';
exception when insufficient_privilege then raise notice 'ok  announcements are server-only (denied)';
end $$;
reset role;

-- Security fix: no writes as a learner to accounts, money or progress tables.
select pg_temp.check_eq((select count(*) from unnest(array['users','payments','subscriptions','withdrawals','referral_codes',
  'course_enrollments','build_enrollments','build_stage_results']) t
  cross join unnest(array['anon','authenticated']) r
  cross join unnest(array['INSERT','UPDATE','DELETE']) p
  where to_regclass('public.' || t) is not null and has_table_privilege(r, 'public.' || t, p)), 0,
  'learners cannot write users, payments, subscriptions, withdrawals, referral codes, enrolments, build results');
set local role authenticated;
do $$ begin
  update public.users set role = 'super_admin';
  raise exception 'FAIL: a learner can change roles';
exception when insufficient_privilege then raise notice 'ok  learners cannot make themselves admin (denied)';
end $$;
do $$ begin
  insert into public.withdrawals (user_id) values (gen_random_uuid());
  raise exception 'FAIL: a learner can create a withdrawal directly';
exception when insufficient_privilege then raise notice 'ok  learners cannot insert withdrawals directly (denied)';
end $$;
reset role;

set local role anon;
do $$ begin
  insert into public.announcements (title) values ('Spoof');
  raise exception 'FAIL: visitors can post announcements';
exception when insufficient_privilege then raise notice 'ok  visitors cannot post announcements (denied)';
end $$;
reset role;

rollback;

\o
\echo 'ALL CONTROL CENTRE CHECKS PASSED'
