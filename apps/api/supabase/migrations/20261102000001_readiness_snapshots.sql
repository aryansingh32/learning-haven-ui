-- =============================================================================
-- Placement readiness, computed on the server (slice W2-R1)
--
-- * public.readiness_snapshots: one row per learner per (India) day with the
--   score and its parts, written only by the Forge API when the learner opens
--   their readiness, so the dashboard can show the trend. Learners read their own.
--
-- Additive. Tested by supabase/tests/readiness.sql.
-- =============================================================================

create table if not exists public.readiness_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  day     date not null,
  score   smallint not null check (score between 0 and 100),
  parts   jsonb not null default '{}'::jsonb,
  primary key (user_id, day)
);
alter table public.readiness_snapshots enable row level security;
drop policy if exists "Users read own readiness" on public.readiness_snapshots;
create policy "Users read own readiness" on public.readiness_snapshots for select to authenticated using (user_id = auth.uid());
revoke all on public.readiness_snapshots from authenticated, anon;
grant select on public.readiness_snapshots to authenticated;
grant all on public.readiness_snapshots to service_role;
