-- =============================================================================
-- Learner goals and study time per day (slice W2-D1)
--
-- * public.study_time_daily: seconds studied per learner per (India) day, so the
--   dashboard can chart study time and check the daily goal. Written only by the
--   Forge API (POST /users/study-time adds to today's row); learners read their own.
-- * users.weekly_problem_goal: how many problems a learner wants to solve a week
--   (the daily minutes goal is the existing users.daily_time_minutes).
--
-- Additive. Tested by supabase/tests/learner_goals.sql.
-- =============================================================================

create table public.study_time_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  day     date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  primary key (user_id, day)
);
alter table public.study_time_daily enable row level security;
create policy "Users read own study time" on public.study_time_daily for select to authenticated using (user_id = auth.uid());
revoke all on public.study_time_daily from authenticated, anon;
grant select on public.study_time_daily to authenticated;
grant all on public.study_time_daily to service_role;

alter table public.users add column if not exists weekly_problem_goal smallint
  check (weekly_problem_goal is null or weekly_problem_goal between 1 and 100);
alter table public.users drop constraint if exists users_daily_time_minutes_range;
alter table public.users add constraint users_daily_time_minutes_range
  check (daily_time_minutes is null or daily_time_minutes between 5 and 600) not valid;
