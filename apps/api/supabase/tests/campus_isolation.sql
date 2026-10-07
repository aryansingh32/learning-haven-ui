-- =============================================================================
-- Campus isolation tests: one college must never read or change another's data.
--
-- Runs entirely inside a transaction that is rolled back, so it leaves no rows
-- behind. Each check acts as a real signed-in user (role `authenticated` with
-- JWT claims), exactly as the Campus API will. Any failure aborts with the
-- check's name; success prints "ALL CAMPUS ISOLATION CHECKS PASSED".
--
-- Run: pnpm --filter @repo/api test:db   (needs TEST_DATABASE_URL)
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

-- ── Assertion helpers ────────────────────────────────────────────────────────
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

-- ── Fixtures (as the database owner) ────────────────────────────────────────
-- College A: owner, admin, faculty, student, suspended student.
-- College B: admin, student. Plus a Forge super admin and an outsider.
insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-000000000001', 'a-owner@a.test'),
  ('11111111-0000-0000-0000-000000000002', 'a-admin@a.test'),
  ('11111111-0000-0000-0000-000000000003', 'a-faculty@a.test'),
  ('11111111-0000-0000-0000-000000000004', 'a-student@a.test'),
  ('11111111-0000-0000-0000-000000000005', 'a-suspended@a.test'),
  ('22222222-0000-0000-0000-000000000001', 'b-admin@b.test'),
  ('22222222-0000-0000-0000-000000000002', 'b-student@b.test'),
  ('33333333-0000-0000-0000-000000000001', 'forge-admin@forge.test'),
  ('44444444-0000-0000-0000-000000000001', 'outsider@x.test');

insert into public.users (id, email, full_name, role)
select id, email, split_part(email, '@', 1),
       case when email = 'forge-admin@forge.test' then 'super_admin' else 'user' end
from auth.users where email like '%.test';

insert into campus.organizations (id, slug, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'college-a', 'College A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'college-b', 'College B');

insert into campus.departments (id, org_id, name, code) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Computer Science', 'CSE'),
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Computer Science', 'CSE');

insert into campus.org_memberships (org_id, user_id, role, status, department_id, roll_number) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'owner',   'active',    null, null),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000002', 'admin',   'active',    null, null),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003', 'faculty', 'active',    'aaaaaaaa-0000-0000-0000-0000000000d1', null),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000004', 'student', 'active',    'aaaaaaaa-0000-0000-0000-0000000000d1', 'A-001'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000005', 'student', 'suspended', null, 'A-002'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000001', 'admin',   'active',    null, null),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000002', 'student', 'active',    'bbbbbbbb-0000-0000-0000-0000000000d1', 'B-001');

insert into campus.batches (id, org_id, department_id, name, graduation_year) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'CSE 2027 A', 2027),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-0000000000d1', 'CSE 2027 A', 2027);

insert into campus.batch_members (batch_id, org_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000004'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000002');

insert into campus.batch_faculty (batch_id, org_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000003');

-- ── Data integrity: a batch can't hold someone from another college ─────────
select pg_temp.check_denied(
  $$insert into campus.batch_members (batch_id, org_id, user_id)
    values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-000000000002')$$,
  'a College B student cannot be put in a College A batch');
select pg_temp.check_denied(
  $$insert into campus.batch_members (batch_id, org_id, user_id)
    values ('aaaaaaaa-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000002')$$,
  'a batch row cannot claim another college''s org_id');
select pg_temp.check_denied(
  $$update campus.org_memberships set department_id = 'bbbbbbbb-0000-0000-0000-0000000000d1'
    where user_id = '11111111-0000-0000-0000-000000000004'$$,
  'a College A member cannot be placed in a College B department');

-- ── Anonymous (public anon key) ─────────────────────────────────────────────
set local role anon;
select pg_temp.check_denied('select 1 from campus.organizations', 'anon cannot read colleges');
select pg_temp.check_denied('select 1 from campus.org_memberships', 'anon cannot read members');
reset role;

-- ── College A student ───────────────────────────────────────────────────────
select pg_temp.act_as('11111111-0000-0000-0000-000000000004');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.organizations where type = 'college'), 1, 'A student sees only College A');
select pg_temp.check_eq((select count(*) from campus.organizations where type = 'platform'), 1, 'A student sees the Forge organisation');
select pg_temp.check_eq((select count(*) from campus.org_memberships), 1, 'A student sees only their own membership');
select pg_temp.check_eq((select count(*) from campus.batch_members), 1, 'A student sees only their own batch membership');
select pg_temp.check_eq((select count(*) from campus.batches where org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0, 'A student sees no College B batches');
select pg_temp.check_denied(
  $$insert into campus.org_memberships (org_id, user_id, role)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', '44444444-0000-0000-0000-000000000001', 'student')$$,
  'A student cannot add members');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.org_memberships set role = 'admin' where user_id = '11111111-0000-0000-0000-000000000004'$$),
  0, 'A student cannot promote themselves');
reset role;

-- ── College A admin ─────────────────────────────────────────────────────────
select pg_temp.act_as('11111111-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.org_memberships), 5, 'A admin sees all 5 College A members');
select pg_temp.check_eq((select count(*) from campus.org_memberships where org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0, 'A admin sees no College B members');
select pg_temp.check_eq((select count(*) from campus.batch_members where org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0, 'A admin sees no College B batch members');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.org_memberships (org_id, user_id, role)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', '44444444-0000-0000-0000-000000000001', 'student')$$),
  1, 'A admin can add a student to College A');
select pg_temp.check_denied(
  $$insert into campus.org_memberships (org_id, user_id, role)
    values ('bbbbbbbb-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000003', 'admin')$$,
  'A admin cannot add anyone to College B');
select pg_temp.check_denied(
  $$update campus.org_memberships set role = 'owner' where user_id = '11111111-0000-0000-0000-000000000003'$$,
  'A admin cannot promote someone to owner');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.org_memberships set status = 'suspended' where user_id = '11111111-0000-0000-0000-000000000001'$$),
  0, 'A admin cannot change the owner''s membership');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.batches set name = 'hacked' where org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$),
  0, 'A admin cannot rename a College B batch');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$delete from campus.batch_members where org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$),
  0, 'A admin cannot remove College B batch members');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.organizations set name = 'hacked' where id = 'bbbbbbbb-0000-0000-0000-00000000000b'$$),
  0, 'A admin cannot edit College B');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.organizations set name = 'renamed' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$),
  0, 'A admin cannot edit College A settings (owner only)');
select pg_temp.check_denied(
  $$insert into campus.organizations (slug, name) values ('rogue', 'Rogue College')$$,
  'A admin cannot create a college');
reset role;

-- ── College A faculty ───────────────────────────────────────────────────────
select pg_temp.act_as('11111111-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.batch_members), 1, 'A faculty sees College A batch members only');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.batches set name = 'renamed' where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$),
  0, 'A faculty cannot manage batches');
reset role;

-- ── Suspended College A student ─────────────────────────────────────────────
select pg_temp.act_as('11111111-0000-0000-0000-000000000005');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.organizations where type = 'college'), 0, 'a suspended member loses access to the college');
select pg_temp.check_eq((select count(*) from campus.batches), 0, 'a suspended member sees no batches');
reset role;

-- ── College B admin ─────────────────────────────────────────────────────────
select pg_temp.act_as('22222222-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.org_memberships where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'B admin sees no College A members');
select pg_temp.check_eq((select count(*) from campus.departments where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'B admin sees no College A departments');
reset role;

-- ── Outsider (signed in, no college) ────────────────────────────────────────
select pg_temp.act_as('44444444-0000-0000-0000-000000000099');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.organizations where type = 'college'), 0, 'a non-member sees no colleges');
select pg_temp.check_eq((select count(*) from campus.org_memberships), 0, 'a non-member sees no memberships');
reset role;

-- ── Forge super admin ───────────────────────────────────────────────────────
select pg_temp.act_as('33333333-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.organizations where type = 'college'), 2, 'Forge admin sees every college');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.organizations (slug, name) values ('college-c', 'College C')$$),
  1, 'Forge admin can create a college');
reset role;

-- ── Content ownership defaults keep today's catalogue unchanged ─────────────
select pg_temp.check_eq(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and column_name = 'owner_org_id'
     and table_name in ('courses', 'test_series', 'tests', 'programs', 'exam_categories', 'categories', 'testseries_questions')),
  7, 'all 7 content tables have an owner');
insert into public.courses (title, slug) values ('Isolation probe', 'isolation-probe');
select pg_temp.check_eq(
  (select count(*) from public.courses
   where slug = 'isolation-probe' and owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and visibility = 'public'),
  1, 'new content defaults to Forge-owned and public');

rollback;

\o
\echo 'ALL CAMPUS ISOLATION CHECKS PASSED'
