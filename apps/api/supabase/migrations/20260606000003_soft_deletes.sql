-- Standardize soft delete representation to deleted_at timestamps.
do $$
declare
  t text;
begin
  foreach t in array array[
    'programs',
    'program_stages',
    'program_enrollments',
    'program_submissions',
    'build_challenges',
    'build_stages',
    'build_enrollments',
    'courses',
    'problems'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'is_deleted'
      ) then
        execute format('update public.%I set deleted_at = coalesce(deleted_at, now()) where is_deleted = true and deleted_at is null', t);
      end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'is_archived'
      ) then
        execute format('update public.%I set deleted_at = coalesce(deleted_at, now()) where is_archived = true and deleted_at is null', t);
      end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'inactive'
      ) then
        execute format('update public.%I set deleted_at = coalesce(deleted_at, now()) where inactive = true and deleted_at is null', t);
      end if;
      execute format('create index if not exists idx_%s_deleted_at on public.%I(deleted_at)', t, t);
    end if;
  end loop;
end $$;
