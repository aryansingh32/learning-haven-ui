-- =============================================================================
-- Forge Campus — college lifecycle: suspension and seat limits (SaaS control)
--
-- * A college that Forge suspends (or archives) stops working for its people:
--   staff lose every permission, students stop seeing its tests, courses,
--   drives and licences. Nothing is deleted; reactivating restores everything.
--   Forge staff (platform admins) keep full access to manage it.
-- * seat_limit is enforced: at most that many active students. A roster entry
--   that would go over the limit stays pending (claimed later, when a seat
--   frees up or Forge raises the limit). A trigger enforces it on every path.
-- * Only Forge staff can change a college's status, seat limit, slug or type;
--   owners keep editing name, logo, brand colour, email domains and settings.
-- * Fixes a gap: a course given to a batch stayed visible to a removed student.
--
-- Same function bodies as before plus the college check. Tested by
-- supabase/tests/college_lifecycle.sql.
-- =============================================================================

create or replace function campus.org_is_active(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from campus.organizations o where o.id = p_org and o.status = 'active');
$$;
revoke all on function campus.org_is_active(uuid) from public;
grant execute on function campus.org_is_active(uuid) to authenticated, service_role;

create or replace function campus.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.org_memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active' and campus.org_is_active(m.org_id)
  );
$$;

create or replace function campus.user_permissions(p_org uuid, p_user uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when m.custom_role_id is not null
                then (select cr.permissions from campus.custom_roles cr where cr.id = m.custom_role_id)
                else (select array_agg(rp.permission) from campus.role_permissions rp where rp.role = m.role) end
      from campus.org_memberships m
     where m.org_id = p_org and m.user_id = p_user and m.status = 'active' and campus.org_is_active(m.org_id)
  ), '{}');
$$;

create or replace function campus.is_batch_member(p_batch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from campus.batch_members bm
    join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
    where bm.batch_id = p_batch and bm.user_id = auth.uid() and m.status = 'active' and campus.org_is_active(m.org_id)
  );
$$;

create or replace function campus.is_assignment_target(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from campus.assignments a
      join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = auth.uid()
      join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
     where a.id = p_assignment and m.status = 'active' and campus.org_is_active(m.org_id)
       and (a.section_id is null or bm.section_id = a.section_id)
       and campus.meets_eligibility(a.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id)
  );
$$;

create or replace function campus.is_course_assignment_target(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from campus.course_assignments a
      join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = auth.uid()
      join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
     where a.id = p_assignment and m.status = 'active' and campus.org_is_active(m.org_id)
       and (a.section_id is null or bm.section_id = a.section_id)
  );
$$;

create or replace function campus.is_drive_eligible(p_drive uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.placement_drives d
      join campus.org_memberships m on m.org_id = d.org_id and m.user_id = auth.uid()
     where d.id = p_drive and m.role = 'student' and m.status = 'active' and campus.org_is_active(m.org_id)
       and (cardinality(d.batch_ids) = 0 or exists (
             select 1 from campus.batch_members bm where bm.user_id = m.user_id and bm.batch_id = any(d.batch_ids)))
       and campus.meets_eligibility(d.eligibility, m.cgpa, m.active_backlogs, m.tenth_percent, m.twelfth_percent, m.department_id)
  );
$$;

create or replace function campus.user_has_course_licence(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from campus.org_memberships m
    where m.user_id = p_user and m.status = 'active' and campus.org_is_active(m.org_id) and campus.course_licensed(m.org_id, p_course)
  );
$$;

create or replace function campus.user_can_see_course(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.deleted_at is null
      and (
        (c.is_published and c.visibility = 'public')
        or (c.is_published and c.visibility in ('org', 'batch') and exists (
              select 1 from campus.course_assignments a
              join campus.batch_members bm on bm.batch_id = a.batch_id and bm.user_id = p_user
              join campus.org_memberships m on m.org_id = bm.org_id and m.user_id = bm.user_id
              where a.course_id = c.id and a.status = 'published' and m.status = 'active' and campus.org_is_active(m.org_id)))
        or (c.is_published and c.visibility = 'org' and exists (
              select 1 from campus.org_memberships m
              where m.org_id = c.owner_org_id and m.user_id = p_user and m.status = 'active' and campus.org_is_active(m.org_id)))
        or 'content.create' = any(campus.user_permissions(c.owner_org_id, p_user))
      )
  );
$$;

-- ── Seat limit ───────────────────────────────────────────────────────────────
-- Active students a college has, against its limit (null = no limit).
create or replace function campus.seats_available(p_org uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when o.seat_limit is null then null
              else greatest(o.seat_limit - (select count(*) from campus.org_memberships m
                                             where m.org_id = o.id and m.role = 'student' and m.status = 'active'), 0)::int end
    from campus.organizations o where o.id = p_org;
$$;
revoke all on function campus.seats_available(uuid) from public;
grant execute on function campus.seats_available(uuid) to service_role;

-- Every path that makes someone an active student goes through here.
create or replace function campus.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_used integer;
begin
  if new.role <> 'student' or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.role = 'student' and old.status = 'active' and old.org_id = new.org_id then return new; end if;
  -- Lock the college so two claims can't both take the last seat.
  select seat_limit into v_limit from campus.organizations where id = new.org_id for update;
  if v_limit is null then return new; end if;
  select count(*) into v_used from campus.org_memberships
   where org_id = new.org_id and role = 'student' and status = 'active' and user_id <> new.user_id;
  if v_used >= v_limit then
    raise exception 'This college has used all % student seats', v_limit using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function campus.enforce_seat_limit() from public, authenticated, anon;

drop trigger if exists org_memberships_seat_limit on campus.org_memberships;
create trigger org_memberships_seat_limit before insert or update of role, status, org_id on campus.org_memberships
  for each row execute function campus.enforce_seat_limit();

-- Only Forge controls a college's plan: status, seats, slug, type and identity.
-- (Owners keep editing name, logo, brand colour, email domains and settings.)
create or replace function campus.guard_org_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not campus.is_platform_admin()
     and (new.status, new.seat_limit, new.slug, new.type, new.id, new.created_by, new.created_at)
         is distinct from (old.status, old.seat_limit, old.slug, old.type, old.id, old.created_by, old.created_at) then
    raise exception 'Only Forge can change a college''s status, seats or address' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function campus.guard_org_columns() from public, authenticated, anon;

drop trigger if exists organizations_guard_columns on campus.organizations;
create trigger organizations_guard_columns before update on campus.organizations
  for each row execute function campus.guard_org_columns();

-- Claiming: skip (leave pending) entries of a suspended college or one with no free seat.
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
    if not campus.org_is_active(r.org_id) then
      continue;
    end if;
    if r.role = 'student' and campus.seats_available(r.org_id) = 0
       and not exists (select 1 from campus.org_memberships m
                        where m.org_id = r.org_id and m.user_id = v_user and m.role = 'student' and m.status = 'active') then
      continue; -- stays pending until a seat is free
    end if;

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
