-- SCRUM-71. All temporary users, trips, reports and logs roll back.
begin;
select set_config('test.validation_owner', gen_random_uuid()::text, true);
select set_config('test.validation_other', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('test.validation_owner')::uuid), (current_setting('test.validation_other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.validation_owner'), true);
do $test$
declare
  valid_trip jsonb := '{"origin":"Norfolk","destination":"Boston","startDate":"2026-11-15","endDate":"2026-11-21","budget":8000,"travelers":4,"transportation":"car","cost":200,"travelTime":2}';
  changes jsonb; bad_trip jsonb; saved_id uuid; loaded record;
  count_before integer; rejected boolean;
begin
  select id into saved_id from public.trip_repository_create(valid_trip, '{"travelers":4}');
  perform set_config('test.validation_trip', saved_id::text, true);
  select count(*) into count_before from public.trip_reports where scenario_id = saved_id;
  for changes in select value from jsonb_array_elements('[
    {"origin":null}, {"origin":""}, {"origin":"   "}, {"origin":123},
    {"destination":null}, {"destination":""}, {"destination":"  "},
    {"startDate":null}, {"endDate":null}, {"startDate":"bad date"},
    {"startDate":"2026-02-30"}, {"endDate":"2026-11-15"}, {"endDate":"2026-11-14"},
    {"budget":-1}, {"budget":null}, {"budget":"NaN"}, {"budget":0},
    {"travelers":0}, {"travelers":-1}, {"travelers":1.5}, {"travelers":"invalid"},
    {"travelers":true}, {"travelers":2147483648}
  ]'::jsonb) loop
    bad_trip := valid_trip || changes;
    rejected := false;
    begin
      perform public.trip_repository_create(bad_trip, '{}');
    exception when invalid_parameter_value then rejected := true;
    end;
    if not rejected then raise exception 'Create accepted invalid input: %', changes; end if;
    rejected := false;
    begin
      perform public.trip_repository_update(saved_id, bad_trip, '{}');
    exception when invalid_parameter_value then rejected := true;
    end;
    if not rejected then raise exception 'Update accepted invalid input: %', changes; end if;
  end loop;
  if (select count(*) from public.trip_reports where scenario_id = saved_id) <> count_before then
    raise exception 'Rejected edits changed report history';
  end if;
  select * into loaded from public.trip_repository_get(saved_id);
  if loaded.scenario->>'budget' <> '8000' then raise exception 'Rejected edit changed the trip'; end if;

  rejected := false;
  begin perform public.trip_repository_create(valid_trip - 'travelers', '{}');
  exception when invalid_parameter_value then rejected := true;
  end;
  if not rejected then raise exception 'Create accepted an unknown traveler count'; end if;

  rejected := false;
  begin perform public.trip_repository_create(valid_trip || '{"travelers":0}', '{"travelers":4}');
  exception when invalid_parameter_value then rejected := true;
  end;
  if not rejected then raise exception 'A valid report masked an invalid scenario count'; end if;

  rejected := false;
  begin perform public.trip_repository_create(valid_trip, '{"travelers":3}');
  exception when invalid_parameter_value then rejected := true;
  end;
  if not rejected then raise exception 'Conflicting traveler counts accepted'; end if;

  -- A saved snapshot from the earlier app omitted travelers. Keep the existing
  -- database value and include it in the next saved scenario/report snapshot.
  perform public.trip_repository_update(saved_id,
    (valid_trip - 'travelers') || '{"budget":9000}', '{"travelers":null}');
  select * into loaded from public.trip_repository_get(saved_id);
  if loaded.scenario->>'travelers' <> '4' or loaded.report->>'travelers' <> '4'
    or loaded.scenario->>'budget' <> '9000' then
    raise exception 'Legacy saved-trip edit lost its traveler count or update';
  end if;
  -- Positive whole values represented as decimals are valid, not truncated.
  perform public.trip_repository_update(saved_id, valid_trip || '{"travelers":4.0}', '{"travelers":4.0}');
end $test$;

select set_config('request.jwt.claim.sub', current_setting('test.validation_other'), true);
do $test$
begin
  if exists(select 1 from public.trip_repository_update(
    current_setting('test.validation_trip')::uuid, '{}', '{}')) then
    raise exception 'Validation changes allowed an unauthorized update';
  end if;
end $test$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $test$
declare rejected boolean := false;
begin
  begin perform app_private.validate_trip_scenario('{}', '{}');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Guest called protected validation'; end if;
end $test$;
reset role;
rollback;
select 'PASS: SCRUM-71 create/update validation, legacy saved edits, atomic failures and ownership; test data rolled back.' as result;
