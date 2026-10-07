-- =============================================================================
-- Lock the public anon key out of every table that had RLS switched off.
--
-- These 37 tables granted the `anon` role full SELECT/INSERT/UPDATE/DELETE, and
-- the anon key ships inside the web app — so anyone could read OTP codes,
-- mint coupons and certificates, or rewrite courses and system settings.
--
-- With RLS on and no policy, `anon` and `authenticated` get nothing. The API
-- (service-role key) and the pg pool bypass RLS, so server behaviour is
-- unchanged. PREREQUISITE: deploy the API change that moves its Supabase
-- client off the anon key first, or the API loses access to these tables.
-- =============================================================================

alter table public.admin_logs                        enable row level security;
alter table public.admin_permissions                 enable row level security;
alter table public.admin_roles                       enable row level security;
alter table public.analytics_events                  enable row level security;
alter table public.apprenticeship_certificates       enable row level security;
alter table public.apprenticeship_coupons            enable row level security;
alter table public.apprenticeship_events             enable row level security;
alter table public.apprenticeship_github_connections enable row level security;
alter table public.apprenticeship_post_replies       enable row level security;
alter table public.apprenticeship_post_upvotes       enable row level security;
alter table public.apprenticeship_posts              enable row level security;
alter table public.apprenticeship_programs           enable row level security;
alter table public.apprenticeship_projects           enable row level security;
alter table public.apprenticeship_test_stages        enable row level security;
alter table public.chapter_content                   enable row level security;
alter table public.chapters                          enable row level security;
alter table public.course_items                      enable row level security;
alter table public.courses                           enable row level security;
alter table public.job_alerts                        enable row level security;
alter table public.job_logs                          enable row level security;
alter table public.otp_verifications                 enable row level security;
alter table public.patterns                          enable row level security;
alter table public.phases                            enable row level security;
alter table public.problem_patterns                  enable row level security;
alter table public.problems                          enable row level security;
alter table public.site_workflows                    enable row level security;
alter table public.sites                             enable row level security;
alter table public.step_content                      enable row level security;
alter table public.steps                             enable row level security;
alter table public.system_settings                   enable row level security;
alter table public.user_badges                       enable row level security;
alter table public.user_chapter_progress             enable row level security;
alter table public.user_daily_quests                 enable row level security;
alter table public.user_files                        enable row level security;
alter table public.user_memory_profiles              enable row level security;
alter table public.user_progress                     enable row level security;
alter table public.user_streaks                      enable row level security;

-- The Learn page subscribes to its own progress rows over Supabase Realtime
-- (useLearnCourse.ts). Signed-in users may read only their own rows.
drop policy if exists "Users read own chapter progress" on public.user_chapter_progress;
create policy "Users read own chapter progress"
  on public.user_chapter_progress
  for select
  to authenticated
  using (auth.uid() = user_id);
