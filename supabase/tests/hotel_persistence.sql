-- Hotel pricing persistence regression. Temporary account and data are rolled back.
begin;
select set_config('test.hotel_owner', gen_random_uuid()::text, true);
insert into auth.users(id) values(current_setting('test.hotel_owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.hotel_owner'), true);
do $test$
declare saved_id uuid; pricing jsonb; details jsonb; snapshot jsonb; loaded record;
begin
  pricing := '{"source":"liteapi-sandbox","hotelName":"Test Hotel","lodgingTotal":100,"baseTotal":80,"additionalFees":20}';
  details := '{"origin":"Norfolk","destination":"Boston","startDate":"2026-11-08","endDate":"2026-11-10","budget":1000,"travelers":2,"transportation":"train","cost":160,"travelTime":8.3}'::jsonb
    || jsonb_build_object('pricing', pricing);
  snapshot := jsonb_build_object('version', 1, 'pricing', pricing, 'lodgingTotal', 100, 'estimatedTotal', 160);
  select id into saved_id from public.trip_repository_create(details, snapshot);
  select * into loaded from public.trip_repository_get(saved_id);
  if loaded.scenario->'pricing' is distinct from pricing then raise exception 'Scenario hotel metadata lost'; end if;
  if loaded.report->'pricing' is distinct from pricing then raise exception 'Report hotel metadata lost'; end if;
  if not exists(select 1 from public.trip_reports where scenario_id = saved_id
    and total_cost = 160 and report_snapshot->'pricing' = pricing) then
    raise exception 'Hotel report not persisted';
  end if;
  perform public.trip_repository_update(saved_id,
    jsonb_set(details, '{pricing}', '{"source":"edited-sandbox"}'),
    jsonb_set(snapshot, '{pricing}', '{"source":"edited-sandbox"}'));
  select * into loaded from public.trip_repository_get(saved_id);
  if loaded.scenario #>> '{pricing,source}' is distinct from 'edited-sandbox' then raise exception 'Edited scenario label lost'; end if;
  if loaded.report #>> '{pricing,source}' is distinct from 'edited-sandbox' then raise exception 'Edited report label lost'; end if;
  if not exists(select 1 from public.trip_reports where scenario_id = saved_id
    and report_snapshot->'pricing' = pricing) then raise exception 'Historical hotel report overwritten'; end if;
  if not public.trip_repository_delete(saved_id) then raise exception 'Hotel trip deletion failed'; end if;
end $test$;
reset role;
rollback;
select 'PASS: hotel source, whole-stay total, fees, edited labels and report history persist; test data rolled back.' as result;
