-- =============================================================================
-- Slice W2-L1 — Course discussions: a thread per chapter.
--
-- Learners who can see a course can read and post in its chapters' threads,
-- reply (one level), edit or delete their own posts, and report a post.
-- Staff (Forge admins, or the owning college's content staff) can hide posts;
-- hiding goes through the Forge API, which checks public.is_course_staff().
-- Posts are soft-deleted (deleted_at) so replies keep their thread.
-- Additive and idempotent.
-- =============================================================================

-- Can the signed-in user see this course? (Wraps the campus rule; no user id parameter,
-- so it is safe to expose to signed-in users and to use in policies.)
create or replace function public.can_see_course(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and (campus.is_platform_admin() or campus.user_can_see_course(auth.uid(), p_course));
$$;

-- Does the signed-in user moderate this course? Forge admins, or content staff of the owning college.
create or replace function public.is_course_staff(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    campus.is_platform_admin()
    or exists (
      select 1 from public.courses c
      where c.id = p_course and c.owner_org_id is not null
        and c.owner_org_id <> '00000000-0000-0000-0000-00000000f0f0'
        and 'content.create' = any(campus.user_permissions(c.owner_org_id, auth.uid()))
    )
  );
$$;

revoke all on function public.can_see_course(uuid) from public, anon;
revoke all on function public.is_course_staff(uuid) from public, anon;
grant execute on function public.can_see_course(uuid) to authenticated, service_role;
grant execute on function public.is_course_staff(uuid) to authenticated, service_role;

-- ── Posts ────────────────────────────────────────────────────────────────────
create table if not exists public.chapter_discussion_posts (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  chapter_id    uuid not null references public.chapters(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  parent_id     uuid references public.chapter_discussion_posts(id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz,
  hidden_at     timestamptz,
  hidden_by     uuid references public.users(id) on delete set null,
  hidden_reason text check (hidden_reason is null or length(hidden_reason) <= 300),
  constraint chapter_discussion_posts_not_own_parent check (parent_id is null or parent_id <> id)
);
create index if not exists chapter_discussion_posts_chapter on public.chapter_discussion_posts (chapter_id, created_at);
create index if not exists chapter_discussion_posts_parent on public.chapter_discussion_posts (parent_id);
create index if not exists chapter_discussion_posts_user on public.chapter_discussion_posts (user_id, created_at);

-- The chapter belongs to the course; a reply answers a top-level post in the same chapter;
-- a deleted post stays deleted; edits are stamped.
create or replace function public.chapter_discussion_post_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare parent record;
begin
  if tg_op = 'INSERT' or new.chapter_id is distinct from old.chapter_id or new.course_id is distinct from old.course_id then
    if not exists (select 1 from public.chapters c where c.id = new.chapter_id and c.course_id = new.course_id) then
      raise exception 'chapter does not belong to this course' using errcode = 'check_violation';
    end if;
  end if;
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    select p.chapter_id, p.parent_id, p.deleted_at into parent from public.chapter_discussion_posts p where p.id = new.parent_id;
    if not found or parent.chapter_id <> new.chapter_id or parent.parent_id is not null then
      raise exception 'a reply must answer a top-level post in the same chapter' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null and (new.deleted_at is null or new.body is distinct from old.body) then
      raise exception 'a deleted post cannot be changed' using errcode = 'check_violation';
    end if;
    if new.body is distinct from old.body then
      new.edited_at := now();
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
revoke all on function public.chapter_discussion_post_rules() from public, authenticated, anon;

drop trigger if exists chapter_discussion_post_rules on public.chapter_discussion_posts;
create trigger chapter_discussion_post_rules before insert or update on public.chapter_discussion_posts
  for each row execute function public.chapter_discussion_post_rules();

alter table public.chapter_discussion_posts enable row level security;
drop policy if exists discussion_posts_select on public.chapter_discussion_posts;
drop policy if exists discussion_posts_insert on public.chapter_discussion_posts;
drop policy if exists discussion_posts_update_own on public.chapter_discussion_posts;
-- Readers: anyone who can see the course; hidden posts only for their author and staff.
create policy discussion_posts_select on public.chapter_discussion_posts for select to authenticated
  using (public.can_see_course(course_id)
         and (hidden_at is null or user_id = auth.uid() or public.is_course_staff(course_id)));
create policy discussion_posts_insert on public.chapter_discussion_posts for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_course(course_id));
-- Authors edit or delete their own visible posts (only body and deleted_at are granted).
create policy discussion_posts_update_own on public.chapter_discussion_posts for update to authenticated
  using (user_id = auth.uid() and hidden_at is null and public.can_see_course(course_id))
  with check (user_id = auth.uid() and hidden_at is null);

revoke all on public.chapter_discussion_posts from anon, authenticated;
grant select on public.chapter_discussion_posts to authenticated;
grant insert (id, course_id, chapter_id, user_id, parent_id, body) on public.chapter_discussion_posts to authenticated;
grant update (body, deleted_at) on public.chapter_discussion_posts to authenticated;
grant all on public.chapter_discussion_posts to service_role;

-- ── Reports ──────────────────────────────────────────────────────────────────
create table if not exists public.chapter_discussion_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.chapter_discussion_posts(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason      text not null check (reason in ('spam', 'abuse', 'off_topic', 'other')),
  details     text check (details is null or length(details) <= 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  unique (post_id, reporter_id)
);
create index if not exists chapter_discussion_reports_open on public.chapter_discussion_reports (post_id) where resolved_at is null;

alter table public.chapter_discussion_reports enable row level security;
drop policy if exists discussion_reports_select on public.chapter_discussion_reports;
drop policy if exists discussion_reports_insert on public.chapter_discussion_reports;
create policy discussion_reports_select on public.chapter_discussion_reports for select to authenticated
  using (reporter_id = auth.uid() or exists (
    select 1 from public.chapter_discussion_posts p where p.id = post_id and public.is_course_staff(p.course_id)));
-- You can report a post you can see (the posts policy applies inside this check).
create policy discussion_reports_insert on public.chapter_discussion_reports for insert to authenticated
  with check (reporter_id = auth.uid()
              and exists (select 1 from public.chapter_discussion_posts p where p.id = post_id));

revoke all on public.chapter_discussion_reports from anon, authenticated;
grant select on public.chapter_discussion_reports to authenticated;
grant insert (post_id, reporter_id, reason, details) on public.chapter_discussion_reports to authenticated;
grant all on public.chapter_discussion_reports to service_role;
