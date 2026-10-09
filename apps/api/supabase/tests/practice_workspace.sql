-- =============================================================================
-- Practice workspace (slice W2-I1): run history (own rows, API writes, bounded),
-- submission memory, and editor preferences (own rows, values in range).
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

insert into auth.users (id, email, email_confirmed_at) values
  ('83000000-0000-0000-0000-000000000001', 'w1@w.test', now()), ('83000000-0000-0000-0000-000000000002', 'w2@w.test', now());
insert into public.users (id, email, full_name) select id, email, split_part(email, '@', 1) from auth.users where email like '%@w.test';
insert into public.problems (id, slug, title, description, difficulty, topic, order_index) values
  ('83300000-0000-0000-0000-000000000001', 'ws-check-1', 'Workspace check 1', 'x', 'easy', 'Arrays & Hashing', 9991),
  ('83300000-0000-0000-0000-000000000002', 'ws-check-2', 'Workspace check 2', 'x', 'easy', 'Arrays & Hashing', 9992);

-- ── Run history ──────────────────────────────────────────────────────────────
insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict, passed, total, time_ms, memory_kb) values
  ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'cpp', 'server', 'examples', 'int x;', 'Accepted', 2, 2, 12, 3400),
  ('83000000-0000-0000-0000-000000000002', '83300000-0000-0000-0000-000000000001', 'python', 'browser', 'examples', 'pass', 'Wrong Answer', 0, 2, 40, null);
insert into public.problem_runs (user_id, problem_id, language, source, kind, code, input, output, verdict) values
  ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'javascript', 'browser', 'custom', 'f()', 'nums = [1]', '[0]', 'Ran');
select pg_temp.check_eq((select count(*) from public.problem_runs), 3, 'the API records runs (examples and custom)');

select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'javascript', 'browser', 'custom', 'f()', 'Ran')$$,
  'a custom run must keep its input');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, input, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'javascript', 'browser', 'examples', 'f()', 'x', 'Accepted')$$,
  'an examples run has no custom input');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'ruby', 'browser', 'examples', 'x', 'Accepted')$$,
  'unknown languages are refused');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'laptop', 'examples', 'x', 'Accepted')$$,
  'unknown sources are refused');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict, passed, total)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'browser', 'examples', 'x', 'Accepted', 3, 2)$$,
  'passed can not exceed total');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict, memory_kb)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'server', 'examples', 'x', 'Accepted', -1)$$,
  'negative memory is refused');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'server', 'examples', repeat('x', 50001), 'Accepted')$$,
  'code over 50 KB is refused');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, input, verdict)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'server', 'custom', 'x', repeat('x', 5001), 'Ran')$$,
  'custom input over 5000 characters is refused');

-- Bounded: 25 per learner and problem (oldest dropped first); other learners and problems untouched.
insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict, created_at)
select '83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000001', 'python', 'browser', 'examples', 'v' || g, 'Accepted', now() + g * interval '1 second'
  from generate_series(1, 30) g;
select pg_temp.check_eq((select count(*) from public.problem_runs where user_id = '83000000-0000-0000-0000-000000000001'
  and problem_id = '83300000-0000-0000-0000-000000000001'), 25, 'run history keeps the newest 25 per problem');
select pg_temp.check_eq((select count(*) from public.problem_runs where user_id = '83000000-0000-0000-0000-000000000001'
  and problem_id = '83300000-0000-0000-0000-000000000001' and code in ('v1', 'v5', 'int x;')), 0, 'the oldest runs are the ones dropped');
select pg_temp.check_eq((select count(*) from public.problem_runs where code = 'v30'), 1, 'the newest run is kept');
select pg_temp.check_eq((select count(*) from public.problem_runs where user_id = '83000000-0000-0000-0000-000000000002'), 1,
  'another learner''s runs are untouched');

-- And at most 500 per learner across problems.
insert into public.problems (id, slug, title, description, difficulty, topic, order_index)
select ('83400000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'ws-many-' || g, 'Many ' || g, 'x', 'easy', 'Arrays & Hashing', 10000 + g
  from generate_series(1, 21) g;
insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict, created_at)
select '83000000-0000-0000-0000-000000000002', ('83400000-0000-0000-0000-' || lpad(p::text, 12, '0'))::uuid, 'python', 'browser', 'examples',
       'm' || p || '-' || r, 'Accepted', now() + (p * 100 + r) * interval '1 second'
  from generate_series(1, 21) p, generate_series(1, 25) r;
select pg_temp.check_eq((select count(*) from public.problem_runs where user_id = '83000000-0000-0000-0000-000000000002'), 500,
  'a learner keeps at most 500 runs overall');
select pg_temp.check_eq((select count(*) from public.problem_runs where code = 'm21-25'), 1, 'the newest of them stay');
delete from public.problem_runs where user_id = '83000000-0000-0000-0000-000000000002';
insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict) values
  ('83000000-0000-0000-0000-000000000002', '83300000-0000-0000-0000-000000000001', 'python', 'browser', 'examples', 'pass', 'Wrong Answer');

-- Learners read only their own runs and cannot write or change them.
set local role authenticated;
select pg_temp.act_as('83000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from public.problem_runs), 1, 'a learner sees only their own runs');
select pg_temp.check_denied($$insert into public.problem_runs (user_id, problem_id, language, source, kind, code, verdict)
  values ('83000000-0000-0000-0000-000000000002', '83300000-0000-0000-0000-000000000001', 'python', 'server', 'examples', 'x', 'Accepted')$$,
  'and cannot write runs from the browser');
select pg_temp.check_denied($$update public.problem_runs set verdict = 'Accepted'$$, 'or change them');
select pg_temp.check_denied($$delete from public.problem_runs$$, 'or delete them');
reset role;
select pg_temp.check_eq(has_function_privilege('authenticated', 'public.trim_problem_runs()', 'execute')::int, 0,
  'learners cannot call the trim function');

-- ── Submission memory ───────────────────────────────────────────────────────
insert into public.problem_submissions (user_id, problem_id, language, code, verdict, passed, total, memory_kb) values
  ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000002', 'cpp', 'x', 'Accepted', 2, 2, 3412);
select pg_temp.check_eq((select memory_kb from public.problem_submissions where problem_id = '83300000-0000-0000-0000-000000000002')::bigint, 3412,
  'a judged submission keeps its peak memory');
select pg_temp.check_denied($$insert into public.problem_submissions (user_id, problem_id, language, code, verdict, passed, total, memory_kb)
  values ('83000000-0000-0000-0000-000000000001', '83300000-0000-0000-0000-000000000002', 'cpp', 'x', 'Accepted', 2, 2, -5)$$,
  'negative submission memory is refused');

-- ── Editor preferences ──────────────────────────────────────────────────────
set local role authenticated;
select pg_temp.act_as('83000000-0000-0000-0000-000000000001');
insert into public.editor_preferences (user_id, theme, font_size, word_wrap) values ('83000000-0000-0000-0000-000000000001', 'dracula', 16, true);
select pg_temp.check_eq((select count(*) from public.editor_preferences where theme = 'dracula'), 1, 'a learner saves their editor theme');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.editor_preferences set theme = 'solarized-light'$$), 1, 'and changes it');
select pg_temp.check_denied($$update public.editor_preferences set font_size = 40$$, 'a font size over 24 is refused');
select pg_temp.check_denied($$update public.editor_preferences set theme = 'Bad Theme!'$$, 'a malformed theme name is refused');
select pg_temp.check_denied($$insert into public.editor_preferences (user_id, theme) values ('83000000-0000-0000-0000-000000000002', 'monokai')$$,
  'a learner cannot write someone else''s preferences');
select pg_temp.act_as('83000000-0000-0000-0000-000000000002');
select pg_temp.check_eq((select count(*) from public.editor_preferences), 0, 'or read them');
select pg_temp.check_eq(pg_temp.rows_changed($$update public.editor_preferences set theme = 'monokai'$$), 0, 'or change them');
reset role;
set local role anon;
select pg_temp.check_denied($$select count(*) from public.editor_preferences$$, 'anonymous visitors read no preferences');
select pg_temp.check_denied($$select count(*) from public.problem_runs$$, 'or runs');
reset role;

rollback;

\o
\echo 'ALL PRACTICE WORKSPACE CHECKS PASSED'
