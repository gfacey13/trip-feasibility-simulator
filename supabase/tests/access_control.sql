-- SCRUM-69. Run after the SCRUM-72 and SCRUM-69 migrations in SQL Editor.
-- Three isolated test accounts. All changes are rolled back.
begin;
select set_config('test.owner_a', gen_random_uuid()::text, true);
select set_config('test.owner_b', gen_random_uuid()::text, true);
select set_config('test.administrator', gen_random_uuid()::text, true);
select set_config('test.setting', 'scrum69-test-' || gen_random_uuid()::text, true);
insert into auth.users(id, raw_user_meta_data) values
  (current_setting('test.owner_a')::uuid, '{}'),
  (current_setting('test.owner_b')::uuid, '{"role":"admin","is_admin":true}'),
  (current_setting('test.administrator')::uuid, '{}');
insert into app_private.administrator_accounts(user_id)
  values (current_setting('test.administrator')::uuid);
insert into public.administrator_settings(key, value)
  values (current_setting('test.setting'), '{"enabled":false}');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
do $test$
declare saved_id uuid; report_id uuid; statement text;
begin
  if app_private.is_administrator() then raise exception 'Ordinary account became an administrator'; end if;
  select id into saved_id from public.trip_repository_create(
    '{"origin":"Norfolk","destination":"Boston","startDate":"2026-11-08","endDate":"2026-11-14","budget":7000,"travelers":2,"transportation":"train","cost":1280,"travelTime":8.3}',
    '{"analysis":{"status":"Feasible"}}');
  perform set_config('test.scenario_a', saved_id::text, true);
  select id into report_id from public.trip_reports where scenario_id = saved_id limit 1;
  perform set_config('test.report_a', report_id::text, true);
  insert into public.preferred_trips(user_id, scenario) values (auth.uid(), '{"origin":"Norfolk"}');
  if not exists(select 1 from public.trip_repository_get(saved_id)) then raise exception 'Owner cannot read trip'; end if;
  if not exists(select 1 from public.trip_reports where id = report_id) then raise exception 'Owner cannot read report'; end if;
  foreach statement in array array[
    'select * from app_private.administrator_accounts',
    'truncate public.trip_scenarios cascade',
    'truncate public.trip_reports',
    'truncate public.preferred_trips',
    'insert into app_private.administrator_accounts(user_id) values(auth.uid())',
    'delete from app_private.administrator_accounts where user_id = auth.uid()',
    'insert into public.access_audit_log(resource, resource_id, action) values(''forged'', ''x'', ''INSERT'')',
    'update public.access_audit_log set action = ''DELETE''',
    'delete from public.access_audit_log',
    'insert into public.administrator_settings(key, value) values(''forged'', ''{}'')'
  ] loop
    begin execute statement; raise exception 'Forbidden operation succeeded: %', statement;
    exception when insufficient_privilege then null;
    end;
  end loop;
  if exists(select 1 from public.administrator_settings) then raise exception 'Settings leaked'; end if;
  if exists(select 1 from public.access_audit_log) then raise exception 'Logs leaked'; end if;
  update public.administrator_settings set value = '{}' where key = current_setting('test.setting');
  if found then raise exception 'Nonadministrator edited settings'; end if;
  delete from public.administrator_settings where key = current_setting('test.setting');
  if found then raise exception 'Nonadministrator deleted settings'; end if;
  begin
    update public.trip_scenarios set user_id = current_setting('test.owner_b')::uuid where id = saved_id;
    raise exception 'Owner could transfer ownership';
  exception when insufficient_privilege then null;
  end;
end $test$;

-- A second ordinary account claims an administrator role in editable metadata.
select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);
select set_config('request.jwt.claims', '{"user_metadata":{"role":"admin","is_admin":true}}', true);
do $test$
declare saved_id uuid;
begin
  if app_private.is_administrator() then raise exception 'Profile metadata granted administrator access'; end if;
  if exists(select 1 from public.trip_repository_get(current_setting('test.scenario_a')::uuid)) then raise exception 'RPC trip leak'; end if;
  if exists(select 1 from public.trip_scenarios where id = current_setting('test.scenario_a')::uuid) then raise exception 'Direct trip leak'; end if;
  if exists(select 1 from public.trip_reports where id = current_setting('test.report_a')::uuid) then raise exception 'Report leak'; end if;
  if exists(select 1 from public.preferred_trips where user_id = current_setting('test.owner_a')::uuid) then raise exception 'Legacy trip leak'; end if;
  if exists(select 1 from public.administrator_settings) then raise exception 'Forged administrator read settings'; end if;
  if exists(select 1 from public.access_audit_log) then raise exception 'Forged administrator read logs'; end if;
  if exists(select 1 from public.trip_repository_update(current_setting('test.scenario_a')::uuid, '{}', '{}')) then raise exception 'RPC edited another trip'; end if;
  if public.trip_repository_delete(current_setting('test.scenario_a')::uuid) then raise exception 'RPC deleted another trip'; end if;
  update public.trip_scenarios set origin = 'forged' where id = current_setting('test.scenario_a')::uuid;
  if found then raise exception 'Direct cross-account update'; end if;
  delete from public.trip_scenarios where id = current_setting('test.scenario_a')::uuid;
  if found then raise exception 'Direct cross-account delete'; end if;
  update public.trip_reports set recommendations = 'forged' where id = current_setting('test.report_a')::uuid;
  if found then raise exception 'Cross-account report edit'; end if;
  delete from public.trip_reports where id = current_setting('test.report_a')::uuid;
  if found then raise exception 'Cross-account report delete'; end if;
  update public.preferred_trips set scenario = '{}' where user_id = current_setting('test.owner_a')::uuid;
  if found then raise exception 'Cross-account legacy edit'; end if;
  delete from public.preferred_trips where user_id = current_setting('test.owner_a')::uuid;
  if found then raise exception 'Cross-account legacy delete'; end if;
  begin
    insert into public.trip_reports(scenario_id, total_cost) values(current_setting('test.scenario_a')::uuid, 0);
    raise exception 'Cross-account report insertion';
  exception when insufficient_privilege then null;
  end;
  select id into saved_id from public.trip_repository_create(
    '{"origin":"Norfolk","destination":"Miami","startDate":"2026-11-08","endDate":"2026-11-14","budget":7000,"transportation":"car","cost":100,"travelTime":2}', '{}');
  if not exists(select 1 from public.trip_repository_get(saved_id)) then raise exception 'Second owner cannot read own trip'; end if;
  if not public.trip_repository_delete(saved_id) then raise exception 'Second owner cannot delete own trip'; end if;
end $test$;

-- Administrators can manage settings and read audit events, while trip ownership holds.
select set_config('request.jwt.claim.sub', current_setting('test.administrator'), true);
do $test$
declare statement text;
begin
  if not app_private.is_administrator() then raise exception 'Administrator not recognized'; end if;
  if not exists(select 1 from public.administrator_settings where key = current_setting('test.setting')) then raise exception 'Administrator cannot read settings'; end if;
  update public.administrator_settings set value = '{"enabled":true}' where key = current_setting('test.setting');
  if not found then raise exception 'Administrator cannot update setting'; end if;
  insert into public.administrator_settings(key, value) values(current_setting('test.setting') || '-extra', '{}');
  delete from public.administrator_settings where key = current_setting('test.setting') || '-extra';
  if not found then raise exception 'Administrator cannot create/delete setting'; end if;
  if not exists(select 1 from public.access_audit_log where resource = 'trip_scenarios'
    and resource_id = current_setting('test.scenario_a') and actor_id = current_setting('test.owner_a')::uuid
    and action = 'INSERT') then raise exception 'Successful write not audited'; end if;
  if not exists(select 1 from public.access_audit_log where resource = 'administrator_settings'
    and resource_id = current_setting('test.setting') and action = 'UPDATE') then raise exception 'Setting edit not audited'; end if;
  if exists(select 1 from public.trip_repository_get(current_setting('test.scenario_a')::uuid)) then raise exception 'Administrator accessed another traveler trip'; end if;
  if exists(select 1 from public.trip_reports where id = current_setting('test.report_a')::uuid) then raise exception 'Administrator accessed another traveler report'; end if;
  foreach statement in array array[
    'insert into app_private.administrator_accounts(user_id) values(auth.uid())',
    'insert into public.access_audit_log(resource, resource_id, action) values(''forged'', ''x'', ''INSERT'')',
    'update public.access_audit_log set action = ''DELETE''',
    'delete from public.access_audit_log'
  ] loop
    begin execute statement; raise exception 'Administrator forged audit or membership: %', statement;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $test$;

-- Membership revocation works without a new JWT or login.
reset role;
delete from app_private.administrator_accounts where user_id = current_setting('test.administrator')::uuid;
set local role authenticated;
do $test$
begin
  if app_private.is_administrator() then raise exception 'Revoked administrator retained access'; end if;
  if exists(select 1 from public.administrator_settings) then raise exception 'Revoked administrator read settings'; end if;
  if exists(select 1 from public.access_audit_log) then raise exception 'Revoked administrator read logs'; end if;
end $test$;

-- Guest requests are rejected by backend permissions, independently of the UI.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $test$
declare statement text;
begin
  foreach statement in array array[
    'select * from public.trip_repository_list()',
    'select * from public.trip_repository_get(gen_random_uuid())',
    'select * from public.trip_repository_create(''{}'', ''{}'')',
    'select * from public.trip_repository_update(gen_random_uuid(), ''{}'', ''{}'')',
    'select public.trip_repository_delete(gen_random_uuid())',
    'select * from public.trip_scenarios',
    'select * from public.trip_reports',
    'select * from public.preferred_trips',
    'select * from public.administrator_settings',
    'select * from public.access_audit_log',
    'select app_private.is_administrator()'
  ] loop
    begin execute statement; raise exception 'Guest backend access succeeded: %', statement;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $test$;
reset role;
rollback;
select 'PASS: SCRUM-69 ownership, guest denial, administrator restrictions, audit protection, metadata spoofing and role revocation; test data rolled back.' as result;
