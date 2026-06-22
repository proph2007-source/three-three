create table if not exists public.region_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{"members":[],"messages":[],"reports":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.region_app_state enable row level security;

drop policy if exists "Users can read their own region app state" on public.region_app_state;
create policy "Users can read their own region app state"
on public.region_app_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own region app state" on public.region_app_state;
create policy "Users can insert their own region app state"
on public.region_app_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own region app state" on public.region_app_state;
create policy "Users can update their own region app state"
on public.region_app_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own region app state" on public.region_app_state;
create policy "Users can delete their own region app state"
on public.region_app_state
for delete
to authenticated
using ((select auth.uid()) = user_id);
