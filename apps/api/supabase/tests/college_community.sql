-- =============================================================================
-- College community (20261101000001): people, teams, threads, replies and
-- reports stay inside one college; team threads stay inside the team; only
-- moderators hide and pin. Runs as real signed-in users in a rolled-back
-- transaction.
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

-- Rows an UPDATE/DELETE touched (RLS hides rows silently instead of raising).
create function pg_temp.touched(stmt text) returns bigint
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

create function pg_temp.as_system() returns void
language sql as $$ select set_config('request.jwt.claims', '', true); $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- College A: faculty fa (moderator), students a1 a2 a3. College B: student b1.
insert into auth.users (id, email, email_confirmed_at) values
  ('c1000000-0000-0000-0000-0000000000fa', 'fa@cm.test', now()),
  ('c2000000-0000-0000-0000-0000000000a1', 'a1@cm.test', now()),
  ('c2000000-0000-0000-0000-0000000000a2', 'a2@cm.test', now()),
  ('c2000000-0000-0000-0000-0000000000a3', 'a3@cm.test', now()),
  ('c3000000-0000-0000-0000-0000000000b1', 'b1@cm.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@cm.test';
insert into campus.organizations (id, slug, name) values
  ('cccccccc-aaaa-0000-0000-00000000000a', 'cm-college-a', 'CM College A'),
  ('cccccccc-bbbb-0000-0000-00000000000b', 'cm-college-b', 'CM College B');
insert into campus.org_memberships (org_id, user_id, role) values
  ('cccccccc-aaaa-0000-0000-00000000000a', 'c1000000-0000-0000-0000-0000000000fa', 'faculty'),
  ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a1', 'student'),
  ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a2', 'student'),
  ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a3', 'student'),
  ('cccccccc-bbbb-0000-0000-00000000000b', 'c3000000-0000-0000-0000-0000000000b1', 'student');
insert into public.problems (id, slug, title, description, difficulty, topic, order_index, owner_org_id, visibility) values
  ('cb000000-0000-0000-0000-00000000000b', 'cm-b-only', 'B only', 'x', 'easy', 'Arrays', 9999, 'cccccccc-bbbb-0000-0000-00000000000b', 'org');

-- ── People ──────────────────────────────────────────────────────────────────
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into campus.community_profiles (org_id, user_id, headline, skills, looking_for_team)
values ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a1', 'Backend, Java', '{java,sql}', true);
select pg_temp.check_denied($$insert into campus.community_profiles (org_id, user_id, headline)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a2', 'Not me')$$, 'nobody writes another person''s card');
select pg_temp.check_denied($$insert into campus.community_profiles (org_id, user_id, headline)
  values ('cccccccc-bbbb-0000-0000-00000000000b', 'c2000000-0000-0000-0000-0000000000a1', 'Wrong college')$$, 'nor a card in a college they are not in');
reset role;
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_profiles), 1, 'classmates see the directory');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_profiles set headline = 'hacked'$$), 0, 'but cannot edit someone else''s card');
reset role;
select pg_temp.act_as('c3000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_profiles), 0, 'another college sees none of it');
reset role;

-- ── Teams ───────────────────────────────────────────────────────────────────
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into campus.community_teams (id, org_id, name, description, max_members, created_by)
values ('cd000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'Hostel app', 'Mess menu + laundry', 2, 'c2000000-0000-0000-0000-0000000000a1');
select pg_temp.check_eq((select count(*) from campus.community_team_members where team_id = 'cd000000-0000-0000-0000-000000000001' and role = 'lead' and status = 'active'), 1,
  'the creator leads the team');
select pg_temp.check_denied($$insert into campus.community_teams (org_id, name, created_by)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'Fake', 'c2000000-0000-0000-0000-0000000000a2')$$, 'a team can''t be created in someone else''s name');
reset role;

select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select pg_temp.check_denied($$insert into campus.community_team_members (team_id, org_id, user_id, status)
  values ('cd000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a2', 'active')$$,
  'nobody walks straight into a team');
insert into campus.community_team_members (team_id, org_id, user_id, message)
values ('cd000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a2', 'I do Android');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_team_members set status = 'active'
  where user_id = 'c2000000-0000-0000-0000-0000000000a2'$$), 0, 'nor accepts their own request');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_teams set name = 'Mine now'$$), 0, 'only the lead edits the team');
reset role;
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a3');
set local role authenticated;
insert into campus.community_team_members (team_id, org_id, user_id)
values ('cd000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a3');
select pg_temp.check_eq((select count(*) from campus.community_team_members where team_id = 'cd000000-0000-0000-0000-000000000001'), 2,
  'others see the members and their own request, not other requests');
reset role;
select pg_temp.act_as('c3000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select pg_temp.check_denied($$insert into campus.community_team_members (team_id, org_id, user_id)
  values ('cd000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c3000000-0000-0000-0000-0000000000b1')$$,
  'another college can''t ask to join');
select pg_temp.check_eq((select count(*) from campus.community_teams), 0, 'nor see the team');
reset role;

select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_team_members where status = 'requested'), 2, 'the lead sees both requests');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_team_members set status = 'active'
  where user_id = 'c2000000-0000-0000-0000-0000000000a2'$$), 1, 'the lead accepts a request');
select pg_temp.check_denied($$update campus.community_team_members set status = 'active'
  where user_id = 'c2000000-0000-0000-0000-0000000000a3'$$, 'a full team takes nobody else');
select pg_temp.check_denied($$update campus.community_team_members set role = 'lead'
  where user_id = 'c2000000-0000-0000-0000-0000000000a2'$$, 'roles change only by handing over');
select pg_temp.check_denied($$update campus.community_teams set max_members = 1$$, 'the size can''t drop below the members');
select pg_temp.check_denied($$update campus.community_teams set created_by = 'c2000000-0000-0000-0000-0000000000a2'$$, 'nor can who started it');
reset role;

-- ── Threads ─────────────────────────────────────────────────────────────────
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a3');
set local role authenticated;
insert into campus.community_threads (id, org_id, author_id, kind, title, body)
values ('ce000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a3',
        'doubt', 'Why is my two sum O(n^2)?', 'I used two loops');
select pg_temp.check_denied($$insert into campus.community_threads (org_id, author_id, title, body, problem_id)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a3', 'About B', 'x', 'cb000000-0000-0000-0000-00000000000b')$$,
  'a doubt can''t point at another college''s problem');
select pg_temp.check_denied($$insert into campus.community_threads (org_id, team_id, author_id, title, body)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'cd000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-0000000000a3', 'Sneak', 'x')$$,
  'only team members post in a team');
select pg_temp.check_denied($$insert into campus.community_threads (org_id, author_id, title, body, is_pinned)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a3', 'Pin me', 'x', true)$$,
  'students can''t pin their own threads');
reset role;

select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
insert into campus.community_threads (id, org_id, team_id, author_id, kind, title, body)
values ('ce000000-0000-0000-0000-000000000002', 'cccccccc-aaaa-0000-0000-00000000000a', 'cd000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-0000000000a1', 'discussion', 'Stack: React Native?', 'Thoughts?');
insert into campus.community_posts (id, thread_id, org_id, author_id, body)
values ('cf000000-0000-0000-0000-000000000001', 'ce000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a',
        'c2000000-0000-0000-0000-0000000000a1', 'Use a hash map: one pass.');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_threads set title = 'Changed'
  where id = 'ce000000-0000-0000-0000-000000000001'$$), 0, 'nobody edits another person''s thread');
reset role;

select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_threads), 1, 'a non-member doesn''t see the team''s thread');
select pg_temp.check_eq((select count(*) from campus.community_posts), 1, 'the college''s replies are visible');
update campus.community_threads set solved_post_id = 'cf000000-0000-0000-0000-000000000001' where id = 'ce000000-0000-0000-0000-000000000001';
select pg_temp.check_eq((select count(*) from campus.community_threads where solved_post_id is not null), 1, 'the author marks the answer');
select pg_temp.check_denied($$update campus.community_threads set solved_post_id = 'cf000000-0000-0000-0000-000000000099'
  where id = 'ce000000-0000-0000-0000-000000000001'$$, 'the answer must be a reply in the thread');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_posts set body = 'edited by someone else'$$), 0, 'nobody edits another person''s reply');
reset role;

select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_threads), 2, 'a team member sees the team thread too');
reset role;
select pg_temp.act_as('c3000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_threads) + (select count(*) from campus.community_posts), 0,
  'another college sees no threads or replies');
select pg_temp.check_denied($$insert into campus.community_posts (thread_id, org_id, author_id, body)
  values ('ce000000-0000-0000-0000-000000000001', 'cccccccc-aaaa-0000-0000-00000000000a', 'c3000000-0000-0000-0000-0000000000b1', 'hi')$$,
  'nor replies to them');
reset role;

-- ── Reports and moderation ──────────────────────────────────────────────────
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
insert into campus.community_reports (org_id, post_id, reporter_id, reason)
values ('cccccccc-aaaa-0000-0000-00000000000a', 'cf000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-0000000000a2', 'Spoils the answer');
select pg_temp.check_denied($$insert into campus.community_reports (org_id, thread_id, reporter_id, reason)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'ce000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-0000000000a1', 'framed')$$,
  'reports are filed as yourself');
select pg_temp.check_eq(pg_temp.touched($$update campus.community_threads set is_hidden = true where id = 'ce000000-0000-0000-0000-000000000001'$$), 0,
  'students can''t hide other people''s threads');
reset role;
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select pg_temp.check_denied($$update campus.community_threads set is_hidden = true where id = 'ce000000-0000-0000-0000-000000000001'$$,
  'nor their own (that is a moderator''s call)');
select pg_temp.check_eq((select count(*) from campus.community_reports), 0, 'reports are private to the reporter and moderators');
reset role;

select pg_temp.act_as('c1000000-0000-0000-0000-0000000000fa');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_reports where resolved_at is null), 1, 'moderators see open reports');
select pg_temp.check_eq((select count(*) from campus.community_threads), 2, 'moderators can open a team thread a report points at');
update campus.community_posts set is_hidden = true where id = 'cf000000-0000-0000-0000-000000000001';
select pg_temp.check_denied($$update campus.community_posts set body = 'moderator rewrote it'$$, 'moderators don''t edit replies either');
update campus.community_threads set is_pinned = true where id = 'ce000000-0000-0000-0000-000000000001';
update campus.community_reports set resolved_at = now(), resolved_by = 'c1000000-0000-0000-0000-0000000000fa';
select pg_temp.check_denied($$update campus.community_threads set body = 'moderator rewrote it'
  where id = 'ce000000-0000-0000-0000-000000000001'$$, 'moderators hide, but don''t put words in people''s mouths');
reset role;
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_posts), 0, 'a hidden reply disappears for others');
select pg_temp.check_denied($$insert into campus.community_threads (org_id, author_id, title, body, is_hidden)
  values ('cccccccc-aaaa-0000-0000-00000000000a', 'c2000000-0000-0000-0000-0000000000a2', 'x', 'x', true)$$, 'nobody posts pre-hidden');
reset role;
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_posts), 1, 'but its author still sees it');
delete from campus.community_posts where id = 'cf000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.check_eq((select count(*) from campus.community_threads where id = 'ce000000-0000-0000-0000-000000000001' and solved_post_id is null), 1,
  'deleting the answer un-marks it');

-- ── Leaving ─────────────────────────────────────────────────────────────────
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a1');
set local role authenticated;
delete from campus.community_team_members where user_id = 'c2000000-0000-0000-0000-0000000000a1';
reset role;
select pg_temp.check_eq((select count(*) from campus.community_team_members where user_id = 'c2000000-0000-0000-0000-0000000000a2' and role = 'lead'), 1,
  'a lead who leaves hands the team to the next member');
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a2');
set local role authenticated;
delete from campus.community_team_members where user_id = 'c2000000-0000-0000-0000-0000000000a2';
reset role;
select pg_temp.check_eq((select count(*) from campus.community_teams where id = 'cd000000-0000-0000-0000-000000000001' and status = 'archived'), 1,
  'the last one out archives the team');
select pg_temp.check_eq((select count(*) from campus.community_team_members where team_id = 'cd000000-0000-0000-0000-000000000001'), 0,
  'and its open requests go with it');
delete from campus.org_memberships where user_id = 'c2000000-0000-0000-0000-0000000000a1' and org_id = 'cccccccc-aaaa-0000-0000-00000000000a';
select pg_temp.check_eq((select count(*) from campus.community_profiles where user_id = 'c2000000-0000-0000-0000-0000000000a1'), 0,
  'leaving the college removes the directory card');

-- A suspended college's community is closed.
select pg_temp.as_system();
update campus.organizations set status = 'suspended' where id = 'cccccccc-aaaa-0000-0000-00000000000a';
select pg_temp.act_as('c2000000-0000-0000-0000-0000000000a3');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.community_threads), 0, 'a suspended college''s threads are closed');
reset role;

rollback;

\o
\echo 'ALL COLLEGE COMMUNITY CHECKS PASSED'
