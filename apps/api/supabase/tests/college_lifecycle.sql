-- =============================================================================
-- College lifecycle (20261030000002): a suspended college stops working for its
-- staff and students (Forge staff keep access), the seat limit holds on every
-- path, and a removed student no longer sees their old batch's course.
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

create function pg_temp.check_denied(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege or check_violation then
    raise notice 'ok  % (denied)', label;
end $$;

create function pg_temp.act_as(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_system() returns void
language sql as $$ select set_config('request.jwt.claims', '', true); $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- Fixtures: college L (seat limit 2), its owner, two students, a third waiting student, Forge staff.
insert into auth.users (id, email, email_confirmed_at) values
  ('e1000000-0000-0000-0000-000000000001', 'own@l.test', now()),
  ('e2000000-0000-0000-0000-000000000001', 's1@l.test', now()),
  ('e2000000-0000-0000-0000-000000000002', 's2@l.test', now()),
  ('e2000000-0000-0000-0000-000000000003', 's3@l.test', now()),
  ('e9000000-0000-0000-0000-000000000009', 'staff@forge.l.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%l.test';
update public.users set role = 'admin' where id = 'e9000000-0000-0000-0000-000000000009';
insert into campus.organizations (id, slug, name, seat_limit) values ('eeeeeeee-0000-0000-0000-00000000000a', 'l-college', 'College L', 2);
insert into campus.batches (id, org_id, name) values ('eeeeeeee-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-00000000000a', 'L1');
insert into campus.org_memberships (org_id, user_id, role) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'owner'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000001', 'student');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('eeeeeeee-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000001');
insert into public.courses (id, title, slug, is_published, owner_org_id, visibility) values
  ('ec000000-0000-0000-0000-00000000000a', 'L batch course', 'l-batch-course', true, 'eeeeeeee-0000-0000-0000-00000000000a', 'batch');
insert into campus.course_assignments (org_id, batch_id, course_id, title, status) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-0000000000b1', 'ec000000-0000-0000-0000-00000000000a', 'Read this', 'published');
insert into campus.roster_entries (org_id, email, role, batch_id) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 's2@l.test', 'student', 'eeeeeeee-0000-0000-0000-0000000000b1'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 's3@l.test', 'student', 'eeeeeeee-0000-0000-0000-0000000000b1');

-- ── Seats ───────────────────────────────────────────────────────────────────
select pg_temp.check_eq(campus.seats_available('eeeeeeee-0000-0000-0000-00000000000a'), 1, 'one of two seats is free');
select pg_temp.act_as('e2000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(campus.claim_roster_entries(), 1, 'the second student claims the last seat');
reset role;
select pg_temp.act_as('e2000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_eq(campus.claim_roster_entries(), 0, 'the third student is not admitted: no seat');
reset role;
select pg_temp.check_eq((select count(*) from campus.roster_entries where email = 's3@l.test' and status = 'pending'), 1, 'their roster entry stays pending');
select pg_temp.check_denied($$insert into campus.org_memberships (org_id, user_id, role) values ('eeeeeeee-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000003', 'student')$$,
  'adding a student directly over the limit is refused');
select pg_temp.as_system();
update campus.organizations set seat_limit = 3 where id = 'eeeeeeee-0000-0000-0000-00000000000a';
select pg_temp.act_as('e2000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_eq(campus.claim_roster_entries(), 1, 'after Forge raises the limit, the waiting student gets in');
reset role;
select pg_temp.as_system();
update campus.org_memberships set status = 'suspended' where user_id = 'e2000000-0000-0000-0000-000000000003';
select pg_temp.as_system();
update campus.organizations set seat_limit = 2 where id = 'eeeeeeee-0000-0000-0000-00000000000a';
select pg_temp.check_denied($$update campus.org_memberships set status = 'active' where user_id = 'e2000000-0000-0000-0000-000000000003'$$,
  'reactivating a student over the limit is refused');

-- ── Who controls the plan ──────────────────────────────────────────────────
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_denied($$update campus.organizations set seat_limit = 5000 where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$, 'an owner cannot raise their own seat limit');
select pg_temp.check_denied($$update campus.organizations set status = 'active', type = 'platform' where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$, 'or change status or type');
update campus.organizations set name = 'College L (renamed)', brand_color = '#112233' where id = 'eeeeeeee-0000-0000-0000-00000000000a';
reset role;
select pg_temp.check_eq((select count(*) from campus.organizations where name = 'College L (renamed)'), 1, 'but can still rename and brand it');
select pg_temp.act_as('e9000000-0000-0000-0000-000000000009');
set local role authenticated;
update campus.organizations set seat_limit = 2 where id = 'eeeeeeee-0000-0000-0000-00000000000a';
reset role;
select pg_temp.check_eq((select seat_limit from campus.organizations where id = 'eeeeeeee-0000-0000-0000-00000000000a'), 2, 'Forge staff change the seat limit');

-- ── Suspension ──────────────────────────────────────────────────────────────
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(campus.has_org_permission('eeeeeeee-0000-0000-0000-00000000000a', 'members.manage')::int, 1, 'the owner manages an active college');
reset role;
select pg_temp.check_eq(campus.user_can_see_course('e2000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000a')::int, 1,
  'a student sees their batch course');

select pg_temp.as_system();
update campus.organizations set status = 'suspended' where id = 'eeeeeeee-0000-0000-0000-00000000000a';

select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(campus.has_org_permission('eeeeeeee-0000-0000-0000-00000000000a', 'members.manage')::int, 0, 'the owner of a suspended college can do nothing');
select pg_temp.check_eq(campus.is_org_member('eeeeeeee-0000-0000-0000-00000000000a')::int, 0, 'and is not treated as a member');
select pg_temp.check_eq((select count(*) from campus.batches), 0, 'and reads none of its batches');
reset role;
select pg_temp.act_as('e2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(campus.is_batch_member('eeeeeeee-0000-0000-0000-0000000000b1')::int, 0, 'a student of a suspended college is out of its batches');
reset role;
select pg_temp.check_eq(campus.user_can_see_course('e2000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000a')::int, 0,
  'and no longer sees its batch course');
select pg_temp.act_as('e9000000-0000-0000-0000-000000000009');
set local role authenticated;
select pg_temp.check_eq(campus.has_org_permission('eeeeeeee-0000-0000-0000-00000000000a', 'members.manage')::int, 1, 'Forge staff can still manage it');
reset role;

select pg_temp.as_system();
update campus.organizations set status = 'active' where id = 'eeeeeeee-0000-0000-0000-00000000000a';
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(campus.has_org_permission('eeeeeeee-0000-0000-0000-00000000000a', 'members.manage')::int, 1, 'reactivating restores everything');
reset role;

-- ── Removed student ─────────────────────────────────────────────────────────
select pg_temp.as_system();
update campus.org_memberships set status = 'suspended' where user_id = 'e2000000-0000-0000-0000-000000000001';
select pg_temp.check_eq(campus.user_can_see_course('e2000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000a')::int, 0,
  'a removed student no longer sees their old batch course');

rollback;

\o
\echo 'ALL COLLEGE LIFECYCLE CHECKS PASSED'
