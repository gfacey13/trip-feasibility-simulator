-- One preferred scenario per account, accessible only by its owner.
begin;
create table public.preferred_trips (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scenario jsonb not null check (jsonb_typeof(scenario) = 'object')
);
alter table public.preferred_trips enable row level security;
revoke all on public.preferred_trips from anon;
grant select, insert, update, delete on public.preferred_trips to authenticated;
create policy "Read own preferred trip" on public.preferred_trips
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own preferred trip" on public.preferred_trips
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own preferred trip" on public.preferred_trips
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own preferred trip" on public.preferred_trips
  for delete to authenticated using ((select auth.uid()) = user_id);
commit;
