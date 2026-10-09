-- =============================================================================
-- Courses for colleges (slice D6): licences, course assignments, visibility.
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
-- 1x College A staff, 2x College A students (21 in batch A1, 22 in A2), 3x College B, 9 Forge staff.
insert into auth.users (id, email, email_confirmed_at) values
  ('d1000000-0000-0000-0000-000000000001', 'fac@a.test', now()),
  ('d2000000-0000-0000-0000-000000000021', 's21@a.test', now()),
  ('d2000000-0000-0000-0000-000000000022', 's22@a.test', now()),
  ('d3000000-0000-0000-0000-000000000001', 'fac@b.test', now()),
  ('d9000000-0000-0000-0000-000000000009', 'staff@forge.test', now()),
  ('d0000000-0000-0000-0000-000000000000', 'nobody@x.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%.test';
update public.users set role = 'admin' where id = 'd9000000-0000-0000-0000-000000000009';

insert into campus.organizations (id, slug, name) values
  ('dddddddd-aaaa-0000-0000-00000000000a', 'd-college-a', 'College A'),
  ('dddddddd-bbbb-0000-0000-00000000000b', 'd-college-b', 'College B');
insert into campus.batches (id, org_id, name) values
  ('dddddddd-aaaa-0000-0000-0000000000b1', 'dddddddd-aaaa-0000-0000-00000000000a', 'A1'),
  ('dddddddd-aaaa-0000-0000-0000000000b2', 'dddddddd-aaaa-0000-0000-00000000000a', 'A2'),
  ('dddddddd-bbbb-0000-0000-0000000000b1', 'dddddddd-bbbb-0000-0000-00000000000b', 'B1');
insert into campus.org_memberships (org_id, user_id, role) values
  ('dddddddd-aaaa-0000-0000-00000000000a', 'd1000000-0000-0000-0000-000000000001', 'faculty'),
  ('dddddddd-aaaa-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000021', 'student'),
  ('dddddddd-aaaa-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000022', 'student'),
  ('dddddddd-bbbb-0000-0000-00000000000b', 'd3000000-0000-0000-0000-000000000001', 'faculty');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('dddddddd-aaaa-0000-0000-0000000000b1', 'dddddddd-aaaa-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000021'),
  ('dddddddd-aaaa-0000-0000-0000000000b2', 'dddddddd-aaaa-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000022');

-- Courses: Forge free, Forge premium, Forge draft, College A batch-only, College B private.
insert into public.courses (id, title, slug, is_premium, is_published, owner_org_id, visibility) values
  ('dc000000-0000-0000-0000-000000000001', 'Forge free',    'd-forge-free',    false, true,  '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('dc000000-0000-0000-0000-000000000002', 'Forge premium', 'd-forge-premium', true,  true,  '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('dc000000-0000-0000-0000-000000000003', 'Forge draft',   'd-forge-draft',   false, false, '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('dc000000-0000-0000-0000-00000000000a', 'A batch course','d-a-batch',       false, true,  'dddddddd-aaaa-0000-0000-00000000000a', 'batch'),
  ('dc000000-0000-0000-0000-00000000000b', 'B private',     'd-b-private',     false, true,  'dddddddd-bbbb-0000-0000-00000000000b', 'private');
insert into public.chapters (id, course_id, chapter_number, title) values
  ('dc100000-0000-0000-0000-000000000011', 'dc000000-0000-0000-0000-000000000001', 1, 'Free 1'),
  ('dc100000-0000-0000-0000-000000000012', 'dc000000-0000-0000-0000-000000000001', 2, 'Free 2'),
  ('dc100000-0000-0000-0000-000000000021', 'dc000000-0000-0000-0000-000000000002', 1, 'Premium 1');

-- ── Licences ────────────────────────────────────────────────────────────────
select pg_temp.act_as('d1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_denied(
  $$insert into campus.course_licences (org_id, course_id) values ('dddddddd-aaaa-0000-0000-00000000000a', null)$$,
  'a college cannot grant itself a licence');
reset role;

select pg_temp.act_as('d9000000-0000-0000-0000-000000000009');
set local role authenticated;
insert into campus.course_licences (org_id, course_id, note) values ('dddddddd-aaaa-0000-0000-00000000000a', 'dc000000-0000-0000-0000-000000000002', 'Pilot');
reset role;

select pg_temp.check_true(campus.user_has_course_licence('d2000000-0000-0000-0000-000000000021', 'dc000000-0000-0000-0000-000000000002'),
  'a College A student is licensed for the premium course');
select pg_temp.check_true(not campus.user_has_course_licence('d3000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000002'),
  'College B is not');
update campus.org_memberships set status = 'suspended' where user_id = 'd2000000-0000-0000-0000-000000000022';
select pg_temp.check_true(not campus.user_has_course_licence('d2000000-0000-0000-0000-000000000022', 'dc000000-0000-0000-0000-000000000002'),
  'a suspended member loses the licence');
update campus.org_memberships set status = 'active' where user_id = 'd2000000-0000-0000-0000-000000000022';
update campus.course_licences set ends_at = now() - interval '1 second', starts_at = now() - interval '1 day';
select pg_temp.check_true(not campus.user_has_course_licence('d2000000-0000-0000-0000-000000000021', 'dc000000-0000-0000-0000-000000000002'),
  'an expired licence grants nothing');
update campus.course_licences set ends_at = null;

-- ── Course assignments ──────────────────────────────────────────────────────
select pg_temp.act_as('d1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.course_licences), 1, 'College A staff see their licence');
insert into campus.course_assignments (id, org_id, batch_id, course_id, title, status, chapter_ids) values
  ('dca00000-0000-0000-0000-000000000001', 'dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1',
   'dc000000-0000-0000-0000-000000000001', 'Read chapter 1', 'published', array['dc100000-0000-0000-0000-000000000011']::uuid[]),
  ('dca00000-0000-0000-0000-000000000002', 'dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1',
   'dc000000-0000-0000-0000-000000000002', 'Premium (licensed)', 'published', null),
  ('dca00000-0000-0000-0000-000000000003', 'dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1',
   'dc000000-0000-0000-0000-00000000000a', 'Own course', 'published', null);
select pg_temp.check_eq((select count(*) from campus.course_assignments), 3, 'A faculty assigns a free, a licensed premium and an own course');
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title) values
    ('dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-000000000003', 'Draft')$$,
  'an unpublished course cannot be assigned');
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title) values
    ('dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-00000000000b', 'Steal')$$,
  'another college''s private course cannot be assigned');
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title, chapter_ids) values
    ('dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-aaaa-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-000000000001', 'Wrong chapter',
     array['dc100000-0000-0000-0000-000000000021']::uuid[])$$,
  'chapters must belong to the assigned course');
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title) values
    ('dddddddd-aaaa-0000-0000-00000000000a', 'dddddddd-bbbb-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-000000000001', 'Other batch')$$,
  'a course cannot be assigned to another college''s batch');
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title) values
    ('dddddddd-bbbb-0000-0000-00000000000b', 'dddddddd-bbbb-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-000000000001', 'As B')$$,
  'a faculty cannot assign on behalf of College B');
reset role;

select pg_temp.act_as('d3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_denied(
  $$insert into campus.course_assignments (org_id, batch_id, course_id, title) values
    ('dddddddd-bbbb-0000-0000-00000000000b', 'dddddddd-bbbb-0000-0000-0000000000b1', 'dc000000-0000-0000-0000-000000000002', 'Premium unlicensed')$$,
  'an unlicensed college cannot assign a premium course');
select pg_temp.check_eq((select count(*) from campus.course_assignments), 0, 'College B sees no College A course assignments');
select pg_temp.check_eq((select count(*) from campus.course_licences), 0, 'College B sees no College A licences');
reset role;

select pg_temp.act_as('d2000000-0000-0000-0000-000000000021');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.course_assignments), 3, 'a student in A1 sees the published course assignments for A1');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.course_assignments set due_at = now() + interval '1 year'$$), 0,
  'a student cannot move a due date');
reset role;

select pg_temp.act_as('d2000000-0000-0000-0000-000000000022');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.course_assignments), 0, 'a student in A2 sees none of A1''s');
reset role;

-- ── Visibility for the learner app (Forge API asks as the server) ───────────
select pg_temp.check_true(campus.user_can_see_course('d0000000-0000-0000-0000-000000000000', 'dc000000-0000-0000-0000-000000000001'), 'anyone sees a public course');
select pg_temp.check_true(not campus.user_can_see_course('d0000000-0000-0000-0000-000000000000', 'dc000000-0000-0000-0000-000000000003'), 'nobody sees a draft');
select pg_temp.check_true(campus.user_can_see_course('d2000000-0000-0000-0000-000000000021', 'dc000000-0000-0000-0000-00000000000a'), 'a student of an assigned batch sees a batch course');
select pg_temp.check_true(not campus.user_can_see_course('d2000000-0000-0000-0000-000000000022', 'dc000000-0000-0000-0000-00000000000a'), 'a student of another batch does not');
select pg_temp.check_true(not campus.user_can_see_course('d0000000-0000-0000-0000-000000000000', 'dc000000-0000-0000-0000-00000000000a'), 'outsiders do not');
select pg_temp.check_true(campus.user_can_see_course('d1000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-00000000000a'), 'the owner college''s content staff do');
select pg_temp.check_true(not campus.user_can_see_course('d1000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-00000000000b'), 'nobody outside College B sees its private course');
select pg_temp.check_true(campus.user_can_see_course('d3000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-00000000000b'), 'College B''s content staff see it');

set local role authenticated;
select pg_temp.act_as('d2000000-0000-0000-0000-000000000021');
select pg_temp.check_denied($$select campus.user_can_see_course('d3000000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-00000000000b')$$,
  'learners cannot ask about other people''s access');
reset role;

rollback;

\o
\echo 'ALL CAMPUS COURSE CHECKS PASSED'
