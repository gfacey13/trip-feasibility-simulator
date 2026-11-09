-- SCRUM-71: apply as a NEW migration after the deployed SCRUM-72/69 migrations.
begin;

create or replace function app_private.validate_trip_scenario(
  p_scenario jsonb, p_report jsonb, p_existing_travelers integer default null
) returns integer language plpgsql immutable security invoker set search_path = ''
as $$
declare start_date date; end_date date; budget_value numeric;
  scenario_count numeric; report_count numeric; count_text text;
begin
  if jsonb_typeof(p_scenario) is distinct from 'object'
    or (p_report is not null and jsonb_typeof(p_report) is distinct from 'object') then
    raise exception using errcode = '22023', message = 'Send valid trip details and report data.';
  end if;
  if jsonb_typeof(p_scenario->'origin') is distinct from 'string'
    or (p_scenario->>'origin') !~ '[^[:space:]]' then
    raise exception using errcode = '22023', message = 'Enter an origin.';
  end if;
  if jsonb_typeof(p_scenario->'destination') is distinct from 'string'
    or (p_scenario->>'destination') !~ '[^[:space:]]' then
    raise exception using errcode = '22023', message = 'Enter a destination.';
  end if;
  if jsonb_typeof(p_scenario->'startDate') is distinct from 'string'
    or jsonb_typeof(p_scenario->'endDate') is distinct from 'string'
    or (p_scenario->>'startDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (p_scenario->>'endDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'Enter valid departure and return dates.';
  end if;
  begin
    start_date := (p_scenario->>'startDate')::date;
    end_date := (p_scenario->>'endDate')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'Enter valid departure and return dates.';
  end;
  if end_date <= start_date then
    raise exception using errcode = '22023', message = 'Return date must be after departure date.';
  end if;
  if coalesce(jsonb_typeof(p_scenario->'budget'), '') not in ('number', 'string')
    or btrim(p_scenario->>'budget') !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception using errcode = '22023', message = 'Budget must be a positive number.';
  end if;
  begin budget_value := (p_scenario->>'budget')::numeric;
  exception when numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Enter a valid budget.';
  end;
  if budget_value <= 0 then
    raise exception using errcode = '22023', message = 'Budget must be greater than zero.';
  end if;

  -- Validate both sources when supplied, so a valid report cannot mask invalid input.
  for count_text in select value from (values
    (p_scenario->>'travelers'), (p_report->>'travelers')
  ) supplied(value) where value is not null loop
    if btrim(count_text) !~ '^[0-9]+([.]0+)?$' then
      raise exception using errcode = '22023', message = 'Traveler count must be a positive whole number.';
    end if;
    begin
      if count_text::numeric < 1 or count_text::numeric > 2147483647 then
        raise exception using errcode = '22023', message = 'Traveler count must be a positive whole number.';
      end if;
    exception when numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'Enter a valid traveler count.';
    end;
  end loop;
  scenario_count := (p_scenario->>'travelers')::numeric;
  report_count := (p_report->>'travelers')::numeric;
  if scenario_count is not null and report_count is not null and scenario_count <> report_count then
    raise exception using errcode = '22023', message = 'Trip and report traveler counts must match.';
  end if;
  -- Earlier saved snapshots omitted the count. Updates preserve the existing row.
  if coalesce(scenario_count, report_count, p_existing_travelers) is null then
    raise exception using errcode = '22023', message = 'Enter the number of travelers.';
  end if;
  if coalesce(scenario_count, report_count, p_existing_travelers) < 1 then
    raise exception using errcode = '22023', message = 'Traveler count must be a positive whole number.';
  end if;
  return coalesce(scenario_count, report_count, p_existing_travelers)::integer;
end;
$$;
revoke all on function app_private.validate_trip_scenario(jsonb, jsonb, integer) from public, anon;
grant execute on function app_private.validate_trip_scenario(jsonb, jsonb, integer) to authenticated;

create or replace function public.trip_repository_create(p_scenario jsonb, p_report jsonb)
returns table (
  id uuid, user_id uuid, scenario jsonb, report jsonb,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql volatile security invoker set search_path = ''
as $$
declare new_id uuid; normalized_travelers integer;
begin
  normalized_travelers := app_private.validate_trip_scenario(p_scenario, p_report);
  insert into public.trip_scenarios (
    user_id, origin, destination, departure_date, return_date, budget,
    travelers, transportation_mode, scenario_snapshot
  ) values (
    auth.uid(), p_scenario->>'origin', p_scenario->>'destination',
    (p_scenario->>'startDate')::date, (p_scenario->>'endDate')::date,
    (p_scenario->>'budget')::numeric,
    normalized_travelers,
    p_scenario->>'transportation', p_scenario || jsonb_build_object('travelers', normalized_travelers)
  ) returning trip_scenarios.id into new_id;

  insert into public.trip_reports (
    scenario_id, total_cost, travel_time_minutes, weather_summary,
    recommendations, report_snapshot, created_at
  ) values (
    new_id, (p_scenario->>'cost')::numeric,
    round((p_scenario->>'travelTime')::numeric * 60)::integer,
    p_report #>> '{weather,status}',
    (p_report #> '{analysis,reasons}')::text,
    p_report || jsonb_build_object('travelers', normalized_travelers), clock_timestamp()
  );
  return query select * from public.trip_repository_get(new_id);
end;
$$;

create or replace function public.trip_repository_update(p_id uuid, p_scenario jsonb, p_report jsonb)
returns table (
  id uuid, user_id uuid, scenario jsonb, report jsonb,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql volatile security invoker set search_path = ''
as $$
declare existing_travelers integer; normalized_travelers integer;
begin
  select s.travelers into existing_travelers from public.trip_scenarios s
    where s.id = p_id and s.user_id = auth.uid() for update;
  if not found then return; end if;
  normalized_travelers := app_private.validate_trip_scenario(p_scenario, p_report, existing_travelers);
  update public.trip_scenarios s set
    origin = p_scenario->>'origin', destination = p_scenario->>'destination',
    departure_date = (p_scenario->>'startDate')::date,
    return_date = (p_scenario->>'endDate')::date,
    budget = (p_scenario->>'budget')::numeric,
    travelers = normalized_travelers,
    transportation_mode = p_scenario->>'transportation',
    scenario_snapshot = p_scenario || jsonb_build_object('travelers', normalized_travelers), updated_at = clock_timestamp()
  where s.id = p_id and s.user_id = auth.uid();
  if not found then return; end if;

  -- Append a report version; earlier report results remain in trip_reports.
  insert into public.trip_reports (
    scenario_id, total_cost, travel_time_minutes, weather_summary,
    recommendations, report_snapshot, created_at
  ) values (
    p_id, (p_scenario->>'cost')::numeric,
    round((p_scenario->>'travelTime')::numeric * 60)::integer,
    p_report #>> '{weather,status}',
    (p_report #> '{analysis,reasons}')::text,
    p_report || jsonb_build_object('travelers', normalized_travelers), clock_timestamp()
  );
  return query select * from public.trip_repository_get(p_id);
end;
$$;

revoke all on function public.trip_repository_create(jsonb, jsonb) from public, anon;
revoke all on function public.trip_repository_update(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.trip_repository_create(jsonb, jsonb) to authenticated;
grant execute on function public.trip_repository_update(uuid, jsonb, jsonb) to authenticated;
commit;
