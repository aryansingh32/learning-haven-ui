-- =============================================
-- Content Import: Staged Import Pipeline
-- Tables: content_import_batches, content_import_rows
-- All writes to live content tables go only through publishBatch.
-- =============================================

-- ──────────────────────────────────────────────
-- 1. content_import_batches
--    One row per import session (file or sheet).
-- ──────────────────────────────────────────────
create table if not exists public.content_import_batches (
  id            uuid primary key default gen_random_uuid(),
  content_type  text not null
                  check (content_type in ('chapters', 'problems', 'build_stages')),
  source        text not null
                  check (source in ('upload', 'sheet_url', 'json')),
  source_ref    text,                          -- original filename or sheet URL
  uploaded_by   uuid references public.users(id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending', 'reviewed', 'published', 'rejected')),
  total_rows    integer not null default 0,
  valid_rows    integer not null default 0,
  error_rows    integer not null default 0,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);

comment on table public.content_import_batches is
  'One row per staged import session. Status moves pending -> reviewed -> published (or rejected).';

-- ──────────────────────────────────────────────
-- 2. content_import_rows
--    One row per CSV/sheet row in a batch.
-- ──────────────────────────────────────────────
create table if not exists public.content_import_rows (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null
                        references public.content_import_batches(id)
                        on delete cascade,
  row_number          integer not null,
  raw_data            jsonb not null default '{}',
  status              text not null
                        check (status in ('valid', 'error', 'warning')),
  errors              jsonb not null default '[]',  -- array of error strings
  resolved_entity_id  uuid,                          -- set after publish
  created_at          timestamptz not null default now()
);

comment on table public.content_import_rows is
  'Individual parsed rows within a content import batch. resolved_entity_id is set after publish.';

-- ──────────────────────────────────────────────
-- 3. Indexes
-- ──────────────────────────────────────────────
create index if not exists idx_cib_uploaded_by
  on public.content_import_batches(uploaded_by, created_at desc);

create index if not exists idx_cib_status_type
  on public.content_import_batches(content_type, status, created_at desc);

create index if not exists idx_cir_batch
  on public.content_import_rows(batch_id, row_number);

create index if not exists idx_cir_status
  on public.content_import_rows(batch_id, status);

-- ──────────────────────────────────────────────
-- 4. Row Level Security
--    API always uses service_role (bypasses RLS).
--    Policies below protect direct client access.
-- ──────────────────────────────────────────────
alter table public.content_import_batches enable row level security;
alter table public.content_import_rows enable row level security;

-- Admins can manage batches they uploaded (service role bypasses anyway)
drop policy if exists "admin manage own import batches" on public.content_import_batches;
create policy "admin manage own import batches"
  on public.content_import_batches for all
  using (auth.uid() = uploaded_by);

drop policy if exists "admin read own import rows" on public.content_import_rows;
create policy "admin read own import rows"
  on public.content_import_rows for select
  using (
    exists (
      select 1 from public.content_import_batches b
      where b.id = batch_id and b.uploaded_by = auth.uid()
    )
  );
