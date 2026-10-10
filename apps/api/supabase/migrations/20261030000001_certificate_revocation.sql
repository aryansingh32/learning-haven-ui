-- =============================================================================
-- Certificate revocation. The admin Certificates page revokes a certificate
-- (is_valid = false, revoked_at), but the table never had these columns, so the
-- page failed to load and revoking was impossible. Public verification now
-- reports a revoked certificate as not valid. Additive; existing rows stay valid.
-- =============================================================================

alter table public.certificates
  add column if not exists is_valid boolean not null default true,
  add column if not exists revoked_at timestamptz;

alter table public.certificates drop constraint if exists certificates_revoked_shape;
alter table public.certificates add constraint certificates_revoked_shape
  check (is_valid or revoked_at is not null);
