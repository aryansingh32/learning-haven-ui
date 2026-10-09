-- =============================================================================
-- Activity log and custom roles (slice C2c).
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
  ('71000000-0000-0000-0000-000000000001', 'adm@g.test', now()),
  ('71000000-0000-0000-0000-000000000002', 'fac@g.test', now()),
  ('71000000-0000-0000-0000-000000000003', 'setter@g.test', now()),
  ('72000000-0000-0000-0000-000000000001', 'stu@g.test', now()),
  ('73000000-0000-0000-0000-000000000001', 'adm@h.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@g.test' or email like '%@h.test';
insert into campus.organizations (id, slug, name) values
  ('77777777-aaaa-0000-0000-00000000000a', 'g-college', 'College G'),
  ('77777777-bbbb-0000-0000-00000000000b', 'h-college', 'College H');
insert into campus.org_memberships (org_id, user_id, role) values
  ('77777777-aaaa-0000-0000-00000000000a', '71000000-0000-0000-0000-000000000001', 'admin'),
  ('77777777-aaaa-0000-0000-00000000000a', '71000000-0000-0000-0000-000000000002', 'faculty'),
  ('77777777-aaaa-0000-0000-00000000000a', '71000000-0000-0000-0000-000000000003', 'invigilator'),
  ('77777777-aaaa-0000-0000-00000000000a', '72000000-0000-0000-0000-000000000001', 'student'),
  ('77777777-bbbb-0000-0000-00000000000b', '73000000-0000-0000-0000-000000000001', 'admin');
insert into public.tests (id, slug, title, duration_seconds, is_published, owner_org_id, visibility) values
  ('77777777-aaaa-0000-0000-0000000000e1', 'g-test', 'G test', 600, false, '77777777-aaaa-0000-0000-00000000000a', 'org'),
  ('77777777-ffff-0000-0000-0000000000e1', 'forge-g', 'Forge test', 600, true, '00000000-0000-0000-0000-00000000f0f0', 'public');
delete from campus.audit_log;

-- ── Custom roles ────────────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.act_as('71000000-0000-0000-0000-000000000002');
select pg_temp.check_denied(
  $$insert into campus.custom_roles (org_id, name, permissions) values ('77777777-aaaa-0000-0000-00000000000a', 'Setter', '{content.create}')$$,
  'faculty cannot create roles');
select pg_temp.act_as('71000000-0000-0000-0000-000000000001');
select pg_temp.check_denied(
  $$insert into campus.custom_roles (org_id, name, permissions) values ('77777777-aaaa-0000-0000-00000000000a', 'Boss', '{org.manage}')$$,
  'owner-only permissions cannot be given by a custom role');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.custom_roles (id, org_id, name, permissions) values
     ('77777777-aaaa-0000-0000-0000000000c1', '77777777-aaaa-0000-0000-00000000000a', 'Question setter', '{content.create}')$$),
  1, 'an admin creates a Question setter role');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update campus.org_memberships set custom_role_id = '77777777-aaaa-0000-0000-0000000000c1'
     where user_id = '71000000-0000-0000-0000-000000000003'$$), 1, 'and gives it to a staff member');
select pg_temp.check_denied(
  $$update campus.org_memberships set custom_role_id = '77777777-aaaa-0000-0000-0000000000c1'
     where user_id = '72000000-0000-0000-0000-000000000001'$$, 'but not to a student');
select pg_temp.act_as('73000000-0000-0000-0000-000000000001');
select pg_temp.check_denied(
  $$update campus.org_memberships set custom_role_id = '77777777-aaaa-0000-0000-0000000000c1'
     where org_id = '77777777-bbbb-0000-0000-00000000000b'$$, 'another college cannot use it');

select pg_temp.act_as('71000000-0000-0000-0000-000000000003');
select pg_temp.check_true(campus.has_org_permission('77777777-aaaa-0000-0000-00000000000a', 'content.create'), 'the setter may write questions');
select pg_temp.check_true(not campus.has_org_permission('77777777-aaaa-0000-0000-00000000000a', 'assessments.invigilate'),
  'and no longer has the base role''s permissions');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update public.tests set title = 'G test v2' where id = '77777777-aaaa-0000-0000-0000000000e1'$$), 1, 'so they can edit the college''s test');
reset role;
select pg_temp.check_denied($$select campus.user_permissions('77777777-aaaa-0000-0000-00000000000a', '71000000-0000-0000-0000-000000000003')$$,
  'nobody signed in can ask about another person''s permissions') from (select set_config('role', 'authenticated', true)) x;
reset role;

-- ── Activity log ────────────────────────────────────────────────────────────
select pg_temp.check_eq((select count(*) from campus.audit_log where entity = 'tests' and action = 'update'
   and actor_id = '71000000-0000-0000-0000-000000000003' and changes->'title'->>'to' = 'G test v2'), 1, 'the test edit is logged with who and what');
select pg_temp.check_eq((select count(*) from campus.audit_log where entity = 'custom_roles' and action = 'create'), 1, 'creating a role is logged');
select pg_temp.check_eq((select count(*) from campus.audit_log where entity = 'org_memberships' and changes ? 'custom_role_id'), 1, 'giving a role is logged');
update public.tests set title = 'Forge v2' where id = '77777777-ffff-0000-0000-0000000000e1';
select pg_temp.check_eq((select count(*) from campus.audit_log where summary = 'Forge v2'), 0, 'Forge content is not in college logs');
update public.tests set updated_at = now() where id = '77777777-aaaa-0000-0000-0000000000e1';
select pg_temp.check_eq((select count(*) from campus.audit_log where entity = 'tests'), 1, 'a change to timestamps only is not logged');

set local role authenticated;
select pg_temp.act_as('71000000-0000-0000-0000-000000000001');
select pg_temp.check_true((select count(*) from campus.audit_log) >= 3, 'the admin reads the log');
select pg_temp.check_denied($$insert into campus.audit_log (org_id, action, entity) values ('77777777-aaaa-0000-0000-00000000000a', 'update', 'x')$$,
  'nobody writes the log by hand');
select pg_temp.check_denied($$delete from campus.audit_log$$, 'or deletes from it');
select pg_temp.act_as('71000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from campus.audit_log), 0, 'faculty do not read it');
select pg_temp.act_as('73000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from campus.audit_log), 0, 'another college does not read it');
reset role;

rollback;

\o
\echo 'ALL CAMPUS AUDIT AND ROLE CHECKS PASSED'
