-- =============================================================================
-- Readiness snapshots (20261102000001): learners read only their own, and
-- nobody signed in can write them (the Forge API does).
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

create function pg_temp.act_as(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values
  ('d1000000-0000-0000-0000-0000000000a1', 'r1@rd.test', now()),
  ('d1000000-0000-0000-0000-0000000000a2', 'r2@rd.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@rd.test';
insert into public.readiness_snapshots (user_id, day, score) values
  ('d1000000-0000-0000-0000-0000000000a1', '2026-10-01', 40),
  ('d1000000-0000-0000-0000-0000000000a2', '2026-10-01', 70);

select pg_temp.act_as('d1000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.readiness_snapshots), 1, 'a learner reads only their own readiness');
select pg_temp.check_denied($$insert into public.readiness_snapshots (user_id, day, score) values ('d1000000-0000-0000-0000-0000000000a1', '2026-10-02', 100)$$,
  'learners cannot write their own score');
select pg_temp.check_denied($$update public.readiness_snapshots set score = 100$$, 'nor change it');
reset role;

rollback;

\o
\echo 'ALL READINESS CHECKS PASSED'
