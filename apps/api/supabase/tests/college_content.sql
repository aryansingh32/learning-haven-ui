-- =============================================================================
-- Content made by colleges (20261031000001): who sees a college's problems,
-- test series and study materials. Runs as real signed-in users inside a
-- rolled-back transaction.
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

create function pg_temp.sees(u uuid, owner uuid, vis public.content_visibility, published boolean) returns int
language sql as $$ select campus.user_can_see_content(u, owner, vis, published)::int $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- College A (faculty fa, students sa1 in batch A1, sa2 in batch A2), college B (student sb), Forge staff.
insert into auth.users (id, email, email_confirmed_at) values
  ('f1000000-0000-0000-0000-0000000000fa', 'fa@cc.test', now()),
  ('f2000000-0000-0000-0000-0000000000a1', 'sa1@cc.test', now()),
  ('f2000000-0000-0000-0000-0000000000a2', 'sa2@cc.test', now()),
  ('f3000000-0000-0000-0000-0000000000b1', 'sb@cc.test', now()),
  ('f0000000-0000-0000-0000-000000000000', 'nobody@cc.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@cc.test';
insert into campus.organizations (id, slug, name) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'cc-college-a', 'CC College A'),
  ('ffffffff-bbbb-0000-0000-00000000000b', 'cc-college-b', 'CC College B');
insert into campus.batches (id, org_id, name) values
  ('ffffffff-aaaa-0000-0000-0000000000b1', 'ffffffff-aaaa-0000-0000-00000000000a', 'A1'),
  ('ffffffff-aaaa-0000-0000-0000000000b2', 'ffffffff-aaaa-0000-0000-00000000000a', 'A2');
insert into campus.org_memberships (org_id, user_id, role) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000fa', 'faculty'),
  ('ffffffff-aaaa-0000-0000-00000000000a', 'f2000000-0000-0000-0000-0000000000a1', 'student'),
  ('ffffffff-aaaa-0000-0000-00000000000a', 'f2000000-0000-0000-0000-0000000000a2', 'student'),
  ('ffffffff-bbbb-0000-0000-00000000000b', 'f3000000-0000-0000-0000-0000000000b1', 'student');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('ffffffff-aaaa-0000-0000-0000000000b1', 'ffffffff-aaaa-0000-0000-00000000000a', 'f2000000-0000-0000-0000-0000000000a1'),
  ('ffffffff-aaaa-0000-0000-0000000000b2', 'ffffffff-aaaa-0000-0000-00000000000a', 'f2000000-0000-0000-0000-0000000000a2');
insert into public.courses (id, title, slug, is_published, owner_org_id, visibility) values
  ('fc000000-0000-0000-0000-00000000000b', 'B own course', 'cc-b-course', true, 'ffffffff-bbbb-0000-0000-00000000000b', 'org');

-- ── The visibility rule ─────────────────────────────────────────────────────
select pg_temp.check_eq(pg_temp.sees('f3000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000f0f0', 'public', true), 1,
  'Forge public content is for everyone');
select pg_temp.check_eq(pg_temp.sees('f2000000-0000-0000-0000-0000000000a1', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', true), 1,
  'a student sees their college''s published content');
select pg_temp.check_eq(pg_temp.sees('f3000000-0000-0000-0000-0000000000b1', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', true), 0,
  'a student of another college does not');
select pg_temp.check_eq(pg_temp.sees('f0000000-0000-0000-0000-000000000000', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', true), 0,
  'nor does a learner with no college');
select pg_temp.check_eq(pg_temp.sees('f2000000-0000-0000-0000-0000000000a1', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', false), 0,
  'students never see drafts');
select pg_temp.check_eq(pg_temp.sees('f1000000-0000-0000-0000-0000000000fa', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', false), 1,
  'the college''s content staff see their drafts');
select pg_temp.check_eq(pg_temp.sees('f1000000-0000-0000-0000-0000000000fa', 'ffffffff-bbbb-0000-0000-00000000000b', 'org', false), 0,
  'but not another college''s drafts');
update campus.organizations set status = 'suspended' where id = 'ffffffff-aaaa-0000-0000-00000000000a';
select pg_temp.check_eq(pg_temp.sees('f2000000-0000-0000-0000-0000000000a1', 'ffffffff-aaaa-0000-0000-00000000000a', 'org', true), 0,
  'a suspended college''s content disappears');
update campus.organizations set status = 'active' where id = 'ffffffff-aaaa-0000-0000-00000000000a';
select pg_temp.check_eq((select count(*) from campus.user_colleges('f2000000-0000-0000-0000-0000000000a1')), 1, 'a student''s colleges are listed');
select pg_temp.check_eq(has_function_privilege('authenticated', 'campus.user_can_see_content(uuid,uuid,public.content_visibility,boolean)', 'execute')::int, 0,
  'the rule is server-only (it takes a user id)');
select pg_temp.check_eq((select count(*) from public.problems where owner_org_id is null or visibility is null), 0, 'every problem has an owner and a visibility');

-- ── Study materials ─────────────────────────────────────────────────────────
select pg_temp.act_as('f1000000-0000-0000-0000-0000000000fa');
set local role authenticated;
insert into campus.study_materials (org_id, title, kind, body, is_published) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'Pointers cheat sheet', 'note', '# Pointers', true),
  ('ffffffff-aaaa-0000-0000-00000000000a', 'Draft notes', 'note', 'wip', false);
insert into campus.study_materials (org_id, batch_id, title, kind, url, is_published) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'ffffffff-aaaa-0000-0000-0000000000b1', 'A1 lab manual', 'link', 'https://example.edu/lab.pdf', true);
select pg_temp.check_denied($$insert into campus.study_materials (org_id, course_id, title, kind, body) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'fc000000-0000-0000-0000-00000000000b', 'Steal', 'note', 'x')$$,
  'a material cannot point at another college''s course');
select pg_temp.check_denied($$insert into campus.study_materials (org_id, title, kind, body) values
  ('ffffffff-bbbb-0000-0000-00000000000b', 'Spam', 'note', 'x')$$, 'faculty cannot publish into another college');
reset role;

select pg_temp.act_as('f2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.study_materials), 2, 'a student of batch A1 sees the college note and their batch''s manual');
select pg_temp.check_denied($$insert into campus.study_materials (org_id, title, kind, body, is_published) values
  ('ffffffff-aaaa-0000-0000-00000000000a', 'Mine', 'note', 'x', true)$$, 'students cannot publish materials');
reset role;
select pg_temp.act_as('f2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.study_materials), 1, 'a student of batch A2 sees only the college-wide note');
reset role;
select pg_temp.act_as('f3000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.study_materials), 0, 'another college''s student sees none');
reset role;

rollback;

\o
\echo 'ALL COLLEGE CONTENT CHECKS PASSED'
