-- =============================================================================
-- Account & profile (slice W2-A1): account log, sessions (list / revoke, own
-- only), skills profile, opt-in public portfolio.
-- Runs as real signed-in users inside a rolled-back transaction.
--
-- The Supabase stubs only have auth.users(id, email, email_confirmed_at). The
-- real auth.users / auth.sessions / auth.refresh_tokens / auth.audit_log_entries
-- columns used here are added below with the same names and types as
-- Supabase Auth (sessions.refreshed_at is a timestamp WITHOUT time zone and
-- ip is inet there; refresh_tokens.session_id references sessions on delete
-- cascade). The real tables have more columns (factor_id, tag, instance_id …)
-- that nothing here reads.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists raw_app_meta_data jsonb;
alter table auth.users add column if not exists encrypted_password varchar(255);
alter table auth.users add column if not exists email_change varchar(255) default '';
create table if not exists auth.sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz, updated_at timestamptz, not_after timestamptz, aal text,
  refreshed_at timestamp without time zone, user_agent text, ip inet);
create table if not exists auth.refresh_tokens (
  id bigserial primary key, token varchar(255) unique, user_id varchar(255), revoked boolean,
  created_at timestamptz, updated_at timestamptz, parent varchar(255),
  session_id uuid references auth.sessions(id) on delete cascade);
create table if not exists auth.audit_log_entries (
  id uuid primary key, payload json, created_at timestamptz, ip_address varchar(64) not null default '');

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
  when insufficient_privilege or check_violation or foreign_key_violation or unique_violation then
    raise notice 'ok  % (denied)', label;
end $$;

create function pg_temp.check_no_privilege(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege then raise notice 'ok  % (denied)', label;
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

-- Priya (verified, password + google), Arjun (verified), Kavya (email not verified).
insert into auth.users (id, email, email_confirmed_at, created_at, last_sign_in_at, raw_app_meta_data, encrypted_password) values
  ('84000000-0000-0000-0000-000000000001', 'priya@a1.test', '2026-09-01', '2026-09-01', '2026-10-08', '{"provider": "email", "providers": ["email", "google"]}', '$2a$hash'),
  ('84000000-0000-0000-0000-000000000002', 'arjun@a1.test', '2026-09-02', '2026-09-02', null, '{"providers": ["google"]}', ''),
  ('84000000-0000-0000-0000-000000000003', 'kavya@a1.test', null, '2026-09-03', null, null, '$2a$hash');
insert into public.users (id, email, full_name, phone, college_name) values
  ('84000000-0000-0000-0000-000000000001', 'priya@a1.test', 'Priya Sharma', '+919800000001', 'SVCE'),
  ('84000000-0000-0000-0000-000000000002', 'arjun@a1.test', 'Arjun Rao', null, null),
  ('84000000-0000-0000-0000-000000000003', 'kavya@a1.test', 'Kavya N', null, null);

insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, not_after, user_agent, ip) values
  ('84100000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days', (now() at time zone 'UTC') - interval '1 hour', null, 'Chrome laptop', '10.0.0.1'),
  ('84100000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', now() - interval '2 days', now() - interval '2 days', null, null, 'Safari phone', '10.0.0.2'),
  ('84100000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 day', null, null, 'Firefox lab', null),
  ('84100000-0000-0000-0000-000000000004', '84000000-0000-0000-0000-000000000001', now() - interval '9 days', now() - interval '9 days', null, now() - interval '1 day', 'expired', null),
  ('84100000-0000-0000-0000-000000000005', '84000000-0000-0000-0000-000000000002', now(), now(), null, null, 'Arjun phone', '10.0.0.5');
insert into auth.refresh_tokens (token, user_id, revoked, session_id) values
  ('rt-1', '84000000-0000-0000-0000-000000000001', false, '84100000-0000-0000-0000-000000000001'),
  ('rt-2', '84000000-0000-0000-0000-000000000001', false, '84100000-0000-0000-0000-000000000002'),
  ('rt-3', '84000000-0000-0000-0000-000000000001', false, '84100000-0000-0000-0000-000000000003'),
  ('rt-5', '84000000-0000-0000-0000-000000000002', false, '84100000-0000-0000-0000-000000000005');
insert into auth.audit_log_entries (id, payload, created_at, ip_address) values
  (gen_random_uuid(), '{"actor_id": "84000000-0000-0000-0000-000000000001", "action": "login", "traits": {"provider": "email"}}', '2026-09-05', '1.2.3.4'),
  (gen_random_uuid(), '{"actor_id": "84000000-0000-0000-0000-000000000001", "action": "token_refreshed"}', '2026-09-06', ''),
  (gen_random_uuid(), '{"actor_id": "84000000-0000-0000-0000-000000000001", "action": "user_updated_password"}', '2026-09-07', ''),
  (gen_random_uuid(), '{"actor_id": "84000000-0000-0000-0000-000000000002", "action": "login"}', '2026-09-08', '');

-- ── Sessions: only your own, and revoking really removes them ──────────────
select pg_temp.check_eq((select count(*) from public.account_sessions('84000000-0000-0000-0000-000000000001')), 3,
  'a learner''s live sessions are listed (expired ones are not)');
select pg_temp.check_true((select bool_and(user_agent <> 'Arjun phone') from public.account_sessions('84000000-0000-0000-0000-000000000001')),
  'and no other learner''s session is among them');
select pg_temp.check_true((select id = '84100000-0000-0000-0000-000000000001' from public.account_sessions('84000000-0000-0000-0000-000000000001') limit 1),
  'the most recently active (refreshed) session comes first');
select pg_temp.check_eq((select count(*) from public.revoke_account_sessions('84000000-0000-0000-0000-000000000001', '84100000-0000-0000-0000-000000000005', null)), 0,
  'revoking someone else''s session id with your user id matches nothing');
select pg_temp.check_eq((select count(*) from auth.sessions where id = '84100000-0000-0000-0000-000000000005'), 1, 'so their session is still there');
select pg_temp.check_eq((select count(*) from public.revoke_account_sessions('84000000-0000-0000-0000-000000000001', '84100000-0000-0000-0000-000000000002', null)), 1,
  'one session is signed out');
select pg_temp.check_eq((select count(*) from auth.refresh_tokens where token = 'rt-2'), 0, 'and its refresh token is gone with it');
select pg_temp.check_eq((select count(*) from public.revoke_account_sessions('84000000-0000-0000-0000-000000000001', null, '84100000-0000-0000-0000-000000000001')), 2,
  'sign out everywhere else removes the rest (the expired one too)');
select pg_temp.check_true((select array_agg(id) = array['84100000-0000-0000-0000-000000000001'::uuid] from auth.sessions where user_id = '84000000-0000-0000-0000-000000000001'),
  'keeping only this device');
select pg_temp.check_eq((select count(*) from auth.refresh_tokens where user_id = '84000000-0000-0000-0000-000000000002'), 1, 'other learners are untouched');
select pg_temp.check_denied($$select public.revoke_account_sessions(null, null, null)$$, 'a revoke without a user is refused');

-- ── Auth info and audit history ─────────────────────────────────────────────
select pg_temp.check_true((select email_confirmed_at is not null and has_password and providers = array['email', 'google'] and pending_email is null
  from public.account_auth_info('84000000-0000-0000-0000-000000000001')), 'auth info: verified, has a password, providers');
select pg_temp.check_true((select email_confirmed_at is null from public.account_auth_info('84000000-0000-0000-0000-000000000003')), 'an unverified email shows as such');
select pg_temp.check_true((select not has_password from public.account_auth_info('84000000-0000-0000-0000-000000000002')), 'a Google-only account has no password');
select pg_temp.check_eq((select count(*) from public.account_audit_history('84000000-0000-0000-0000-000000000001', null, 30)), 2,
  'audit history: own account actions only, token refreshes left out');
select pg_temp.check_eq((select count(*) from public.account_audit_history('84000000-0000-0000-0000-000000000001', '2026-09-06', 30)), 1, 'older than a cut-off');
select pg_temp.check_eq((select count(*) from public.account_audit_history('84000000-0000-0000-0000-000000000001', null, 1)), 1, 'and limited');

-- ── Account log ─────────────────────────────────────────────────────────────
insert into public.account_events (user_id, kind, session_id, ip, user_agent) values
  ('84000000-0000-0000-0000-000000000001', 'sign_in', '84100000-0000-0000-0000-000000000001', '10.0.0.1', 'Chrome'),
  ('84000000-0000-0000-0000-000000000002', 'sign_in', '84100000-0000-0000-0000-000000000005', null, null);
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.account_events (user_id, kind, session_id) values
  ('84000000-0000-0000-0000-000000000001', 'sign_in', '84100000-0000-0000-0000-000000000001') on conflict (session_id) where kind = 'sign_in' do nothing$$), 0,
  'a session''s sign-in is recorded once');
select pg_temp.check_denied($$insert into public.account_events (user_id, kind) values ('84000000-0000-0000-0000-000000000001', 'hacked')$$, 'unknown event kinds are refused');
select pg_temp.check_denied($$update public.account_events set ip = '1.1.1.1'$$, 'events cannot be edited');

-- ── As signed-in learners ───────────────────────────────────────────────────
set local role authenticated;
select pg_temp.act_as('84000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.account_events), 1, 'a learner reads only their own account log');
select pg_temp.check_no_privilege($$insert into public.account_events (user_id, kind) values ('84000000-0000-0000-0000-000000000001', 'password_changed')$$,
  'and cannot write to it');
select pg_temp.check_no_privilege($$select public.account_sessions('84000000-0000-0000-0000-000000000002')$$, 'cannot list sessions directly');
select pg_temp.check_no_privilege($$select public.revoke_account_sessions('84000000-0000-0000-0000-000000000002', null, null)$$, 'or revoke them');
select pg_temp.check_no_privilege($$select public.account_auth_info('84000000-0000-0000-0000-000000000002')$$, 'or read auth details');
select pg_temp.check_no_privilege($$select public.account_audit_history('84000000-0000-0000-0000-000000000002', null, 5)$$, 'or the audit log');
select pg_temp.check_no_privilege($$select public.public_portfolio('arjun')$$, 'or call the portfolio builder');

-- Skills
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.user_skills (user_id, name, level, category) values
  ('84000000-0000-0000-0000-000000000001', 'Java', 'advanced', 'language'), ('84000000-0000-0000-0000-000000000001', 'React', 'intermediate', 'framework')$$), 2,
  'a learner adds skills with a level');
select pg_temp.check_denied($$insert into public.user_skills (user_id, name, level) values ('84000000-0000-0000-0000-000000000001', 'java', 'beginner')$$,
  'the same skill twice (any case) is refused');
select pg_temp.check_denied($$insert into public.user_skills (user_id, name, level) values ('84000000-0000-0000-0000-000000000001', 'Go', 'guru')$$, 'an unknown level is refused');
select pg_temp.check_denied($$insert into public.user_skills (user_id, name, level) values ('84000000-0000-0000-0000-000000000001', '<script>', 'expert')$$, 'markup in a name is refused');
select pg_temp.check_denied($$insert into public.user_skills (user_id, name, level) values ('84000000-0000-0000-0000-000000000002', 'Java', 'expert')$$, 'nobody adds skills for someone else');
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.user_skills (user_id, name, level) select '84000000-0000-0000-0000-000000000001', 'Skill ' || g, 'beginner' from generate_series(1, 28) g$$), 28,
  'up to 30 skills');
select pg_temp.check_denied($$insert into public.user_skills (user_id, name, level) values ('84000000-0000-0000-0000-000000000001', 'One too many', 'beginner')$$, 'but not 31');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.user_skills set level = 'expert' where name = 'Java'$$), 1, 'a learner changes their own level');

select pg_temp.act_as('84000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from public.user_skills), 0, 'another learner does not see those skills');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.user_skills set level = 'beginner'$$), 0, 'or change them');
select pg_temp.check_eq(pg_temp.rows_changed($$delete from public.user_skills$$), 0, 'or delete them');
reset role;

-- ── Portfolio ───────────────────────────────────────────────────────────────
insert into public.apprenticeship_programs (id, title, slug, duration_days, price_inr, short_tagline) values
  ('84200000-0000-0000-0000-000000000001', 'Build a Redis clone', 'a1-redis', 30, 0, 'In-memory store'),
  ('84200000-0000-0000-0000-000000000002', 'Build Git', 'a1-git', 30, 0, null);
insert into public.build_enrollments (id, user_id, program_id, language, status, total_stages, completed_stages, completed_at, repo_url) values
  ('84300000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '84200000-0000-0000-0000-000000000001', 'go', 'completed', 8, '{1,2,3,4,5,6,7,8}', '2026-10-01', 'https://github.com/priya/redis'),
  ('84300000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', '84200000-0000-0000-0000-000000000002', 'python', 'in_progress', 6, '{1}', null, null),
  ('84300000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000002', '84200000-0000-0000-0000-000000000001', 'go', 'completed', 8, '{}', now(), null);
insert into public.certificates (id, user_id, topic, verification_code) values
  ('84400000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'Arrays & Hashing', 'a1code000001'),
  ('84400000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', 'Two Pointers', 'a1code000002'),
  ('84400000-0000-0000-0000-000000000003', '84000000-0000-0000-0000-000000000002', 'Graphs', 'a1code000003');
insert into public.programs (id, type, slug, title) values ('84500000-0000-0000-0000-000000000001', 'course', 'a1-prog', 'DSA Bootcamp');
insert into public.program_certificates (id, program_id, user_id, certificate_code, status, revoked_at) values
  ('84600000-0000-0000-0000-000000000001', '84500000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'a1-prog-1', 'revoked', now());
insert into public.problems (id, slug, title, description, difficulty, topic, order_index) values
  ('84700000-0000-0000-0000-000000000001', 'a1-p1', 'P1', 'x', 'easy', 'Arrays & Hashing', 9001),
  ('84700000-0000-0000-0000-000000000002', 'a1-p2', 'P2', 'x', 'easy', 'Arrays & Hashing', 9002),
  ('84700000-0000-0000-0000-000000000003', 'a1-p3', 'P3', 'x', 'medium', 'Graphs', 9003);
insert into public.problem_submissions (user_id, problem_id, language, code, verdict, passed, total) values
  ('84000000-0000-0000-0000-000000000001', '84700000-0000-0000-0000-000000000001', 'java', 'x', 'Accepted', 5, 5),
  ('84000000-0000-0000-0000-000000000001', '84700000-0000-0000-0000-000000000001', 'java', 'x', 'Accepted', 5, 5),
  ('84000000-0000-0000-0000-000000000001', '84700000-0000-0000-0000-000000000002', 'java', 'x', 'Accepted', 5, 5),
  ('84000000-0000-0000-0000-000000000001', '84700000-0000-0000-0000-000000000003', 'java', 'x', 'Wrong Answer', 1, 5);

select pg_temp.check_eq((select amount from public.skill_evidence('84000000-0000-0000-0000-000000000001') where source = 'practice' and skill = 'Arrays & Hashing')::bigint, 2,
  'evidence: distinct judge-accepted problems per topic');
select pg_temp.check_eq((select count(*) from public.skill_evidence('84000000-0000-0000-0000-000000000001') where source = 'practice' and skill = 'Graphs'), 0,
  'a wrong answer is no evidence');
select pg_temp.check_eq((select count(*) from public.skill_evidence('84000000-0000-0000-0000-000000000001') where source = 'certificate'), 2,
  'certificates count as evidence (a revoked one does not)');
select pg_temp.check_eq((select count(*) from public.skill_evidence('84000000-0000-0000-0000-000000000001') where source = 'project'), 1,
  'and finished projects only');

set local role authenticated;
select pg_temp.act_as('84000000-0000-0000-0000-000000000003');
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.learner_portfolios (user_id, handle) values ('84000000-0000-0000-0000-000000000003', 'kavya')$$), 1,
  'a portfolio is created private');
select pg_temp.check_denied($$update public.learner_portfolios set is_public = true$$, 'an unverified email cannot publish it');

select pg_temp.act_as('84000000-0000-0000-0000-000000000001');
select pg_temp.check_denied($$insert into public.learner_portfolios (user_id, handle) values ('84000000-0000-0000-0000-000000000001', 'Priya')$$, 'handles are lower case');
select pg_temp.check_denied($$insert into public.learner_portfolios (user_id, handle) values ('84000000-0000-0000-0000-000000000001', 'admin')$$, 'reserved handles are refused');
select pg_temp.check_denied($$insert into public.learner_portfolios (user_id, handle) values ('84000000-0000-0000-0000-000000000001', 'kavya')$$, 'a handle is taken once');
select pg_temp.check_denied($$insert into public.learner_portfolios (user_id, handle) values ('84000000-0000-0000-0000-000000000002', 'arjun')$$, 'nobody creates a portfolio for someone else');
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.learner_portfolios (user_id, handle, headline, show_college, certificate_refs, project_ids)
  values ('84000000-0000-0000-0000-000000000001', 'priya-s', 'Backend developer', true, array['topic:84400000-0000-0000-0000-000000000001'],
          array['84300000-0000-0000-0000-000000000001'::uuid])$$), 1, 'Priya picks a certificate and a project');
select pg_temp.check_true((select not is_public and published_at is null from public.learner_portfolios where user_id = '84000000-0000-0000-0000-000000000001'),
  'still private by default');
select pg_temp.check_denied($$update public.learner_portfolios set project_ids = array['84300000-0000-0000-0000-000000000003'::uuid]$$, 'someone else''s project cannot be shown');
select pg_temp.check_denied($$update public.learner_portfolios set certificate_refs = array['topic:84400000-0000-0000-0000-000000000003']$$, 'nor someone else''s certificate');
select pg_temp.check_denied($$update public.learner_portfolios set certificate_refs = array['program:84600000-0000-0000-0000-000000000001']$$, 'nor a revoked certificate');
select pg_temp.check_denied($$update public.learner_portfolios set certificate_refs = array['bogus']$$, 'nor a malformed reference');
select pg_temp.check_denied($$update public.learner_portfolios set user_id = '84000000-0000-0000-0000-000000000002'$$, 'a portfolio cannot be handed to someone else');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.learner_portfolios set is_public = true$$), 1, 'a verified learner publishes');
select pg_temp.check_true((select published_at is not null from public.learner_portfolios where user_id = '84000000-0000-0000-0000-000000000001'), 'and it is stamped');

select pg_temp.act_as('84000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from public.learner_portfolios), 0, 'another learner cannot read the portfolio row');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.learner_portfolios set is_public = false$$), 0, 'or unpublish it');
reset role;

select pg_temp.check_denied($$update public.learner_portfolios set user_id = '84000000-0000-0000-0000-000000000002' where handle = 'kavya'$$,
  'not even the server can move a portfolio to another account');

set local role anon;
select pg_temp.check_no_privilege($$select * from public.learner_portfolios$$, 'the public key reads no portfolio rows');
select pg_temp.check_no_privilege($$select * from public.user_skills$$, 'or skills');
select pg_temp.check_no_privilege($$select * from public.account_events$$, 'or account events');
reset role;

-- The public view
create temp table pv as select public.public_portfolio('PRIYA-S') as v;
select pg_temp.check_true((select v ->> 'name' = 'Priya Sharma' and v ->> 'headline' = 'Backend developer' and v ->> 'college' = 'SVCE' from pv),
  'the public view has the name, headline and (chosen) college');
select pg_temp.check_true((select v::text !~* '(priya@a1\.test|\+9198|84000000-|84300000-|84400000-)' from pv),
  'and no email, phone or ids');
select pg_temp.check_eq((select jsonb_array_length(v -> 'certificates')::bigint from pv), 1, 'only the chosen certificate');
select pg_temp.check_true((select v -> 'certificates' -> 0 ->> 'code' = 'a1code000001' from pv), 'with its verification code');
select pg_temp.check_true((select jsonb_array_length(v -> 'projects') = 1 and v -> 'projects' -> 0 ->> 'title' = 'Build a Redis clone'
  and v -> 'projects' -> 0 -> 'repo_url' = 'null'::jsonb from pv), 'only the chosen project, repo link hidden unless asked');
select pg_temp.check_eq((select jsonb_array_length(v -> 'skills')::bigint from pv), 30, 'declared skills');
select pg_temp.check_true((select v -> 'evidence' = '[{"skill": "Arrays & Hashing", "amount": 2, "source": "practice"}]'::jsonb from pv),
  'practice evidence only (unpicked certificates and projects stay hidden)');

update public.learner_portfolios set show_repo_links = true, show_skills = false, show_college = false where handle = 'priya-s';
select pg_temp.check_true((select v -> 'projects' -> 0 ->> 'repo_url' = 'https://github.com/priya/redis' and v -> 'skills' = '[]'::jsonb and v -> 'college' = 'null'::jsonb
  from (select public.public_portfolio('priya-s') v) x), 'repo link when asked; skills and college can be hidden');
select pg_temp.check_true((select public.public_portfolio('kavya') is null), 'a private portfolio is not shown');
select pg_temp.check_true((select public.public_portfolio('nobody') is null), 'an unknown handle shows nothing');
update public.learner_portfolios set is_public = false where handle = 'priya-s';
select pg_temp.check_true((select public.public_portfolio('priya-s') is null and (select published_at from public.learner_portfolios where handle = 'priya-s') is null),
  'unpublishing takes it down at once');
update public.learner_portfolios set is_public = true where handle = 'priya-s';
update public.users set is_banned = true where id = '84000000-0000-0000-0000-000000000001';
select pg_temp.check_true((select public.public_portfolio('priya-s') is null), 'a banned account''s portfolio is not shown');

rollback;

\o
\echo 'ALL ACCOUNT PROFILE CHECKS PASSED'
