-- Build Haven: per-stage Docker/timeout and structured test feedback
alter table public.build_stages add column if not exists docker_test_image text;
alter table public.build_stages add column if not exists timeout_seconds integer default 120 not null;
alter table public.build_stage_results add column if not exists structured_feedback jsonb default '{}'::jsonb not null;

comment on column public.build_stages.timeout_seconds is 'Docker test runner timeout per stage (seconds)';
comment on column public.build_stage_results.structured_feedback is 'Structured test result payload for UI';
