-- =============================================================================
-- Devices and exam integrity
--
-- * public.user_devices: every device (browser) an account is used from, with
--   the browser's device id (a hash of stable browser/hardware traits), OS,
--   browser, kind of device, screen, timezone, the IPs it came from and when it
--   was first and last seen. Written by the Forge and Campus APIs; shown to Forge
--   staff (admin → user, security) and to the learner (account page).
--   Server-only.
-- * public.test_attempts: device_id, start_ip, device_info — the device a test
--   was started on. College staff see them through the attempt (existing RLS).
-- * campus.proctoring_events: new event types — device_change (the attempt
--   continued on another device: server-detected, always a violation),
--   multiple_screens, devtools_open, screenshot_key, large_paste (noted) — and
--   the IP and device of each event in details.
--
-- Additive. Tested by supabase/tests/device_integrity.sql.
-- =============================================================================

create table if not exists public.user_devices (
  user_id         uuid not null references public.users(id) on delete cascade,
  device_id       text not null check (device_id ~ '^[a-f0-9]{32,64}$'),
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_ip         inet,
  ips             inet[] not null default '{}' check (cardinality(ips) <= 20),
  user_agent      text check (user_agent is null or length(user_agent) <= 512),
  os              text check (os is null or length(os) <= 40),
  os_version      text check (os_version is null or length(os_version) <= 20),
  browser         text check (browser is null or length(browser) <= 40),
  browser_version text check (browser_version is null or length(browser_version) <= 20),
  device_type     text check (device_type is null or device_type in ('desktop', 'mobile', 'tablet')),
  screen          text check (screen is null or screen ~ '^\d{2,5}x\d{2,5}$'),
  screens         smallint check (screens is null or screens between 1 and 9),
  timezone        text check (timezone is null or length(timezone) <= 64),
  language        text check (language is null or length(language) <= 35),
  seen_count      integer not null default 1,
  primary key (user_id, device_id)
);
create index if not exists user_devices_device on public.user_devices (device_id);
create index if not exists user_devices_last_seen on public.user_devices (last_seen_at desc);
alter table public.user_devices enable row level security;
revoke all on public.user_devices from anon, authenticated;
grant all on public.user_devices to service_role;

/**
 * Records one sighting: new device → a row; known device → last seen, IP list
 * (most recent first, 20 at most), latest traits. Called by the APIs (throttled).
 */
create or replace function public.record_device(
  p_user uuid, p_device text, p_ip inet, p_user_agent text, p_info jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_devices as d (user_id, device_id, last_ip, ips, user_agent, os, os_version, browser, browser_version,
                                        device_type, screen, screens, timezone, language)
  values (p_user, p_device, p_ip, case when p_ip is null then '{}' else array[p_ip] end, left(p_user_agent, 512),
          left(p_info->>'os', 40), left(p_info->>'osVersion', 20), left(p_info->>'browser', 40), left(p_info->>'browserVersion', 20),
          case when p_info->>'deviceType' in ('desktop', 'mobile', 'tablet') then p_info->>'deviceType' end,
          case when p_info->>'screen' ~ '^\d{2,5}x\d{2,5}$' then p_info->>'screen' end,
          case when (p_info->>'screens') ~ '^[1-9]$' then (p_info->>'screens')::smallint end,
          left(p_info->>'timezone', 64), left(p_info->>'language', 35))
  on conflict (user_id, device_id) do update set
    last_seen_at = now(),
    seen_count = d.seen_count + 1,
    last_ip = coalesce(excluded.last_ip, d.last_ip),
    ips = case when excluded.last_ip is null then d.ips
               else (array[excluded.last_ip] || array_remove(d.ips, excluded.last_ip))[1:20] end,
    user_agent = coalesce(excluded.user_agent, d.user_agent),
    os = coalesce(excluded.os, d.os), os_version = coalesce(excluded.os_version, d.os_version),
    browser = coalesce(excluded.browser, d.browser), browser_version = coalesce(excluded.browser_version, d.browser_version),
    device_type = coalesce(excluded.device_type, d.device_type), screen = coalesce(excluded.screen, d.screen),
    screens = coalesce(excluded.screens, d.screens), timezone = coalesce(excluded.timezone, d.timezone),
    language = coalesce(excluded.language, d.language);
end $$;
revoke all on function public.record_device(uuid, text, inet, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_device(uuid, text, inet, text, jsonb) to service_role;

alter table public.test_attempts add column if not exists device_id text check (device_id is null or device_id ~ '^[a-f0-9]{32,64}$');
alter table public.test_attempts add column if not exists start_ip inet;
alter table public.test_attempts add column if not exists device_info jsonb check (device_info is null or (jsonb_typeof(device_info) = 'object' and length(device_info::text) <= 2000));

alter table campus.proctoring_events drop constraint if exists proctoring_events_event_type_check;
alter table campus.proctoring_events add constraint proctoring_events_event_type_check check (event_type in (
  'tab_switch', 'window_blur', 'fullscreen_exit', 'copy', 'paste', 'context_menu',
  'device_change', 'multiple_screens', 'devtools_open', 'screenshot_key', 'large_paste'));
