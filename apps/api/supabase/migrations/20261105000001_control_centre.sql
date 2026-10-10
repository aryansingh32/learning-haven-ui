-- =============================================================================
-- Admin control centre (slice W3-F1)
--
-- * public.feature_flags gains what the admin needs to roll features out and to
--   switch parts of the product off in an emergency:
--     kind       'release' (a feature rolled out to a percentage of learners and
--                to chosen colleges) or 'kill_switch' (a whole module; turning it
--                off makes the API refuse that module's requests at once)
--     org_ids    colleges whose members always get a release flag
--     updated_by who changed it last
--   Seeded with one kill switch per module the API can switch off.
-- * public.announcements: banners shown across the learner app (and the Campus
--   portal) between two times, made in the Forge admin.
-- * system_settings maintenance_message: what learners see while maintenance mode
--   (already a setting, now enforced by the API) is on.
-- * public.users.banned_at: when an account was suspended. The admin's ban wrote
--   this column, which never existed, so banning always failed; bans are now also
--   enforced by the API (they were recorded and never checked).
-- * Security fix: signed-in learners could write their own public.users row
--   straight through Supabase's REST API with the public key — including role
--   (making themselves super_admin, which also passed every "admin" policy on
--   payments, subscriptions, plans, coupons, withdrawals…), is_banned,
--   wallet_balance, current_plan and xp. They could also insert withdrawals of
--   any amount and mark their own build stages, build and course enrolments, and
--   referral codes. No app writes these tables as the learner (the APIs use the
--   service role), so learners keep read access (RLS as before) and lose writes.
-- Both tables are server-only: the Forge API reads and writes them, clients get
-- what applies to them from GET /api/system/status.
--
-- Additive, apart from the revoked learner writes. Tested by supabase/tests/control_centre.sql.
-- =============================================================================

alter table public.feature_flags add column if not exists kind text not null default 'release';
alter table public.feature_flags add column if not exists org_ids uuid[] not null default '{}';
alter table public.feature_flags add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.feature_flags drop constraint if exists feature_flags_kind_check;
alter table public.feature_flags add constraint feature_flags_kind_check check (kind in ('release', 'kill_switch'));
alter table public.feature_flags drop constraint if exists feature_flags_key_format;
alter table public.feature_flags add constraint feature_flags_key_format check (key ~ '^[a-z][a-z0-9_.]{1,63}$');
alter table public.feature_flags drop constraint if exists feature_flags_org_ids_size;
alter table public.feature_flags add constraint feature_flags_org_ids_size check (cardinality(org_ids) <= 500);
alter table public.feature_flags drop constraint if exists feature_flags_description_length;
alter table public.feature_flags add constraint feature_flags_description_length check (description is null or length(description) <= 500);

revoke all on public.feature_flags from anon, authenticated;
grant all on public.feature_flags to service_role;

-- One switch per module; on (enabled) by default, so nothing changes until an admin acts.
insert into public.feature_flags (key, kind, enabled, rollout_percentage, description) values
  ('module.ai',             'kill_switch', true, 100, 'AI coach and AI hints'),
  ('module.code_execution', 'kill_switch', true, 100, 'Running and submitting code'),
  ('module.payments',       'kill_switch', true, 100, 'New purchases (payment confirmations and webhooks keep working)'),
  ('module.test_series',    'kill_switch', true, 100, 'Test series and mock tests'),
  ('module.discussions',    'kill_switch', true, 100, 'Course discussions'),
  ('module.community',      'kill_switch', true, 100, 'College community (doubts, people, teams)')
on conflict (key) do nothing;

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) between 2 and 120),
  body       text not null default '' check (length(body) <= 1000),
  level      text not null default 'info' check (level in ('info', 'warning', 'critical')),
  audience   text not null default 'everyone' check (audience in ('everyone', 'signed_in', 'colleges')),
  link_url   text check (link_url is null or (link_url ~ '^https://' and length(link_url) <= 1000)),
  link_label text check (link_label is null or length(link_label) <= 40),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  is_active  boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window check (ends_at is null or ends_at > starts_at)
);
create index if not exists announcements_live on public.announcements (starts_at) where is_active;
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant all on public.announcements to service_role;

alter table public.users add column if not exists banned_at timestamptz;

insert into public.system_settings (key, value, description, category)
values ('maintenance_message', '"We''re making Forge better. Back shortly."'::jsonb, 'Shown to learners while maintenance mode is on', 'general')
on conflict (key) do nothing;

-- Learners read these through RLS as before; every write goes through the APIs.
revoke insert, update, delete, truncate on
  public.users, public.payments, public.subscriptions, public.withdrawals, public.referral_codes,
  public.course_enrollments, public.build_enrollments, public.build_stage_results
  from anon, authenticated;
