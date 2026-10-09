-- =============================================================================
-- Notifications (slice C3): own rows only, read_at only, servers create.
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

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, email, email_confirmed_at) values
  ('81000000-0000-0000-0000-000000000001', 'n1@n.test', now()), ('81000000-0000-0000-0000-000000000002', 'n2@n.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@n.test';
insert into public.notifications (id, user_id, kind, title, link, dedupe_key) values
  ('88888888-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'test_assigned', 'New test', '/college', 'a:1'),
  ('88888888-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'test_assigned', 'Other', '/college', 'a:1');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.notifications (user_id, kind, title, dedupe_key) values ('81000000-0000-0000-0000-000000000001', 'test_assigned', 'Again', 'a:1')
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing$$), 0, 'a reminder is created once per person');
select pg_temp.check_denied(
  $$insert into public.notifications (user_id, kind, title, link) values ('81000000-0000-0000-0000-000000000001', 'announcement', 'x', 'https://evil.example')$$,
  'links stay inside the app');

set local role authenticated;
select pg_temp.act_as('81000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.notifications), 1, 'a person sees only their own notifications');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.notifications set read_at = now()$$), 1, 'and can mark them read');
select pg_temp.check_denied($$update public.notifications set title = 'changed'$$, 'but cannot change what they say');
select pg_temp.check_denied($$insert into public.notifications (user_id, kind, title) values ('81000000-0000-0000-0000-000000000002', 'announcement', 'spam')$$,
  'and cannot send notifications to others');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.notifications set read_at = now() where user_id = '81000000-0000-0000-0000-000000000002'$$), 0,
  'nor mark someone else''s read');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.notification_preferences (user_id, email_enabled, muted_kinds) values ('81000000-0000-0000-0000-000000000001', false, '{job_alert}')$$),
  1, 'a person saves their own preferences');
select pg_temp.check_denied($$insert into public.notification_preferences (user_id) values ('81000000-0000-0000-0000-000000000002')$$,
  'not someone else''s');
select pg_temp.check_denied($$update public.notification_preferences set muted_kinds = '{everything}'$$, 'only known kinds can be muted');
reset role;

rollback;

\o
\echo 'ALL NOTIFICATION CHECKS PASSED'
