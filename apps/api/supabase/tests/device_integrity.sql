-- =============================================================================
-- Devices and exam integrity (20261106000001): user_devices is server-only,
-- record_device keeps one row per device with recent IPs, new event types.
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

insert into auth.users (id, email) values ('d0000000-0000-0000-0000-0000000000d1', 'dev@test.local');
insert into public.users (id, email, full_name) values ('d0000000-0000-0000-0000-0000000000d1', 'dev@test.local', 'Dev');

select public.record_device('d0000000-0000-0000-0000-0000000000d1', repeat('a', 64), '10.0.0.1', 'UA',
  '{"os":"Windows","browser":"Chrome","browserVersion":"129","deviceType":"desktop","screen":"1920x1080","screens":"2","timezone":"Asia/Kolkata"}');
select public.record_device('d0000000-0000-0000-0000-0000000000d1', repeat('a', 64), '10.0.0.2', 'UA', '{}');
select public.record_device('d0000000-0000-0000-0000-0000000000d1', repeat('a', 64), '10.0.0.1', 'UA', '{"deviceType":"toaster","screen":"<b>"}');

select pg_temp.check_eq((select count(*) from public.user_devices where user_id = 'd0000000-0000-0000-0000-0000000000d1'), 1, 'one row per device');
select pg_temp.check_eq((select seen_count from public.user_devices where device_id = repeat('a', 64)), 3, 'sightings counted');
select pg_temp.check_eq((select cardinality(ips) from public.user_devices where device_id = repeat('a', 64)), 2, 'distinct IPs kept');
select pg_temp.check_eq((select count(*) from public.user_devices where device_id = repeat('a', 64) and last_ip = '10.0.0.1' and ips[1] = '10.0.0.1'), 1, 'latest IP first');
select pg_temp.check_eq((select count(*) from public.user_devices where device_id = repeat('a', 64)
  and os = 'Windows' and device_type = 'desktop' and screen = '1920x1080' and screens = 2), 1, 'traits kept, junk ignored');

do $$ begin
  insert into public.user_devices (user_id, device_id) values ('d0000000-0000-0000-0000-0000000000d1', 'not-a-hash');
  raise exception 'FAIL: malformed device id';
exception when check_violation then raise notice 'ok  device ids are hashes (denied)';
end $$;
do $$ begin
  update public.user_devices set ips = array_fill('1.1.1.1'::inet, array[21]);
  raise exception 'FAIL: unbounded IP list';
exception when check_violation then raise notice 'ok  at most 20 IPs per device (denied)';
end $$;

set local role authenticated;
do $$ begin
  perform 1 from public.user_devices;
  raise exception 'FAIL: learners can read device records';
exception when insufficient_privilege then raise notice 'ok  device records are server-only (denied)';
end $$;
do $$ begin
  perform public.record_device('d0000000-0000-0000-0000-0000000000d1', repeat('b', 64), null, null, '{}');
  raise exception 'FAIL: learners can write device records';
exception when insufficient_privilege then raise notice 'ok  only the APIs record devices (denied)';
end $$;
reset role;

select pg_temp.check_eq((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'test_attempts'
  and column_name in ('device_id', 'start_ip', 'device_info')), 3, 'attempts keep their device');
select pg_temp.check_eq((select count(*) from pg_constraint where conname = 'proctoring_events_event_type_check'
  and pg_get_constraintdef(oid) like '%device_change%' and pg_get_constraintdef(oid) like '%large_paste%'), 1, 'new proctoring event types allowed');

rollback;

\o
\echo 'ALL DEVICE INTEGRITY CHECKS PASSED'
