-- SCRUM-72: adapts the existing normalized trip_scenarios/trip_reports schema.
-- Apply after preferred_trips exists. Keeps all existing tables and records.
begin;

alter table public.trip_scenarios
  add column if not exists scenario_snapshot jsonb;
alter table public.trip_reports
  add column if not exists report_snapshot jsonb;
create index if not exists scrum72_scenarios_owner
  on public.trip_scenarios(user_id, updated_at desc);
create index if not exists scrum72_reports_scenario
  on public.trip_reports(scenario_id, created_at desc);

alter table public.trip_scenarios enable row level security;
alter table public.trip_reports enable row level security;
-- Named policies only: existing policies are preserved. The restrictive policy
-- ensures another permissive policy cannot grant access to another owner's data.
do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'trip_scenarios' and policyname = 'scrum72_trip_scenarios_owner_access') then
    create policy scrum72_trip_scenarios_owner_access on public.trip_scenarios
      as permissive for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $policy$;
do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'trip_scenarios' and policyname = 'scrum72_trip_scenarios_owner_boundary') then
    create policy scrum72_trip_scenarios_owner_boundary on public.trip_scenarios
      as restrictive for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $policy$;
revoke all on public.trip_scenarios from anon;
grant select, insert, update, delete on public.trip_scenarios to authenticated;
do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'trip_reports' and policyname = 'scrum72_trip_reports_owner_access') then
    create policy scrum72_trip_reports_owner_access on public.trip_reports
      as permissive for all to authenticated
      using (exists (select 1 from public.trip_scenarios s where s.id = scenario_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.trip_scenarios s where s.id = scenario_id and s.user_id = (select auth.uid())));
  end if;
end $policy$;
do $policy$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'trip_reports' and policyname = 'scrum72_trip_reports_owner_boundary') then
    create policy scrum72_trip_reports_owner_boundary on public.trip_reports
      as restrictive for all to authenticated
      using (exists (select 1 from public.trip_scenarios s where s.id = scenario_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.trip_scenarios s where s.id = scenario_id and s.user_id = (select auth.uid())));
  end if;
end $policy$;
revoke all on public.trip_reports from anon;
grant select, insert, update, delete on public.trip_reports to authenticated;

-- Backfill the previously saved preferred scenario without changing source data.
-- Normalized columns retain their existing names. Original simulator fields are
-- preserved exactly in scenario_snapshot. Old records had no traveler count;
-- the destination schema's existing default of 1 is used for those records.
insert into public.trip_scenarios (
  user_id, origin, destination, departure_date, return_date, budget,
  travelers, transportation_mode, scenario_snapshot
)
select p.user_id, p.scenario->>'origin', p.scenario->>'destination',
  (p.scenario->>'startDate')::date, (p.scenario->>'endDate')::date,
  (p.scenario->>'budget')::numeric,
  coalesce((p.scenario->>'travelers')::integer, 1),
  p.scenario->>'transportation', p.scenario - 'report'
from public.preferred_trips p
where not exists (
  select 1 from public.trip_scenarios s
  where s.user_id = p.user_id and s.scenario_snapshot = p.scenario - 'report'
);

-- Preserve known legacy cost/time results, without fabricating a full report.
insert into public.trip_reports (
  scenario_id, total_cost, travel_time_minutes, report_snapshot
)
select s.id, (s.scenario_snapshot->>'cost')::numeric,
  round((s.scenario_snapshot->>'travelTime')::numeric * 60)::integer,
  p.scenario->'report'
from public.trip_scenarios s
join public.preferred_trips p
  on p.user_id = s.user_id and s.scenario_snapshot = p.scenario - 'report'
where not exists (select 1 from public.trip_reports r where r.scenario_id = s.id);

create or replace function public.trip_repository_list()
returns table (
  id uuid, user_id uuid, scenario jsonb, report jsonb,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select s.id, s.user_id,
    coalesce(s.scenario_snapshot, jsonb_build_object(
      'origin', s.origin, 'destination', s.destination,
      'startDate', s.departure_date, 'endDate', s.return_date,
      'budget', s.budget, 'travelers', s.travelers,
      'transportation', s.transportation_mode,
      'cost', r.total_cost, 'travelTime', r.travel_time_minutes / 60.0,
      'savedAt', s.updated_at
    )),
    coalesce(r.report_snapshot, case when r.id is not null then jsonb_build_object(
      'version', 0, 'estimatedTotal', r.total_cost,
      'estimatedTravelTime', r.travel_time_minutes / 60.0,
      'weatherSummary', r.weather_summary, 'feasibilityScore', r.feasibility_score,
      'recommendations', r.recommendations
    ) end),
    s.created_at, s.updated_at
  from public.trip_scenarios s
  left join lateral (
    select tr.* from public.trip_reports tr where tr.scenario_id = s.id
    order by tr.created_at desc, tr.id desc limit 1
  ) r on true
  where s.user_id = auth.uid()
  order by s.updated_at desc, s.id;
$$;

create or replace function public.trip_repository_get(p_id uuid)
returns table (
  id uuid, user_id uuid, scenario jsonb, report jsonb,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from public.trip_repository_list() r where r.id = p_id; $$;

create or replace function public.trip_repository_create(p_scenario jsonb, p_report jsonb)
returns table (
  id uuid, user_id uuid, scenario jsonb, report jsonb,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql volatile security invoker set search_path = ''
as $$
declare new_id uuid;
begin
    if trim(coalesce(p_scenario->>'origin', '')) = '' then
    raise exception 'Origin is required.';
  end if;

  if trim(coalesce(p_scenario->>'destination', '')) = '' then
    raise exception 'Destination is required.';
  end if;

  if (p_scenario->>'endDate')::date <=
     (p_scenario->>'startDate')::date then
    raise exception 'Return date must be after departure date.';
  end if;

  if (p_scenario->>'budget')::numeric < 0 then
    raise exception 'Budget cannot be negative.';
  end if;

  if coalesce(
    (p_report->>'travelers')::integer,
    (p_scenario->>'travelers')::integer,
    0
  ) < 1 then
    raise exception 'Traveler count must be a positive whole number.';
  end if;
  insert into public.trip_scenarios (
    user_id, origin, destination, departure_date, return_date, budget,
    travelers, transportation_mode, scenario_snapshot
  ) values (
    auth.uid(), p_scenario->>'origin', p_scenario->>'destination',
    (p_scenario->>'startDate')::date, (p_scenario->>'endDate')::date,
    (p_scenario->>'budget')::numeric,
    coalesce((p_report->>'travelers')::integer, (p_scenario->>'travelers')::integer, 1),
    p_scenario->>'transportation', p_scenario
  ) returning trip_scenarios.id into new_id;

  insert into public.trip_reports (
    scenario_id, total_cost, travel_time_minutes, weather_summary,
    recommendations, report_snapshot, created_at
  ) values (
    new_id, (p_scenario->>'cost')::numeric,
    round((p_scenario->>'travelTime')::numeric * 60)::integer,
    p_report #>> '{weather,status}',
    (p_report #> '{analysis,reasons}')::text, p_report, clock_timestamp()
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
begin
    if trim(coalesce(p_scenario->>'origin', '')) = '' then
    raise exception 'Origin is required.';
  end if;

  if trim(coalesce(p_scenario->>'destination', '')) = '' then
    raise exception 'Destination is required.';
  end if;

  if (p_scenario->>'endDate')::date <=
     (p_scenario->>'startDate')::date then
    raise exception 'Return date must be after departure date.';
  end if;

  if (p_scenario->>'budget')::numeric < 0 then
    raise exception 'Budget cannot be negative.';
  end if;

  if coalesce(
    (p_report->>'travelers')::integer,
    (p_scenario->>'travelers')::integer,
    0
  ) < 1 then
    raise exception 'Traveler count must be a positive whole number.';
  end if;
  update public.trip_scenarios s set
    origin = p_scenario->>'origin', destination = p_scenario->>'destination',
    departure_date = (p_scenario->>'startDate')::date,
    return_date = (p_scenario->>'endDate')::date,
    budget = (p_scenario->>'budget')::numeric,
    travelers = coalesce((p_report->>'travelers')::integer,
      (p_scenario->>'travelers')::integer, s.travelers),
    transportation_mode = p_scenario->>'transportation',
    scenario_snapshot = p_scenario, updated_at = clock_timestamp()
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
    (p_report #> '{analysis,reasons}')::text, p_report, clock_timestamp()
  );
  return query select * from public.trip_repository_get(p_id);
end;
$$;

create or replace function public.trip_repository_delete(p_id uuid)
returns boolean language plpgsql volatile security invoker set search_path = ''
as $$
begin
  -- Lock the scenario so concurrent updates/deletes cannot split the operation.
  perform 1 from public.trip_scenarios s
    where s.id = p_id and s.user_id = auth.uid() for update;
  if not found then return false; end if;
  delete from public.trip_reports r where r.scenario_id = p_id;
  delete from public.trip_scenarios s where s.id = p_id and s.user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.trip_repository_list() from public, anon;
grant execute on function public.trip_repository_list() to authenticated;
revoke all on function public.trip_repository_get(uuid) from public, anon;
grant execute on function public.trip_repository_get(uuid) to authenticated;
revoke all on function public.trip_repository_create(jsonb, jsonb) from public, anon;
grant execute on function public.trip_repository_create(jsonb, jsonb) to authenticated;
revoke all on function public.trip_repository_update(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.trip_repository_update(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.trip_repository_delete(uuid) from public, anon;
grant execute on function public.trip_repository_delete(uuid) to authenticated;
commit;
