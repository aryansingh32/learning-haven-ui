-- =============================================================================
-- Webcam snapshots (20261107000001): only the Campus API writes them, only
-- college staff who invigilate or see reports read them, JPEG ≤ 45 KB, ≤ 40
-- per attempt, other colleges see nothing.
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

-- A JPEG-looking blob of n bytes.
create function pg_temp.jpeg(n int) returns bytea
language sql as $$ select '\xffd8ff'::bytea || decode(repeat('00', n - 3), 'hex') $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values
  ('5a000000-0000-0000-0000-000000000001', 'inv@snap-a.test', now()),
  ('5a000000-0000-0000-0000-000000000002', 'stu@snap-a.test', now()),
  ('5b000000-0000-0000-0000-000000000001', 'inv@snap-b.test', now());
insert into public.users (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users where email like '%snap-%.test';

insert into campus.organizations (id, slug, name) values
  ('5aaaaaaa-0000-0000-0000-00000000000a', 'snap-a', 'Snap A'),
  ('5bbbbbbb-0000-0000-0000-00000000000b', 'snap-b', 'Snap B');
insert into campus.batches (id, org_id, name) values
  ('5aaaaaaa-0000-0000-0000-0000000000b1', '5aaaaaaa-0000-0000-0000-00000000000a', 'A1');
insert into campus.org_memberships (org_id, user_id, role) values
  ('5aaaaaaa-0000-0000-0000-00000000000a', '5a000000-0000-0000-0000-000000000001', 'invigilator'),
  ('5aaaaaaa-0000-0000-0000-00000000000a', '5a000000-0000-0000-0000-000000000002', 'student'),
  ('5bbbbbbb-0000-0000-0000-00000000000b', '5b000000-0000-0000-0000-000000000001', 'invigilator');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('5aaaaaaa-0000-0000-0000-0000000000b1', '5aaaaaaa-0000-0000-0000-00000000000a', '5a000000-0000-0000-0000-000000000002');
insert into public.tests (id, slug, title, duration_seconds, is_published, owner_org_id, visibility) values
  ('5aaaaaaa-0000-0000-0000-0000000000e1', 'snap-test', 'Snap test', 600, true, '5aaaaaaa-0000-0000-0000-00000000000a', 'org');
insert into campus.assignments (id, org_id, batch_id, test_id, title, opens_at, closes_at, status) values
  ('5aaaaaaa-0000-0000-0000-0000000000a1', '5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000b1',
   '5aaaaaaa-0000-0000-0000-0000000000e1', 'Proctored', now() - interval '1 hour', now() + interval '1 day', 'published');
insert into public.test_attempts (id, user_id, test_id, expires_at, total_questions, total_marks, assignment_id, org_id) values
  ('5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', '5aaaaaaa-0000-0000-0000-0000000000e1',
   now() + interval '10 minutes', 1, 1, '5aaaaaaa-0000-0000-0000-0000000000a1', '5aaaaaaa-0000-0000-0000-00000000000a');

-- The API (connection owner) writes.
insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image, ip)
values ('5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', pg_temp.jpeg(2000), '10.0.0.1');
select pg_temp.check_eq((select count(*) from campus.proctoring_snapshots), 1, 'the API stores a snapshot');

select pg_temp.check_denied($$insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image)
  values ('5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', pg_temp.jpeg(46000))$$,
  'snapshots are at most 45 KB');
select pg_temp.check_denied($$insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image)
  values ('5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', decode(repeat('89', 2000), 'hex'))$$,
  'snapshots must be JPEG');

insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image)
select '5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', pg_temp.jpeg(600)
from generate_series(1, 39);
select pg_temp.check_denied($$insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image)
  values ('5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', pg_temp.jpeg(600))$$,
  'at most 40 snapshots per attempt');

-- Students can't write or read them, even their own.
select pg_temp.act_as('5a000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_denied($$insert into campus.proctoring_snapshots (org_id, attempt_id, user_id, image)
  values ('5aaaaaaa-0000-0000-0000-00000000000a', '5aaaaaaa-0000-0000-0000-0000000000d1', '5a000000-0000-0000-0000-000000000002', pg_temp.jpeg(600))$$,
  'a student cannot upload snapshots directly');
select pg_temp.check_eq((select count(*) from campus.proctoring_snapshots), 0, 'a student cannot read snapshots');
select pg_temp.check_denied($$delete from campus.proctoring_snapshots$$, 'a student cannot delete snapshots');
reset role;

-- College A's invigilator reads them; College B's sees none.
select pg_temp.act_as('5a000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.proctoring_snapshots), 40, 'the college''s invigilator reads snapshots');
select pg_temp.check_denied($$delete from campus.proctoring_snapshots$$, 'staff cannot delete snapshots');
reset role;

select pg_temp.act_as('5b000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.proctoring_snapshots), 0, 'another college sees no snapshots');
reset role;

select pg_temp.check_eq((select count(*) from pg_constraint where conname = 'proctoring_events_event_type_check'
  and pg_get_constraintdef(oid) like '%camera_off%'), 1, 'camera_off event type allowed');

rollback;

\o
\echo 'ALL PROCTORING SNAPSHOT CHECKS PASSED'
