-- =============================================================================
-- Forge Campus — more question types, tags, written answers, paper versions,
-- and sharing tests between colleges (slice C2a)
--
-- * Types: 'tf' (true/false, scored like a single-answer MCQ), 'fib' (typed
--   answer checked against accepted answers), 'descriptive' (written answer,
--   marked by an evaluator against a rubric).
-- * Tags on questions (free text, for filtering and analytics).
-- * Assignments can deal 1–4 named paper versions (A/B/C/D): students of one
--   version get the same question set and order.
-- * Grading and feedback are recorded in campus.attempt_adjustments.
-- * campus.test_shares: a college lets another college use one of its tests
--   (assign it, or copy it into its own bank). test_usable_by_org honours it.
--
-- Additive. Tested by supabase/tests/campus_assessments.sql (C2a block).
-- =============================================================================

alter table public.testseries_questions
  drop constraint if exists testseries_questions_question_type_check,
  add constraint testseries_questions_question_type_check
    check (question_type in ('mcq', 'msq', 'nat', 'coding', 'tf', 'fib', 'descriptive'));

alter table public.testseries_questions
  drop constraint if exists chk_mcq_msq_options,
  add constraint chk_mcq_msq_options
    check (question_type not in ('mcq', 'msq', 'tf') or (options is not null and correct_options is not null));

alter table public.testseries_questions
  add column if not exists text_answers jsonb,            -- fib: ["photosynthesis", "photo-synthesis"]
  add column if not exists rubric text check (rubric is null or length(rubric) <= 5000),     -- descriptive: what earns marks
  add column if not exists max_words integer check (max_words is null or max_words between 1 and 5000),
  add column if not exists tags text[] not null default '{}';

alter table public.testseries_questions
  drop constraint if exists testseries_questions_fib_check,
  add constraint testseries_questions_fib_check check (
    question_type <> 'fib'
    or coalesce(jsonb_typeof(text_answers) = 'array' and jsonb_array_length(text_answers) between 1 and 20, false)
  ),
  drop constraint if exists testseries_questions_tf_check,
  add constraint testseries_questions_tf_check check (
    question_type <> 'tf' or coalesce(jsonb_array_length(options) = 2 and jsonb_array_length(correct_options) = 1, false)
  ),
  drop constraint if exists testseries_questions_tags_check,
  add constraint testseries_questions_tags_check check (cardinality(tags) <= 20);

create index if not exists testseries_questions_tags on public.testseries_questions using gin (tags);

-- ── Paper versions ──────────────────────────────────────────────────────────
alter table campus.assignments
  add column paper_versions integer not null default 1 check (paper_versions between 1 and 4);

-- ── Grading / feedback audit ────────────────────────────────────────────────
alter table campus.attempt_adjustments drop constraint if exists attempt_adjustments_kind_check;
alter table campus.attempt_adjustments add constraint attempt_adjustments_kind_check
  check (kind in ('extend', 'force_submit', 'grade', 'feedback'));
alter table campus.attempt_adjustments add column if not exists question_id uuid;

-- Evaluators (assessments.grade) mark written answers: they read the
-- college's assignments and attempts (writes go through the Campus API).
create policy assignment_grader_select on campus.assignments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.grade'));
create policy "Campus graders read college attempts" on public.test_attempts for select to authenticated
  using (org_id is not null and campus.has_org_permission(org_id, 'assessments.grade'));
drop policy if exists adjustment_select on campus.attempt_adjustments;
create policy adjustment_select on campus.attempt_adjustments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate') or campus.has_org_permission(org_id, 'reports.view')
         or campus.has_org_permission(org_id, 'assessments.grade'));

-- Overall written feedback on an attempt (per-question marks and comments live in its answers).
alter table public.test_attempts add column if not exists feedback text check (feedback is null or length(feedback) <= 5000);

-- ── Sharing tests between colleges ──────────────────────────────────────────
create table campus.test_shares (
  test_id      uuid not null references public.tests(id) on delete cascade,
  owner_org_id uuid not null references campus.organizations(id) on delete cascade,
  org_id       uuid not null references campus.organizations(id) on delete cascade,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (test_id, org_id),
  check (org_id <> owner_org_id)
);
alter table campus.test_shares enable row level security;

-- The owner must really own the test.
create function campus.check_test_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tests t where t.id = new.test_id and t.owner_org_id = new.owner_org_id and t.deleted_at is null) then
    raise exception 'Only the college that owns a test can share it' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from campus.organizations o where o.id = new.org_id and o.type = 'college') then
    raise exception 'Tests can be shared only with colleges' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger test_shares_check before insert or update on campus.test_shares
  for each row execute function campus.check_test_share();

create policy share_select on campus.test_shares for select to authenticated
  using (campus.has_org_permission(owner_org_id, 'content.create')
         or campus.has_org_permission(org_id, 'content.create')
         or campus.has_org_permission(org_id, 'assessments.create'));
create policy share_write on campus.test_shares for all to authenticated
  using (campus.has_org_permission(owner_org_id, 'content.create'))
  with check (campus.has_org_permission(owner_org_id, 'content.create'));
grant select, insert, delete on campus.test_shares to authenticated;
grant all on campus.test_shares to service_role;

-- Staff of a college a test is shared with can see the test row (not its answers).
create policy "Campus staff read tests shared with them" on public.tests for select to authenticated
  using (deleted_at is null and exists (
    select 1 from campus.test_shares s
     where s.test_id = tests.id
       and (campus.has_org_permission(s.org_id, 'assessments.create') or campus.has_org_permission(s.org_id, 'content.create'))));

create or replace function campus.test_usable_by_org(p_test uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tests t
    where t.id = p_test
      and t.deleted_at is null
      and (
        t.owner_org_id = p_org
        or (t.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and t.visibility = 'public' and t.is_published)
        or (t.is_published and exists (select 1 from campus.test_shares s where s.test_id = t.id and s.org_id = p_org))
      )
  );
$$;

revoke all on function campus.check_test_share() from public;
