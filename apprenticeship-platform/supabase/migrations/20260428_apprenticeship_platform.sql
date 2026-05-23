create extension if not exists pgcrypto;

create table if not exists public.apprenticeship_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  duration_days integer not null,
  price_inr integer not null,
  original_price_inr integer,
  tech_stack text[] default '{}',
  difficulty_level text not null check (difficulty_level in ('beginner', 'intermediate', 'advanced')),
  total_projects integer not null default 0,
  learning_paths text[] default '{traditional,ai_assisted}',
  max_enrollments integer,
  enrolled_count integer default 0,
  avg_completion_rate numeric(4,3),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  certificate_preview_url text,
  community_size integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apprenticeship_projects (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  project_number integer not null,
  title text not null,
  slug text not null,
  description text,
  estimated_hours integer,
  traditional_guide jsonb,
  ai_guide jsonb,
  starter_repo_url text,
  reference_solution_url text,
  helpful_resources jsonb default '[]'::jsonb,
  verification_mode text not null default 'automated' check (verification_mode in ('automated', 'manual')),
  verification_requirements jsonb,
  docker_test_image text,
  unlock_condition text not null default 'complete_previous',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, project_number)
);

create table if not exists public.apprenticeship_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  payment_id uuid,
  referral_code text,
  learning_path text not null default 'traditional' check (learning_path in ('traditional', 'ai_assisted')),
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz not null,
  current_project_number integer not null default 1,
  completed_projects integer not null default 0,
  total_projects integer not null,
  progress_percentage numeric(5,2) not null default 0,
  certificate_issued boolean not null default false,
  certificate_id uuid,
  status text not null default 'active' check (status in ('active', 'expired', 'completed', 'revoked')),
  discord_invited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, program_id)
);

create table if not exists public.apprenticeship_project_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.apprenticeship_enrollments(id) on delete cascade,
  project_id uuid not null references public.apprenticeship_projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'available', 'in_progress', 'passed', 'skipped')),
  github_repo_full_name text,
  github_repo_url text,
  webhook_secret text,
  started_at timestamptz,
  passed_at timestamptz,
  attempts_count integer not null default 0,
  best_code_quality_score integer,
  total_xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, project_id)
);

create table if not exists public.apprenticeship_submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.apprenticeship_enrollments(id) on delete cascade,
  project_progress_id uuid not null references public.apprenticeship_project_progress(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.apprenticeship_projects(id) on delete cascade,
  github_repo_full_name text,
  commit_hash text,
  live_url text,
  learning_path text,
  attempt_number integer not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'testing', 'passed', 'failed', 'manual_review', 'manual_passed', 'manual_failed')),
  total_tests integer,
  passed_tests integer,
  failed_tests jsonb,
  code_quality_score integer,
  security_issues jsonb,
  performance_score integer,
  execution_time_ms integer,
  console_output_tail text,
  reviewer_id uuid,
  reviewer_notes text,
  code_quality_override integer,
  xp_bonus integer not null default 0,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  testing_started_at timestamptz,
  verified_at timestamptz,
  xp_awarded integer not null default 0,
  flagged_for_review boolean not null default false,
  flag_reason text
);

create table if not exists public.apprenticeship_test_stages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.apprenticeship_submissions(id) on delete cascade,
  stage_number integer not null,
  stage_name text not null,
  status text not null check (status in ('pending', 'running', 'passed', 'failed')),
  tests_in_stage integer,
  passed_in_stage integer,
  failed_details jsonb,
  xp_for_stage integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.apprenticeship_github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  github_username text not null,
  github_user_id bigint not null,
  access_token text not null,
  token_scopes text[] default '{}',
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_active boolean not null default true,
  revoked_at timestamptz
);

create table if not exists public.apprenticeship_posts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  project_id uuid references public.apprenticeship_projects(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  attachments jsonb,
  upvotes integer not null default 0,
  replies_count integer not null default 0,
  is_pinned boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.apprenticeship_post_upvotes (
  post_id uuid not null references public.apprenticeship_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.apprenticeship_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.apprenticeship_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  upvotes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.apprenticeship_certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.apprenticeship_enrollments(id) on delete cascade unique,
  user_id uuid not null references public.users(id) on delete cascade,
  program_id uuid not null references public.apprenticeship_programs(id) on delete cascade,
  verification_code text not null unique,
  recipient_name text not null,
  final_grade text check (final_grade in ('Distinction', 'Merit', 'Pass')),
  avg_code_quality_score numeric(5,2),
  projects_completed integer not null,
  certificate_url text,
  pdf_url text,
  social_share_image_url text,
  issued_at timestamptz not null default now()
);

create table if not exists public.apprenticeship_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  session_id text not null,
  event_type text not null,
  event_category text not null,
  event_data jsonb,
  page_url text,
  referrer_url text,
  ip_address inet,
  user_agent text,
  country_code text,
  duration_ms integer,
  enrollment_id uuid references public.apprenticeship_enrollments(id) on delete set null,
  project_id uuid references public.apprenticeship_projects(id) on delete set null,
  submission_id uuid references public.apprenticeship_submissions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.apprenticeship_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  program_id uuid references public.apprenticeship_programs(id) on delete set null,
  discount_type text not null check (discount_type in ('fixed', 'percentage')),
  discount_value integer not null,
  max_uses integer,
  uses_count integer not null default 0,
  per_user_limit integer not null default 1,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_apprenticeship_events_user_id on public.apprenticeship_events(user_id);
create index if not exists idx_apprenticeship_events_event_type on public.apprenticeship_events(event_type);
create index if not exists idx_apprenticeship_events_created_at on public.apprenticeship_events(created_at desc);
create index if not exists idx_apprenticeship_events_session_id on public.apprenticeship_events(session_id);
create index if not exists idx_apprenticeship_submissions_user_project on public.apprenticeship_submissions(user_id, project_id, submitted_at desc);
create index if not exists idx_apprenticeship_progress_user on public.apprenticeship_project_progress(user_id, enrollment_id);

alter table public.apprenticeship_programs enable row level security;
alter table public.apprenticeship_projects enable row level security;
alter table public.apprenticeship_enrollments enable row level security;
alter table public.apprenticeship_project_progress enable row level security;
alter table public.apprenticeship_submissions enable row level security;
alter table public.apprenticeship_test_stages enable row level security;
alter table public.apprenticeship_github_connections enable row level security;
alter table public.apprenticeship_posts enable row level security;
alter table public.apprenticeship_post_upvotes enable row level security;
alter table public.apprenticeship_post_replies enable row level security;
alter table public.apprenticeship_certificates enable row level security;
alter table public.apprenticeship_events enable row level security;
alter table public.apprenticeship_coupons enable row level security;

drop policy if exists "apprenticeship programs public read" on public.apprenticeship_programs;
create policy "apprenticeship programs public read"
on public.apprenticeship_programs for select
using (status = 'active');

drop policy if exists "apprenticeship projects public read active" on public.apprenticeship_projects;
create policy "apprenticeship projects public read active"
on public.apprenticeship_projects for select
using (is_active = true);

drop policy if exists "users can read own apprenticeship enrollments" on public.apprenticeship_enrollments;
create policy "users can read own apprenticeship enrollments"
on public.apprenticeship_enrollments for select
using (auth.uid() = user_id);

drop policy if exists "users can read own apprenticeship progress" on public.apprenticeship_project_progress;
create policy "users can read own apprenticeship progress"
on public.apprenticeship_project_progress for select
using (auth.uid() = user_id);

drop policy if exists "users can read own apprenticeship submissions" on public.apprenticeship_submissions;
create policy "users can read own apprenticeship submissions"
on public.apprenticeship_submissions for select
using (auth.uid() = user_id);

drop policy if exists "users can read own github connection" on public.apprenticeship_github_connections;
create policy "users can read own github connection"
on public.apprenticeship_github_connections for select
using (auth.uid() = user_id);

drop policy if exists "certificate verify public read" on public.apprenticeship_certificates;
create policy "certificate verify public read"
on public.apprenticeship_certificates for select
using (true);
