-- =============================================================================
-- Practice: every judged submission is kept (verdict, tests passed, code), so
-- learners can see their history per problem. Written by the Forge API only.
--
-- Also closes a hole: learners could INSERT into public.submissions through the
-- public API key (e.g. solved = true without being judged). Solves are written
-- by the API's judge (service role); nothing in the apps inserts directly.
--
-- Additive (one new table; one policy dropped). Tested by tests/problem_judging.sql.
-- =============================================================================

create table if not exists public.problem_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  problem_id  uuid not null references public.problems(id) on delete cascade,
  language    text not null check (language in ('javascript', 'python', 'java', 'cpp')),
  code        text not null check (length(code) <= 50000),
  verdict     text not null check (verdict in ('Accepted', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Time Limit Exceeded')),
  passed      integer not null check (passed >= 0),
  total       integer not null check (total >= passed),
  time_ms     integer,
  created_at  timestamptz not null default now()
);
create index if not exists idx_problem_submissions_user_problem on public.problem_submissions (user_id, problem_id, created_at desc);
alter table public.problem_submissions enable row level security;

drop policy if exists "Users read own problem submissions" on public.problem_submissions;
create policy "Users read own problem submissions" on public.problem_submissions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own submissions" on public.submissions;
