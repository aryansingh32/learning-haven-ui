-- =============================================================================
-- Forge Campus — activity log, custom roles, exam-rules consent (slice C2c)
--
-- * campus.custom_roles: a college defines its own staff roles (e.g. "Question
--   setter" = content.create only). A member with a custom role gets exactly
--   its permissions instead of their base role's. Owner-only permissions
--   (org.manage, org.billing) can't be given this way.
-- * campus.user_permissions(org, user) is now the single definition of what a
--   member may do; has_org_permission and course visibility use it.
-- * campus.audit_log: who changed what — tests, questions, sections,
--   assignments, courses given, shares, members (role, status, record),
--   batches/sections/units, custom roles — written by triggers, plus exports
--   recorded by the Campus API. Owners and admins read it; nobody edits it.
-- * test_attempts.consent: when the student accepted the exam rules, and which.
--
-- Additive. Tested by supabase/tests/campus_audit_roles.sql.
-- =============================================================================

-- ── Custom roles ────────────────────────────────────────────────────────────
create table campus.custom_roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 300),
  permissions text[] not null check (
    cardinality(permissions) between 1 and 12
    and permissions <@ array['members.manage', 'members.view', 'batches.manage', 'content.create', 'assessments.create',
                             'assessments.grade', 'assessments.invigilate', 'reports.view', 'reports.export', 'records.view']
  ),
  created_at  timestamptz not null default now(),
  unique (org_id, name),
  unique (id, org_id)
);
alter table campus.custom_roles enable row level security;
create policy custom_role_select on campus.custom_roles for select to authenticated using (campus.is_org_member(org_id));
create policy custom_role_write on campus.custom_roles for all to authenticated
  using (campus.has_org_permission(org_id, 'members.manage'))
  with check (campus.has_org_permission(org_id, 'members.manage'));
grant select, insert, update, delete on campus.custom_roles to authenticated;
grant all on campus.custom_roles to service_role;

alter table campus.org_memberships add column custom_role_id uuid,
  add foreign key (custom_role_id, org_id) references campus.custom_roles(id, org_id) on delete set null (custom_role_id),
  add constraint org_memberships_custom_role_staff check (custom_role_id is null or role not in ('owner', 'student'));

create function campus.user_permissions(p_org uuid, p_user uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when m.custom_role_id is not null
                then (select cr.permissions from campus.custom_roles cr where cr.id = m.custom_role_id)
                else (select array_agg(rp.permission) from campus.role_permissions rp where rp.role = m.role) end
      from campus.org_memberships m
     where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
  ), '{}');
$$;

create or replace function campus.has_org_permission(p_org uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select campus.is_platform_admin() or p_permission = any(campus.user_permissions(p_org, auth.uid()));
$$;

-- Course visibility for a college's content staff now follows custom roles too.
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
              where a.course_id = c.id and a.status = 'published'))
        or (c.is_published and c.visibility = 'org' and exists (
              select 1 from campus.org_memberships m
              where m.org_id = c.owner_org_id and m.user_id = p_user and m.status = 'active'))
        or 'content.create' = any(campus.user_permissions(c.owner_org_id, p_user))
      )
  );
$$;

revoke all on function campus.user_permissions(uuid, uuid) from public;
grant execute on function campus.user_permissions(uuid, uuid) to service_role;

-- ── Activity log ────────────────────────────────────────────────────────────
create table campus.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  actor_id    uuid references public.users(id) on delete set null,
  action      text not null check (action in ('create', 'update', 'delete', 'export')),
  entity      text not null check (length(entity) <= 60),
  entity_id   text,
  summary     text check (summary is null or length(summary) <= 300),
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_org on campus.audit_log (org_id, created_at desc);
alter table campus.audit_log enable row level security;
create policy audit_select on campus.audit_log for select to authenticated
  using (campus.has_org_permission(org_id, 'org.manage') or campus.has_org_permission(org_id, 'members.manage'));
grant select on campus.audit_log to authenticated;
grant all on campus.audit_log to service_role;

-- One trigger for every audited table. Keeps only the columns that changed
-- (minus timestamps and bulky JSON), and skips Forge-owned content.
create function campus.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_org uuid;
  v_changes jsonb;
  v_summary text;
  skip text[] := array['updated_at', 'created_at', 'answers', 'starter_code', 'search_vector'];
begin
  v_org := coalesce((r->>'org_id')::uuid, (r->>'owner_org_id')::uuid);
  if v_org is null and r ? 'test_id' then
    select t.owner_org_id into v_org from public.tests t where t.id = (r->>'test_id')::uuid;
  end if;
  if v_org is null or v_org = '00000000-0000-0000-0000-00000000f0f0'
     or not exists (select 1 from campus.organizations x where x.id = v_org) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', o->k, 'to', r->k)) into v_changes
      from jsonb_object_keys(r) k
     where not (k = any(skip)) and (o->k) is distinct from (r->k);
    if v_changes is null then return null; end if;
  elsif tg_op = 'INSERT' then
    select jsonb_object_agg(k, r->k) into v_changes from jsonb_object_keys(r) k
     where not (k = any(skip)) and r->k <> 'null'::jsonb;
  end if;

  v_summary := coalesce(r->>'title', r->>'name', left(r->>'body', 120), r->>'email', r->>'user_id');
  insert into campus.audit_log (org_id, actor_id, action, entity, entity_id, summary, changes)
  values (v_org, auth.uid(), case tg_op when 'INSERT' then 'create' else lower(tg_op) end, tg_table_name,
          coalesce(r->>'id', r->>'user_id', r->>'question_id'), left(v_summary, 300), v_changes);
  return null;
end $$;
revoke all on function campus.audit_row() from public;

do $$
declare t text;
begin
  foreach t in array array[
    'public.tests', 'public.testseries_questions', 'public.test_questions', 'public.test_sections', 'public.question_test_cases',
    'campus.assignments', 'campus.course_assignments', 'campus.test_shares', 'campus.org_memberships',
    'campus.batches', 'campus.batch_members', 'campus.sections', 'campus.departments', 'campus.custom_roles',
    'campus.assignment_accommodations', 'campus.course_licences'
  ] loop
    execute format('create trigger audit_row after insert or update or delete on %s for each row execute function campus.audit_row()', t);
  end loop;
end $$;

-- question_test_cases has no org column: find it through its question.
create or replace function campus.audit_row_test_case() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end; v_org uuid;
begin
  select q.owner_org_id into v_org from public.testseries_questions q where q.id = (r->>'question_id')::uuid;
  if v_org is null or v_org = '00000000-0000-0000-0000-00000000f0f0' then return null; end if;
  insert into campus.audit_log (org_id, actor_id, action, entity, entity_id, summary, changes)
  values (v_org, auth.uid(), case tg_op when 'INSERT' then 'create' else lower(tg_op) end, 'question_test_cases', r->>'question_id',
          case when (r->>'is_sample')::boolean then 'sample test' else 'hidden test' end,
          jsonb_build_object('input', left(r->>'input', 200)));
  return null;
end $$;
revoke all on function campus.audit_row_test_case() from public;
drop trigger audit_row on public.question_test_cases;
create trigger audit_row after insert or update or delete on public.question_test_cases
  for each row execute function campus.audit_row_test_case();

-- ── Consent to the exam rules ───────────────────────────────────────────────
alter table public.test_attempts add column if not exists consent jsonb;   -- {"at": "...", "rules": ["full screen", ...]}
