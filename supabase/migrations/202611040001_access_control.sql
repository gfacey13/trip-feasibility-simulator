-- SCRUM-69: backend authorization. Apply after the SCRUM-72 migrations.
begin;

-- Harden direct access to the legacy table as well as the repository tables.
-- A restrictive policy keeps existing permissive policies inside the owner boundary.
revoke all on public.preferred_trips from public, anon;
alter table public.preferred_trips enable row level security;
create policy scrum69_preferred_owner_boundary on public.preferred_trips
  as restrictive for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.trip_scenarios, public.trip_reports from public, anon;
revoke truncate, references, trigger on public.preferred_trips,
  public.trip_scenarios, public.trip_reports from authenticated;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

-- Only trusted SQL administration can grant/revoke administrator membership.
-- Do not expose app_private as a Data API schema.
create table app_private.administrator_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table app_private.administrator_accounts enable row level security;
revoke all on app_private.administrator_accounts from public, anon, authenticated;

create function app_private.is_administrator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app_private.administrator_accounts a
    where a.user_id = auth.uid()
  );
$$;
revoke all on function app_private.is_administrator() from public, anon;
grant execute on function app_private.is_administrator() to authenticated;

-- No operational settings are invented or enabled by this migration.
create table public.administrator_settings (
  key text primary key check (length(btrim(key)) > 0),
  value jsonb not null
);
alter table public.administrator_settings enable row level security;
revoke all on public.administrator_settings from public, anon, authenticated;
grant select, insert, update, delete on public.administrator_settings to authenticated;
create policy scrum69_administrator_settings on public.administrator_settings
  for all to authenticated
  using ((select app_private.is_administrator()))
  with check ((select app_private.is_administrator()));

-- Metadata only. Trip details, report bodies, credentials and setting values
-- are excluded. Browser clients cannot insert, edit or remove audit entries.
create table public.access_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  resource text not null,
  resource_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  occurred_at timestamptz not null default clock_timestamp()
);
create index scrum69_audit_time on public.access_audit_log(occurred_at desc);
alter table public.access_audit_log enable row level security;
revoke all on public.access_audit_log from public, anon, authenticated;
grant select on public.access_audit_log to authenticated;
create policy scrum69_administrator_audit_read on public.access_audit_log
  for select to authenticated using ((select app_private.is_administrator()));

create function app_private.record_access_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare changed_row jsonb;
begin
  if tg_op = 'DELETE' then changed_row := to_jsonb(old);
  else changed_row := to_jsonb(new);
  end if;
  insert into public.access_audit_log(actor_id, resource, resource_id, action)
  values (
    auth.uid(), tg_table_name,
    coalesce(changed_row->>'id', changed_row->>'key', changed_row->>'user_id'),
    tg_op
  );
  return null;
end;
$$;
revoke all on function app_private.record_access_change() from public, anon, authenticated;
create trigger scrum69_audit_change
  after insert or update or delete on public.trip_scenarios
  for each row execute function app_private.record_access_change();
create trigger scrum69_audit_change
  after insert or update or delete on public.trip_reports
  for each row execute function app_private.record_access_change();
create trigger scrum69_audit_change
  after insert or update or delete on public.preferred_trips
  for each row execute function app_private.record_access_change();
create trigger scrum69_audit_change
  after insert or update or delete on public.administrator_settings
  for each row execute function app_private.record_access_change();
create trigger scrum69_audit_change
  after insert or update or delete on app_private.administrator_accounts
  for each row execute function app_private.record_access_change();
revoke all on function public.trip_repository_list() from public, anon;
revoke all on function public.trip_repository_get(uuid) from public, anon;
revoke all on function public.trip_repository_create(jsonb, jsonb) from public, anon;
revoke all on function public.trip_repository_update(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.trip_repository_delete(uuid) from public, anon;
commit;
