-- =============================================================================
-- College community: the people of one college helping each other.
--
-- * community_profiles: an opt-in card in the college's people directory
--   (headline, skills, "looking for a team").
-- * community_teams + community_team_members: students form teams to build
--   projects; others ask to join and the lead accepts. A lead who leaves hands
--   the team to the longest-standing member; the last one out archives it.
-- * community_threads + community_posts: doubts (optionally about a practice
--   problem or a course) and discussions, open to the college, or private to
--   one team. The author can mark the reply that solved it.
-- * community_reports: anyone can flag a thread or reply; moderators hide it.
-- * New permission community.moderate (owner, admin, faculty): hide, pin, and
--   see private team threads when handling a report.
--
-- Everything is scoped to one college (RLS: active member of an active
-- college). Not exposed through PostgREST: the Campus API serves it.
-- Additive. Tested by supabase/tests/college_community.sql.
-- =============================================================================

insert into campus.role_permissions (role, permission)
values ('owner', 'community.moderate'), ('admin', 'community.moderate'), ('faculty', 'community.moderate')
on conflict do nothing;

alter table campus.custom_roles drop constraint if exists custom_roles_permissions_check;
alter table campus.custom_roles add constraint custom_roles_permissions_check check (
  cardinality(permissions) between 1 and 12
  and permissions <@ array['members.manage', 'members.view', 'batches.manage', 'content.create', 'assessments.create',
                           'assessments.grade', 'assessments.invigilate', 'reports.view', 'reports.export', 'records.view',
                           'placements.manage', 'community.moderate']
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'test_assigned', 'test_closing', 'result_released', 'feedback', 'course_assigned', 'course_due',
  'drive_announced', 'drive_update', 'job_alert', 'announcement',
  'community_reply', 'team_request', 'team_update']));

-- ── People directory ────────────────────────────────────────────────────────
create table if not exists campus.community_profiles (
  org_id           uuid not null,
  user_id          uuid not null,
  headline         text check (headline is null or length(headline) <= 120),
  bio              text check (bio is null or length(bio) <= 1000),
  skills           text[] not null default '{}' check (cardinality(skills) <= 20),
  looking_for_team boolean not null default false,
  github_url       text check (github_url is null or (github_url ~ '^https://' and length(github_url) <= 300)),
  linkedin_url     text check (linkedin_url is null or (linkedin_url ~ '^https://' and length(linkedin_url) <= 300)),
  updated_at       timestamptz not null default now(),
  primary key (org_id, user_id),
  -- Leaving the college removes the card.
  foreign key (org_id, user_id) references campus.org_memberships(org_id, user_id) on delete cascade
);
alter table campus.community_profiles enable row level security;
drop policy if exists profile_select on campus.community_profiles;
create policy profile_select on campus.community_profiles for select to authenticated
  using (campus.is_org_member(org_id));
drop policy if exists profile_own on campus.community_profiles;
create policy profile_own on campus.community_profiles for all to authenticated
  using (user_id = auth.uid() and campus.is_org_member(org_id))
  with check (user_id = auth.uid() and campus.is_org_member(org_id));
grant select, insert, update, delete on campus.community_profiles to authenticated;
grant all on campus.community_profiles to service_role;

-- ── Teams ───────────────────────────────────────────────────────────────────
create table if not exists campus.community_teams (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references campus.organizations(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 80),
  description   text check (description is null or length(description) <= 4000),  -- the project idea
  skills_needed text[] not null default '{}' check (cardinality(skills_needed) <= 15),
  max_members   int not null default 4 check (max_members between 2 and 10),
  status        text not null default 'forming' check (status in ('forming', 'building', 'shipped', 'archived')),
  repo_url      text check (repo_url is null or (repo_url ~ '^https://' and length(repo_url) <= 300)),
  demo_url      text check (demo_url is null or (demo_url ~ '^https://' and length(demo_url) <= 300)),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, org_id)
);
create index if not exists community_teams_org on campus.community_teams (org_id, status, created_at desc);

create table if not exists campus.community_team_members (
  team_id    uuid not null,
  org_id     uuid not null,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('lead', 'member')),
  status     text not null default 'requested' check (status in ('requested', 'active')),
  message    text check (message is null or length(message) <= 500),   -- "why I'd like to join"
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (team_id, user_id),
  foreign key (team_id, org_id) references campus.community_teams(id, org_id) on delete cascade
);
create index if not exists community_team_members_user on campus.community_team_members (user_id, status);

-- Membership checks for policies (security definer: no recursion through RLS).
create or replace function campus.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from campus.community_team_members m
                  where m.team_id = p_team and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function campus.is_team_lead(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from campus.community_team_members m
                  where m.team_id = p_team and m.user_id = auth.uid() and m.status = 'active' and m.role = 'lead');
$$;
revoke all on function campus.is_team_member(uuid) from public, anon;
revoke all on function campus.is_team_lead(uuid) from public, anon;
grant execute on function campus.is_team_member(uuid) to authenticated, service_role;
grant execute on function campus.is_team_lead(uuid) to authenticated, service_role;

alter table campus.community_teams enable row level security;
drop policy if exists team_select on campus.community_teams;
create policy team_select on campus.community_teams for select to authenticated
  using (campus.is_org_member(org_id));
drop policy if exists team_insert on campus.community_teams;
create policy team_insert on campus.community_teams for insert to authenticated
  with check (campus.is_org_member(org_id) and created_by = auth.uid());
drop policy if exists team_update on campus.community_teams;
create policy team_update on campus.community_teams for update to authenticated
  using (campus.is_org_member(org_id) and (campus.is_team_lead(id) or campus.has_org_permission(org_id, 'community.moderate')))
  with check (campus.is_org_member(org_id) and (campus.is_team_lead(id) or campus.has_org_permission(org_id, 'community.moderate')));
drop policy if exists team_delete on campus.community_teams;
create policy team_delete on campus.community_teams for delete to authenticated
  using (campus.is_team_lead(id) or campus.has_org_permission(org_id, 'community.moderate'));
grant select, insert, update, delete on campus.community_teams to authenticated;
grant all on campus.community_teams to service_role;

alter table campus.community_team_members enable row level security;
-- The college sees who is on a team; a request is seen by the person asking and the lead.
drop policy if exists team_member_select on campus.community_team_members;
create policy team_member_select on campus.community_team_members for select to authenticated
  using (campus.is_org_member(org_id) and (status = 'active' or user_id = auth.uid() or campus.is_team_lead(team_id)));
-- Anyone in the college may ask to join (as themselves, as a plain request).
drop policy if exists team_member_request on campus.community_team_members;
create policy team_member_request on campus.community_team_members for insert to authenticated
  with check (user_id = auth.uid() and campus.is_org_member(org_id) and status = 'requested' and role = 'member');
-- The lead accepts requests.
drop policy if exists team_member_accept on campus.community_team_members;
create policy team_member_accept on campus.community_team_members for update to authenticated
  using (campus.is_team_lead(team_id))
  with check (campus.is_team_lead(team_id));
-- Leave or withdraw yourself; the lead removes or declines; moderators remove anyone.
drop policy if exists team_member_delete on campus.community_team_members;
create policy team_member_delete on campus.community_team_members for delete to authenticated
  using (user_id = auth.uid() or campus.is_team_lead(team_id) or campus.has_org_permission(org_id, 'community.moderate'));
grant select, insert, update, delete on campus.community_team_members to authenticated;
grant all on campus.community_team_members to service_role;

-- Teams: who created it can't be rewritten, and the creator becomes its lead.
create or replace function campus.guard_community_team() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.org_id <> old.org_id or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
      raise exception 'A team''s college and creator can''t be changed' using errcode = 'check_violation';
    end if;
    if new.max_members < (select count(*) from campus.community_team_members m where m.team_id = new.id and m.status = 'active') then
      raise exception 'The team already has more members than that' using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists community_teams_guard on campus.community_teams;
create trigger community_teams_guard before insert or update on campus.community_teams
  for each row execute function campus.guard_community_team();

create or replace function campus.add_team_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into campus.community_team_members (team_id, org_id, user_id, role, status, decided_at)
    values (new.id, new.org_id, new.created_by, 'lead', 'active', now());
  end if;
  return new;
end $$;
drop trigger if exists community_teams_lead on campus.community_teams;
create trigger community_teams_lead after insert on campus.community_teams
  for each row execute function campus.add_team_lead();

-- Members: only a request can become active (a lead can't promote or rewrite rows),
-- the person must belong to the college, and the team must have room and be open.
create or replace function campus.guard_community_team_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t record;
begin
  select * into t from campus.community_teams where id = new.team_id;
  if tg_op = 'INSERT' then
    if not exists (select 1 from campus.org_memberships m where m.org_id = new.org_id and m.user_id = new.user_id and m.status = 'active') then
      raise exception 'Only people in this college can join its teams' using errcode = 'check_violation';
    end if;
    if new.status = 'requested' and t.status in ('shipped', 'archived') then
      raise exception 'This team isn''t taking new members' using errcode = 'check_violation';
    end if;
  elsif pg_trigger_depth() = 1 then   -- deeper = our own hand-over to a new lead
    if new.team_id <> old.team_id or new.org_id <> old.org_id or new.user_id <> old.user_id
       or new.role <> old.role or new.created_at <> old.created_at or new.message is distinct from old.message then
      raise exception 'Only a request''s status can change' using errcode = 'check_violation';
    end if;
    if old.status = 'active' and new.status <> 'active' then
      raise exception 'Remove the member instead' using errcode = 'check_violation';
    end if;
    if old.status = 'requested' and new.status = 'active' then
      new.decided_at := now();
    end if;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active')
     and (select count(*) from campus.community_team_members m where m.team_id = new.team_id and m.status = 'active') >= t.max_members then
    raise exception 'This team is full' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists community_team_members_guard on campus.community_team_members;
create trigger community_team_members_guard before insert or update on campus.community_team_members
  for each row execute function campus.guard_community_team_member();

-- A lead who leaves hands over to the longest-standing member; the last one out archives the team.
create or replace function campus.after_team_member_left() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  next_lead uuid;
begin
  -- The whole team is being deleted: nothing to hand over.
  if not exists (select 1 from campus.community_teams where id = old.team_id) then return old; end if;
  if old.status = 'active' and old.role = 'lead' then
    select m.user_id into next_lead from campus.community_team_members m
     where m.team_id = old.team_id and m.status = 'active'
     order by m.decided_at nulls last, m.created_at limit 1;
    if next_lead is not null then
      update campus.community_team_members set role = 'lead' where team_id = old.team_id and user_id = next_lead;
    else
      update campus.community_teams set status = 'archived' where id = old.team_id;
      delete from campus.community_team_members where team_id = old.team_id and status = 'requested';
    end if;
  end if;
  return old;
end $$;
drop trigger if exists community_team_members_left on campus.community_team_members;
create trigger community_team_members_left after delete on campus.community_team_members
  for each row execute function campus.after_team_member_left();

-- ── Threads and replies ─────────────────────────────────────────────────────
create table if not exists campus.community_threads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references campus.organizations(id) on delete cascade,
  team_id          uuid,                                  -- null = the whole college
  author_id        uuid references public.users(id) on delete set null,
  kind             text not null default 'doubt' check (kind in ('doubt', 'discussion')),
  title            text not null check (length(trim(title)) between 3 and 200),
  body             text not null check (length(trim(body)) between 1 and 20000),
  problem_id       uuid references public.problems(id) on delete set null,
  course_id        uuid references public.courses(id) on delete set null,
  tags             text[] not null default '{}' check (cardinality(tags) <= 10),
  solved_post_id   uuid,                                  -- the reply that answered a doubt
  is_pinned        boolean not null default false,
  is_hidden        boolean not null default false,       -- moderators
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  last_activity_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (team_id, org_id) references campus.community_teams(id, org_id) on delete cascade
);
create index if not exists community_threads_feed on campus.community_threads (org_id, last_activity_at desc) where team_id is null;
create index if not exists community_threads_team on campus.community_threads (team_id, last_activity_at desc) where team_id is not null;
create index if not exists community_threads_problem on campus.community_threads (org_id, problem_id) where problem_id is not null;

create table if not exists campus.community_posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null,
  org_id     uuid not null,
  author_id  uuid references public.users(id) on delete set null,
  body       text not null check (length(trim(body)) between 1 and 20000),
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  unique (id, thread_id),
  foreign key (thread_id, org_id) references campus.community_threads(id, org_id) on delete cascade
);
create index if not exists community_posts_thread on campus.community_posts (thread_id, created_at);

-- Who may read a thread: the college (or the team, for team threads); hidden ones only
-- their author and moderators. Moderators also see team threads (to handle reports).
create or replace function campus.can_read_thread(p_org uuid, p_team uuid, p_author uuid, p_hidden boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select campus.is_org_member(p_org)
     and (p_team is null or campus.is_team_member(p_team) or campus.has_org_permission(p_org, 'community.moderate'))
     and (not p_hidden or p_author = auth.uid() or campus.has_org_permission(p_org, 'community.moderate'));
$$;
revoke all on function campus.can_read_thread(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function campus.can_read_thread(uuid, uuid, uuid, boolean) to authenticated, service_role;

alter table campus.community_threads enable row level security;
drop policy if exists thread_select on campus.community_threads;
create policy thread_select on campus.community_threads for select to authenticated
  using (campus.can_read_thread(org_id, team_id, author_id, is_hidden));
drop policy if exists thread_insert on campus.community_threads;
create policy thread_insert on campus.community_threads for insert to authenticated
  with check (author_id = auth.uid() and campus.is_org_member(org_id)
              and (team_id is null or campus.is_team_member(team_id))
              and not is_hidden and not is_pinned);
drop policy if exists thread_update on campus.community_threads;
create policy thread_update on campus.community_threads for update to authenticated
  using (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')))
  with check (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')));
drop policy if exists thread_delete on campus.community_threads;
create policy thread_delete on campus.community_threads for delete to authenticated
  using (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')));
grant select, insert, update, delete on campus.community_threads to authenticated;
grant all on campus.community_threads to service_role;

alter table campus.community_posts enable row level security;
-- A reply is readable where its thread is (RLS on threads applies inside the subquery).
drop policy if exists post_select on campus.community_posts;
create policy post_select on campus.community_posts for select to authenticated
  using (exists (select 1 from campus.community_threads t where t.id = thread_id)
         and (not is_hidden or author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')));
drop policy if exists post_insert on campus.community_posts;
create policy post_insert on campus.community_posts for insert to authenticated
  with check (author_id = auth.uid() and not is_hidden
              and exists (select 1 from campus.community_threads t where t.id = thread_id and not t.is_hidden));
drop policy if exists post_update on campus.community_posts;
create policy post_update on campus.community_posts for update to authenticated
  using (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')))
  with check (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')));
drop policy if exists post_delete on campus.community_posts;
create policy post_delete on campus.community_posts for delete to authenticated
  using (campus.is_org_member(org_id) and (author_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate')));
grant select, insert, update, delete on campus.community_posts to authenticated;
grant all on campus.community_posts to service_role;

-- Threads: authors edit their words and pick the answer; moderators hide and pin.
-- A doubt can point at a problem or course the college can use.
create or replace function campus.guard_community_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_mod boolean := campus.has_org_permission(new.org_id, 'community.moderate');
  is_author boolean := new.author_id is not distinct from auth.uid();
  is_system boolean := auth.uid() is null or pg_trigger_depth() > 1;  -- our own triggers
begin
  if tg_op = 'UPDATE' then
    if new.org_id <> old.org_id or new.team_id is distinct from old.team_id or new.author_id is distinct from old.author_id
       or new.created_at <> old.created_at then
      raise exception 'A thread''s college, team and author can''t be changed' using errcode = 'check_violation';
    end if;
    if not is_system and not is_mod and (new.is_hidden <> old.is_hidden or new.is_pinned <> old.is_pinned) then
      raise exception 'Only moderators can hide or pin threads' using errcode = 'insufficient_privilege';
    end if;
    if not is_system and not is_author and (new.title <> old.title or new.body <> old.body or new.tags <> old.tags or new.kind <> old.kind
       or new.problem_id is distinct from old.problem_id or new.course_id is distinct from old.course_id
       or new.solved_post_id is distinct from old.solved_post_id) then
      raise exception 'Only the author can edit a thread' using errcode = 'insufficient_privilege';
    end if;
    if new.title <> old.title or new.body <> old.body then new.edited_at := now(); end if;
  end if;
  if new.problem_id is not null and (tg_op = 'INSERT' or new.problem_id is distinct from old.problem_id) and not exists (
    select 1 from public.problems p where p.id = new.problem_id and p.deleted_at is null
      and (p.owner_org_id = new.org_id or (p.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and p.visibility = 'public'))
  ) then
    raise exception 'That problem is not available to this college' using errcode = 'check_violation';
  end if;
  if new.course_id is not null and (tg_op = 'INSERT' or new.course_id is distinct from old.course_id) and not exists (
    select 1 from public.courses c where c.id = new.course_id and c.deleted_at is null
      and (c.owner_org_id = new.org_id or (c.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and c.visibility = 'public'))
  ) then
    raise exception 'That course is not available to this college' using errcode = 'check_violation';
  end if;
  if new.solved_post_id is not null and (tg_op = 'INSERT' or new.solved_post_id is distinct from old.solved_post_id)
     and not exists (select 1 from campus.community_posts p where p.id = new.solved_post_id and p.thread_id = new.id) then
    raise exception 'The answer must be a reply in this thread' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists community_threads_guard on campus.community_threads;
create trigger community_threads_guard before insert or update on campus.community_threads
  for each row execute function campus.guard_community_thread();

create or replace function campus.guard_community_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_mod boolean := campus.has_org_permission(new.org_id, 'community.moderate');
  is_system boolean := auth.uid() is null or pg_trigger_depth() > 1;  -- our own triggers
begin
  if tg_op = 'UPDATE' then
    if new.thread_id <> old.thread_id or new.org_id <> old.org_id or new.author_id is distinct from old.author_id
       or new.created_at <> old.created_at then
      raise exception 'A reply''s thread and author can''t be changed' using errcode = 'check_violation';
    end if;
    if not is_system and not is_mod and new.is_hidden <> old.is_hidden then
      raise exception 'Only moderators can hide replies' using errcode = 'insufficient_privilege';
    end if;
    if not is_system and new.author_id is distinct from auth.uid() and new.body <> old.body then
      raise exception 'Only the author can edit a reply' using errcode = 'insufficient_privilege';
    end if;
    if new.body <> old.body then new.edited_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists community_posts_guard on campus.community_posts;
create trigger community_posts_guard before insert or update on campus.community_posts
  for each row execute function campus.guard_community_post();

-- New replies bring a thread back to the top; a removed answer stops being "the answer".
create or replace function campus.after_community_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update campus.community_threads set last_activity_at = now() where id = new.thread_id;
    return new;
  end if;
  update campus.community_threads set solved_post_id = null where id = old.thread_id and solved_post_id = old.id;
  return old;
end $$;
drop trigger if exists community_posts_after on campus.community_posts;
create trigger community_posts_after after insert or delete on campus.community_posts
  for each row execute function campus.after_community_post();

-- ── Reports ─────────────────────────────────────────────────────────────────
create table if not exists campus.community_reports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references campus.organizations(id) on delete cascade,
  thread_id   uuid references campus.community_threads(id) on delete cascade,
  post_id     uuid references campus.community_posts(id) on delete cascade,
  reporter_id uuid references public.users(id) on delete set null,
  reason      text not null check (length(trim(reason)) between 3 and 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  check ((thread_id is null) <> (post_id is null))
);
create index if not exists community_reports_open on campus.community_reports (org_id, created_at desc) where resolved_at is null;
create unique index if not exists community_reports_once on campus.community_reports (reporter_id, coalesce(thread_id, post_id)) where resolved_at is null;
alter table campus.community_reports enable row level security;
-- Report only what you can read, as yourself, in that thing's college.
drop policy if exists report_insert on campus.community_reports;
create policy report_insert on campus.community_reports for insert to authenticated
  with check (reporter_id = auth.uid() and resolved_at is null and (
    (thread_id is not null and exists (select 1 from campus.community_threads t where t.id = thread_id and t.org_id = community_reports.org_id))
    or (post_id is not null and exists (select 1 from campus.community_posts p where p.id = post_id and p.org_id = community_reports.org_id))));
drop policy if exists report_select on campus.community_reports;
create policy report_select on campus.community_reports for select to authenticated
  using (reporter_id = auth.uid() or campus.has_org_permission(org_id, 'community.moderate'));
drop policy if exists report_resolve on campus.community_reports;
create policy report_resolve on campus.community_reports for update to authenticated
  using (campus.has_org_permission(org_id, 'community.moderate'))
  with check (campus.has_org_permission(org_id, 'community.moderate'));
grant select, insert, update on campus.community_reports to authenticated;
grant all on campus.community_reports to service_role;

revoke all on function campus.guard_community_team() from public, anon, authenticated;
revoke all on function campus.add_team_lead() from public, anon, authenticated;
revoke all on function campus.guard_community_team_member() from public, anon, authenticated;
revoke all on function campus.after_team_member_left() from public, anon, authenticated;
revoke all on function campus.guard_community_thread() from public, anon, authenticated;
revoke all on function campus.guard_community_post() from public, anon, authenticated;
revoke all on function campus.after_community_post() from public, anon, authenticated;

-- Moderation is a staff action: keep a record.
drop trigger if exists audit_row on campus.community_reports;
create trigger audit_row after insert or update or delete on campus.community_reports
  for each row execute function campus.audit_row();
