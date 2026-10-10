-- =============================================================================
-- Certificate templates (slice W2-T1)
--
-- * public.certificate_templates: how a certificate looks and reads — title,
--   wording with {name} {achievement} {date} {code} {grade}, colours, border,
--   signatory, logo, QR code — per kind ('topic' for practice topics,
--   'apprenticeship' for programs). One default per kind; made in the Forge admin.
-- * certificates.template_id: the template a certificate was issued with, so it
--   renders the same way whenever it's downloaded.
-- Server-only (the Forge API reads and writes; no client access).
--
-- Additive. Tested by supabase/tests/certificate_templates.sql.
-- =============================================================================

create table if not exists public.certificate_templates (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('topic', 'apprenticeship')),
  name       text not null check (length(trim(name)) between 2 and 80),
  is_default boolean not null default false,
  layout     jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object' and length(layout::text) <= 20000),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists certificate_templates_one_default on public.certificate_templates (kind) where is_default;
alter table public.certificate_templates enable row level security;
revoke all on public.certificate_templates from anon, authenticated;
grant all on public.certificate_templates to service_role;

alter table public.certificates
  add column if not exists template_id uuid references public.certificate_templates(id) on delete set null;

-- The look certificates had until now, as the starting default for each kind.
insert into public.certificate_templates (kind, name, is_default, layout)
select 'topic', 'Classic gold', true, jsonb_build_object(
  'title', 'CERTIFICATE OF ACHIEVEMENT', 'subtitle', 'Forge',
  'intro', 'This is to certify that', 'body', 'has successfully completed all problems in',
  'footer', 'Forge — from zero to hired', 'accent', '#D9A521', 'background', '#FAF8F2', 'text', '#262626',
  'border', 'double', 'showQr', true, 'signatoryName', '', 'signatoryTitle', '', 'logoUrl', '')
where not exists (select 1 from public.certificate_templates where kind = 'topic');
insert into public.certificate_templates (kind, name, is_default, layout)
select 'apprenticeship', 'Program navy', true, jsonb_build_object(
  'title', 'VERIFIED APPRENTICESHIP CERTIFICATE', 'subtitle', 'Forge',
  'intro', 'This is to certify that', 'body', 'has successfully completed',
  'footer', 'Grade: {grade}', 'accent', '#C9A838', 'background', '#F7FAFF', 'text', '#141F3A',
  'border', 'single', 'showQr', true, 'signatoryName', '', 'signatoryTitle', '', 'logoUrl', '')
where not exists (select 1 from public.certificate_templates where kind = 'apprenticeship');
