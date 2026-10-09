-- =============================================================================
-- Slice W2-L1 — Learning: chapter highlights, course prerequisites, drip release.
--
-- 1. public.chapter_highlights — text a learner highlighted in a chapter's
--    text lessons. Own rows only (read, add, recolour, remove).
-- 2. public.course_prerequisites — course → required course. Server-only
--    (admins set them through the Forge API; learners see them through it).
--    Cycles are refused.
-- 3. public.courses.drip_interval_days — chapter N opens (N-1) × D days after
--    the learner started the course. Enforced by the Forge API.
-- Helpers that take a user id are server-only (service_role).
-- Additive and idempotent.
-- =============================================================================

-- ── 1. Highlights ────────────────────────────────────────────────────────────
create table if not exists public.chapter_highlights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  chapter_id   uuid not null references public.chapters(id) on delete cascade,
  step_id      uuid references public.steps(id) on delete cascade,
  text         text not null check (length(btrim(text)) between 1 and 2000),
  -- A little context on each side so the highlight can be found again in the text.
  prefix       text not null default '' check (length(prefix) <= 64),
  suffix       text not null default '' check (length(suffix) <= 64),
  start_offset integer not null default 0 check (start_offset between 0 and 1000000),
  color        text not null default 'yellow' check (color in ('yellow', 'green', 'blue', 'pink')),
  created_at   timestamptz not null default now()
);
create index if not exists chapter_highlights_user_chapter on public.chapter_highlights (user_id, chapter_id);

-- A highlight's step must belong to its chapter.
create or replace function public.chapter_highlight_step_matches() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.step_id is not null and not exists (
    select 1 from public.steps s where s.id = new.step_id and s.chapter_id = new.chapter_id
  ) then
    raise exception 'step does not belong to this chapter' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.chapter_highlight_step_matches() from public, authenticated, anon;

drop trigger if exists chapter_highlight_step_matches on public.chapter_highlights;
create trigger chapter_highlight_step_matches before insert or update of step_id, chapter_id on public.chapter_highlights
  for each row execute function public.chapter_highlight_step_matches();

alter table public.chapter_highlights enable row level security;
drop policy if exists chapter_highlights_own_select on public.chapter_highlights;
drop policy if exists chapter_highlights_own_insert on public.chapter_highlights;
drop policy if exists chapter_highlights_own_update on public.chapter_highlights;
drop policy if exists chapter_highlights_own_delete on public.chapter_highlights;
create policy chapter_highlights_own_select on public.chapter_highlights for select to authenticated
  using (user_id = auth.uid());
create policy chapter_highlights_own_insert on public.chapter_highlights for insert to authenticated
  with check (user_id = auth.uid());
create policy chapter_highlights_own_update on public.chapter_highlights for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chapter_highlights_own_delete on public.chapter_highlights for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.chapter_highlights from anon, authenticated;
grant select, delete on public.chapter_highlights to authenticated;
grant insert (chapter_id, step_id, user_id, text, prefix, suffix, start_offset, color) on public.chapter_highlights to authenticated;
grant update (color) on public.chapter_highlights to authenticated;
grant all on public.chapter_highlights to service_role;

-- ── 2. Course prerequisites ──────────────────────────────────────────────────
create table if not exists public.course_prerequisites (
  course_id          uuid not null references public.courses(id) on delete cascade,
  required_course_id uuid not null references public.courses(id) on delete cascade,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  primary key (course_id, required_course_id),
  constraint course_prerequisites_not_self check (course_id <> required_course_id)
);
create index if not exists course_prerequisites_required on public.course_prerequisites (required_course_id);

-- No chains that lead back to the course itself (A needs B needs A).
create or replace function public.course_prerequisites_no_cycle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    with recursive chain(id) as (
      select new.required_course_id
      union
      select p.required_course_id from public.course_prerequisites p join chain on p.course_id = chain.id
    )
    select 1 from chain where id = new.course_id
  ) then
    raise exception 'prerequisites would form a cycle' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.course_prerequisites_no_cycle() from public, authenticated, anon;

drop trigger if exists course_prerequisites_no_cycle on public.course_prerequisites;
create trigger course_prerequisites_no_cycle before insert or update on public.course_prerequisites
  for each row execute function public.course_prerequisites_no_cycle();

alter table public.course_prerequisites enable row level security;
revoke all on public.course_prerequisites from anon, authenticated;
grant all on public.course_prerequisites to service_role;

-- Chapters done / total in a course for one learner (a course with no chapters counts as not done).
create or replace function public.course_completion(p_user uuid, p_course uuid)
returns table (total integer, done integer)
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         count(*) filter (where exists (
           select 1 from public.user_chapter_progress p
           where p.user_id = p_user and p.chapter_id = c.id and p.status = 'COMPLETED'))::int
  from public.chapters c
  where c.course_id = p_course and coalesce(c.is_active, true);
$$;

-- The prerequisites of a course this learner has not finished yet.
create or replace function public.unmet_prerequisites(p_user uuid, p_course uuid)
returns table (course_id uuid, title text, slug text, total integer, done integer)
language sql stable security definer set search_path = '' as $$
  select r.id, r.title, r.slug, cc.total, cc.done
  from public.course_prerequisites p
  join public.courses r on r.id = p.required_course_id and r.deleted_at is null
  cross join lateral public.course_completion(p_user, r.id) cc
  where p.course_id = p_course and (cc.total = 0 or cc.done < cc.total)
  order by r.title;
$$;

-- ── 3. Drip release ──────────────────────────────────────────────────────────
alter table public.courses add column if not exists drip_interval_days integer;
do $$ begin
  alter table public.courses add constraint courses_drip_interval_days_check
    check (drip_interval_days is null or drip_interval_days between 1 and 365);
exception when duplicate_object then null; end $$;
comment on column public.courses.drip_interval_days is
  'Drip release: chapter N opens (N-1) x this many days after the learner started the course. Null = no drip.';

-- When did this learner start the course? Enrolment or the first chapter they opened, whichever came first.
create or replace function public.course_started_at(p_user uuid, p_course uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select least(
    (select e.enrolled_at from public.course_enrollments e where e.user_id = p_user and e.course_id = p_course),
    (select min(p.created_at) from public.user_chapter_progress p
       join public.chapters c on c.id = p.chapter_id
      where p.user_id = p_user and c.course_id = p_course)
  );
$$;

revoke all on function public.course_completion(uuid, uuid) from public, authenticated, anon;
revoke all on function public.unmet_prerequisites(uuid, uuid) from public, authenticated, anon;
revoke all on function public.course_started_at(uuid, uuid) from public, authenticated, anon;
grant execute on function public.course_completion(uuid, uuid) to service_role;
grant execute on function public.unmet_prerequisites(uuid, uuid) to service_role;
grant execute on function public.course_started_at(uuid, uuid) to service_role;
