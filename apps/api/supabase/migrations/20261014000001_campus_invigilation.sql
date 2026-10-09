-- =============================================================================
-- Forge Campus — live invigilation (slice B5)
--
-- * Invigilators (permission assessments.invigilate) can watch a running test:
--   they read the college's assignments, attempts and batch roster.
-- * test_attempts.last_seen_at: the Campus API stamps it on every student
--   request and heartbeat, so the board shows who has dropped off.
-- * campus.attempt_adjustments: audit of extra time and force-submits.
-- * campus.incident_reviews: an invigilator's decision on an attempt's
--   proctoring events (no issue / warning / malpractice). Append-only.
-- Students read neither table. Writes happen through the Campus API.
--
-- Additive. Tested by supabase/tests/campus_assessments.sql.
-- =============================================================================

alter table public.test_attempts add column if not exists last_seen_at timestamptz;

-- An invigilator can end an attempt (recorded in attempt_adjustments).
alter table public.test_attempts
  drop constraint if exists test_attempts_submit_reason_check,
  add constraint test_attempts_submit_reason_check
    check (submit_reason in ('manual', 'timeout', 'violations', 'closed', 'invigilator'));

-- ── Invigilators can see what they invigilate ───────────────────────────────
create policy assignment_invigilator_select on campus.assignments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate'));

create policy "Campus invigilators read college attempts" on public.test_attempts for select to authenticated
  using (org_id is not null and campus.has_org_permission(org_id, 'assessments.invigilate'));

create policy batch_member_invigilator_select on campus.batch_members for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate'));

create policy member_invigilator_select on campus.org_memberships for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate'));

-- ── Audit of extra time / force submit ──────────────────────────────────────
create table campus.attempt_adjustments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  attempt_id  uuid not null references public.test_attempts(id) on delete cascade,
  kind        text not null check (kind in ('extend', 'force_submit')),
  minutes     integer check ((kind = 'extend') = (minutes is not null) and (minutes is null or minutes between 1 and 240)),
  reason      text not null check (length(trim(reason)) between 3 and 500),
  actor_id    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index attempt_adjustments_attempt on campus.attempt_adjustments (attempt_id, created_at);
alter table campus.attempt_adjustments enable row level security;

create policy adjustment_select on campus.attempt_adjustments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate') or campus.has_org_permission(org_id, 'reports.view'));

-- ── Incident reviews ────────────────────────────────────────────────────────
create table campus.incident_reviews (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  attempt_id  uuid not null references public.test_attempts(id) on delete cascade,
  reviewer_id uuid references public.users(id) on delete set null,
  outcome     text not null check (outcome in ('no_issue', 'warning', 'malpractice')),
  note        text check (note is null or length(note) <= 2000),
  created_at  timestamptz not null default now()
);
create index incident_reviews_attempt on campus.incident_reviews (attempt_id, created_at desc);
alter table campus.incident_reviews enable row level security;

create policy incident_review_select on campus.incident_reviews for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.invigilate') or campus.has_org_permission(org_id, 'reports.view'));
-- A reviewer records their own decision on an attempt of their own college.
create policy incident_review_insert on campus.incident_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and campus.has_org_permission(org_id, 'assessments.invigilate')
    and exists (select 1 from public.test_attempts a where a.id = attempt_id and a.org_id = incident_reviews.org_id)
  );

grant select on campus.attempt_adjustments to authenticated;
grant select, insert on campus.incident_reviews to authenticated;
grant all on campus.attempt_adjustments, campus.incident_reviews to service_role;
