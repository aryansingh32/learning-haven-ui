-- =============================================================================
-- Placement drives (slice C3): who sees, who registers, who decides.
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
  ('91000000-0000-0000-0000-000000000001', 'po@p.test', now()), ('91000000-0000-0000-0000-000000000002', 'fac@p.test', now()),
  ('92000000-0000-0000-0000-000000000001', 's1@p.test', now()), ('92000000-0000-0000-0000-000000000002', 's2@p.test', now()),
  ('92000000-0000-0000-0000-000000000003', 's3@p.test', now()), ('93000000-0000-0000-0000-000000000001', 'po@q.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@p.test' or email like '%@q.test';
insert into campus.organizations (id, slug, name) values ('99999999-aaaa-0000-0000-00000000000a', 'p-college', 'College P'), ('99999999-bbbb-0000-0000-00000000000b', 'q-college', 'College Q');
insert into campus.batches (id, org_id, name) values
  ('99999999-aaaa-0000-0000-0000000000b1', '99999999-aaaa-0000-0000-00000000000a', 'B1'), ('99999999-aaaa-0000-0000-0000000000b2', '99999999-aaaa-0000-0000-00000000000a', 'B2');
insert into campus.org_memberships (org_id, user_id, role, cgpa, active_backlogs) values
  ('99999999-aaaa-0000-0000-00000000000a', '91000000-0000-0000-0000-000000000001', 'placement_officer', null, null),
  ('99999999-aaaa-0000-0000-00000000000a', '91000000-0000-0000-0000-000000000002', 'faculty', null, null),
  ('99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000001', 'student', 8.0, 0),
  ('99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000002', 'student', 6.0, 0),
  ('99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000003', 'student', 9.0, 0),
  ('99999999-bbbb-0000-0000-00000000000b', '93000000-0000-0000-0000-000000000001', 'placement_officer', null, null);
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('99999999-aaaa-0000-0000-0000000000b1', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000001'),
  ('99999999-aaaa-0000-0000-0000000000b1', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000002'),
  ('99999999-aaaa-0000-0000-0000000000b2', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000003');

set local role authenticated;
select pg_temp.act_as('91000000-0000-0000-0000-000000000002');
select pg_temp.check_denied(
  $$insert into campus.placement_drives (org_id, company, role_title) values ('99999999-aaaa-0000-0000-00000000000a', 'X', 'Y')$$,
  'faculty cannot create drives');
select pg_temp.act_as('91000000-0000-0000-0000-000000000001');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.placement_drives (id, org_id, company, role_title, batch_ids, eligibility, status, apply_by) values
     ('99999999-aaaa-0000-0000-0000000000d1', '99999999-aaaa-0000-0000-00000000000a', 'Acme', 'Graduate Engineer',
      '{99999999-aaaa-0000-0000-0000000000b1}', '{"minCgpa": 7}', 'open', now() + interval '3 days')$$), 1, 'the placement officer opens a drive');

select pg_temp.act_as('92000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from campus.placement_drives), 1, 'an eligible student sees the drive');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.drive_registrations (drive_id, org_id, user_id) values ('99999999-aaaa-0000-0000-0000000000d1', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000001')$$),
  1, 'and registers');
select pg_temp.check_denied(
  $$update campus.drive_registrations set status = 'selected' where user_id = '92000000-0000-0000-0000-000000000001'$$, 'but cannot select themselves');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.drive_registrations set status = 'withdrawn' where user_id = '92000000-0000-0000-0000-000000000001'$$), 1, 'can withdraw');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.drive_registrations set status = 'registered' where user_id = '92000000-0000-0000-0000-000000000001'$$), 1, 'and register again while it is open');

select pg_temp.act_as('92000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from campus.placement_drives), 0, 'a student below the CGPA cut-off does not see it');
select pg_temp.check_denied(
  $$insert into campus.drive_registrations (drive_id, org_id, user_id) values ('99999999-aaaa-0000-0000-0000000000d1', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000002')$$,
  'and cannot register by id');
select pg_temp.act_as('92000000-0000-0000-0000-000000000003');
select pg_temp.check_eq((select count(*) from campus.placement_drives), 0, 'a student of another batch does not see it');
select pg_temp.check_denied(
  $$insert into campus.drive_registrations (drive_id, org_id, user_id) values ('99999999-aaaa-0000-0000-0000000000d1', '99999999-aaaa-0000-0000-00000000000a', '92000000-0000-0000-0000-000000000001')$$,
  'nor register someone else');

select pg_temp.act_as('91000000-0000-0000-0000-000000000001');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.drive_registrations set status = 'shortlisted'$$), 1, 'the placement officer shortlists');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.placement_drives set apply_by = now() - interval '1 minute'$$), 1, 'and the deadline passes');
select pg_temp.act_as('91000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from campus.drive_registrations), 1, 'faculty with reports can see registrations');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.drive_registrations set status = 'rejected'$$), 0, 'but not decide them');
select pg_temp.act_as('93000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from campus.placement_drives), 0, 'another college sees nothing');
select pg_temp.check_eq((select count(*) from campus.drive_registrations), 0, 'nor its registrations');
reset role;
select pg_temp.check_eq((select count(*) from campus.audit_log where entity = 'drive_registrations' and action = 'update' and changes ? 'status'), 3, 'status changes are in the activity log');

rollback;

\o
\echo 'ALL CAMPUS DRIVE CHECKS PASSED'
