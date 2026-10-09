-- =============================================================================
-- Forge Campus — college structure and academic records (slice C1)
--
-- * Hierarchy: departments become units with a kind (school / department /
--   branch) and an optional parent in the same college, so a college can model
--   School of Engineering → CSE → CSE (AI & ML).
-- * Sections inside a batch (CSE 2027 → A, B, C). A student is in at most one
--   section of a batch. Tests and courses can go to a whole batch or one section.
-- * Academic record on the membership: CGPA, active backlogs, 10th/12th marks.
-- * Eligibility rules on an assignment (placement drives): minimum CGPA,
--   maximum backlogs, minimum 10th/12th, departments. Students who don't meet
--   them don't see the test, and aren't counted in its results.
-- * campus.assignment_students(id) is the one definition of "who this test is
--   for" used by every report.
--
-- Additive. Tested by supabase/tests/campus_structure.sql.
-- =============================================================================

-- ── Hierarchy ───────────────────────────────────────────────────────────────
alter table campus.departments
  add column kind text not null default 'department' check (kind in ('school', 'department', 'branch')),
  add column parent_id uuid,
  add foreign key (parent_id, org_id) references campus.departments(id, org_id) on delete set null (parent_id);

-- No loops, at most 4 levels.
create function campus.check_department_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cur uuid := new.parent_id; depth int := 1;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'A unit cannot be inside itself' using errcode = 'check_violation';
    end if;
    depth := depth + 1;
    if depth > 4 then
      raise exception 'Units can be nested at most 4 levels deep' using errcode = 'check_violation';
    end if;
    select parent_id into cur from campus.departments where id = cur;
  end loop;
  return new;
end $$;
create trigger departments_parent_check before insert or update of parent_id on campus.departments
  for each row execute function campus.check_department_parent();

-- ── Sections ────────────────────────────────────────────────────────────────
create table campus.sections (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  batch_id   uuid not null,
  name       text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (batch_id, name),
  unique (id, org_id),
  unique (id, batch_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade
);
alter table campus.sections enable row level security;
create policy section_select on campus.sections for select to authenticated
  using (campus.is_org_member(org_id));
create policy section_write on campus.sections for all to authenticated
  using (campus.has_org_permission(org_id, 'batches.manage'))
  with check (campus.has_org_permission(org_id, 'batches.manage'));
grant select, insert, update, delete on campus.sections to authenticated;
grant all on campus.sections to service_role;

alter table campus.batch_members add column section_id uuid,
  add foreign key (section_id, batch_id) references campus.sections(id, batch_id) on delete set null (section_id);

alter table campus.assignments add column section_id uuid,
  add foreign key (section_id, batch_id) references campus.sections(id, batch_id) on delete restrict;
alter table campus.course_assignments add column section_id uuid,
  add foreign key (section_id, batch_id) references campus.sections(id, batch_id) on delete restrict;

-- ── Academic record ─────────────────────────────────────────────────────────
alter table campus.org_memberships
  add column cgpa            numeric(4, 2) check (cgpa is null or cgpa between 0 and 10),
  add column active_backlogs integer check (active_backlogs is null or active_backlogs between 0 and 100),
  add column tenth_percent   numeric(5, 2) check (tenth_percent is null or tenth_percent between 0 and 100),
  add column twelfth_percent numeric(5, 2) check (twelfth_percent is null or twelfth_percent between 0 and 100);

-- ── Eligibility ─────────────────────────────────────────────────────────────
-- Rules: {"minCgpa": 7, "maxBacklogs": 0, "minTenth": 60, "minTwelfth": 60, "departmentIds": [...]}
-- A missing value never meets a rule that needs it.
alter table campus.assignments add column eligibility jsonb not null default '{}'
  check (jsonb_typeof(eligibility) = 'object');

create function campus.meets_eligibility(
  p_rules jsonb, p_cgpa numeric, p_backlogs integer, p_tenth numeric, p_twelfth numeric, p_department uuid
) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
       (p_rules->>'minCgpa' is null or p_cgpa >= (p_rules->>'minCgpa')::numeric)
   and (p_rules->>'maxBacklogs' is null or p_backlogs <= (p_rules->>'maxBacklogs')::integer)
   and (p_rules->>'minTenth' is null or p_tenth >= (p_rules->>'minTenth')::numeric)
   and (p_rules->>'minTwelfth' is null or p_twelfth >= (p_rules->>'minTwelfth')::numeric)
   and (jsonb_array_length(coalesce(p_rules->'departmentIds', '[]')) = 0
        or p_department::text in (select jsonb_array_elements_text(p_rules->'departmentIds'))),
    false);
$$;

-- Who a test assignment is for: active students of the batch, in its section
-- if it has one, who meet its eligibility rules. Runs with the caller's rights,
-- so staff see only what RLS lets them see.
create function campus.assignment_students(p_assignment uuid)
returns table (user_id uuid, roll_number text, section_id uuid)
language sql stable set search_path = '' as $$
  select bm.user_id, m.roll_number, bm.section_id
    from campus.assignments a
    join campus.batch_members bm on bm.batch_id = a.batch_id
    join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
   where a.id = p_assignment and m.role = 'student' and m.status = 'active'
     and (a.section_id is null or bm.section_id = a.section_id)
     and campus.meets_eligibility(a.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id);
$$;

create function campus.course_assignment_students(p_assignment uuid)
returns table (user_id uuid, roll_number text, section_id uuid)
language sql stable set search_path = '' as $$
  select bm.user_id, m.roll_number, bm.section_id
    from campus.course_assignments a
    join campus.batch_members bm on bm.batch_id = a.batch_id
    join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
   where a.id = p_assignment and m.role = 'student' and m.status = 'active'
     and (a.section_id is null or bm.section_id = a.section_id);
$$;

-- Is this test assignment for me? (student policies and the attempt start)
create function campus.is_assignment_target(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from campus.assignments a
      join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = auth.uid()
      join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
     where a.id = p_assignment and m.status = 'active'
       and (a.section_id is null or bm.section_id = a.section_id)
       and campus.meets_eligibility(a.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id)
  );
$$;

create function campus.is_course_assignment_target(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from campus.course_assignments a
      join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = auth.uid()
      join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
     where a.id = p_assignment and m.status = 'active'
       and (a.section_id is null or bm.section_id = a.section_id)
  );
$$;

drop policy assignment_student_select on campus.assignments;
create policy assignment_student_select on campus.assignments for select to authenticated
  using (status = 'published' and campus.is_assignment_target(id));
drop policy course_assignment_student_select on campus.course_assignments;
create policy course_assignment_student_select on campus.course_assignments for select to authenticated
  using (status = 'published' and campus.is_course_assignment_target(id));

revoke all on function campus.check_department_parent() from public;
revoke all on function campus.meets_eligibility(jsonb, numeric, integer, numeric, numeric, uuid) from public;
revoke all on function campus.assignment_students(uuid) from public;
revoke all on function campus.course_assignment_students(uuid) from public;
revoke all on function campus.is_assignment_target(uuid) from public;
revoke all on function campus.is_course_assignment_target(uuid) from public;
grant execute on function campus.meets_eligibility(jsonb, numeric, integer, numeric, numeric, uuid) to authenticated, service_role;
grant execute on function campus.assignment_students(uuid) to authenticated, service_role;
grant execute on function campus.course_assignment_students(uuid) to authenticated, service_role;
grant execute on function campus.is_assignment_target(uuid) to authenticated, service_role;
grant execute on function campus.is_course_assignment_target(uuid) to authenticated, service_role;

-- ── Roster carries section and academic record ──────────────────────────────
alter table campus.roster_entries
  add column section_name    text check (section_name is null or length(trim(section_name)) between 1 and 60),
  add column cgpa            numeric(4, 2) check (cgpa is null or cgpa between 0 and 10),
  add column active_backlogs integer check (active_backlogs is null or active_backlogs between 0 and 100),
  add column tenth_percent   numeric(5, 2) check (tenth_percent is null or tenth_percent between 0 and 100),
  add column twelfth_percent numeric(5, 2) check (twelfth_percent is null or twelfth_percent between 0 and 100);

-- Same as before, plus the section (found by name in the batch) and the record.
create or replace function campus.claim_roster_entries() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_count integer := 0;
  v_section uuid;
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
    insert into campus.org_memberships (org_id, user_id, role, status, department_id, roll_number, joined_at,
                                        cgpa, active_backlogs, tenth_percent, twelfth_percent)
    values (r.org_id, v_user, r.role, 'active', r.department_id, r.roll_number, now(),
            r.cgpa, r.active_backlogs, r.tenth_percent, r.twelfth_percent)
    on conflict (org_id, user_id) do nothing;

    if r.batch_id is not null then
      v_section := null;
      if r.section_name is not null then
        select s.id into v_section from campus.sections s
         where s.batch_id = r.batch_id and lower(s.name) = lower(r.section_name);
      end if;
      insert into campus.batch_members (batch_id, org_id, user_id, section_id)
      values (r.batch_id, r.org_id, v_user, v_section)
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
