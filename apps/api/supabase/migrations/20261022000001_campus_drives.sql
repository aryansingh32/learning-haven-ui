-- =============================================================================
-- Forge Campus — placement drives (slice C3)
--
-- * campus.placement_drives: a company visiting the college — role, CTC,
--   location, who may apply (batches + the same eligibility rules as tests),
--   apply-by date, status.
-- * campus.drive_rounds: its stages; a round can be a college test assignment.
-- * campus.drive_registrations: students apply; placement staff move them
--   through shortlisted / selected / rejected. A student can only register for
--   an open drive they're eligible for, and can only withdraw themselves.
-- * New permission placements.manage (owner, admin, placement officer).
--
-- Additive. Tested by supabase/tests/campus_drives.sql.
-- =============================================================================

insert into campus.role_permissions (role, permission)
values ('owner', 'placements.manage'), ('admin', 'placements.manage'), ('placement_officer', 'placements.manage')
on conflict do nothing;

alter table campus.custom_roles drop constraint if exists custom_roles_permissions_check;
alter table campus.custom_roles add constraint custom_roles_permissions_check check (
  cardinality(permissions) between 1 and 12
  and permissions <@ array['members.manage', 'members.view', 'batches.manage', 'content.create', 'assessments.create',
                           'assessments.grade', 'assessments.invigilate', 'reports.view', 'reports.export', 'records.view', 'placements.manage']
);

create table campus.placement_drives (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references campus.organizations(id) on delete cascade,
  company      text not null check (length(trim(company)) between 1 and 120),
  role_title   text not null check (length(trim(role_title)) between 1 and 120),
  description  text check (description is null or length(description) <= 10000),
  job_type     text not null default 'full_time' check (job_type in ('full_time', 'internship', 'internship_ppo')),
  ctc          text check (ctc is null or length(ctc) <= 80),          -- "6.5 LPA", "₹25,000/month"
  location     text check (location is null or length(location) <= 120),
  batch_ids    uuid[] not null default '{}',                           -- empty = every student of the college
  eligibility  jsonb not null default '{}' check (jsonb_typeof(eligibility) = 'object'),
  apply_by     timestamptz,
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, org_id)
);
create index placement_drives_org on campus.placement_drives (org_id, status);

create table campus.drive_rounds (
  id            uuid primary key default gen_random_uuid(),
  drive_id      uuid not null,
  org_id        uuid not null,
  name          text not null check (length(trim(name)) between 1 and 120),
  kind          text not null default 'test' check (kind in ('test', 'interview', 'group_discussion', 'other')),
  assignment_id uuid,
  scheduled_at  timestamptz,
  sort_order    integer not null default 0,
  foreign key (drive_id, org_id) references campus.placement_drives(id, org_id) on delete cascade,
  foreign key (assignment_id, org_id) references campus.assignments(id, org_id) on delete set null (assignment_id)
);

create table campus.drive_registrations (
  drive_id      uuid not null,
  org_id        uuid not null,
  user_id       uuid not null,
  status        text not null default 'registered' check (status in ('registered', 'shortlisted', 'selected', 'rejected', 'withdrawn')),
  note          text check (note is null or length(note) <= 500),
  registered_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (drive_id, user_id),
  foreign key (drive_id, org_id) references campus.placement_drives(id, org_id) on delete cascade,
  foreign key (org_id, user_id) references campus.org_memberships(org_id, user_id) on delete cascade
);

-- Is this drive for me? Active student of the college, in one of its batches
-- (if it names any), meeting its eligibility rules.
create function campus.is_drive_eligible(p_drive uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.placement_drives d
      join campus.org_memberships m on m.org_id = d.org_id and m.user_id = auth.uid()
     where d.id = p_drive and m.role = 'student' and m.status = 'active'
       and (cardinality(d.batch_ids) = 0 or exists (
             select 1 from campus.batch_members bm where bm.user_id = m.user_id and bm.batch_id = any(d.batch_ids)))
       and campus.meets_eligibility(d.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id)
  );
$$;

create function campus.can_register_drive(p_drive uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select campus.is_drive_eligible(p_drive) and exists (
    select 1 from campus.placement_drives d where d.id = p_drive and d.status = 'open' and (d.apply_by is null or d.apply_by > now()));
$$;

alter table campus.placement_drives enable row level security;
alter table campus.drive_rounds enable row level security;
alter table campus.drive_registrations enable row level security;

create policy drive_staff_select on campus.placement_drives for select to authenticated
  using (campus.has_org_permission(org_id, 'placements.manage') or campus.has_org_permission(org_id, 'reports.view'));
create policy drive_student_select on campus.placement_drives for select to authenticated
  using (status in ('open', 'closed') and campus.is_drive_eligible(id));
create policy drive_write on campus.placement_drives for all to authenticated
  using (campus.has_org_permission(org_id, 'placements.manage'))
  with check (campus.has_org_permission(org_id, 'placements.manage'));

create policy round_select on campus.drive_rounds for select to authenticated
  using (exists (select 1 from campus.placement_drives d where d.id = drive_id));   -- visible when the drive is
create policy round_write on campus.drive_rounds for all to authenticated
  using (campus.has_org_permission(org_id, 'placements.manage'))
  with check (campus.has_org_permission(org_id, 'placements.manage'));

create policy registration_select on campus.drive_registrations for select to authenticated
  using (user_id = auth.uid() or campus.has_org_permission(org_id, 'placements.manage') or campus.has_org_permission(org_id, 'reports.view'));
create policy registration_student_insert on campus.drive_registrations for insert to authenticated
  with check (user_id = auth.uid() and status = 'registered' and campus.can_register_drive(drive_id));
-- A student may only withdraw (or re-register while the drive is open).
create policy registration_student_update on campus.drive_registrations for update to authenticated
  using (user_id = auth.uid() and status in ('registered', 'withdrawn'))
  with check (user_id = auth.uid() and (status = 'withdrawn' or (status = 'registered' and campus.can_register_drive(drive_id))));
create policy registration_staff_write on campus.drive_registrations for all to authenticated
  using (campus.has_org_permission(org_id, 'placements.manage'))
  with check (campus.has_org_permission(org_id, 'placements.manage'));

revoke all on function campus.is_drive_eligible(uuid) from public;
revoke all on function campus.can_register_drive(uuid) from public;
grant execute on function campus.is_drive_eligible(uuid) to authenticated, service_role;
grant execute on function campus.can_register_drive(uuid) to authenticated, service_role;

grant select, insert, update, delete on campus.placement_drives, campus.drive_rounds, campus.drive_registrations to authenticated;
grant all on campus.placement_drives, campus.drive_rounds, campus.drive_registrations to service_role;

-- Changes to drives and who was shortlisted/selected go in the activity log.
create trigger audit_row after insert or update or delete on campus.placement_drives for each row execute function campus.audit_row();
create trigger audit_row after insert or update or delete on campus.drive_registrations for each row execute function campus.audit_row();

-- Every student a drive is for (staff reports and announcements). Caller's rights.
create function campus.drive_students(p_drive uuid) returns table (user_id uuid)
language sql stable set search_path = '' as $$
  select m.user_id from campus.placement_drives d
    join campus.org_memberships m on m.org_id = d.org_id
   where d.id = p_drive and m.role = 'student' and m.status = 'active'
     and (cardinality(d.batch_ids) = 0 or exists (
           select 1 from campus.batch_members bm where bm.user_id = m.user_id and bm.batch_id = any(d.batch_ids)))
     and campus.meets_eligibility(d.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id);
$$;
revoke all on function campus.drive_students(uuid) from public;
grant execute on function campus.drive_students(uuid) to authenticated, service_role;
