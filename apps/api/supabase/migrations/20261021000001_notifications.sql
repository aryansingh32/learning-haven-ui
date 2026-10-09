-- =============================================================================
-- Notifications for learners and staff (slice C3)
--
-- * public.notifications: one row per person per event (a test assigned, closing
--   soon, results out, feedback, a course due, a placement drive, a job alert…).
--   People read and mark their own; only the servers create them. A dedupe key
--   makes reminders idempotent (the scheduler can run as often as it likes).
-- * public.notification_preferences: email on/off, kinds muted, and a daily
--   digest instead of one email per event. In-app notifications always appear.
--
-- Additive. Tested by supabase/tests/notifications.sql.
-- =============================================================================

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  org_id      uuid references campus.organizations(id) on delete cascade,
  kind        text not null check (kind in (
                'test_assigned', 'test_closing', 'result_released', 'feedback', 'course_assigned', 'course_due',
                'drive_announced', 'drive_update', 'job_alert', 'announcement')),
  title       text not null check (length(title) between 1 and 200),
  body        text check (body is null or length(body) <= 1000),
  link        text check (link is null or (link ~ '^/' and length(link) <= 300)),   -- an in-app path, never an outside URL
  dedupe_key  text check (dedupe_key is null or length(dedupe_key) <= 200),
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index notifications_dedupe on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_unemailed on public.notifications (created_at) where emailed_at is null;
alter table public.notifications enable row level security;

create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Only read_at can change from the client; everything else is written by the servers.
revoke all on public.notifications from authenticated, anon;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create table public.notification_preferences (
  user_id       uuid primary key references public.users(id) on delete cascade,
  email_enabled boolean not null default true,
  daily_digest  boolean not null default false,
  muted_kinds   text[] not null default '{}' check (muted_kinds <@ array[
                  'test_assigned', 'test_closing', 'result_released', 'feedback', 'course_assigned', 'course_due',
                  'drive_announced', 'drive_update', 'job_alert', 'announcement']),
  last_digest_at timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "Users manage own notification preferences" on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
