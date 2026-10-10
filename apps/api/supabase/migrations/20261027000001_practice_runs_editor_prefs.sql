-- =============================================================================
-- Practice workspace (slice W2-I1): run history, memory, editor preferences.
--
-- * public.problem_runs: the learner's recent "Run"s on a problem (examples or a
--   custom input), from the browser or the server. Written by the Forge API only;
--   learners read their own. Kept bounded by a trigger: the newest 25 per learner
--   and problem, and the newest 500 per learner overall.
-- * problem_submissions.memory_kb: peak memory of a judged submission when the
--   runner reports it (Judge0 does; browser runs never do).
-- * public.editor_preferences: editor theme, font size and word wrap per learner.
--
-- Additive and idempotent. Tested by supabase/tests/practice_workspace.sql.
-- =============================================================================

create table if not exists public.problem_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  problem_id  uuid not null references public.problems(id) on delete cascade,
  language    text not null check (language in ('javascript', 'python', 'java', 'cpp')),
  -- Where the code ran: 'browser' rows are reported by the learner's browser (not trusted for scoring; history only).
  source      text not null check (source in ('browser', 'server')),
  -- 'examples' = the problem's sample tests; 'custom' = an input the learner typed.
  kind        text not null check (kind in ('examples', 'custom')),
  code        text not null check (length(code) between 1 and 50000),
  input       text check (input is null or length(input) <= 5000),
  output      text check (output is null or length(output) <= 4000),
  verdict     text not null check (verdict in ('Accepted', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Time Limit Exceeded', 'Ran')),
  passed      integer not null default 0 check (passed >= 0),
  total       integer not null default 0 check (total >= passed and total <= 100),
  time_ms     integer check (time_ms is null or time_ms between 0 and 600000),
  memory_kb   integer check (memory_kb is null or memory_kb between 0 and 16777216),
  created_at  timestamptz not null default now(),
  constraint problem_runs_custom_has_input check ((kind = 'custom') = (input is not null))
);
create index if not exists idx_problem_runs_user_problem on public.problem_runs (user_id, problem_id, created_at desc);
create index if not exists idx_problem_runs_user on public.problem_runs (user_id, created_at desc);

alter table public.problem_runs enable row level security;
drop policy if exists "Users read own problem runs" on public.problem_runs;
create policy "Users read own problem runs" on public.problem_runs for select to authenticated using (user_id = auth.uid());
revoke all on public.problem_runs from authenticated, anon;
grant select on public.problem_runs to authenticated;
grant all on public.problem_runs to service_role;

-- Keep the history bounded whoever writes it.
create or replace function public.trim_problem_runs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.problem_runs r
   where r.user_id = new.user_id and r.problem_id = new.problem_id
     and r.id not in (select x.id from public.problem_runs x
                       where x.user_id = new.user_id and x.problem_id = new.problem_id
                       order by x.created_at desc, x.id desc limit 25);
  delete from public.problem_runs r
   where r.user_id = new.user_id
     and r.id not in (select x.id from public.problem_runs x
                       where x.user_id = new.user_id
                       order by x.created_at desc, x.id desc limit 500);
  return null;
end $$;
revoke all on function public.trim_problem_runs() from public, authenticated, anon;

drop trigger if exists problem_runs_trim on public.problem_runs;
create trigger problem_runs_trim after insert on public.problem_runs
  for each row execute function public.trim_problem_runs();

-- Judged submissions: peak memory where the runner reports it.
alter table public.problem_submissions add column if not exists memory_kb integer;
alter table public.problem_submissions drop constraint if exists problem_submissions_memory_kb_range;
alter table public.problem_submissions add constraint problem_submissions_memory_kb_range
  check (memory_kb is null or memory_kb between 0 and 16777216);

create table if not exists public.editor_preferences (
  user_id     uuid primary key references public.users(id) on delete cascade,
  theme       text not null default 'forge-dark' check (theme ~ '^[a-z0-9-]{1,32}$'),
  font_size   smallint not null default 15 check (font_size between 11 and 24),
  word_wrap   boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table public.editor_preferences enable row level security;
drop policy if exists "Users manage own editor preferences" on public.editor_preferences;
create policy "Users manage own editor preferences" on public.editor_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.editor_preferences from authenticated, anon;
grant select, insert, update on public.editor_preferences to authenticated;
grant all on public.editor_preferences to service_role;
