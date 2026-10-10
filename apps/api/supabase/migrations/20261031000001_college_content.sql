-- =============================================================================
-- Forge Campus — content made by colleges (courses, practice problems, test
-- series, aptitude sets, study materials), seen only by that college's people.
--
-- * One rule for learner-facing content: campus.user_can_see_content(user,
--   owner, visibility, published). Forge-owned public content is for everyone;
--   a college's content (visibility 'org') is for the active members of that
--   college while the college is active; content staff of the owner always.
--   Used by the Forge API (service role) for problems and test series; courses
--   keep campus.user_can_see_course (same rule plus batch assignments).
-- * public.problems gains owner_org_id + visibility (existing rows: Forge, public).
-- * campus.study_materials: notes, links and files a college publishes, to the
--   whole college or one batch, optionally tied to a course.
--
-- Additive. Tested by supabase/tests/college_content.sql.
-- =============================================================================

alter table public.problems
  add column if not exists owner_org_id uuid not null default '00000000-0000-0000-0000-00000000f0f0' references campus.organizations(id),
  add column if not exists visibility public.content_visibility not null default 'public';
create index if not exists problems_owner_org on public.problems (owner_org_id) where owner_org_id <> '00000000-0000-0000-0000-00000000f0f0';

create or replace function campus.user_can_see_content(p_user uuid, p_owner uuid, p_visibility public.content_visibility, p_published boolean)
returns boolean
language sql stable security definer set search_path = '' as $$
  select
    -- The owner college's content staff always see their own drafts and published items.
    (p_owner <> '00000000-0000-0000-0000-00000000f0f0' and 'content.create' = any(campus.user_permissions(p_owner, p_user)))
    or (coalesce(p_published, false) and (
          (p_visibility = 'public' and (p_owner = '00000000-0000-0000-0000-00000000f0f0' or campus.org_is_active(p_owner)))
       or (p_visibility = 'org' and exists (
             select 1 from campus.org_memberships m
              where m.org_id = p_owner and m.user_id = p_user and m.status = 'active' and campus.org_is_active(m.org_id)))
    ));
$$;
revoke all on function campus.user_can_see_content(uuid, uuid, public.content_visibility, boolean) from public, anon, authenticated;
grant execute on function campus.user_can_see_content(uuid, uuid, public.content_visibility, boolean) to service_role;

-- The colleges a learner belongs to (active, college active): the Forge API uses it
-- to add "From <college>" rows to Learn, Practice and Test Series.
create or replace function campus.user_colleges(p_user uuid)
returns table (org_id uuid, name text, slug text, logo_url text, brand_color text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.slug, o.logo_url, o.brand_color
    from campus.org_memberships m join campus.organizations o on o.id = m.org_id
   where m.user_id = p_user and m.status = 'active' and o.type = 'college' and o.status = 'active'
   order by o.name;
$$;
revoke all on function campus.user_colleges(uuid) from public, anon, authenticated;
grant execute on function campus.user_colleges(uuid) to service_role;

-- ── Study materials ─────────────────────────────────────────────────────────
create table if not exists campus.study_materials (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references campus.organizations(id) on delete cascade,
  batch_id     uuid,                                -- null = the whole college
  course_id    uuid references public.courses(id) on delete set null,
  title        text not null check (length(trim(title)) between 1 and 200),
  kind         text not null check (kind in ('note', 'link', 'file')),
  body         text check (body is null or length(body) <= 100000),          -- markdown, for notes
  url          text check (url is null or (url ~ '^https?://' and length(url) <= 2000)),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  is_published boolean not null default false,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (batch_id, org_id) references campus.batches(id, org_id) on delete cascade,
  check ((kind = 'note' and body is not null) or (kind in ('link', 'file') and url is not null))
);
create index if not exists study_materials_org on campus.study_materials (org_id, is_published, created_at desc);
alter table campus.study_materials enable row level security;

drop policy if exists material_staff on campus.study_materials;
create policy material_staff on campus.study_materials for all to authenticated
  using (campus.has_org_permission(org_id, 'content.create'))
  with check (campus.has_org_permission(org_id, 'content.create'));
drop policy if exists material_student_select on campus.study_materials;
create policy material_student_select on campus.study_materials for select to authenticated
  using (is_published and campus.is_org_member(org_id) and (batch_id is null or campus.is_batch_member(batch_id)));
grant select, insert, update, delete on campus.study_materials to authenticated;
grant all on campus.study_materials to service_role;

-- A material's course must be one the college may use (its own, or a public Forge course).
create or replace function campus.check_study_material() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.course_id is not null and not exists (
    select 1 from public.courses c where c.id = new.course_id and c.deleted_at is null
      and (c.owner_org_id = new.org_id or (c.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and c.visibility = 'public'))
  ) then
    raise exception 'That course is not available to this college' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function campus.check_study_material() from public, anon, authenticated;
drop trigger if exists study_materials_check on campus.study_materials;
create trigger study_materials_check before insert or update on campus.study_materials
  for each row execute function campus.check_study_material();

drop trigger if exists audit_row on campus.study_materials;
create trigger audit_row after insert or update or delete on campus.study_materials
  for each row execute function campus.audit_row();
