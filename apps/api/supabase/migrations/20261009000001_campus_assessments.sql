-- =============================================================================
-- Forge Campus — Phase 1: rosters, college-owned tests, assignments, proctoring
--
-- * Roster: admins pre-register people by email; a person who signs in with
--   that VERIFIED email is attached to the college, department and batch.
-- * College staff author their own tests in the existing CBT tables
--   (owner_org_id = the college). Students never read questions directly.
-- * Assignments give a test to a batch with a window, attempt limit,
--   shuffling, result-release rule and proctoring settings. A trigger
--   refuses tests the college may not use.
-- * Attempts gain assignment context; proctoring events are logged per attempt.
--
-- Tested by supabase/tests/campus_assessments.sql.
-- =============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────
create function campus.is_batch_member(p_batch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from campus.batch_members bm
    join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
    where bm.batch_id = p_batch and bm.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- A college may use its own tests and Forge's public tests.
create function campus.test_usable_by_org(p_test uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tests t
    where t.id = p_test
      and t.deleted_at is null
      and (
        t.owner_org_id = p_org
        or (t.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and t.visibility = 'public' and t.is_published)
      )
  );
$$;

revoke all on function campus.is_batch_member(uuid) from public;
revoke all on function campus.test_usable_by_org(uuid, uuid) from public;
grant execute on function campus.is_batch_member(uuid) to authenticated, service_role;
grant execute on function campus.test_usable_by_org(uuid, uuid) to authenticated, service_role;

-- ── Roster ──────────────────────────────────────────────────────────────────
create table campus.roster_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references campus.organizations(id) on delete cascade,
  email         text not null check (email = lower(trim(email)) and email like '%_@_%'),
  full_name     text,
  role          campus.org_role not null default 'student' check (role <> 'owner'),
  roll_number   text,
  department_id uuid,
  batch_id      uuid,
  status        text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  claimed_by    uuid references public.users(id) on delete set null,
  claimed_at    timestamptz,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (org_id, email),
  foreign key (department_id, org_id) references campus.departments(id, org_id) on delete set null (department_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete set null (batch_id)
);
create index roster_entries_pending_email on campus.roster_entries (email) where status = 'pending';

alter table campus.roster_entries enable row level security;
create policy roster_select on campus.roster_entries for select to authenticated
  using (campus.has_org_permission(org_id, 'members.manage'));
create policy roster_write on campus.roster_entries for all to authenticated
  using (campus.has_org_permission(org_id, 'members.manage'))
  with check (campus.has_org_permission(org_id, 'members.manage'));

-- Attach the signed-in user to every college that pre-registered their
-- verified email. Runs as the owner (bypassing RLS) but only ever acts on
-- the caller's own account and own confirmed email.
create function campus.claim_roster_entries() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_count integer := 0;
  r record;
begin
  if v_user is null then
    return 0;
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then
    return 0; -- unverified emails never claim anything
  end if;
  if not exists (select 1 from public.users where id = v_user) then
    return 0;
  end if;

  for r in
    select * from campus.roster_entries
    where email = v_email and status = 'pending'
    for update skip locked
  loop
    insert into campus.org_memberships (org_id, user_id, role, status, department_id, roll_number, joined_at)
    values (r.org_id, v_user, r.role, 'active', r.department_id, r.roll_number, now())
    on conflict (org_id, user_id) do nothing;

    if r.batch_id is not null then
      insert into campus.batch_members (batch_id, org_id, user_id)
      values (r.batch_id, r.org_id, v_user)
      on conflict do nothing;
    end if;

    update campus.roster_entries
    set status = 'claimed', claimed_by = v_user, claimed_at = now()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function campus.claim_roster_entries() from public;
grant execute on function campus.claim_roster_entries() to authenticated;

-- ── College-owned tests in the existing CBT tables ──────────────────────────
-- Staff with content.create may manage their college's tests and questions.
-- Forge content is managed only from the Forge admin app (service role).

create policy "Campus staff manage college tests" on public.tests for all to authenticated
  using (owner_org_id <> '00000000-0000-0000-0000-00000000f0f0' and campus.has_org_permission(owner_org_id, 'content.create'))
  with check (owner_org_id <> '00000000-0000-0000-0000-00000000f0f0' and campus.has_org_permission(owner_org_id, 'content.create'));

create policy "Campus staff manage college questions" on public.testseries_questions for all to authenticated
  using (owner_org_id <> '00000000-0000-0000-0000-00000000f0f0' and campus.has_org_permission(owner_org_id, 'content.create'))
  with check (owner_org_id <> '00000000-0000-0000-0000-00000000f0f0' and campus.has_org_permission(owner_org_id, 'content.create'));

-- Sections and question links follow their test: only staff of the college
-- that owns the test, and a linked question must belong to that college too.
-- (Published tests are publicly readable, so "the test is visible" is not
-- enough — the permission check is repeated here.)
create function campus.can_author_test(p_test uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tests t
    where t.id = p_test
      and t.owner_org_id <> '00000000-0000-0000-0000-00000000f0f0'
      and campus.has_org_permission(t.owner_org_id, 'content.create')
  );
$$;
revoke all on function campus.can_author_test(uuid) from public;
grant execute on function campus.can_author_test(uuid) to authenticated, service_role;

create policy "Campus staff manage college test sections" on public.test_sections for all to authenticated
  using (campus.can_author_test(test_id))
  with check (campus.can_author_test(test_id));

create policy "Campus staff manage college test questions" on public.test_questions for all to authenticated
  using (campus.can_author_test(test_id))
  with check (
    campus.can_author_test(test_id)
    and exists (
      select 1 from public.tests t
      join public.testseries_questions q on q.id = question_id and q.owner_org_id = t.owner_org_id
      where t.id = test_id
    )
  );

-- The public catalogue shows only public tests; college tests stay private
-- to the college even once published.
drop policy if exists "Public read published tests" on public.tests;
create policy "Public read published tests" on public.tests for select
  using (
    is_published = true and deleted_at is null and visibility = 'public'
    and (release_at is null or release_at <= now())
  );

-- ── Assignments ─────────────────────────────────────────────────────────────
create type campus.result_release as enum ('immediately', 'after_close', 'manual');

create table campus.assignments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references campus.organizations(id) on delete cascade,
  batch_id            uuid not null,
  test_id             uuid not null references public.tests(id) on delete restrict,
  title               text not null check (length(trim(title)) > 0),
  instructions        text,
  opens_at            timestamptz not null,
  closes_at           timestamptz not null,
  duration_seconds    integer check (duration_seconds is null or duration_seconds between 60 and 86400),
  max_attempts        integer not null default 1 check (max_attempts between 1 and 10),
  shuffle_questions   boolean not null default true,
  shuffle_options     boolean not null default true,
  result_release      campus.result_release not null default 'after_close',
  results_released_at timestamptz,
  proctoring          jsonb not null default '{}',
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (closes_at > opens_at),
  unique (id, org_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade
);
create index assignments_org on campus.assignments (org_id, opens_at desc);
create index assignments_batch on campus.assignments (batch_id) where status = 'published';

create trigger assignments_updated_at before update on campus.assignments
  for each row execute function public.update_updated_at();

create function campus.check_assignment_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not campus.test_usable_by_org(new.test_id, new.org_id) then
    raise exception 'This test is not available to this college'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger assignments_test_usable before insert or update of test_id, org_id on campus.assignments
  for each row execute function campus.check_assignment_test();

alter table campus.assignments enable row level security;
create policy assignment_staff_select on campus.assignments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.create') or campus.has_org_permission(org_id, 'reports.view'));
create policy assignment_student_select on campus.assignments for select to authenticated
  using (status = 'published' and campus.is_batch_member(batch_id));
create policy assignment_write on campus.assignments for all to authenticated
  using (campus.has_org_permission(org_id, 'assessments.create'))
  with check (campus.has_org_permission(org_id, 'assessments.create'));

-- ── Attempts gain assignment context ────────────────────────────────────────
alter table public.test_attempts
  add column assignment_id   uuid references campus.assignments(id) on delete cascade,
  add column org_id          uuid references campus.organizations(id) on delete cascade,
  add column attempt_number  integer not null default 1 check (attempt_number >= 1),
  add column question_order  jsonb,
  add column violation_count integer not null default 0 check (violation_count >= 0),
  add column submit_reason   text check (submit_reason in ('manual', 'timeout', 'violations', 'closed')),
  add constraint test_attempts_assignment_has_org check ((assignment_id is null) = (org_id is null));

create unique index test_attempts_assignment_number on public.test_attempts (assignment_id, user_id, attempt_number)
  where assignment_id is not null;
create index test_attempts_org on public.test_attempts (org_id) where org_id is not null;

-- Learners could previously write their own attempt rows through the public
-- API (including score). Both APIs write attempts server-side, so learners
-- now only read their own.
drop policy if exists "Users manage own attempts" on public.test_attempts;
create policy "Users read own attempts" on public.test_attempts for select to authenticated
  using (auth.uid() = user_id);

-- Staff see their own college's attempts.
create policy "Campus staff read college attempts" on public.test_attempts for select to authenticated
  using (org_id is not null and campus.has_org_permission(org_id, 'reports.view'));

-- ── Proctoring events ───────────────────────────────────────────────────────
create table campus.proctoring_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  attempt_id  uuid not null references public.test_attempts(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  event_type  text not null check (event_type in ('tab_switch', 'window_blur', 'fullscreen_exit', 'copy', 'paste', 'context_menu')),
  severity    text not null check (severity in ('warning', 'violation')),
  occurred_at timestamptz not null default now(),
  details     jsonb not null default '{}'
);
create index proctoring_events_attempt on campus.proctoring_events (attempt_id, occurred_at);

alter table campus.proctoring_events enable row level security;
create policy proctoring_select on campus.proctoring_events for select to authenticated
  using (
    user_id = auth.uid()
    or campus.has_org_permission(org_id, 'assessments.invigilate')
    or campus.has_org_permission(org_id, 'reports.view')
  );
-- Students record events on their own attempts; the Campus API sets severity.
create policy proctoring_insert on campus.proctoring_events for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.test_attempts a
      where a.id = attempt_id and a.user_id = auth.uid() and a.org_id = proctoring_events.org_id
    )
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on campus.roster_entries, campus.assignments to authenticated;
grant select, insert on campus.proctoring_events to authenticated;
grant all on campus.roster_entries, campus.assignments, campus.proctoring_events to service_role;
