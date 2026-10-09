-- =============================================================================
-- College structure (slice C1): hierarchy, sections, academic record, eligibility.
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
-- e1 admin A, e2 faculty A, s31..s34 students A (batch A1), e3 faculty B.
insert into auth.users (id, email, email_confirmed_at) values
  ('e1000000-0000-0000-0000-000000000001', 'adm@ea.test', now()),
  ('e1000000-0000-0000-0000-000000000002', 'fac@ea.test', now()),
  ('e2000000-0000-0000-0000-000000000031', 's31@ea.test', now()),
  ('e2000000-0000-0000-0000-000000000032', 's32@ea.test', now()),
  ('e2000000-0000-0000-0000-000000000033', 's33@ea.test', now()),
  ('e2000000-0000-0000-0000-000000000034', 's34@ea.test', now()),
  ('e3000000-0000-0000-0000-000000000001', 'fac@eb.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@e_.test';

insert into campus.organizations (id, slug, name) values
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e-college-a', 'College A'),
  ('eeeeeeee-bbbb-0000-0000-00000000000b', 'e-college-b', 'College B');
insert into campus.departments (id, org_id, name, code, kind) values
  ('eeeeeeee-aaaa-0000-0000-0000000000d1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'School of Engineering', 'SOE', 'school'),
  ('eeeeeeee-aaaa-0000-0000-0000000000d2', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'Computer Science', 'CSE', 'department'),
  ('eeeeeeee-aaaa-0000-0000-0000000000d3', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'Electronics', 'ECE', 'department'),
  ('eeeeeeee-bbbb-0000-0000-0000000000d1', 'eeeeeeee-bbbb-0000-0000-00000000000b', 'B Dept', 'BD', 'department');
insert into campus.batches (id, org_id, name) values
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'A1'),
  ('eeeeeeee-aaaa-0000-0000-0000000000b2', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'A2'),
  ('eeeeeeee-bbbb-0000-0000-0000000000b1', 'eeeeeeee-bbbb-0000-0000-00000000000b', 'B1');
insert into campus.org_memberships (org_id, user_id, role, department_id, cgpa, active_backlogs, tenth_percent, twelfth_percent) values
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'admin', null, null, null, null, null),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000002', 'faculty', null, null, null, null, null),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000031', 'student', 'eeeeeeee-aaaa-0000-0000-0000000000d2', 8.2, 0, 90, 88),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000032', 'student', 'eeeeeeee-aaaa-0000-0000-0000000000d2', 6.5, 0, 80, 75),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000033', 'student', 'eeeeeeee-aaaa-0000-0000-0000000000d3', 9.0, 2, 95, 92),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000034', 'student', 'eeeeeeee-aaaa-0000-0000-0000000000d2', null, null, null, null),
  ('eeeeeeee-bbbb-0000-0000-00000000000b', 'e3000000-0000-0000-0000-000000000001', 'faculty', null, null, null, null, null);
insert into campus.sections (id, org_id, batch_id, name) values
  ('eeeeeeee-aaaa-0000-0000-0000000000c1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', 'A'),
  ('eeeeeeee-aaaa-0000-0000-0000000000c2', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', 'B'),
  ('eeeeeeee-aaaa-0000-0000-0000000000c3', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b2', 'A');
insert into campus.batch_members (batch_id, org_id, user_id, section_id) values
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000031', 'eeeeeeee-aaaa-0000-0000-0000000000c1'),
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000032', 'eeeeeeee-aaaa-0000-0000-0000000000c1'),
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000033', 'eeeeeeee-aaaa-0000-0000-0000000000c2'),
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000034', null);
insert into public.tests (id, slug, title, duration_seconds, is_published, owner_org_id, visibility) values
  ('eeeeeeee-aaaa-0000-0000-0000000000e1', 'e-a-test', 'A test', 600, true, 'eeeeeeee-aaaa-0000-0000-00000000000a', 'org');

-- ── Hierarchy ───────────────────────────────────────────────────────────────
update campus.departments set parent_id = 'eeeeeeee-aaaa-0000-0000-0000000000d1' where id in ('eeeeeeee-aaaa-0000-0000-0000000000d2', 'eeeeeeee-aaaa-0000-0000-0000000000d3');
select pg_temp.check_denied(
  $$update campus.departments set parent_id = 'eeeeeeee-aaaa-0000-0000-0000000000d2' where id = 'eeeeeeee-aaaa-0000-0000-0000000000d1'$$,
  'a unit cannot end up inside itself');
select pg_temp.check_denied(
  $$update campus.departments set parent_id = 'eeeeeeee-bbbb-0000-0000-0000000000d1' where id = 'eeeeeeee-aaaa-0000-0000-0000000000d2'$$,
  'a unit cannot sit under another college''s unit');
select pg_temp.check_denied(
  $$insert into campus.departments (org_id, name, code, kind) values ('eeeeeeee-aaaa-0000-0000-00000000000a', 'x', 'X', 'campus')$$,
  'unknown unit kinds are refused');

-- ── Sections ────────────────────────────────────────────────────────────────
select pg_temp.check_denied(
  $$update campus.batch_members set section_id = 'eeeeeeee-aaaa-0000-0000-0000000000c3'
     where user_id = 'e2000000-0000-0000-0000-000000000031'$$,
  'a student cannot be put in a section of another batch');
select pg_temp.check_denied(
  $$insert into campus.sections (org_id, batch_id, name) values ('eeeeeeee-bbbb-0000-0000-00000000000b', 'eeeeeeee-aaaa-0000-0000-0000000000b1', 'X')$$,
  'a section cannot belong to another college''s batch');

set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.sections (org_id, batch_id, name) values ('eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b2', 'B')$$),
  1, 'an admin adds a section');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select pg_temp.check_denied(
  $$insert into campus.sections (org_id, batch_id, name) values ('eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b2', 'C')$$,
  'faculty cannot add sections');
select pg_temp.check_eq((select count(*) from campus.sections), 4, 'faculty see their college''s sections');
select pg_temp.act_as('e3000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from campus.sections), 0, 'another college sees none');
reset role;

-- ── Eligibility function ───────────────────────────────────────────────────
select pg_temp.check_true(campus.meets_eligibility('{}', null, null, null, null, null), 'no rules: everyone qualifies');
select pg_temp.check_true(campus.meets_eligibility('{"minCgpa": 7}', 7.0, 0, 0, 0, null), 'cgpa at the cut-off qualifies');
select pg_temp.check_true(not campus.meets_eligibility('{"minCgpa": 7}', 6.99, 0, 0, 0, null), 'cgpa below does not');
select pg_temp.check_true(not campus.meets_eligibility('{"minCgpa": 7}', null, 0, 0, 0, null), 'a missing cgpa does not');
select pg_temp.check_true(not campus.meets_eligibility('{"maxBacklogs": 0}', 9, 1, 0, 0, null), 'a backlog fails a zero-backlog rule');
select pg_temp.check_true(campus.meets_eligibility('{"departmentIds": ["eeeeeeee-aaaa-0000-0000-0000000000d2"]}', null, null, null, null,
  'eeeeeeee-aaaa-0000-0000-0000000000d2'), 'listed department qualifies');
select pg_temp.check_true(not campus.meets_eligibility('{"departmentIds": ["eeeeeeee-aaaa-0000-0000-0000000000d2"]}', null, null, null, null, null),
  'no department does not');

-- ── Who an assignment is for ────────────────────────────────────────────────
insert into campus.assignments (id, org_id, batch_id, section_id, test_id, title, opens_at, closes_at, status, eligibility) values
  ('eeeeeeee-aaaa-0000-0000-0000000000a1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', null,
   'eeeeeeee-aaaa-0000-0000-0000000000e1', 'Whole batch', now(), now() + interval '1 day', 'published', '{}'),
  ('eeeeeeee-aaaa-0000-0000-0000000000a2', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-0000000000c1',
   'eeeeeeee-aaaa-0000-0000-0000000000e1', 'Section A', now(), now() + interval '1 day', 'published', '{}'),
  ('eeeeeeee-aaaa-0000-0000-0000000000a3', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', null,
   'eeeeeeee-aaaa-0000-0000-0000000000e1', 'Drive: CGPA 7+, no backlogs', now(), now() + interval '1 day', 'published', '{"minCgpa": 7, "maxBacklogs": 0}');
select pg_temp.check_denied(
  $$insert into campus.assignments (org_id, batch_id, section_id, test_id, title, opens_at, closes_at) values
     ('eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b2', 'eeeeeeee-aaaa-0000-0000-0000000000c1',
      'eeeeeeee-aaaa-0000-0000-0000000000e1', 'x', now(), now() + interval '1 day')$$,
  'an assignment''s section must be in its batch');
select pg_temp.check_denied(
  $$delete from campus.sections where id = 'eeeeeeee-aaaa-0000-0000-0000000000c1'$$,
  'a section with assignments cannot be deleted (its results would go)');

set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from campus.assignment_students('eeeeeeee-aaaa-0000-0000-0000000000a1')), 4, 'whole batch: 4 students');
select pg_temp.check_eq((select count(*) from campus.assignment_students('eeeeeeee-aaaa-0000-0000-0000000000a2')), 2, 'section A: 2 students');
select pg_temp.check_eq((select count(*) from campus.assignment_students('eeeeeeee-aaaa-0000-0000-0000000000a3')), 1, 'drive: only the eligible student');
select pg_temp.act_as('e3000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from campus.assignment_students('eeeeeeee-aaaa-0000-0000-0000000000a1')), 0, 'another college gets nobody');

select pg_temp.act_as('e2000000-0000-0000-0000-000000000031');   -- section A, CGPA 8.2, 0 backlogs
select pg_temp.check_eq((select count(*) from campus.assignments), 3, 's31 sees all three');
select pg_temp.act_as('e2000000-0000-0000-0000-000000000032');   -- section A, CGPA 6.5
select pg_temp.check_eq((select count(*) from campus.assignments), 2, 's32 is not eligible for the drive');
select pg_temp.act_as('e2000000-0000-0000-0000-000000000033');   -- section B, backlogs
select pg_temp.check_eq((select count(*) from campus.assignments), 1, 's33 sees only the whole-batch test');
select pg_temp.act_as('e2000000-0000-0000-0000-000000000034');   -- no section, no record
select pg_temp.check_eq((select count(*) from campus.assignments), 1, 's34 (no section, no record) sees only the whole-batch test');

-- A student cannot raise their own CGPA.
select pg_temp.act_as('e2000000-0000-0000-0000-000000000032');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.org_memberships set cgpa = 9.9 where user_id = 'e2000000-0000-0000-0000-000000000032'$$), 0,
  'a student cannot edit their academic record');
reset role;

rollback;

\o
\echo 'ALL CAMPUS STRUCTURE CHECKS PASSED'
