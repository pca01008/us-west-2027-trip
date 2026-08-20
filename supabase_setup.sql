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
revoke update on public.trip_documents from authenticated;

drop policy if exists "anyone can read the shared trip" on public.trip_documents;
create policy "anyone can read the shared trip"
on public.trip_documents for select
to anon, authenticated
using (true);

drop policy if exists "only the editor can update the shared trip" on public.trip_documents;

create table if not exists public.trip_document_versions (
  id bigint generated always as identity primary key,
  trip_id text not null references public.trip_documents(trip_id) on delete cascade,
  content jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists trip_document_versions_trip_created_idx
on public.trip_document_versions (trip_id, created_at desc, id desc);

alter table public.trip_document_versions enable row level security;

revoke all on public.trip_document_versions from anon;
grant select on public.trip_document_versions to authenticated;

drop policy if exists "only the editor can read trip versions" on public.trip_document_versions;
create policy "only the editor can read trip versions"
on public.trip_document_versions for select
to authenticated
using (
  exists (
    select 1
    from public.trip_documents document
    where document.trip_id = trip_document_versions.trip_id
      and document.editor_id = (select auth.uid())
  )
);

create or replace function public.save_trip_document(p_trip_id text, p_content jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  document_editor uuid;
  saved_version_id bigint;
  saved_at timestamptz;
begin
  select editor_id
    into document_editor
  from public.trip_documents
  where trip_id = p_trip_id
  for update;

  if document_editor is null or (select auth.uid()) is distinct from document_editor then
    raise exception 'Editor permission required';
  end if;

  insert into public.trip_document_versions (trip_id, content, created_by)
  values (p_trip_id, p_content, (select auth.uid()))
  returning id, created_at into saved_version_id, saved_at;

  update public.trip_documents
  set content = p_content
  where trip_id = p_trip_id
  returning updated_at into saved_at;

  delete from public.trip_document_versions old_version
  where old_version.trip_id = p_trip_id
    and old_version.id not in (
      select retained.id
      from public.trip_document_versions retained
      where retained.trip_id = p_trip_id
      order by retained.created_at desc, retained.id desc
      limit 50
    );

  return jsonb_build_object(
    'version_id', saved_version_id,
    'updated_at', saved_at
  );
end;
$$;

revoke all on function public.save_trip_document(text, jsonb) from public, anon;
grant execute on function public.save_trip_document(text, jsonb) to authenticated;

-- Schedule photos are compressed to WebP in the browser before upload.
-- The bucket is public so viewers can load thumbnails without signing in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-media', 'trip-media', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can read trip media" on storage.objects;
-- Public buckets serve known public URLs without a SELECT policy. Keeping this
-- policy absent also prevents anonymous clients from listing every object.

drop policy if exists "editor can upload trip media" on storage.objects;
create policy "editor can upload trip media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-media'
  and name like 'us-west-2027/%'
  and exists (
    select 1
    from public.trip_documents document
    where document.trip_id = 'us-west-2027'
      and document.editor_id = (select auth.uid())
  )
);

drop policy if exists "editor can update trip media" on storage.objects;
drop policy if exists "editor can delete trip media" on storage.objects;
-- The page never overwrites or removes objects. Keeping UPDATE/DELETE denied
-- preserves photos referenced by any of the retained document versions.

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
