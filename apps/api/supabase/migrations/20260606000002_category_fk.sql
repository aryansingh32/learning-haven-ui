-- Standard category foreign keys for learning and program content.
create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories for select using (true);

alter table public.programs add column if not exists category_id uuid references public.categories(id);

do $$
begin
  if to_regclass('public.problems') is not null then
    alter table public.problems add column if not exists category_id uuid references public.categories(id);

    insert into public.categories (name, slug)
    select distinct topic, lower(regexp_replace(topic, '[^a-zA-Z0-9]+', '-', 'g'))
    from public.problems
    where topic is not null and topic <> ''
    on conflict (slug) do nothing;

    update public.problems p
    set category_id = c.id
    from public.categories c
    where p.category_id is null
      and p.topic is not null
      and c.slug = lower(regexp_replace(p.topic, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  if to_regclass('public.courses') is not null then
    alter table public.courses add column if not exists category_id uuid references public.categories(id);
  end if;
end $$;

create index if not exists idx_programs_category_id on public.programs(category_id);
