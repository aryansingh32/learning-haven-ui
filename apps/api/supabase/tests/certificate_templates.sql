-- =============================================================================
-- Certificate templates (20261104000001): server-only, one default per kind,
-- seeded with the previous look.
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
grant execute on all functions in schema pg_temp to authenticated, anon;

select pg_temp.check_eq((select count(*) from public.certificate_templates where is_default), 2, 'each kind starts with a default');

do $$ begin
  insert into public.certificate_templates (kind, name, is_default) values ('topic', 'Second default', true);
  raise exception 'FAIL: two defaults for one kind';
exception when unique_violation then raise notice 'ok  one default per kind (denied)';
end $$;

set local role authenticated;
do $$ begin
  perform 1 from public.certificate_templates;
  raise exception 'FAIL: learners can read templates';
exception when insufficient_privilege then raise notice 'ok  templates are server-only (denied)';
end $$;
reset role;

rollback;

\o
\echo 'ALL CERTIFICATE TEMPLATE CHECKS PASSED'
