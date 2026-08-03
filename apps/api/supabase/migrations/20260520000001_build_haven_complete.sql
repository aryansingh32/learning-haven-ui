-- =============================================
-- Build Haven: Complete Schema Migration
-- Tracks all build-haven tables that were created ad-hoc.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
-- =============================================

-- ============================================
-- 1. Extend apprenticeship_programs for build challenges
-- ============================================

alter table public.apprenticeship_programs
  add column if not exists program_type text default 'apprenticeship';

alter table public.apprenticeship_programs
  add column if not exists short_tagline text;

alter table public.apprenticeship_programs
  add column if not exists thumbnail_url text;

alter table public.apprenticeship_programs
  add column if not exists what_you_build text;

alter table public.apprenticeship_programs
  add column if not exists what_you_learn text;

alter table public.apprenticeship_programs
  add column if not exists why_build text;

alter table public.apprenticeship_programs
  add column if not exists prerequisites_content text;

alter table public.apprenticeship_programs
  add column if not exists is_free boolean default false;

alter table public.apprenticeship_programs
  add column if not exists supported_languages text[] default '{}';

comment on column public.apprenticeship_programs.program_type
  is 'Discriminator: apprenticeship | build_challenge';

-- Index for fast filtering by program_type
create index if not exists idx_programs_program_type
  on public.apprenticeship_programs(program_type);

-- ============================================
-- 2. build_stages
-- ============================================

create table if not exists public.build_stages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  stage_number integer not null,
  title text not null,
  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  description text,
  instructions text,
  code_example text,
  hints text[] default '{}',
  test_command text,
  docker_test_image text,
  timeout_seconds integer not null default 120,
  expected_exit_code integer not null default 0,
  success_criteria jsonb not null default '{}'::jsonb,
  estimated_minutes integer,
  docs_url text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.build_stages is 'Individual stages within a build challenge';
comment on column public.build_stages.timeout_seconds is 'Docker test runner timeout per stage (seconds)';

-- ============================================
-- 3. build_enrollments
-- ============================================

create table if not exists public.build_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  language text not null,
  current_stage integer not null default 1,
  completed_stages integer[] default '{}',
  total_stages integer not null default 0,
  progress_percentage numeric(5,2) not null default 0,
  repo_full_name text,
  repo_url text,
  webhook_secret text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_push_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint: one enrollment per user+program+language
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'build_enrollments_user_program_language_key'
  ) then
    alter table public.build_enrollments
      add constraint build_enrollments_user_program_language_key
      unique (user_id, program_id, language);
  end if;
end
$$;

comment on table public.build_enrollments is 'User enrollment in a build challenge for a specific language';

-- ============================================
-- 4. build_stage_results
-- ============================================

create table if not exists public.build_stage_results (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.build_enrollments(id) on delete cascade,
  stage_id uuid not null references public.build_stages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  commit_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'passed', 'failed')),
  test_output text,
  exit_code integer,
  execution_time_ms integer,
  attempt_number integer not null default 1,
  structured_feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.build_stage_results is 'Individual test run results per stage attempt';
comment on column public.build_stage_results.structured_feedback is 'Structured test result payload for UI';

-- ============================================
-- 5. build_challenge_languages
-- ============================================

create table if not exists public.build_challenge_languages (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  language text not null,
  starter_repo_url text not null,
  docker_test_image text,
  setup_instructions text,
  created_at timestamptz not null default now()
);

-- Unique constraint: one config per program+language
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'build_challenge_languages_program_language_key'
  ) then
    alter table public.build_challenge_languages
      add constraint build_challenge_languages_program_language_key
      unique (program_id, language);
  end if;
end
$$;

comment on table public.build_challenge_languages is 'Per-language config (starter repo, Docker image) for a build challenge';

-- ============================================
-- 6. Performance Indexes
-- ============================================

-- Webhook lookup: find enrollment by repo name
create index if not exists idx_build_enrollments_repo
  on public.build_enrollments(repo_full_name);

-- Stage lookup by program
create index if not exists idx_build_stages_program_number
  on public.build_stages(program_id, stage_number);

-- Active stages only
create index if not exists idx_build_stages_active
  on public.build_stages(program_id, is_active)
  where is_active = true;

-- Results by enrollment+stage (attempt history)
create index if not exists idx_build_results_enrollment_stage
  on public.build_stage_results(enrollment_id, stage_id);

-- Results by user (global history)
create index if not exists idx_build_results_user
  on public.build_stage_results(user_id, created_at desc);

-- Enrollments by user (dashboard)
create index if not exists idx_build_enrollments_user
  on public.build_enrollments(user_id, program_id);

-- Languages by program
create index if not exists idx_build_languages_program
  on public.build_challenge_languages(program_id);

-- ============================================
-- 7. Updated-at triggers
-- ============================================

-- Reuse the update_updated_at() function from init migration
drop trigger if exists build_stages_updated_at on public.build_stages;
create trigger build_stages_updated_at
  before update on public.build_stages
  for each row execute function update_updated_at();

drop trigger if exists build_enrollments_updated_at on public.build_enrollments;
create trigger build_enrollments_updated_at
  before update on public.build_enrollments
  for each row execute function update_updated_at();

-- ============================================
-- 8. Row Level Security
-- ============================================

alter table public.build_stages enable row level security;
alter table public.build_enrollments enable row level security;
alter table public.build_stage_results enable row level security;
alter table public.build_challenge_languages enable row level security;

-- build_stages: public read (active), admin write via service_role
drop policy if exists "build stages public read" on public.build_stages;
create policy "build stages public read"
  on public.build_stages for select
  using (is_active = true);

-- build_enrollments: users can read own
drop policy if exists "users can read own build enrollments" on public.build_enrollments;
create policy "users can read own build enrollments"
  on public.build_enrollments for select
  using (auth.uid() = user_id);

-- build_stage_results: users can read own
drop policy if exists "users can read own build results" on public.build_stage_results;
create policy "users can read own build results"
  on public.build_stage_results for select
  using (auth.uid() = user_id);

-- build_challenge_languages: public read (catalog needs them)
drop policy if exists "build languages public read" on public.build_challenge_languages;
create policy "build languages public read"
  on public.build_challenge_languages for select
  using (true);
