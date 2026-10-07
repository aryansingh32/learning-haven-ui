-- =============================================================================
-- Forge Campus — multi-college tenancy (Phase 0)
--
-- Colleges, their members and roles, departments and batches, in a separate
-- `campus` schema. Forge itself is the single `platform` organisation, so
-- Forge content and college content follow the same ownership rules.
--
-- Isolation is enforced in the database: every table carries org_id and RLS
-- decides access from the caller's membership. The Campus API must query as
-- the signed-in user (role `authenticated` + JWT claims), never as service
-- role. Do NOT add `campus` to the PostgREST exposed schemas; the Campus API
-- reaches it through the pg pool.
--
-- Tested by supabase/tests/campus_isolation.sql (run: pnpm test:db).
-- =============================================================================

create schema if not exists campus;

-- ── Types ────────────────────────────────────────────────────────────────────
create type campus.org_type as enum ('platform', 'college');
create type campus.org_role as enum (
  'owner', 'admin', 'placement_officer', 'faculty', 'evaluator', 'invigilator', 'student'
);
create type campus.member_status as enum ('invited', 'active', 'suspended');

-- ── Organisations ────────────────────────────────────────────────────────────
create table campus.organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name          text not null check (length(trim(name)) > 0),
  type          campus.org_type not null default 'college',
  logo_url      text,
  brand_color   text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  email_domains text[] not null default '{}',
  seat_limit    integer check (seat_limit is null or seat_limit >= 0),
  status        text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  settings      jsonb not null default '{}',
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Exactly one platform organisation: Forge. Its id is fixed so content
-- tables can default their owner to it.
create unique index organizations_single_platform on campus.organizations (type) where type = 'platform';
insert into campus.organizations (id, slug, name, type)
values ('00000000-0000-0000-0000-00000000f0f0', 'forge', 'Forge', 'platform')
on conflict (id) do nothing;

-- ── Departments ──────────────────────────────────────────────────────────────
create table campus.departments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references campus.organizations(id) on delete cascade,
  name       text not null,
  code       text not null,
  created_at timestamptz not null default now(),
  unique (org_id, code),
  unique (id, org_id)
);

-- ── Memberships (one role per person per organisation) ──────────────────────
create table campus.org_memberships (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references campus.organizations(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role          campus.org_role not null,
  status        campus.member_status not null default 'active',
  department_id uuid,
  roll_number   text,
  invited_by    uuid references public.users(id) on delete set null,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, user_id),
  -- A department must belong to the same college as the membership.
  foreign key (department_id, org_id) references campus.departments(id, org_id) on delete set null (department_id)
);
create unique index org_memberships_roll_number on campus.org_memberships (org_id, roll_number) where roll_number is not null;
create index org_memberships_user on campus.org_memberships (user_id);

-- ── Batches ──────────────────────────────────────────────────────────────────
create table campus.batches (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references campus.organizations(id) on delete cascade,
  department_id   uuid,
  name            text not null,
  academic_year   text,
  graduation_year integer check (graduation_year between 2000 and 2100),
  status          text not null default 'active' check (status in ('active', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, org_id),
  foreign key (department_id, org_id) references campus.departments(id, org_id) on delete set null (department_id)
);
create index batches_org on campus.batches (org_id);

-- Batch rows repeat org_id so composite keys can prove the batch and the
-- person belong to the same college.
create table campus.batch_members (
  batch_id uuid not null,
  org_id   uuid not null,
  user_id  uuid not null,
  added_at timestamptz not null default now(),
  primary key (batch_id, user_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade,
  foreign key (org_id, user_id) references campus.org_memberships(org_id, user_id) on delete cascade
);
create index batch_members_user on campus.batch_members (user_id);

create table campus.batch_faculty (
  batch_id uuid not null,
  org_id   uuid not null,
  user_id  uuid not null,
  added_at timestamptz not null default now(),
  primary key (batch_id, user_id),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade,
  foreign key (org_id, user_id) references campus.org_memberships(org_id, user_id) on delete cascade
);

-- ── Role → permission map (defaults for every college) ──────────────────────
create table campus.role_permissions (
  role       campus.org_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into campus.role_permissions (role, permission)
select r::campus.org_role, p
from (values
  ('owner',             array['org.manage','org.billing','members.manage','members.view','batches.manage','content.create','assessments.create','assessments.grade','assessments.invigilate','reports.view','reports.export','records.view']),
  ('admin',             array['members.manage','members.view','batches.manage','content.create','assessments.create','assessments.grade','assessments.invigilate','reports.view','reports.export','records.view']),
  ('placement_officer', array['members.view','reports.view','reports.export','records.view']),
  ('faculty',           array['members.view','content.create','assessments.create','assessments.grade','assessments.invigilate','reports.view']),
  ('evaluator',         array['assessments.grade']),
  ('invigilator',       array['assessments.invigilate']),
  ('student',           array[]::text[])
) as d(r, perms), unnest(d.perms) as p
on conflict do nothing;

-- ── updated_at maintenance ──────────────────────────────────────────────────
create trigger organizations_updated_at before update on campus.organizations
  for each row execute function public.update_updated_at();
create trigger org_memberships_updated_at before update on campus.org_memberships
  for each row execute function public.update_updated_at();
create trigger batches_updated_at before update on campus.batches
  for each row execute function public.update_updated_at();

-- ── Access helpers ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so policies can consult memberships without recursing
-- into the memberships table's own policies. search_path is pinned.

create function campus.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'super_admin')
  );
$$;

create function campus.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.org_memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create function campus.has_org_permission(p_org uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select campus.is_platform_admin() or exists (
    select 1
    from campus.org_memberships m
    join campus.role_permissions rp on rp.role = m.role
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission = p_permission
  );
$$;

revoke all on function campus.is_platform_admin() from public;
revoke all on function campus.is_org_member(uuid) from public;
revoke all on function campus.has_org_permission(uuid, text) from public;
grant execute on function campus.is_platform_admin() to authenticated, service_role;
grant execute on function campus.is_org_member(uuid) to authenticated, service_role;
grant execute on function campus.has_org_permission(uuid, text) to authenticated, service_role;

-- ── Row-level security ───────────────────────────────────────────────────────
alter table campus.organizations   enable row level security;
alter table campus.departments     enable row level security;
alter table campus.org_memberships enable row level security;
alter table campus.batches         enable row level security;
alter table campus.batch_members   enable row level security;
alter table campus.batch_faculty   enable row level security;
alter table campus.role_permissions enable row level security;

-- Organisations: members see their college; everyone signed in sees Forge.
create policy org_select on campus.organizations for select to authenticated
  using (type = 'platform' or campus.is_org_member(id) or campus.is_platform_admin());
create policy org_update on campus.organizations for update to authenticated
  using (campus.has_org_permission(id, 'org.manage'))
  with check (campus.has_org_permission(id, 'org.manage'));
create policy org_insert on campus.organizations for insert to authenticated
  with check (campus.is_platform_admin());
create policy org_delete on campus.organizations for delete to authenticated
  using (campus.is_platform_admin());

-- Departments
create policy dept_select on campus.departments for select to authenticated
  using (campus.is_org_member(org_id) or campus.is_platform_admin());
create policy dept_write on campus.departments for all to authenticated
  using (campus.has_org_permission(org_id, 'batches.manage'))
  with check (campus.has_org_permission(org_id, 'batches.manage'));

-- Memberships: your own row, or staff who may view members.
create policy member_select on campus.org_memberships for select to authenticated
  using (user_id = auth.uid() or campus.has_org_permission(org_id, 'members.view'));
-- Managing members never lets a non-owner create or promote an owner.
create policy member_insert on campus.org_memberships for insert to authenticated
  with check (
    campus.has_org_permission(org_id, 'members.manage')
    and (role <> 'owner' or campus.has_org_permission(org_id, 'org.manage'))
  );
create policy member_update on campus.org_memberships for update to authenticated
  using (
    campus.has_org_permission(org_id, 'members.manage')
    and (role <> 'owner' or campus.has_org_permission(org_id, 'org.manage'))
  )
  with check (
    campus.has_org_permission(org_id, 'members.manage')
    and (role <> 'owner' or campus.has_org_permission(org_id, 'org.manage'))
  );
create policy member_delete on campus.org_memberships for delete to authenticated
  using (
    campus.has_org_permission(org_id, 'members.manage')
    and (role <> 'owner' or campus.has_org_permission(org_id, 'org.manage'))
  );

-- Batches
create policy batch_select on campus.batches for select to authenticated
  using (campus.is_org_member(org_id) or campus.is_platform_admin());
create policy batch_write on campus.batches for all to authenticated
  using (campus.has_org_permission(org_id, 'batches.manage'))
  with check (campus.has_org_permission(org_id, 'batches.manage'));

-- Batch members / faculty: yourself, or staff who may view members.
create policy batch_member_select on campus.batch_members for select to authenticated
  using (user_id = auth.uid() or campus.has_org_permission(org_id, 'members.view'));
create policy batch_member_write on campus.batch_members for all to authenticated
  using (campus.has_org_permission(org_id, 'batches.manage'))
  with check (campus.has_org_permission(org_id, 'batches.manage'));

create policy batch_faculty_select on campus.batch_faculty for select to authenticated
  using (campus.is_org_member(org_id) or campus.is_platform_admin());
create policy batch_faculty_write on campus.batch_faculty for all to authenticated
  using (campus.has_org_permission(org_id, 'batches.manage'))
  with check (campus.has_org_permission(org_id, 'batches.manage'));

-- The permission map is readable by any signed-in user; only migrations change it.
create policy role_permissions_select on campus.role_permissions for select to authenticated
  using (true);

-- ── Grants (RLS above does the filtering) ───────────────────────────────────
grant usage on schema campus to authenticated, service_role;
grant select, insert, update, delete on all tables in schema campus to authenticated;
grant all on all tables in schema campus to service_role;
revoke all on schema campus from anon;
