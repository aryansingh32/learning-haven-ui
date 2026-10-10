-- =============================================================================
-- Account & profile (slice W2-A1)
--
-- * public.account_events: a learner's account log (sign-ins with device and IP,
--   sign-outs, sessions revoked, password changed, verification email sent,
--   portfolio published/unpublished). Written by the Forge API only; learners
--   read their own. Append-only (rows go away only with the account).
-- * Read/revoke helpers over Supabase Auth (auth.users, auth.sessions,
--   auth.audit_log_entries), service role only, always scoped to one user id:
--   account_auth_info, account_sessions, revoke_account_sessions,
--   account_audit_history. Deleting a row of auth.sessions is what Supabase's
--   own sign-out does: its refresh tokens go with it (FK on delete cascade),
--   so the refresh token can no longer be used.
-- * public.user_skills: self-declared skills with a level, own rows only.
-- * public.learner_portfolios: an opt-in public portfolio at /u/<handle>
--   (off by default, publishing needs a verified email, chosen items must be
--   the owner's). public.public_portfolio(handle) builds the public view
--   (no email, phone or ids of other rows); public.skill_evidence(user) lists
--   skills shown by judge-accepted solves, certificates and finished projects.
--
-- Additive. Functions that read auth.* or optional tables are plpgsql so they
-- load before those exist. Tested by supabase/tests/account_profile.sql.
-- =============================================================================

-- ── Account log ─────────────────────────────────────────────────────────────
create table if not exists public.account_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null check (kind in ('sign_in', 'sign_out', 'session_revoked', 'other_sessions_revoked',
                                            'password_changed', 'verification_email_sent',
                                            'portfolio_published', 'portfolio_unpublished')),
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  session_id  uuid,
  ip          text check (ip is null or length(ip) <= 64),
  user_agent  text check (user_agent is null or length(user_agent) <= 512),
  details     jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and length(details::text) <= 2000)
);
create index if not exists account_events_user on public.account_events (user_id, occurred_at desc);
-- One sign-in row per Supabase session (the API records it the first time it sees the session).
create unique index if not exists account_events_one_sign_in on public.account_events (session_id) where kind = 'sign_in';

alter table public.account_events enable row level security;
drop policy if exists "Users read own account events" on public.account_events;
create policy "Users read own account events" on public.account_events for select to authenticated
  using (user_id = auth.uid());
revoke all on public.account_events from authenticated, anon;
grant select on public.account_events to authenticated;
grant all on public.account_events to service_role;

create or replace function public.account_events_append_only() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Account events cannot be changed' using errcode = 'check_violation';
end $$;
drop trigger if exists account_events_append_only on public.account_events;
create trigger account_events_append_only before update on public.account_events
  for each row execute function public.account_events_append_only();

-- ── Supabase Auth helpers (service role only, one user at a time) ───────────
create or replace function public.account_auth_info(p_user uuid)
returns table (email text, email_confirmed_at timestamptz, created_at timestamptz, last_sign_in_at timestamptz,
               providers text[], has_password boolean, pending_email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select u.email::text, u.email_confirmed_at, u.created_at, u.last_sign_in_at,
         coalesce(array(select jsonb_array_elements_text(coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb))), '{}'::text[]),
         coalesce(u.encrypted_password, '') <> '',
         nullif(u.email_change, '')::text
    from auth.users u
   where u.id = p_user;
end $$;

-- Live sessions of one user, newest activity first. refreshed_at is a timestamp
-- without time zone in Supabase Auth (written in UTC).
create or replace function public.account_sessions(p_user uuid)
returns table (id uuid, created_at timestamptz, updated_at timestamptz, refreshed_at timestamptz,
               not_after timestamptz, aal text, user_agent text, ip text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select s.id, s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC', s.not_after, s.aal::text, s.user_agent::text, host(s.ip)
    from auth.sessions s
   where s.user_id = p_user
     and (s.not_after is null or s.not_after > now())
   order by greatest(s.created_at, s.updated_at, coalesce(s.refreshed_at at time zone 'UTC', s.created_at)) desc;
end $$;

-- Signs out sessions of p_user: one (p_session), or all but one (p_keep), or all.
-- A session id of another user matches nothing. Returns the ids removed.
create or replace function public.revoke_account_sessions(p_user uuid, p_session uuid, p_keep uuid)
returns setof uuid
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_user is null then
    raise exception 'A user is required' using errcode = 'check_violation';
  end if;
  return query
  delete from auth.sessions s
   where s.user_id = p_user
     and (p_session is null or s.id = p_session)
     and (p_keep is null or s.id <> p_keep)
  returning s.id;
end $$;

-- Account actions from Supabase Auth's own audit log (history from before the
-- API kept account_events). Empty when the project keeps no audit log in the DB.
create or replace function public.account_audit_history(p_user uuid, p_before timestamptz, p_limit integer)
returns table (at timestamptz, action text, provider text, ip text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if to_regclass('auth.audit_log_entries') is null then return; end if;
  return query
  select a.created_at, a.payload ->> 'action', a.payload -> 'traits' ->> 'provider', nullif(a.ip_address, '')::text
    from auth.audit_log_entries a
   where a.payload ->> 'actor_id' = p_user::text
     and a.payload ->> 'action' in ('login', 'logout', 'user_signedup', 'user_updated_password', 'user_recovery_requested',
                                    'user_confirmation_requested', 'user_modified', 'user_invited')
     and (p_before is null or a.created_at < p_before)
   order by a.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

revoke all on function public.account_auth_info(uuid) from public, anon, authenticated;
revoke all on function public.account_sessions(uuid) from public, anon, authenticated;
revoke all on function public.revoke_account_sessions(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.account_audit_history(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.account_auth_info(uuid) to service_role;
grant execute on function public.account_sessions(uuid) to service_role;
grant execute on function public.revoke_account_sessions(uuid, uuid, uuid) to service_role;
grant execute on function public.account_audit_history(uuid, timestamptz, integer) to service_role;

-- ── Skills profile ──────────────────────────────────────────────────────────
create table if not exists public.user_skills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null check (name = btrim(name) and length(name) between 1 and 40 and name !~ '[<>{}\r\n\t]'),
  level      text not null check (level in ('beginner', 'intermediate', 'advanced', 'expert')),
  category   text check (category is null or category in ('language', 'framework', 'tool', 'concept', 'soft')),
  sort_order smallint not null default 0 check (sort_order between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists user_skills_one_name on public.user_skills (user_id, lower(name));

alter table public.user_skills enable row level security;
drop policy if exists "Users manage own skills" on public.user_skills;
create policy "Users manage own skills" on public.user_skills for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_skills from authenticated, anon;
grant select, insert, update, delete on public.user_skills to authenticated;
grant all on public.user_skills to service_role;

-- At most 30 skills each.
create or replace function public.user_skills_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.user_skills where user_id = new.user_id) >= 30 then
    raise exception 'A skills profile holds at most 30 skills' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists user_skills_limit on public.user_skills;
create trigger user_skills_limit before insert on public.user_skills
  for each row execute function public.user_skills_limit();

-- ── Public portfolio ────────────────────────────────────────────────────────
create or replace function public.portfolio_refs_ok(p_refs text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(r ~ '^(topic|apprenticeship|program):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'), true)
    from unnest(p_refs) r;
$$;

create table if not exists public.learner_portfolios (
  user_id          uuid primary key references public.users(id) on delete cascade,
  handle           text not null check (handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and handle !~ '--'
                                         and handle not in ('admin', 'api', 'forge', 'support', 'help', 'root', 'system', 'settings',
                                                            'staff', 'campus', 'official', 'null', 'undefined', 'www', 'team')),
  is_public        boolean not null default false,
  headline         text check (headline is null or length(headline) <= 120),
  bio              text check (bio is null or length(bio) <= 600),
  show_college     boolean not null default false,
  show_skills      boolean not null default true,
  show_evidence    boolean not null default true,
  show_repo_links  boolean not null default false,
  certificate_refs text[] not null default '{}' check (cardinality(certificate_refs) <= 30 and public.portfolio_refs_ok(certificate_refs)),
  project_ids      uuid[] not null default '{}' check (cardinality(project_ids) <= 20),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists learner_portfolios_handle on public.learner_portfolios (handle);

alter table public.learner_portfolios enable row level security;
drop policy if exists "Users manage own portfolio" on public.learner_portfolios;
create policy "Users manage own portfolio" on public.learner_portfolios for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.learner_portfolios from authenticated, anon;
grant select, insert, update, delete on public.learner_portfolios to authenticated;
grant all on public.learner_portfolios to service_role;

-- Publishing needs a verified email; everything chosen must belong to the owner.
create or replace function public.learner_portfolio_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bad integer;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'A portfolio cannot change owner' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  if new.is_public then
    if not exists (select 1 from auth.users u where u.id = new.user_id and u.email_confirmed_at is not null) then
      raise exception 'Verify your email before publishing a portfolio' using errcode = 'check_violation';
    end if;
    if tg_op = 'INSERT' or not old.is_public then new.published_at := now(); end if;
  else
    new.published_at := null;
  end if;

  if not public.portfolio_refs_ok(new.certificate_refs) then
    raise exception 'Unknown certificate reference' using errcode = 'check_violation';
  end if;
  select count(*) into v_bad from unnest(new.project_ids) pid
   where not exists (select 1 from public.build_enrollments b where b.id = pid and b.user_id = new.user_id and b.deleted_at is null);
  if v_bad > 0 then
    raise exception 'Only your own projects can be shown' using errcode = 'check_violation';
  end if;
  select count(*) into v_bad from unnest(new.certificate_refs) r
   where not case split_part(r, ':', 1)
     when 'topic' then exists (select 1 from public.certificates c where c.id = split_part(r, ':', 2)::uuid and c.user_id = new.user_id)
     when 'apprenticeship' then exists (select 1 from public.apprenticeship_certificates c where c.id = split_part(r, ':', 2)::uuid and c.user_id = new.user_id)
     when 'program' then exists (select 1 from public.program_certificates c where c.id = split_part(r, ':', 2)::uuid and c.user_id = new.user_id
                                   and c.status = 'issued' and c.revoked_at is null)
     else false end;
  if v_bad > 0 then
    raise exception 'Only your own certificates can be shown' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists learner_portfolio_guard on public.learner_portfolios;
create trigger learner_portfolio_guard before insert or update on public.learner_portfolios
  for each row execute function public.learner_portfolio_guard();

-- Skills shown by what a learner did on Forge: judge-accepted solves per topic
-- (once problem_submissions exists), certificates, and finished build projects.
create or replace function public.skill_evidence(p_user uuid)
returns table (skill text, source text, detail text, amount integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if to_regclass('public.problem_submissions') is not null then
    return query execute
      'select pr.topic, ''practice''::text, null::text, count(distinct ps.problem_id)::integer
         from public.problem_submissions ps join public.problems pr on pr.id = ps.problem_id
        where ps.user_id = $1 and ps.verdict = ''Accepted'' and pr.deleted_at is null
        group by pr.topic' using p_user;
  end if;
  return query select c.topic, 'certificate'::text, c.verification_code, 1 from public.certificates c where c.user_id = p_user;
  return query select ap.title, 'certificate'::text, c.verification_code, 1
    from public.apprenticeship_certificates c join public.apprenticeship_programs ap on ap.id = c.program_id where c.user_id = p_user;
  return query select pg.title, 'certificate'::text, c.certificate_code, 1
    from public.program_certificates c join public.programs pg on pg.id = c.program_id
   where c.user_id = p_user and c.status = 'issued' and c.revoked_at is null;
  return query select b.language, 'project'::text, ap.title, 1
    from public.build_enrollments b join public.apprenticeship_programs ap on ap.id = b.program_id
   where b.user_id = p_user and b.status = 'completed' and b.deleted_at is null;
end $$;

-- The public view of a published portfolio, or null. Never includes email,
-- phone or anything the learner did not choose (evidence is practice only:
-- certificates and projects appear only when picked).
create or replace function public.public_portfolio(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.learner_portfolios;
  u record;
begin
  select * into p from public.learner_portfolios where handle = lower(btrim(p_handle)) and is_public;
  if not found then return null; end if;
  select x.full_name, x.avatar_url, x.college_name, x.deleted_at, x.is_banned into u from public.users x where x.id = p.user_id;
  if not found or u.deleted_at is not null or coalesce(u.is_banned, false) then return null; end if;

  return jsonb_build_object(
    'handle', p.handle,
    'name', u.full_name,
    'avatar_url', u.avatar_url,
    'headline', p.headline,
    'bio', p.bio,
    'college', case when p.show_college then u.college_name end,
    'published_at', p.published_at,
    'certificates', coalesce((
      select jsonb_agg(c.item order by c.issued_at desc) from (
        select jsonb_build_object('kind', 'topic', 'title', t.topic, 'issued_at', t.issued_at, 'code', t.verification_code) item, t.issued_at
          from public.certificates t where t.user_id = p.user_id and ('topic:' || t.id) = any (p.certificate_refs)
        union all
        select jsonb_build_object('kind', 'apprenticeship', 'title', ap.title, 'issued_at', a.issued_at, 'code', a.verification_code, 'grade', a.final_grade), a.issued_at
          from public.apprenticeship_certificates a join public.apprenticeship_programs ap on ap.id = a.program_id
         where a.user_id = p.user_id and ('apprenticeship:' || a.id) = any (p.certificate_refs)
        union all
        select jsonb_build_object('kind', 'program', 'title', pg.title, 'issued_at', pc.issued_at, 'code', pc.certificate_code), pc.issued_at
          from public.program_certificates pc join public.programs pg on pg.id = pc.program_id
         where pc.user_id = p.user_id and pc.status = 'issued' and pc.revoked_at is null and ('program:' || pc.id) = any (p.certificate_refs)
      ) c), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', ap.title, 'slug', ap.slug, 'tagline', ap.short_tagline, 'language', b.language, 'status', b.status,
               'stages_done', coalesce(cardinality(b.completed_stages), 0), 'stages_total', b.total_stages,
               'completed_at', b.completed_at,
               'repo_url', case when p.show_repo_links and b.repo_url ~ '^https://github\.com/' then b.repo_url end)
             order by array_position(p.project_ids, b.id))
        from public.build_enrollments b join public.apprenticeship_programs ap on ap.id = b.program_id
       where b.user_id = p.user_id and b.deleted_at is null and b.id = any (p.project_ids)), '[]'::jsonb),
    'skills', case when p.show_skills then coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'level', s.level, 'category', s.category) order by s.sort_order, s.name)
        from public.user_skills s where s.user_id = p.user_id), '[]'::jsonb) else '[]'::jsonb end,
    'evidence', case when p.show_evidence then coalesce((
      select jsonb_agg(jsonb_build_object('skill', e.skill, 'source', e.source, 'amount', e.amount) order by e.source, e.amount desc, e.skill)
        from public.skill_evidence(p.user_id) e where e.source = 'practice'), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

revoke all on function public.skill_evidence(uuid) from public, anon, authenticated;
revoke all on function public.public_portfolio(text) from public, anon, authenticated;
grant execute on function public.skill_evidence(uuid) to service_role;
grant execute on function public.public_portfolio(text) to service_role;
