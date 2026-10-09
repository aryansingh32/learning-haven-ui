-- =============================================================================
-- Campus Phase 1 checks: rosters, college tests, assignments, attempts,
-- proctoring. Same harness as campus_isolation.sql: runs as real signed-in
-- users inside a rolled-back transaction.
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
-- 1x = College A staff, 2x = College A students, 3x = College B, f = Forge.
insert into auth.users (id, email, email_confirmed_at) values
  ('a1000000-0000-0000-0000-000000000001', 'admin@a.test',   now()),
  ('a1000000-0000-0000-0000-000000000002', 'faculty@a.test', now()),
  ('a2000000-0000-0000-0000-000000000001', 's1@a.test',      now()),   -- verified, pre-registered
  ('a2000000-0000-0000-0000-000000000002', 's2@a.test',      null),    -- NOT verified, pre-registered
  ('a2000000-0000-0000-0000-000000000003', 's3@a.test',      now()),   -- other batch
  ('b3000000-0000-0000-0000-000000000001', 'faculty@b.test', now());

insert into public.users (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users where email like '%.test';

insert into campus.organizations (id, slug, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'college-a', 'College A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'college-b', 'College B');

insert into campus.batches (id, org_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A2'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'B1');

insert into campus.org_memberships (org_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000002', 'faculty'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000003', 'student'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b3000000-0000-0000-0000-000000000001', 'faculty');
insert into campus.batch_members (batch_id, org_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000003');

-- Tests: Forge public, Forge private, College A's, College B's.
insert into public.tests (id, slug, title, duration_seconds, is_published, owner_org_id, visibility) values
  ('f0000000-0000-0000-0000-0000000000f1', 'forge-public',  'Forge public',  600, true, '00000000-0000-0000-0000-00000000f0f0', 'public'),
  ('f0000000-0000-0000-0000-0000000000f2', 'forge-private', 'Forge private', 600, true, '00000000-0000-0000-0000-00000000f0f0', 'private'),
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'a-test',        'A test',        600, true, 'aaaaaaaa-0000-0000-0000-00000000000a', 'org'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'b-test',        'B test',        600, true, 'bbbbbbbb-0000-0000-0000-00000000000b', 'org');

insert into public.testseries_questions (id, question_type, body, options, correct_options, owner_org_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'mcq', 'A question', '[{"id":"a","text":"1"},{"id":"b","text":"2"}]', '["a"]', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'mcq', 'B question', '[{"id":"a","text":"1"},{"id":"b","text":"2"}]', '["b"]', 'bbbbbbbb-0000-0000-0000-00000000000b');

-- ── Roster ──────────────────────────────────────────────────────────────────
select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.roster_entries (org_id, email, role, batch_id, roll_number) values
    ('aaaaaaaa-0000-0000-0000-00000000000a', 's1@a.test', 'student', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'A-001'),
    ('aaaaaaaa-0000-0000-0000-00000000000a', 's2@a.test', 'student', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'A-002')$$),
  2, 'A admin can pre-register students');
select pg_temp.check_denied(
  $$insert into campus.roster_entries (org_id, email, role) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'boss@a.test', 'owner')$$,
  'nobody can pre-register an owner');
select pg_temp.check_denied(
  $$insert into campus.roster_entries (org_id, email) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x@b.test')$$,
  'A admin cannot pre-register people into College B');
reset role;

select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_denied(
  $$insert into campus.roster_entries (org_id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x@a.test')$$,
  'faculty cannot manage the roster');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.roster_entries), 0, 'College B sees none of College A''s roster');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(campus.claim_roster_entries(), 0, 'an unverified email claims nothing');
reset role;
select pg_temp.check_eq((select count(*) from campus.org_memberships where user_id = 'a2000000-0000-0000-0000-000000000002'), 0, 'unverified student was not attached');

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(campus.claim_roster_entries(), 1, 'a verified email claims its pre-registration');
select pg_temp.check_eq(campus.claim_roster_entries(), 0, 'claiming twice does nothing');
reset role;
select pg_temp.check_eq((select count(*) from campus.org_memberships
  where user_id = 'a2000000-0000-0000-0000-000000000001' and role = 'student' and roll_number = 'A-001'), 1, 'claimed student joined College A with their roll number');
select pg_temp.check_eq((select count(*) from campus.batch_members
  where user_id = 'a2000000-0000-0000-0000-000000000001' and batch_id = 'aaaaaaaa-0000-0000-0000-0000000000b1'), 1, 'claimed student joined batch A1');

-- ── College-owned tests ─────────────────────────────────────────────────────
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.tests (slug, title, duration_seconds, owner_org_id, visibility)
    values ('a-new', 'A new test', 900, 'aaaaaaaa-0000-0000-0000-00000000000a', 'org')$$),
  1, 'A faculty can create a College A test');
select pg_temp.check_denied(
  $$insert into public.tests (slug, title, duration_seconds, owner_org_id) values ('b-fake', 'x', 900, 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  'A faculty cannot create a test owned by College B');
select pg_temp.check_denied(
  $$insert into public.tests (slug, title, duration_seconds) values ('forge-fake', 'x', 900)$$,
  'A faculty cannot create a Forge test');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.test_questions (test_id, question_id)
    values ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000c1')$$),
  1, 'A faculty can add a College A question to a College A test');
select pg_temp.check_denied(
  $$insert into public.test_questions (test_id, question_id)
    values ('aaaaaaaa-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-0000000000c1')$$,
  'A faculty cannot pull a College B question into their test');
select pg_temp.check_denied(
  $$insert into public.test_sections (test_id, name) values ('bbbbbbbb-0000-0000-0000-0000000000e1', 'x')$$,
  'A faculty cannot add sections to College B''s test');
select pg_temp.check_denied(
  $$insert into public.test_sections (test_id, name) values ('f0000000-0000-0000-0000-0000000000f1', 'x')$$,
  'A faculty cannot add sections to a Forge test');
select pg_temp.check_eq((select count(*) from public.testseries_questions where owner_org_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0,
  'A faculty cannot read College B questions');
reset role;

-- A learner can see a published public test but must not be able to edit it.
select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_denied(
  $$insert into public.test_sections (test_id, name) values ('f0000000-0000-0000-0000-0000000000f1', 'x')$$,
  'a learner cannot add sections to a published public test');
select pg_temp.check_denied(
  $$insert into public.test_questions (test_id, question_id) values ('f0000000-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000c1')$$,
  'a learner cannot add questions to a published public test');
select pg_temp.check_eq((select count(*) from public.testseries_questions), 0, 'a learner can read no questions (answers stay hidden)');
reset role;

set local role anon;
select pg_temp.check_eq((select count(*) from public.tests where id = 'f0000000-0000-0000-0000-0000000000f1'), 1, 'the public catalogue shows public Forge tests');
select pg_temp.check_eq((select count(*) from public.tests where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'), 0, 'the public catalogue hides published college tests');
reset role;

-- ── Assignments ─────────────────────────────────────────────────────────────
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.assignments (id, org_id, batch_id, test_id, title, opens_at, closes_at, status) values
    ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000b1',
     'aaaaaaaa-0000-0000-0000-0000000000e1', 'Weekly test 1', now() - interval '1 hour', now() + interval '1 day', 'published'),
    ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000b1',
     'f0000000-0000-0000-0000-0000000000f1', 'Forge mock (draft)', now(), now() + interval '1 day', 'draft')$$),
  2, 'A faculty can assign their own test and a public Forge test');
select pg_temp.check_denied(
  $$insert into campus.assignments (org_id, batch_id, test_id, title, opens_at, closes_at) values
    ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000f2', 'x', now(), now() + interval '1 day')$$,
  'a private Forge test cannot be assigned');
select pg_temp.check_denied(
  $$insert into campus.assignments (org_id, batch_id, test_id, title, opens_at, closes_at) values
    ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'x', now(), now() + interval '1 day')$$,
  'College B''s test cannot be assigned by College A');
select pg_temp.check_denied(
  $$insert into campus.assignments (org_id, batch_id, test_id, title, opens_at, closes_at) values
    ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'x', now(), now() + interval '1 day')$$,
  'College A cannot assign to a College B batch');
select pg_temp.check_denied(
  $$insert into campus.assignments (org_id, batch_id, test_id, title, opens_at, closes_at) values
    ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000e1', 'x', now(), now() + interval '1 day')$$,
  'A faculty cannot create assignments in College B');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignments), 1, 'a batch A1 student sees only the published assignment');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignments), 0, 'a batch A2 student sees no batch A1 assignments');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignments), 0, 'College B sees no College A assignments');
reset role;

-- ── Attempts ────────────────────────────────────────────────────────────────
insert into public.test_attempts (id, user_id, test_id, expires_at, total_questions, total_marks, assignment_id, org_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   now() + interval '10 minutes', 1, 1, 'aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a');

select pg_temp.check_denied(
  $$insert into public.test_attempts (user_id, test_id, expires_at, total_questions, total_marks, assignment_id)
    values ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000e1', now(), 1, 1, 'aaaaaaaa-0000-0000-0000-0000000000a1')$$,
  'an assignment attempt must record its college');

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.test_attempts), 1, 'a student reads their own attempt');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update public.test_attempts set score = 100 where id = 'aaaaaaaa-0000-0000-0000-0000000000d1'$$),
  0, 'a student cannot change their own score');
select pg_temp.check_denied(
  $$insert into public.test_attempts (user_id, test_id, expires_at, total_questions, total_marks)
    values ('a2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-0000000000f1', now() + interval '1 hour', 1, 1)$$,
  'a student cannot create attempts directly');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.proctoring_events (org_id, attempt_id, user_id, event_type, severity)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'a2000000-0000-0000-0000-000000000001', 'tab_switch', 'warning')$$),
  1, 'a student can log a proctoring event on their own attempt');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_denied(
  $$insert into campus.proctoring_events (org_id, attempt_id, user_id, event_type, severity)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'a2000000-0000-0000-0000-000000000003', 'tab_switch', 'violation')$$,
  'a student cannot log events against someone else''s attempt');
select pg_temp.check_eq((select count(*) from public.test_attempts), 0, 'a student cannot read a classmate''s attempt');
reset role;

select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.test_attempts where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 1, 'A faculty reads College A attempts');
select pg_temp.check_eq((select count(*) from campus.proctoring_events), 1, 'A faculty sees College A proctoring events');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.test_attempts), 0, 'College B reads no College A attempts');
select pg_temp.check_eq((select count(*) from campus.proctoring_events), 0, 'College B sees no College A proctoring events');
reset role;

-- ── Coding questions (slice B1) ─────────────────────────────────────────────
insert into public.testseries_questions (id, question_type, body, starter_code, judge_config, owner_org_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'coding', 'A coding', '{"python":"class Solution:\n    def f(self, x):\n        pass\n"}', '{"compare":"exact"}', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'coding', 'B coding', '{"python":"class Solution:\n    def f(self, x):\n        pass\n"}', '{}', 'bbbbbbbb-0000-0000-0000-00000000000b'),
  ('f0000000-0000-0000-0000-0000000000c2', 'coding', 'Forge coding', '{"java":"class Solution {}"}', '{}', '00000000-0000-0000-0000-00000000f0f0');
insert into public.question_test_cases (question_id, input, expected_output, is_sample) values
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'x = 1', '1', true),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'x = 99', '99', false),
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'x = 2', '2', false),
  ('f0000000-0000-0000-0000-0000000000c2', 'x = 3', '3', false);

select pg_temp.check_denied(
  $$insert into public.testseries_questions (question_type, body, owner_org_id) values ('coding', 'no starter', 'aaaaaaaa-0000-0000-0000-00000000000a')$$,
  'a coding question needs starter code');
select pg_temp.check_denied(
  $$insert into public.testseries_questions (question_type, body, starter_code, judge_config, owner_org_id)
    values ('coding', 'bad compare', '{"python":"x"}', '{"compare":"fuzzy"}', 'aaaaaaaa-0000-0000-0000-00000000000a')$$,
  'a coding question needs a known compare mode');

select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.testseries_questions (question_type, body, starter_code, owner_org_id)
    values ('coding', 'new', '{"javascript":"function f(x) {}"}', 'aaaaaaaa-0000-0000-0000-00000000000a')$$),
  1, 'A faculty can create a coding question');
select pg_temp.check_eq((select count(*) from public.question_test_cases), 2, 'A faculty reads only College A test cases (sample + hidden)');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.question_test_cases (question_id, input, expected_output) values ('aaaaaaaa-0000-0000-0000-0000000000c2', 'x = 5', '5')$$),
  1, 'A faculty can add a hidden test to a College A question');
select pg_temp.check_denied(
  $$insert into public.question_test_cases (question_id, input, expected_output) values ('bbbbbbbb-0000-0000-0000-0000000000c2', 'x', 'y')$$,
  'A faculty cannot add tests to a College B question');
select pg_temp.check_denied(
  $$insert into public.question_test_cases (question_id, input, expected_output) values ('f0000000-0000-0000-0000-0000000000c2', 'x', 'y')$$,
  'A faculty cannot add tests to a Forge question');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update public.question_test_cases set expected_output = 'hacked' where question_id = 'bbbbbbbb-0000-0000-0000-0000000000c2'$$),
  0, 'A faculty cannot edit College B tests');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.question_test_cases), 0, 'a student reads no test cases (hidden tests stay on the server)');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$delete from public.question_test_cases$$), 0, 'a student cannot delete test cases');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from public.question_test_cases), 1, 'College B faculty reads only College B test cases');
reset role;

set local role anon;
select pg_temp.check_denied($$select count(*) from public.question_test_cases$$, 'anon cannot read test cases');
reset role;

-- ── Timed sections (slice B3) ───────────────────────────────────────────────
insert into public.tests (id, slug, title, duration_seconds, owner_org_id, visibility) values
  ('aaaaaaaa-0000-0000-0000-0000000000e2', 'a-test-2', 'A test 2', 600, 'aaaaaaaa-0000-0000-0000-00000000000a', 'org');
insert into public.test_sections (id, test_id, name, duration_seconds) values
  ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000e2', 'Other test section', 600);

select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into public.test_sections (id, test_id, name, duration_seconds)
    values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Aptitude', 900)$$),
  1, 'A faculty can add a timed section to a College A test');
select pg_temp.check_denied(
  $$insert into public.test_sections (test_id, name, duration_seconds) values ('aaaaaaaa-0000-0000-0000-0000000000e1', 'Too short', 30)$$,
  'a section must last at least a minute');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update public.test_questions set section_id = 'aaaaaaaa-0000-0000-0000-0000000000d1'
     where test_id = 'aaaaaaaa-0000-0000-0000-0000000000e1' and question_id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$),
  1, 'A faculty can place a question in a section of the same test');
select pg_temp.check_denied(
  $$update public.test_questions set section_id = 'aaaaaaaa-0000-0000-0000-0000000000d2'
     where test_id = 'aaaaaaaa-0000-0000-0000-0000000000e1' and question_id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$,
  'a question cannot be placed in another test''s section');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$update public.test_attempts set current_section = 0, section_started_at = now() - interval '1 hour'$$),
  0, 'a student cannot move their own section clock');
reset role;

-- ── Live invigilation (slice B5) ────────────────────────────────────────────
insert into auth.users (id, email, email_confirmed_at) values ('a1000000-0000-0000-0000-000000000009', 'invig@a.test', now());
insert into public.users (id, email, full_name) values ('a1000000-0000-0000-0000-000000000009', 'invig@a.test', 'invig');
insert into campus.org_memberships (org_id, user_id, role) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000009', 'invigilator');

select pg_temp.act_as('a1000000-0000-0000-0000-000000000009');
set local role authenticated;
select pg_temp.check_eq(((select count(*) from public.test_attempts where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0)::int, 1, 'an invigilator sees College A attempts');
select pg_temp.check_eq(((select count(*) from campus.assignments where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a') > 0)::int, 1, 'an invigilator sees College A assignments');
select pg_temp.check_eq((select count(*) from campus.assignments where org_id <> 'aaaaaaaa-0000-0000-0000-00000000000a'), 0, 'an invigilator sees no other college''s assignments');
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.incident_reviews (org_id, attempt_id, reviewer_id, outcome, note)
    select org_id, id, 'a1000000-0000-0000-0000-000000000009', 'warning', 'Looked away often' from public.test_attempts
     where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a' limit 1$$),
  1, 'an invigilator records a review on a College A attempt');
select pg_temp.check_denied(
  $$insert into campus.incident_reviews (org_id, attempt_id, reviewer_id, outcome)
    select org_id, id, 'a1000000-0000-0000-0000-000000000002', 'no_issue' from public.test_attempts
     where org_id = 'aaaaaaaa-0000-0000-0000-00000000000a' limit 1$$,
  'a review cannot be signed with someone else''s name');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.test_attempts set score = 99$$), 0, 'an invigilator cannot change attempts');
select pg_temp.check_denied($$update campus.incident_reviews set outcome = 'no_issue'$$, 'reviews are append-only (no update at all)');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.incident_reviews), 0, 'a student cannot read incident reviews');
select pg_temp.check_denied(
  $$insert into campus.attempt_adjustments (org_id, attempt_id, kind, minutes, reason)
    select org_id, id, 'extend', 60, 'give me time' from public.test_attempts where user_id = 'a2000000-0000-0000-0000-000000000001' limit 1$$,
  'a student cannot give themselves extra time');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.incident_reviews), 0, 'College B cannot read College A incident reviews');
reset role;

-- ── Pools and accommodations (slice B2) ─────────────────────────────────────
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.check_eq(pg_temp.rows_changed(
  $$insert into campus.assignment_accommodations (org_id, assignment_id, user_id, extra_percent, note)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-000000000001', 25, 'Scribe')$$),
  1, 'A faculty gives a College A student 25% extra time');
select pg_temp.check_denied(
  $$insert into campus.assignment_accommodations (org_id, assignment_id, user_id, extra_percent)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'b3000000-0000-0000-0000-000000000001', 25)$$,
  'extra time only for members of the same college');
select pg_temp.check_denied(
  $$insert into campus.assignment_accommodations (org_id, assignment_id, user_id, extra_percent)
    values ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-000000000003', 25)$$,
  'an accommodation cannot claim another college for a College A assignment');
select pg_temp.check_denied(
  $$update campus.assignment_accommodations set extra_percent = 150$$,
  'extra time is capped at 100%');
select pg_temp.check_denied(
  $$update public.test_sections set draw_count = 0 where test_id = 'aaaaaaaa-0000-0000-0000-0000000000e1'$$,
  'a pool deals at least one question');
reset role;

select pg_temp.act_as('b3000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignment_accommodations), 0, 'College B sees no College A accommodations');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignment_accommodations), 1, 'a student sees their own accommodation');
select pg_temp.check_eq(pg_temp.rows_changed($$update campus.assignment_accommodations set extra_percent = 100$$), 0, 'a student cannot raise their own extra time');
reset role;

select pg_temp.act_as('a2000000-0000-0000-0000-000000000003');
set local role authenticated;
select pg_temp.check_eq((select count(*) from campus.assignment_accommodations), 0, 'other students do not see it');
reset role;

rollback;

\o
\echo 'ALL CAMPUS ASSESSMENT CHECKS PASSED'
