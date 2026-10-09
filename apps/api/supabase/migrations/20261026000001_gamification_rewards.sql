-- =============================================================================
-- Gamification rewards: weekly missions, milestones, leaderboard (slice W2-G1)
--
-- * public.gamification_rewards: one row per reward a learner has earned
--   (a weekly mission, a milestone, a daily-quest bonus), unique per
--   (user_id, reward_key), so a reward can be claimed only once. XP is paid by
--   public.pay_gamification_reward, which marks the row paid in the same
--   transaction, so it can never be paid twice. Rewards that would go over the
--   daily XP limit stay 'pending' and are paid on a later (India) day.
--   Written only by the Forge API; learners read their own rows.
-- * public.xp_week_start: each learner's XP when the India week began, so the
--   weekly leaderboard ranks XP earned this week. Filled by
--   public.snapshot_week_xp (weekly cron, or the first leaderboard view).
-- * users.leaderboard_hidden: a learner's opt-out from the public leaderboards.
-- * Learners can no longer write user_problem_status straight from the browser
--   (solves feed milestones and missions; the API, with the service role,
--   records them after judging).
--
-- Additive. Tested by supabase/tests/gamification.sql.
-- =============================================================================

create table if not exists public.gamification_rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reward_key  text not null check (reward_key ~ '^[a-z0-9_:.-]{3,80}$'),
  kind        text not null check (kind in ('weekly_mission', 'milestone', 'daily_quest')),
  xp          integer not null check (xp between 0 and 1000),
  badge_id    text check (badge_id is null or badge_id ~ '^[a-z0-9_]{3,60}$'),
  status      text not null default 'pending' check (status in ('pending', 'paid')),
  claimed_at  timestamptz not null default now(),
  paid_at     timestamptz,
  paid_day    date,
  unique (user_id, reward_key),
  constraint gamification_rewards_paid_shape check ((status = 'paid') = (paid_at is not null and paid_day is not null))
);
create index if not exists gamification_rewards_user_day on public.gamification_rewards (user_id, paid_day) where status = 'paid';
create index if not exists gamification_rewards_pending on public.gamification_rewards (user_id, claimed_at) where status = 'pending';

alter table public.gamification_rewards enable row level security;
drop policy if exists "Users read own rewards" on public.gamification_rewards;
create policy "Users read own rewards" on public.gamification_rewards for select to authenticated using (user_id = auth.uid());
revoke all on public.gamification_rewards from authenticated, anon;
grant select on public.gamification_rewards to authenticated;
grant all on public.gamification_rewards to service_role;

create table if not exists public.xp_week_start (
  user_id    uuid not null references public.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  xp         integer not null check (xp >= 0),
  primary key (user_id, week_start)
);
alter table public.xp_week_start enable row level security;
revoke all on public.xp_week_start from authenticated, anon;
grant all on public.xp_week_start to service_role;

alter table public.users add column if not exists leaderboard_hidden boolean not null default false;

-- Solves are recorded by the API (service role) after the judge accepts, or for
-- problems the judge can't check yet. The browser only reads its own rows.
drop policy if exists "Users can insert their own problem status" on public.user_problem_status;
drop policy if exists "Users can update their own problem status" on public.user_problem_status;
revoke insert, update, delete on public.user_problem_status from authenticated, anon;

-- Pays one earned reward. Locks the learner, then the reward; pays only a pending
-- reward, and only while today's (India) paid reward XP stays within p_daily_cap
-- (the first reward of a day is always paid, so one big reward can't get stuck).
-- Returns 'paid', 'already_paid', 'capped' or 'missing'.
create or replace function public.pay_gamification_reward(p_user uuid, p_reward_key text, p_daily_cap integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.gamification_rewards%rowtype;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_spent  integer;
begin
  perform 1 from public.users where id = p_user for update;
  if not found then return 'missing'; end if;

  select * into v_reward from public.gamification_rewards
   where user_id = p_user and reward_key = p_reward_key
   for update;
  if not found then return 'missing'; end if;
  if v_reward.status = 'paid' then return 'already_paid'; end if;

  if v_reward.xp > 0 then
    select coalesce(sum(xp), 0) into v_spent from public.gamification_rewards
     where user_id = p_user and status = 'paid' and paid_day = v_today;
    if p_daily_cap is not null and p_daily_cap > 0 and v_spent > 0 and v_spent + v_reward.xp > p_daily_cap then
      return 'capped';
    end if;

    -- The XP ledger (20260823000001_xp_ledger) records the award when it is installed;
    -- the reward row above already makes the payment happen once either way.
    if to_regprocedure('public.increment_xp(uuid,integer,text,text,jsonb)') is not null then
      execute 'select public.increment_xp($1, $2, $3, $4, $5)'
        using p_user, v_reward.xp, 'gamification', 'gamify:' || p_user::text || ':' || p_reward_key,
              jsonb_build_object('reward_key', p_reward_key, 'kind', v_reward.kind);
    else
      update public.users set xp = coalesce(xp, 0) + v_reward.xp where id = p_user;
    end if;
  end if;

  update public.gamification_rewards set status = 'paid', paid_at = now(), paid_day = v_today where id = v_reward.id;
  return 'paid';
end $$;

-- Records an earned reward (once) and its badge (once), then tries to pay it.
create or replace function public.grant_gamification_reward(
  p_user uuid, p_reward_key text, p_kind text, p_xp integer,
  p_badge_id text, p_badge_name text, p_badge_emoji text, p_daily_cap integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gamification_rewards (user_id, reward_key, kind, xp, badge_id)
  values (p_user, p_reward_key, p_kind, p_xp, p_badge_id)
  on conflict (user_id, reward_key) do nothing;

  if p_badge_id is not null then
    insert into public.user_badges (user_id, badge_id, badge_name, badge_emoji)
    values (p_user, p_badge_id, p_badge_name, p_badge_emoji)
    on conflict (user_id, badge_id) do nothing;
  end if;

  return public.pay_gamification_reward(p_user, p_reward_key, p_daily_cap);
end $$;

-- Records every learner's XP at the start of an India week (once per learner per week)
-- and forgets weeks older than eight weeks. Learners who join later start from 0.
create or replace function public.snapshot_week_xp(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week must start on a Monday' using errcode = '22023';
  end if;
  insert into public.xp_week_start (user_id, week_start, xp)
  select id, p_week_start, greatest(coalesce(xp, 0), 0) from public.users
  on conflict (user_id, week_start) do nothing;
  get diagnostics n = row_count;
  delete from public.xp_week_start where week_start < p_week_start - 56;
  return n;
end $$;

revoke all on function public.pay_gamification_reward(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.grant_gamification_reward(uuid, text, text, integer, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.snapshot_week_xp(date) from public, anon, authenticated;
grant execute on function public.pay_gamification_reward(uuid, text, integer) to service_role;
grant execute on function public.grant_gamification_reward(uuid, text, text, integer, text, text, text, integer) to service_role;
grant execute on function public.snapshot_week_xp(date) to service_role;
