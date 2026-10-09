-- =============================================================================
-- Forge Campus — coding questions in college tests (slice B1)
--
-- * testseries_questions gains a 'coding' type with starter code per language
--   and judge settings ({"compare": ...}); its languages are the keys of starter_code.
-- * public.question_test_cases holds sample and hidden tests. Only staff of
--   the college that owns the question (content.create) may touch them;
--   students have no policy at all — the Campus API sends them the sample
--   tests and judges hidden ones on the server.
-- * Forge-owned questions are managed from the Forge admin app (service role).
--
-- Additive: existing mcq/msq/nat rows are unaffected. Tested by
-- supabase/tests/campus_assessments.sql.
-- =============================================================================

alter table public.testseries_questions
  drop constraint if exists testseries_questions_question_type_check,
  add constraint testseries_questions_question_type_check
    check (question_type in ('mcq', 'msq', 'nat', 'coding'));

alter table public.testseries_questions
  drop constraint if exists chk_mcq_msq_options,
  add constraint chk_mcq_msq_options
    check (question_type in ('nat', 'coding') or (options is not null and correct_options is not null));

alter table public.testseries_questions
  add column if not exists starter_code jsonb not null default '{}'::jsonb,  -- { "javascript": "...", "python": "...", "java": "..." }
  add column if not exists judge_config jsonb not null default '{}'::jsonb;  -- { "compare": "exact" }; languages = the keys of starter_code

alter table public.testseries_questions
  drop constraint if exists testseries_questions_coding_check,
  add constraint testseries_questions_coding_check check (
    question_type <> 'coding'
    or (
      jsonb_typeof(starter_code) = 'object'
      and starter_code ?| array['javascript', 'python', 'java']
      and coalesce(judge_config->>'compare', 'exact') in ('exact', 'unordered', 'unordered_deep')
    )
  );

create table if not exists public.question_test_cases (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.testseries_questions(id) on delete cascade,
  input           text not null check (length(input) <= 20000),           -- "nums = [2,7,11,15], target = 9"
  expected_output text not null check (length(expected_output) <= 20000),
  is_sample       boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_question_test_cases_question on public.question_test_cases (question_id, sort_order);
alter table public.question_test_cases enable row level security;

-- Same rule as the questions themselves: college staff with content.create,
-- never on Forge-owned questions.
create function campus.can_author_question(p_question uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.testseries_questions q
    where q.id = p_question
      and q.owner_org_id <> '00000000-0000-0000-0000-00000000f0f0'
      and campus.has_org_permission(q.owner_org_id, 'content.create')
  );
$$;
revoke all on function campus.can_author_question(uuid) from public;
grant execute on function campus.can_author_question(uuid) to authenticated, service_role;

create policy "Campus staff manage college question tests" on public.question_test_cases for all to authenticated
  using (campus.can_author_question(question_id))
  with check (campus.can_author_question(question_id));

grant select, insert, update, delete on public.question_test_cases to authenticated;
revoke all on public.question_test_cases from anon;
