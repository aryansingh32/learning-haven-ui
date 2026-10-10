-- =============================================================================
-- Course bundles (slice W2-C1)
--
-- * public.course_bundles: several courses sold together for one price (paise),
--   made in the Forge admin. Buying one gives lifetime access to every course in
--   it (course_access entitlements, one per course, linked to the payment).
-- * public.course_bundle_items: the courses in a bundle, in order. Only Forge's
--   own public courses can be bundled.
-- Learners (and visitors) read published bundles; only the Forge API writes.
-- * Fix: public.payments.plan_id was NOT NULL, so buying a single course (and now a
--   bundle) could never even record the order. A payment now has a plan or names
--   the resource it buys.
--
-- Additive. Tested by supabase/tests/course_bundles.sql.
-- =============================================================================

create table if not exists public.course_bundles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  title        text not null check (length(trim(title)) between 2 and 120),
  description  text check (description is null or length(description) <= 4000),
  cover_image  text check (cover_image is null or (cover_image ~ '^https://' and length(cover_image) <= 1000)),
  price        integer not null check (price between 0 and 10000000),   -- paise
  currency     text not null default 'INR' check (currency = 'INR'),
  is_published boolean not null default false,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- An address is unique among bundles that haven't been removed (a removed one frees it).
create unique index if not exists course_bundles_slug_live on public.course_bundles (slug) where deleted_at is null;

create table if not exists public.course_bundle_items (
  bundle_id  uuid not null references public.course_bundles(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (bundle_id, course_id)
);
create index if not exists course_bundle_items_course on public.course_bundle_items (course_id);

alter table public.course_bundles enable row level security;
alter table public.course_bundle_items enable row level security;
drop policy if exists "Published bundles are public" on public.course_bundles;
create policy "Published bundles are public" on public.course_bundles for select to anon, authenticated
  using (is_published and deleted_at is null);
drop policy if exists "Items of published bundles are public" on public.course_bundle_items;
create policy "Items of published bundles are public" on public.course_bundle_items for select to anon, authenticated
  using (exists (select 1 from public.course_bundles b where b.id = bundle_id and b.is_published and b.deleted_at is null));
revoke all on public.course_bundles, public.course_bundle_items from anon, authenticated;
grant select on public.course_bundles, public.course_bundle_items to anon, authenticated;
grant all on public.course_bundles, public.course_bundle_items to service_role;

-- Only Forge's own public courses go in a bundle (never a college's).
create or replace function public.check_bundle_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.courses c where c.id = new.course_id and c.deleted_at is null
                   and c.owner_org_id = '00000000-0000-0000-0000-00000000f0f0' and c.visibility = 'public') then
    raise exception 'Only Forge''s public courses can be bundled' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function public.check_bundle_item() from public, anon, authenticated;
drop trigger if exists course_bundle_items_check on public.course_bundle_items;
create trigger course_bundle_items_check before insert or update on public.course_bundle_items
  for each row execute function public.check_bundle_item();

-- A payment is for a plan, or for a named resource (a course, a bundle, …).
alter table public.payments alter column plan_id drop not null;
alter table public.payments drop constraint if exists payments_plan_or_resource;
alter table public.payments add constraint payments_plan_or_resource
  check (plan_id is not null or (metadata ? 'resource_type' and metadata ? 'resource_id'));
