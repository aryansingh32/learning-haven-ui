-- Unified program domain, feature flags, idempotency, and admin audit logs.
create extension if not exists pgcrypto;

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, rollout_percentage, description)
values
  ('unified_programs', false, 0, 'Read/write through unified program tables.'),
  ('new_category_fk', false, 0, 'Use UUID category foreign keys instead of text topics.'),
  ('new_submission_system', false, 0, 'Use program_submissions as the single submission source.'),
  ('new_enrollment_system', false, 0, 'Use program_enrollments as the single enrollment source.'),
  ('new_certificate_system', false, 0, 'Use program_certificates as the single certificate source.')
on conflict (key) do nothing;

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  legacy_source text,
  legacy_id uuid,
  type text not null check (type in ('build_haven', 'apprenticeship', 'course', 'career_track')),
  slug text not null,
  title text not null,
  description text,
  difficulty text,
  category_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, slug),
  unique (legacy_source, legacy_id)
);

create table if not exists public.program_stages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  legacy_source text,
  legacy_id uuid,
  stage_number integer not null,
  title text not null,
  description text,
  content jsonb not null default '{}'::jsonb,
  docker_test_image text,
  test_command text,
  timeout_seconds integer not null default 120,
  xp_reward integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, stage_number),
  unique (legacy_source, legacy_id)
);

create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null,
  legacy_source text,
  legacy_id uuid,
  status text not null default 'active',
  current_stage_number integer not null default 1,
  progress_percentage numeric(5,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, user_id),
  unique (legacy_source, legacy_id)
);

create table if not exists public.program_submissions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  stage_id uuid references public.program_stages(id) on delete set null,
  enrollment_id uuid references public.program_enrollments(id) on delete cascade,
  user_id uuid not null,
  legacy_source text,
  legacy_id uuid,
  status text not null default 'pending',
  attempt_number integer not null default 1,
  repo_full_name text,
  commit_hash text,
  result jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_source, legacy_id)
);

create table if not exists public.program_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.program_submissions(id) on delete cascade,
  reviewer_id uuid,
  status text not null,
  feedback text,
  score numeric(6,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_certificates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid references public.program_enrollments(id) on delete set null,
  user_id uuid not null,
  certificate_code text not null unique,
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  request_hash text not null,
  method text,
  path text,
  user_id uuid,
  response jsonb,
  status_code integer,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_programs_type_active on public.programs(type, is_active) where deleted_at is null;
create index if not exists idx_program_stages_program_number on public.program_stages(program_id, stage_number) where deleted_at is null;
create index if not exists idx_program_enrollments_user on public.program_enrollments(user_id, status) where deleted_at is null;
create index if not exists idx_program_submissions_user on public.program_submissions(user_id, submitted_at desc) where deleted_at is null;
create index if not exists idx_idempotency_keys_expires_at on public.idempotency_keys(expires_at);
create index if not exists idx_admin_audit_logs_admin_time on public.admin_audit_logs(admin_id, created_at desc);

alter table public.feature_flags enable row level security;
alter table public.programs enable row level security;
alter table public.program_stages enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.program_submissions enable row level security;
alter table public.program_reviews enable row level security;
alter table public.program_certificates enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "programs public read active" on public.programs;
create policy "programs public read active" on public.programs for select using (is_active = true and deleted_at is null);

drop policy if exists "program stages public read active" on public.program_stages;
create policy "program stages public read active" on public.program_stages for select using (is_active = true and deleted_at is null);

drop policy if exists "users read own program enrollments" on public.program_enrollments;
create policy "users read own program enrollments" on public.program_enrollments for select using (auth.uid() = user_id);

drop policy if exists "users read own program submissions" on public.program_submissions;
create policy "users read own program submissions" on public.program_submissions for select using (auth.uid() = user_id);

drop policy if exists "users read own program certificates" on public.program_certificates;
create policy "users read own program certificates" on public.program_certificates for select using (auth.uid() = user_id or status = 'issued');

do $$
begin
  if to_regclass('public.build_challenges') is not null then
    insert into public.programs (legacy_source, legacy_id, type, slug, title, description, difficulty, metadata, is_active, created_at, updated_at)
    select 'build_challenges', id, 'build_haven', slug, title, description, difficulty,
           to_jsonb(b) - 'id' - 'slug' - 'title' - 'description' - 'difficulty',
           coalesce(is_active, true), coalesce(created_at, now()), coalesce(updated_at, now())
    from public.build_challenges b
    on conflict (legacy_source, legacy_id) do nothing;
  end if;

  if to_regclass('public.build_stages') is not null then
    insert into public.program_stages (program_id, legacy_source, legacy_id, stage_number, title, description, content, docker_test_image, test_command, timeout_seconds, xp_reward, is_active, created_at, updated_at)
    select p.id, 'build_stages', s.id, s.stage_number, s.title, s.description,
           to_jsonb(s) - 'id' - 'program_id' - 'stage_number' - 'title' - 'description',
           s.docker_test_image, s.test_command, coalesce(s.timeout_seconds, 120), 0,
           coalesce(s.is_active, true), coalesce(s.created_at, now()), coalesce(s.updated_at, now())
    from public.build_stages s
    join public.programs p on p.legacy_source = 'build_challenges' and p.legacy_id = s.program_id
    on conflict (legacy_source, legacy_id) do nothing;
  end if;
end $$;
