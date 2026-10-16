-- =============================================================================
-- Webcam snapshots (optional proctoring)
--
-- * campus.proctoring_snapshots: small JPEG photos the exam page takes at random
--   moments when a test's proctoring policy has webcamSnapshots on and the student
--   agreed on the start screen. Written only by the Campus API (after it has
--   checked the attempt is the student's own and still running); read by college
--   staff who invigilate or see reports. At most 40 per attempt, each ≤ 45 KB,
--   JPEG only. Kept 90 days (docs/security/DATA_RETENTION.md).
-- * campus.proctoring_events: new event type camera_off (camera refused, stopped
--   or unplugged while snapshots are on — noted, never a violation by itself).
--
-- Additive. Tested by supabase/tests/proctoring_snapshots.sql.
-- =============================================================================

create table if not exists campus.proctoring_snapshots (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references campus.organizations(id) on delete cascade,
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  taken_at   timestamptz not null default now(),
  image      bytea not null check (octet_length(image) between 500 and 45000
                                   and substring(image from 1 for 3) = '\xffd8ff'::bytea),
  ip         inet,
  device_id  text check (device_id is null or device_id ~ '^[a-f0-9]{32,64}$')
);
create index if not exists proctoring_snapshots_attempt on campus.proctoring_snapshots (attempt_id, taken_at);
create index if not exists proctoring_snapshots_taken on campus.proctoring_snapshots (taken_at);

-- The API also limits this; the database is the backstop.
create or replace function campus.proctoring_snapshots_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('snapshots:' || new.attempt_id::text));
  if (select count(*) from campus.proctoring_snapshots where attempt_id = new.attempt_id) >= 40 then
    raise exception 'snapshot limit reached for this attempt' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists proctoring_snapshots_limit on campus.proctoring_snapshots;
create trigger proctoring_snapshots_limit before insert on campus.proctoring_snapshots
  for each row execute function campus.proctoring_snapshots_limit();

alter table campus.proctoring_snapshots enable row level security;
drop policy if exists snapshots_staff_select on campus.proctoring_snapshots;
create policy snapshots_staff_select on campus.proctoring_snapshots for select to authenticated
  using (
    campus.has_org_permission(org_id, 'assessments.invigilate')
    or campus.has_org_permission(org_id, 'reports.view')
  );
-- No insert/update/delete for signed-in users: only the Campus API writes.
revoke all on campus.proctoring_snapshots from public, anon, authenticated;
grant select on campus.proctoring_snapshots to authenticated;
grant all on campus.proctoring_snapshots to service_role;
revoke all on function campus.proctoring_snapshots_limit() from public, anon, authenticated;

alter table campus.proctoring_events drop constraint if exists proctoring_events_event_type_check;
alter table campus.proctoring_events add constraint proctoring_events_event_type_check check (event_type in (
  'tab_switch', 'window_blur', 'fullscreen_exit', 'copy', 'paste', 'context_menu',
  'device_change', 'multiple_screens', 'devtools_open', 'screenshot_key', 'large_paste', 'camera_off'));
