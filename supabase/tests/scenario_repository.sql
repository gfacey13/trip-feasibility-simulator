-- Run after both migrations in SQL Editor. All test data is rolled back.
-- Uses isolated test identities, not any real account or saved scenario.
begin;
select set_config('test.owner_a', gen_random_uuid()::text, true);
select set_config('test.owner_b', gen_random_uuid()::text, true);
insert into auth.users(id) values
 (current_setting('test.owner_a')::uuid), (current_setting('test.owner_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
do $$
declare first_id uuid; second_id uuid; saved jsonb;
begin
 select id into first_id from public.trip_repository_create(
  '{"origin":"Norfolk","destination":"Boston","startDate":"2026-11-08","endDate":"2026-11-14","budget":7000,"travelers":2,"transportation":"train","cost":1280,"travelTime":8.3}', '{"analysis":{"status":"Feasible"}}');
 select id into second_id from public.trip_repository_create(
  '{"origin":"Norfolk","destination":"Miami","startDate":"2026-11-08","endDate":"2026-11-14","budget":7000,"travelers":2,"transportation":"train","cost":1400,"travelTime":10}', '{"analysis":{"status":"Not feasible"}}');
 if (select count(*) from public.trip_repository_list()) <> 2 then
  raise exception 'Multiple scenario persistence failed'; end if;
 select report into saved from public.trip_repository_get(first_id);
 if saved #>> '{analysis,status}' <> 'Feasible' then raise exception 'Report round trip failed'; end if;
 perform public.trip_repository_update(first_id,
  '{"origin":"Norfolk","destination":"Chicago","startDate":"2026-11-08","endDate":"2026-11-14","budget":7000,"travelers":2,"transportation":"train","cost":1500,"travelTime":9}', '{"analysis":{"status":"Updated"}}');
 if (select report #>> '{analysis,status}' from public.trip_repository_get(first_id)) <> 'Updated' then
  raise exception 'Scenario/report update failed'; end if;
 if (select count(*) from public.trip_reports r where r.scenario_id = first_id) <> 2 then
  raise exception 'Report history lost'; end if;
 perform set_config('test.first_id', first_id::text, true);
 if not public.trip_repository_delete(second_id) then raise exception 'Delete failed'; end if;
 if exists(select 1 from public.trip_repository_get(second_id)) then raise exception 'Deleted scenario returned'; end if;
end $$;
-- A fresh user session sees none of the first account's scenarios.
select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);
do $$
begin
 if exists(select 1 from public.trip_repository_list()) then raise exception 'Cross-account list leak'; end if;
 if exists(select 1 from public.trip_repository_get(current_setting('test.first_id')::uuid)) then
  raise exception 'Cross-account get leak'; end if;
 if exists(select 1 from public.trip_repository_update(current_setting('test.first_id')::uuid, '{}', '{}')) then
  raise exception 'Cross-account update allowed'; end if;
 if public.trip_repository_delete(current_setting('test.first_id')::uuid) then
  raise exception 'Cross-account delete allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
do $$
begin
 if (select count(*) from public.trip_repository_list()) <> 1 then raise exception 'Owner data lost'; end if;
 if (select report #>> '{analysis,status}' from public.trip_repository_get(current_setting('test.first_id')::uuid)) <> 'Updated' then
  raise exception 'Other account changed report'; end if;
end $$;
reset role;
set local role anon;
do $$
declare denied boolean := false;
begin
 begin perform public.trip_repository_list();
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'Guest repository access allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: CRUD, reports, multiple scenarios, ownership, guest denial; test data rolled back.' as result;
