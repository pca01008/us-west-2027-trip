-- Run this once in Supabase Dashboard > SQL Editor.
-- Create the editor account (pca01008@gmail.com) in Authentication > Users first.

create table if not exists public.trip_documents (
  trip_id text primary key,
  content jsonb not null default '{}'::jsonb,
  editor_id uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create or replace function public.set_trip_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trip_documents_set_updated_at on public.trip_documents;
create trigger trip_documents_set_updated_at
before update on public.trip_documents
for each row execute function public.set_trip_document_updated_at();

-- The editor account must already exist before this statement runs.
insert into public.trip_documents (trip_id, editor_id)
select 'us-west-2027', id
from auth.users
where email = 'pca01008@gmail.com'
on conflict (trip_id) do nothing;

alter table public.trip_documents enable row level security;

grant select on public.trip_documents to anon, authenticated;
grant update on public.trip_documents to authenticated;

drop policy if exists "anyone can read the shared trip" on public.trip_documents;
create policy "anyone can read the shared trip"
on public.trip_documents for select
to anon, authenticated
using (true);

drop policy if exists "only the editor can update the shared trip" on public.trip_documents;
create policy "only the editor can update the shared trip"
on public.trip_documents for update
to authenticated
using ((select auth.uid()) = editor_id)
with check ((select auth.uid()) = editor_id);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_documents'
  ) then
    alter publication supabase_realtime add table public.trip_documents;
  end if;
end;
$$;
