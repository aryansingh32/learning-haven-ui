-- =============================================================================
-- Course bundles (20261103000001): drafts stay hidden, nobody signed in can
-- write bundles, and a college's course can't be bundled.
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

insert into campus.organizations (id, slug, name) values ('eeeeeeee-0000-0000-0000-00000000000e', 'cb-college', 'CB College');
insert into public.courses (id, title, slug, is_published) values
  ('e1000000-0000-0000-0000-000000000001', 'Forge A', 'cb-forge-a', true),
  ('e1000000-0000-0000-0000-000000000002', 'Forge B', 'cb-forge-b', true);
insert into public.courses (id, title, slug, is_published, owner_org_id, visibility) values
  ('e1000000-0000-0000-0000-00000000000c', 'College C', 'cb-college-c', true, 'eeeeeeee-0000-0000-0000-00000000000e', 'org');
insert into public.course_bundles (id, slug, title, price, is_published) values
  ('e2000000-0000-0000-0000-000000000001', 'cb-live', 'Live bundle', 99900, true),
  ('e2000000-0000-0000-0000-000000000002', 'cb-draft', 'Draft bundle', 49900, false);
insert into public.course_bundle_items (bundle_id, course_id) values
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002'),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001');

select pg_temp.check_denied($$insert into public.course_bundle_items (bundle_id, course_id)
  values ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-00000000000c')$$, 'a college''s course cannot be bundled');

update public.course_bundles set deleted_at = now() where id = 'e2000000-0000-0000-0000-000000000002';
insert into public.course_bundles (slug, title, price) values ('cb-draft', 'Draft bundle again', 1);
select pg_temp.check_eq((select count(*) from public.course_bundles where slug = 'cb-draft'), 2, 'a removed bundle frees its address');
do $$ begin
  insert into public.course_bundles (slug, title, price) values ('cb-live', 'Clash', 1);
  raise exception 'FAIL: two live bundles share an address';
exception when unique_violation then raise notice 'ok  two live bundles cannot share an address (denied)';
end $$;

-- Payments: a plan, or a named resource; never neither.
insert into auth.users (id, email, email_confirmed_at) values ('e3000000-0000-0000-0000-000000000001', 'buyer@cb.test', now());
insert into public.users (id, email, full_name) values ('e3000000-0000-0000-0000-000000000001', 'buyer@cb.test', 'buyer');
insert into public.payments (user_id, plan_id, amount, final_amount, status, razorpay_order_id, billing_cycle, metadata)
values ('e3000000-0000-0000-0000-000000000001', null, 99900, 117882, 'created', 'cb_order_1', 'one_time',
        '{"resource_type": "bundle", "resource_id": "e2000000-0000-0000-0000-000000000001"}');
select pg_temp.check_eq((select count(*) from public.payments where razorpay_order_id = 'cb_order_1'), 1, 'a bundle or course order needs no plan');
select pg_temp.check_denied($$insert into public.payments (user_id, plan_id, amount, final_amount, status, razorpay_order_id, billing_cycle, metadata)
  values ('e3000000-0000-0000-0000-000000000001', null, 1, 1, 'created', 'cb_order_2', 'one_time', '{}')$$, 'but a payment for nothing is refused');

set local role anon;
select pg_temp.check_eq((select count(*) from public.course_bundles where slug like 'cb-%'), 1, 'visitors see published bundles only');
select pg_temp.check_eq((select count(*) from public.course_bundle_items where bundle_id::text like 'e2000000%'), 2, 'and only their items');
reset role;
set local role authenticated;
select pg_temp.check_denied($$insert into public.course_bundles (slug, title, price) values ('cb-mine', 'Mine', 1)$$, 'learners cannot create bundles');
select pg_temp.check_denied($$update public.course_bundles set price = 1$$, 'nor change prices');
reset role;

rollback;

\o
\echo 'ALL COURSE BUNDLE CHECKS PASSED'
