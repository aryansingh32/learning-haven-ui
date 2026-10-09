-- =============================================================================
-- GST invoices (slice W2-B1): numbered per financial year, paid payments only, tax split, own rows, immutable.
-- Runs as real signed-in users inside a rolled-back transaction.
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

create function pg_temp.check_true(actual boolean, label text) returns void
language plpgsql as $$
begin
  if actual is not true then raise exception 'FAIL: % (got %)', label, actual; end if;
  raise notice 'ok  %', label;
end $$;

create function pg_temp.check_denied(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'ok  % (denied)', label;
end $$;

create function pg_temp.rows_changed(stmt text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.act_as(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.check_no_privilege(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement was allowed)', label;
exception
  when insufficient_privilege then raise notice 'ok  % (denied)', label;
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at) values
  ('83000000-0000-0000-0000-000000000001', 'b1@b.test', now()), ('83000000-0000-0000-0000-000000000002', 'b2@b.test', now());
insert into public.users (id, email, full_name) values
  ('83000000-0000-0000-0000-000000000001', 'b1@b.test', 'Priya Sharma'), ('83000000-0000-0000-0000-000000000002', 'b2@b.test', 'Arjun Rao');
insert into public.plans (id, name, slug) values ('83100000-0000-0000-0000-000000000001', 'Pro', 'pro') on conflict do nothing;
insert into public.payments (id, user_id, plan_id, amount, tax_amount, final_amount, status, razorpay_order_id, billing_cycle, updated_at) values
  ('83200000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'captured', 'o1', 'monthly', '2026-10-01 10:00+05:30'),
  ('83200000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'captured', 'o2', 'monthly', '2026-10-02 10:00+05:30'),
  ('83200000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'created', 'o3', 'monthly', '2026-10-03 10:00+05:30'),
  ('83200000-0000-0000-0000-000000000004', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 0, 0, 0, 'captured', 'free_order_4', 'monthly', '2026-10-03 10:00+05:30'),
  ('83200000-0000-0000-0000-000000000005', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'captured', 'o5', 'monthly', '2027-03-31 23:00+05:30'),
  ('83200000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'captured', 'o6', 'monthly', '2027-04-01 00:30+05:30'),
  ('83200000-0000-0000-0000-000000000007', '83000000-0000-0000-0000-000000000001', (select id from public.plans where slug = 'pro' limit 1), 49900, 7612, 49900, 'captured', 'o7', 'monthly', '2026-10-05 10:00+05:30');

-- Arjun is a business in Karnataka (29); the seller is in Tamil Nadu (33).
insert into public.billing_profiles (user_id, legal_name, gstin, state_code) values
  ('83000000-0000-0000-0000-000000000002', 'Rao Labs LLP', '29ABCDE1234F1Z5', '29');
select pg_temp.check_denied($$insert into public.billing_profiles (user_id, gstin) values ('83000000-0000-0000-0000-000000000001', 'NOT-A-GSTIN')$$,
  'a malformed GSTIN is refused');
select pg_temp.check_denied($$insert into public.billing_profiles (user_id, gstin, state_code) values ('83000000-0000-0000-0000-000000000001', '29ABCDE1234F1Z5', '33')$$,
  'a GSTIN from another state than the one given is refused');

create temp table seller as select '{"name": "Forge Learning Pvt Ltd", "gstin": "33AAAAA0000A1Z5", "state_code": "33", "address": "Chennai"}'::jsonb as s;
grant select on seller to authenticated;

select pg_temp.check_true((select (public.issue_invoice('83200000-0000-0000-0000-000000000001', (select s from seller))).invoice_no = 'FG/2026-27/000001'), 'the first invoice of the year is 000001');
select pg_temp.check_true((select (public.issue_invoice('83200000-0000-0000-0000-000000000002', (select s from seller))).invoice_no = 'FG/2026-27/000002'), 'the next one is 000002');
select pg_temp.check_true((select (public.issue_invoice('83200000-0000-0000-0000-000000000001', (select s from seller))).invoice_no = 'FG/2026-27/000001'), 'issuing again returns the same invoice');
select pg_temp.check_eq((select last_no from public.invoice_counters where fy = '2026-27')::bigint, 2, 'and does not use up a number');
select pg_temp.check_true((select (public.issue_invoice('83200000-0000-0000-0000-000000000005', (select s from seller))).fy = '2026-27'), '31 March belongs to the old year');
select pg_temp.check_true((select (public.issue_invoice('83200000-0000-0000-0000-000000000006', (select s from seller))).invoice_no = 'FG/2027-28/000001'), '1 April starts a new series');

select pg_temp.check_true((select cgst_paise = 3806 and sgst_paise = 3806 and igst_paise = 0 and taxable_paise = 42288 and total_paise = 49900
  from public.invoices where payment_id = '83200000-0000-0000-0000-000000000001'), 'same state: CGST + SGST, adding up to the amount paid');
select pg_temp.check_true((select igst_paise = 7612 and cgst_paise = 0 and place_of_supply = '29' and buyer_name = 'Rao Labs LLP' and buyer_gstin = '29ABCDE1234F1Z5'
  from public.invoices where payment_id = '83200000-0000-0000-0000-000000000002'), 'another state: IGST, with the buyer''s business name and GSTIN');

select pg_temp.check_denied($$select public.issue_invoice('83200000-0000-0000-0000-000000000003', (select s from seller))$$, 'an unpaid order gets no invoice');
select pg_temp.check_denied($$select public.issue_invoice('83200000-0000-0000-0000-000000000004', (select s from seller))$$, 'a free order gets no invoice');
select pg_temp.check_denied($$select public.issue_invoice('83200000-0000-0000-0000-000000000005', '{"name": "x"}')$$, 'incomplete seller details are refused');
select pg_temp.check_denied($$update public.invoices set total_paise = 1 where payment_id = '83200000-0000-0000-0000-000000000001'$$, 'an issued invoice cannot be edited');
select pg_temp.check_denied($$delete from public.invoices where payment_id = '83200000-0000-0000-0000-000000000001'$$, 'or deleted');

set local role authenticated;
select pg_temp.act_as('83000000-0000-0000-0000-000000000001');
select pg_temp.check_eq((select count(*) from public.invoices), 3, 'a learner sees only their own invoices');
select pg_temp.check_no_privilege($$select public.issue_invoice('83200000-0000-0000-0000-000000000007', (select s from seller))$$, 'and cannot issue invoices');
select pg_temp.check_denied($$insert into public.invoices (invoice_no, fy, seq, payment_id, user_id, seller, buyer_name, place_of_supply, description, taxable_paise, total_paise)
  values ('FG/x/1', '2026-27', 99, '83200000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000001', '{}', 'x', '33', 'x', 1, 1)$$, 'or write them');
select pg_temp.check_denied($$update public.invoice_counters set last_no = 0$$, 'or touch the numbering');
select pg_temp.check_eq(pg_temp.rows_changed($$insert into public.billing_profiles (user_id, legal_name, state_code) values ('83000000-0000-0000-0000-000000000001', 'Priya Sharma', '33')$$), 1,
  'a learner saves their own billing details');
select pg_temp.check_denied($$insert into public.billing_profiles (user_id, legal_name) values ('83000000-0000-0000-0000-000000000002', 'x')
  on conflict (user_id) do update set legal_name = 'hijack'$$, 'not someone else''s');
reset role;

rollback;

\o
\echo 'ALL INVOICE CHECKS PASSED'
