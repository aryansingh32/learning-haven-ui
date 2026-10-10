-- =============================================================================
-- Certificate revocation (20261030000001): certificates start valid, a revoked
-- one must carry its revocation time, and the browser can't revoke or edit.
-- Runs inside a rolled-back transaction.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

create function pg_temp.check_eq(actual bigint, expected bigint, label text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok  %', label;
end $$;

create function pg_temp.check_denied(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege or check_violation then
    raise notice 'ok  % (denied)', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values ('86000000-0000-0000-0000-000000000001', 'c1@cert.test', now());
insert into public.users (id, email, full_name) values ('86000000-0000-0000-0000-000000000001', 'c1@cert.test', 'c1');
insert into public.certificates (id, user_id, topic, verification_code)
  values ('86000000-0000-0000-0000-0000000000c1', '86000000-0000-0000-0000-000000000001', 'Arrays', 'CERT-TEST-1');

select pg_temp.check_eq((select is_valid::int from public.certificates where verification_code = 'CERT-TEST-1'), 1, 'a new certificate is valid');
select pg_temp.check_denied($$update public.certificates set is_valid = false where verification_code = 'CERT-TEST-1'$$,
  'revoking without a revocation time is refused');
update public.certificates set is_valid = false, revoked_at = now() where verification_code = 'CERT-TEST-1';
select pg_temp.check_eq((select count(*) from public.certificates where not is_valid and revoked_at is not null), 1, 'the server can revoke it');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '86000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
update public.certificates set is_valid = true, revoked_at = null;   -- RLS: no update policy, so nothing changes
reset role;
select pg_temp.check_eq((select count(*) from public.certificates where verification_code = 'CERT-TEST-1' and not is_valid), 1,
  'a learner cannot un-revoke their certificate');

rollback;

\o
\echo 'ALL CERTIFICATE CHECKS PASSED'
