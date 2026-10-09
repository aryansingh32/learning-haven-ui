-- =============================================================================
-- Forge Campus — courses for colleges (slice D6): connects Learn and Campus.
--
-- * campus.course_licences: Forge grants a college access to premium Forge
--   courses (one course, or all of them when course_id is null), for a period.
--   Every active member of the college gets that access in the learner app.
-- * campus.course_assignments: a college gives a course (or some of its
--   chapters) to a batch with a due date. Faculty see each student's chapter
--   progress; students see it under My College and on the course page.
-- * Helpers the Forge API calls (service role):
--     campus.user_has_course_licence(user, course)
--     campus.user_can_see_course(user, course)  — honours owner/visibility
--
-- Additive. Tested by supabase/tests/campus_courses.sql.
-- =============================================================================

-- ── Licences (granted by Forge staff) ───────────────────────────────────────
create table campus.course_licences (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references campus.organizations(id) on delete cascade,
  course_id  uuid references public.courses(id) on delete cascade,   -- null = every premium Forge course
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  note       text check (note is null or length(note) <= 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create unique index course_licences_org_course on campus.course_licences (org_id, course_id) where course_id is not null;
create unique index course_licences_org_all on campus.course_licences (org_id) where course_id is null;
alter table campus.course_licences enable row level security;

create policy licence_select on campus.course_licences for select to authenticated
  using (campus.is_org_member(org_id) or campus.is_platform_admin());
create policy licence_write on campus.course_licences for all to authenticated
  using (campus.is_platform_admin()) with check (campus.is_platform_admin());

-- Is this course covered by an active licence of this college?
create function campus.course_licensed(p_org uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.course_licences l
    join public.courses c on c.id = p_course
    where l.org_id = p_org
      and l.starts_at <= now() and (l.ends_at is null or l.ends_at > now())
      and (l.course_id = p_course
           or (l.course_id is null and c.owner_org_id = '00000000-0000-0000-0000-00000000f0f0'))
  );
$$;

-- Does any college this person actively belongs to hold a licence for the course?
create function campus.user_has_course_licence(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.org_memberships m
    where m.user_id = p_user and m.status = 'active' and campus.course_licensed(m.org_id, p_course)
  );
$$;

-- ── Course assignments ──────────────────────────────────────────────────────
create table campus.course_assignments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references campus.organizations(id) on delete cascade,
  batch_id     uuid not null,
  course_id    uuid not null references public.courses(id) on delete restrict,
  chapter_ids  uuid[] check (chapter_ids is null or cardinality(chapter_ids) between 1 and 500),  -- null = the whole course
  title        text not null check (length(trim(title)) between 1 and 200),
  instructions text check (instructions is null or length(instructions) <= 5000),
  due_at       timestamptz,
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, org_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade
);
create index course_assignments_batch on campus.course_assignments (batch_id, status);
alter table campus.course_assignments enable row level security;

create policy course_assignment_staff_select on campus.course_assignments for select to authenticated
  using (campus.has_org_permission(org_id, 'assessments.create') or campus.has_org_permission(org_id, 'reports.view'));
create policy course_assignment_student_select on campus.course_assignments for select to authenticated
  using (status = 'published' and campus.is_batch_member(batch_id));
create policy course_assignment_write on campus.course_assignments for all to authenticated
  using (campus.has_org_permission(org_id, 'assessments.create'))
  with check (campus.has_org_permission(org_id, 'assessments.create'));

-- A college may assign its own courses and Forge's public ones; a premium
-- Forge course needs a licence; chosen chapters must belong to the course.
create function campus.check_course_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select id, owner_org_id, visibility, is_published, is_premium, deleted_at into c
    from public.courses where id = new.course_id;
  if c.id is null or c.deleted_at is not null or not c.is_published then
    raise exception 'This course is not available' using errcode = 'check_violation';
  end if;
  if not (c.owner_org_id = new.org_id
          or (c.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and c.visibility = 'public')) then
    raise exception 'This course is not available to this college' using errcode = 'check_violation';
  end if;
  if c.is_premium and c.owner_org_id <> new.org_id and not campus.course_licensed(new.org_id, new.course_id) then
    raise exception 'This is a premium course: your college needs a Forge licence for it' using errcode = 'check_violation';
  end if;
  if new.chapter_ids is not null and exists (
    select 1 from unnest(new.chapter_ids) x(id)
    where not exists (select 1 from public.chapters ch where ch.id = x.id and ch.course_id = new.course_id)
  ) then
    raise exception 'Those chapters are not all in this course' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger course_assignments_check
  before insert or update of course_id, chapter_ids, org_id on campus.course_assignments
  for each row execute function campus.check_course_assignment();

-- ── Course visibility for the learner app ───────────────────────────────────
-- public  → everyone (when published)
-- org     → active members of the owner college
-- batch   → students of a batch it is assigned to (published assignment)
-- private → the owner college's content staff
create function campus.user_can_see_course(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.deleted_at is null
      and (
        (c.is_published and c.visibility = 'public')
        or (c.is_published and c.visibility in ('org', 'batch') and exists (
              select 1 from campus.course_assignments a
              join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = p_user
              where a.course_id = c.id and a.status = 'published'))
        or (c.is_published and c.visibility = 'org' and exists (
              select 1 from campus.org_memberships m
              where m.org_id = c.owner_org_id and m.user_id = p_user and m.status = 'active'))
        or exists (
              select 1 from campus.org_memberships m
              join campus.role_permissions rp on rp.role = m.role and rp.permission = 'content.create'
              where m.org_id = c.owner_org_id and m.user_id = p_user and m.status = 'active')
      )
  );
$$;

revoke all on function campus.course_licensed(uuid, uuid) from public;
revoke all on function campus.user_has_course_licence(uuid, uuid) from public;
revoke all on function campus.user_can_see_course(uuid, uuid) from public;
revoke all on function campus.check_course_assignment() from public;
grant execute on function campus.course_licensed(uuid, uuid) to authenticated, service_role;
-- These take a user id, so only the server may ask them.
grant execute on function campus.user_has_course_licence(uuid, uuid) to service_role;
grant execute on function campus.user_can_see_course(uuid, uuid) to service_role;

grant select, insert, update, delete on campus.course_licences to authenticated;
grant select, insert, update, delete on campus.course_assignments to authenticated;
grant all on campus.course_licences, campus.course_assignments to service_role;
