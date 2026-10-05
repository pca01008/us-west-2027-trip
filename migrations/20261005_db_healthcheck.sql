-- Run once in Supabase SQL Editor. Safe to repeat; no trip data is changed.
begin;

create table if not exists public.healthcheck (
  id smallint primary key check (id = 1)
);

insert into public.healthcheck (id) values (1)
on conflict (id) do nothing;

alter table public.healthcheck enable row level security;
revoke all on table public.healthcheck from public, anon, authenticated;
grant select (id) on table public.healthcheck to anon;

drop policy if exists "read the healthcheck sentinel" on public.healthcheck;
create policy "read the healthcheck sentinel"
on public.healthcheck for select to anon
using (id = 1);

comment on table public.healthcheck is
  'Non-sensitive sentinel used by the external database availability monitor.';

commit;
