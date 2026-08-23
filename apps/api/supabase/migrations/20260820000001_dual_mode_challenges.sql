-- =============================================
-- Dual-Mode Challenges: Traditional + Vibe Coding
-- Additive migration — zero existing data disruption
-- =============================================

-- ============================================
-- 1. apprenticeship_programs: available modes
-- ============================================

-- Which modes this program supports ('traditional' | 'vibe' | both)
alter table public.apprenticeship_programs
  add column if not exists available_modes text[] not null default '{traditional}';

-- Which mode is shown by default when user lands on the challenge page
alter table public.apprenticeship_programs
  add column if not exists default_mode text not null default 'traditional'
    check (default_mode in ('traditional', 'vibe'));

-- Optional: reference build URL (golden demo for vibe mode)
alter table public.apprenticeship_programs
  add column if not exists reference_demo_url text;

-- Optional: product contract markdown (public spec shown to vibe learner)
alter table public.apprenticeship_programs
  add column if not exists product_contract text;

comment on column public.apprenticeship_programs.available_modes
  is 'Which verification modes are available: traditional (docker test) and/or vibe (proof gates)';
comment on column public.apprenticeship_programs.default_mode
  is 'Mode shown by default on the challenge page (traditional | vibe)';
comment on column public.apprenticeship_programs.reference_demo_url
  is 'URL to the live golden build that vibe learners can reference';
comment on column public.apprenticeship_programs.product_contract
  is 'Public product requirements spec (markdown) shown to vibe learners';

-- ============================================
-- 2. build_stages: verification strategy
-- ============================================

-- Stage-level fork: docker_test (existing) or contract (new vibe gate)
alter table public.build_stages
  add column if not exists verification_type text not null default 'docker_test'
    check (verification_type in ('docker_test', 'contract'));

-- Acceptance contract JSON for contract-type stages
-- Schema: { "journeys": [...], "api_checks": [...], "visual_checks": [...] }
alter table public.build_stages
  add column if not exists acceptance_contract jsonb not null default '{}'::jsonb;

-- concepts_content was in service.ts insert but missing from schema
alter table public.build_stages
  add column if not exists concepts_content text;

comment on column public.build_stages.verification_type
  is 'How this stage is verified: docker_test (exit code + regex) or contract (Playwright journey gates)';
comment on column public.build_stages.acceptance_contract
  is 'Proof gate spec for contract stages: { journeys, api_checks, visual_checks }';
comment on column public.build_stages.concepts_content
  is 'Markdown tutorial content shown in the Concepts tab for this stage';

-- ============================================
-- 3. build_enrollments: track chosen mode
-- ============================================

alter table public.build_enrollments
  add column if not exists build_mode text not null default 'traditional'
    check (build_mode in ('traditional', 'vibe'));

comment on column public.build_enrollments.build_mode
  is 'Which mode the learner chose: traditional (git push + docker test) or vibe (submit URL/repo for Playwright gates)';

-- Vibe enrollments don't need a GitHub repo so allow null (already nullable: repo_full_name, repo_url, webhook_secret)
-- No schema change needed — those columns are already nullable.

-- ============================================
-- 4. build_stage_results: submission source
-- ============================================

alter table public.build_stage_results
  add column if not exists submission_source text
    check (submission_source in ('github_push', 'live_url', 'zip_upload', 'sandbox_build'));

-- The actual reference: commit hash (traditional), URL (live_url), or storage path (zip)
alter table public.build_stage_results
  add column if not exists submission_ref text;

-- Admin-only flag for manual overrides (referenced in service.ts but column was missing)
alter table public.build_stage_results
  add column if not exists is_manual_override boolean not null default false;

alter table public.build_stage_results
  add column if not exists overridden_by_admin_id uuid references public.users(id);

comment on column public.build_stage_results.submission_source
  is 'How the submission arrived: github_push | live_url | zip_upload | sandbox_build';
comment on column public.build_stage_results.submission_ref
  is 'Submission reference: commit hash, deployment URL, or storage object path';
comment on column public.build_stage_results.is_manual_override
  is 'True when an admin manually passed this stage via adminManualPassStage()';

-- ============================================
-- 5. Back-fill: set available_modes for existing build_challenge rows
-- ============================================

update public.apprenticeship_programs
  set available_modes = '{traditional}', default_mode = 'traditional'
  where program_type = 'build_challenge'
    and available_modes = '{traditional}';

-- ============================================
-- 6. Indexes for new columns
-- ============================================

create index if not exists idx_build_enrollments_mode
  on public.build_enrollments(build_mode);

create index if not exists idx_build_stages_verification_type
  on public.build_stages(verification_type);
