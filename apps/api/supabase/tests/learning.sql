-- =============================================================================
-- Learning (slice W2-L1): highlights (own rows), course prerequisites (server-only,
-- no cycles), drip start date, chapter discussions (course visibility, own edits,
-- hidden posts, reports).
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
  when insufficient_privilege or check_violation or foreign_key_violation or not_null_violation then
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
-- 1 and 2 learners; 3 College A student (batch L1); 4 College A faculty; 5 outsider; 9 Forge admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('e1000000-0000-0000-0000-000000000001', 'l1@l.test', now()),
  ('e1000000-0000-0000-0000-000000000002', 'l2@l.test', now()),
  ('e1000000-0000-0000-0000-000000000003', 'stu@l.test', now()),
  ('e1000000-0000-0000-0000-000000000004', 'fac@l.test', now()),
  ('e1000000-0000-0000-0000-000000000005', 'out@l.test', now()),
  ('e1000000-0000-0000-0000-000000000009', 'admin@l.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@l.test';
update public.users set role = 'admin' where id = 'e1000000-0000-0000-0000-000000000009';

insert into campus.organizations (id, slug, name) values ('eeeeeeee-aaaa-0000-0000-00000000000a', 'l-college-a', 'College A');
insert into campus.batches (id, org_id, name) values ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'L1');
insert into campus.org_memberships (org_id, user_id, role) values
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000003', 'student'),
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000004', 'faculty');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('eeeeeeee-aaaa-0000-0000-0000000000b1', 'eeeeeeee-aaaa-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000003');

-- Courses: P (public basics), Q (public, needs P), C (College A batch course).
insert into public.courses (id, title, slug, is_published, owner_org_id, visibility) values
  ('ec000000-0000-0000-0000-00000000000a', 'Basics',   'l-basics',   true, '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('ec000000-0000-0000-0000-00000000000b', 'Advanced', 'l-advanced', true, '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('ec000000-0000-0000-0000-00000000000c', 'College',  'l-college',  true, 'eeeeeeee-aaaa-0000-0000-00000000000a', 'batch'),
  ('ec000000-0000-0000-0000-00000000000d', 'Empty',    'l-empty',    true, '00000000-0000-0000-0000-00000000f0f0', 'public');
insert into public.chapters (id, course_id, chapter_number, title) values
  ('ec100000-0000-0000-0000-0000000000a1', 'ec000000-0000-0000-0000-00000000000a', 1, 'Basics 1'),
  ('ec100000-0000-0000-0000-0000000000a2', 'ec000000-0000-0000-0000-00000000000a', 2, 'Basics 2'),
  ('ec100000-0000-0000-0000-0000000000b1', 'ec000000-0000-0000-0000-00000000000b', 1, 'Advanced 1'),
  ('ec100000-0000-0000-0000-0000000000c1', 'ec000000-0000-0000-0000-00000000000c', 1, 'College 1');
insert into public.steps (id, chapter_id, step_number, type, title) values
  ('ec200000-0000-0000-0000-0000000000a1', 'ec100000-0000-0000-0000-0000000000a1', 1, 'doc', 'Read'),
  ('ec200000-0000-0000-0000-0000000000b1', 'ec100000-0000-0000-0000-0000000000b1', 1, 'doc', 'Read');
insert into campus.course_assignments (org_id, batch_id, course_id, title, status) values
  ('eeeeeeee-aaaa-0000-0000-00000000000a', 'eeeeeeee-aaaa-0000-0000-0000000000b1', 'ec000000-0000-0000-0000-00000000000c', 'Do this', 'published');

-- ── Highlights ──────────────────────────────────────────────────────────────
insert into public.chapter_highlights (user_id, chapter_id, step_id, text) values
  ('e1000000-0000-0000-0000-000000000002', 'ec100000-0000-0000-0000-0000000000a1', 'ec200000-0000-0000-0000-0000000000a1', 'theirs');
select pg_temp.check_denied($$insert into public.chapter_highlights (user_id, chapter_id, text) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a1', '   ')$$, 'an empty highlight is refused');
select pg_temp.check_denied($$insert into public.chapter_highlights (user_id, chapter_id, text, color) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a1', 'x', 'red')$$, 'an unknown colour is refused');

set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.chapter_highlights (user_id, chapter_id, step_id, text, prefix, suffix, start_offset) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a1', 'ec200000-0000-0000-0000-0000000000a1', 'a stack is LIFO', 'Remember: ', '.', 120);
select pg_temp.check_eq((select count(*) from public.chapter_highlights), 1, 'a learner sees only their own highlights');
select pg_temp.check_denied($$insert into public.chapter_highlights (user_id, chapter_id, text) values
  ('e1000000-0000-0000-0000-000000000002', 'ec100000-0000-0000-0000-0000000000a1', 'forged')$$, 'and cannot add one for someone else');
select pg_temp.check_denied($$insert into public.chapter_highlights (user_id, chapter_id, step_id, text) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a1', 'ec200000-0000-0000-0000-0000000000b1', 'x')$$,
  'a highlight cannot point at another chapter''s step');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.chapter_highlights set color = 'green'$$), 1, 'a learner can recolour their highlight');
select pg_temp.check_denied($$update public.chapter_highlights set text = 'changed'$$, 'but not rewrite its text');
select pg_temp.check_eq(pg_temp.rows_changed($$delete from public.chapter_highlights where text = 'theirs'$$), 0, 'or delete someone else''s');
select pg_temp.check_eq(pg_temp.rows_changed($$delete from public.chapter_highlights$$), 1, 'and can remove their own');
reset role;
set local role anon;
select pg_temp.check_denied($$select count(*) from public.chapter_highlights$$, 'anonymous visitors read no highlights');
reset role;

-- ── Prerequisites ───────────────────────────────────────────────────────────
insert into public.course_prerequisites (course_id, required_course_id) values
  ('ec000000-0000-0000-0000-00000000000b', 'ec000000-0000-0000-0000-00000000000a');
select pg_temp.check_denied($$insert into public.course_prerequisites values
  ('ec000000-0000-0000-0000-00000000000a', 'ec000000-0000-0000-0000-00000000000a')$$, 'a course cannot require itself');
select pg_temp.check_denied($$insert into public.course_prerequisites (course_id, required_course_id) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec000000-0000-0000-0000-00000000000b')$$, 'a cycle (A needs B needs A) is refused');
insert into public.course_prerequisites (course_id, required_course_id) values
  ('ec000000-0000-0000-0000-00000000000d', 'ec000000-0000-0000-0000-00000000000b');
select pg_temp.check_denied($$insert into public.course_prerequisites (course_id, required_course_id) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec000000-0000-0000-0000-00000000000d')$$, 'a longer cycle (A → D → B → A) is refused');

select pg_temp.check_eq((select count(*) from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000b')), 1,
  'Advanced needs Basics, which the learner has not finished');
insert into public.user_chapter_progress (user_id, chapter_id, status) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a1', 'COMPLETED');
select pg_temp.check_eq((select done from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000b'))::bigint, 1,
  'one of two chapters done is still unmet');
insert into public.user_chapter_progress (user_id, chapter_id, status) values
  ('e1000000-0000-0000-0000-000000000001', 'ec100000-0000-0000-0000-0000000000a2', 'COMPLETED');
select pg_temp.check_eq((select count(*) from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000b')), 0,
  'all chapters done meets the prerequisite');
select pg_temp.check_eq((select count(*) from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000b')), 1,
  'another learner''s progress does not count');
update public.chapters set is_active = false where id = 'ec100000-0000-0000-0000-0000000000b1';
select pg_temp.check_eq((select count(*) from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000d')), 1,
  'a required course with no active chapters counts as not finished');
update public.chapters set is_active = true where id = 'ec100000-0000-0000-0000-0000000000b1';

set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select pg_temp.check_denied($$select count(*) from public.course_prerequisites$$, 'learners cannot read the prerequisites table directly');
select pg_temp.check_denied($$delete from public.course_prerequisites$$, 'or change it');
select pg_temp.check_denied($$select * from public.unmet_prerequisites('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000b')$$,
  'or ask about another learner''s progress');
select pg_temp.check_denied($$select public.course_started_at('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000b')$$,
  'or when another learner started a course');
reset role;

-- ── Drip ────────────────────────────────────────────────────────────────────
select pg_temp.check_denied($$update public.courses set drip_interval_days = 0 where id = 'ec000000-0000-0000-0000-00000000000a'$$, 'a drip interval of 0 days is refused');
select pg_temp.check_denied($$update public.courses set drip_interval_days = 400 where id = 'ec000000-0000-0000-0000-00000000000a'$$, 'a drip interval over a year is refused');
update public.courses set drip_interval_days = 7 where id = 'ec000000-0000-0000-0000-00000000000a';
select pg_temp.check_true(public.course_started_at('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000a') is null,
  'a learner who never opened the course has no start date');
insert into public.user_chapter_progress (user_id, chapter_id, status, created_at) values
  ('e1000000-0000-0000-0000-000000000002', 'ec100000-0000-0000-0000-0000000000a1', 'UNLOCKED', '2026-10-01 10:00+00');
select pg_temp.check_true(public.course_started_at('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000a') = '2026-10-01 10:00+00',
  'the first opened chapter starts the course');
insert into public.course_enrollments (user_id, course_id, enrolled_at) values
  ('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000a', '2026-09-20 09:00+00');
select pg_temp.check_true(public.course_started_at('e1000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000a') = '2026-09-20 09:00+00',
  'an earlier enrolment starts it sooner');

-- ── Discussions ─────────────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
insert into public.chapter_discussion_posts (id, course_id, chapter_id, user_id, body) values
  ('ed000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a1',
   'e1000000-0000-0000-0000-000000000001', 'Why is a stack LIFO?');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, body) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-000000000002', 'forged')$$,
  'a learner cannot post as someone else');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, body) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000b1', 'e1000000-0000-0000-0000-000000000001', 'x')$$,
  'a post''s chapter must belong to its course');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, body) values
  ('ec000000-0000-0000-0000-00000000000c', 'ec100000-0000-0000-0000-0000000000c1', 'e1000000-0000-0000-0000-000000000001', 'x')$$,
  'a learner cannot post in a college course they are not assigned');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, body, hidden_at) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-000000000001', 'x', now())$$,
  'a learner cannot create a pre-hidden post');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
insert into public.chapter_discussion_posts (id, course_id, chapter_id, user_id, parent_id, body) values
  ('ed000000-0000-0000-0000-000000000002', 'ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a1',
   'e1000000-0000-0000-0000-000000000002', 'ed000000-0000-0000-0000-000000000001', 'Last in, first out — like plates.');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts), 2, 'another learner reads the thread and replies');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, parent_id, body) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-000000000002',
   'ed000000-0000-0000-0000-000000000002', 'nested')$$, 'replies go one level deep');
select pg_temp.check_denied($$insert into public.chapter_discussion_posts (course_id, chapter_id, user_id, parent_id, body) values
  ('ec000000-0000-0000-0000-00000000000a', 'ec100000-0000-0000-0000-0000000000a2', 'e1000000-0000-0000-0000-000000000002',
   'ed000000-0000-0000-0000-000000000001', 'elsewhere')$$, 'a reply stays in its post''s chapter');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.chapter_discussion_posts set body = 'hacked' where id = 'ed000000-0000-0000-0000-000000000001'$$), 0,
  'a learner cannot edit someone else''s post');
select pg_temp.check_denied($$update public.chapter_discussion_posts set hidden_at = now() where id = 'ed000000-0000-0000-0000-000000000001'$$,
  'or hide it');
select pg_temp.check_denied($$delete from public.chapter_discussion_posts$$, 'posts are never hard-deleted from the browser');
insert into public.chapter_discussion_reports (post_id, reporter_id, reason) values
  ('ed000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'off_topic');
select pg_temp.check_denied($$insert into public.chapter_discussion_reports (post_id, reporter_id, reason) values
  ('ed000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'spam')$$, 'a report is filed in your own name only');
select pg_temp.check_denied($$insert into public.chapter_discussion_reports (post_id, reporter_id, reason) values
  ('ed000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', 'rude')$$, 'with a known reason');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
update public.chapter_discussion_posts set body = 'Why is a stack LIFO? (edited)' where id = 'ed000000-0000-0000-0000-000000000001';
select pg_temp.check_true((select edited_at is not null from public.chapter_discussion_posts where id = 'ed000000-0000-0000-0000-000000000001'),
  'the author edits their post and it is marked edited');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_reports), 0, 'learners do not see others'' reports');

select pg_temp.act_as('e1000000-0000-0000-0000-000000000005');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where course_id = 'ec000000-0000-0000-0000-00000000000a'), 2,
  'any signed-in learner can read a public course''s threads');
reset role;
set local role anon;
select pg_temp.check_denied($$select count(*) from public.chapter_discussion_posts$$, 'anonymous visitors read nothing');
reset role;

-- College course: only the assigned batch (and its staff) can read or post.
set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
insert into public.chapter_discussion_posts (id, course_id, chapter_id, user_id, body) values
  ('ed000000-0000-0000-0000-00000000000c', 'ec000000-0000-0000-0000-00000000000c', 'ec100000-0000-0000-0000-0000000000c1',
   'e1000000-0000-0000-0000-000000000003', 'Is the lab due Friday?');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where course_id = 'ec000000-0000-0000-0000-00000000000c'), 1,
  'an assigned student posts in the college course');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000005');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where course_id = 'ec000000-0000-0000-0000-00000000000c'), 0,
  'an outsider cannot read the college course thread');
select pg_temp.check_true(not public.is_course_staff('ec000000-0000-0000-0000-00000000000c'), 'an outsider is not its staff');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000003');
select pg_temp.check_true(not public.is_course_staff('ec000000-0000-0000-0000-00000000000c'), 'a student of the college is not its staff');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000004');
select pg_temp.check_true(public.is_course_staff('ec000000-0000-0000-0000-00000000000c'), 'the college''s faculty moderate their own course');
select pg_temp.check_true(not public.is_course_staff('ec000000-0000-0000-0000-00000000000a'), 'but not Forge''s public courses');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000009');
select pg_temp.check_true(public.is_course_staff('ec000000-0000-0000-0000-00000000000a'), 'Forge admins moderate everything');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_reports), 1, 'staff see the reports on their courses');
reset role;

-- Hidden posts (hidden by the server for staff) vanish for everyone but the author and staff.
update public.chapter_discussion_posts set hidden_at = now(), hidden_by = 'e1000000-0000-0000-0000-000000000009'
  where id = 'ed000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where id = 'ed000000-0000-0000-0000-000000000001'), 0,
  'a hidden post is gone for other learners');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where id = 'ed000000-0000-0000-0000-000000000002'), 1,
  'its replies stay');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000005');
select pg_temp.check_denied($$insert into public.chapter_discussion_reports (post_id, reporter_id, reason) values
  ('ed000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000005', 'spam')$$, 'a post you cannot see cannot be reported');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where id = 'ed000000-0000-0000-0000-000000000001'), 1,
  'the author still sees their hidden post');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.chapter_discussion_posts set body = 'sneaky' where id = 'ed000000-0000-0000-0000-000000000001'$$), 0,
  'but cannot edit it while hidden');
select pg_temp.act_as('e1000000-0000-0000-0000-000000000009');
select pg_temp.check_eq((select count(*) from public.chapter_discussion_posts where id = 'ed000000-0000-0000-0000-000000000001'), 1,
  'staff still see hidden posts');

-- Soft delete is final from the browser.
select pg_temp.act_as('e1000000-0000-0000-0000-000000000002');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.chapter_discussion_posts set deleted_at = now() where id = 'ed000000-0000-0000-0000-000000000002'$$), 1,
  'the author deletes their reply');
select pg_temp.check_denied($$update public.chapter_discussion_posts set deleted_at = null where id = 'ed000000-0000-0000-0000-000000000002'$$,
  'and cannot bring it back');
select pg_temp.check_denied($$update public.chapter_discussion_posts set body = 'zombie' where id = 'ed000000-0000-0000-0000-000000000002'$$,
  'or edit it after deleting');
reset role;

rollback;

\o
\echo 'ALL LEARNING CHECKS PASSED'
