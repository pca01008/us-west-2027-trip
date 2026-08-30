-- Run this in Supabase Dashboard > SQL Editor after reviewing the migration.
-- It is idempotent and upgrades the earlier single-table editor mapping safely.

create table if not exists public.trip_documents (
  trip_id text primary key,
  content jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.trip_documents
  add column if not exists revision bigint not null default 0;

create table if not exists public.trip_editors (
  trip_id text primary key references public.trip_documents(trip_id) on delete cascade,
  editor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Copy existing editor assignments before removing the formerly public column.
do $migration$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_documents'
      and column_name = 'editor_id'
  ) then
    execute $sql$
      insert into public.trip_editors (trip_id, editor_id)
      select trip_id, editor_id
      from public.trip_documents
      where editor_id is not null
      on conflict (trip_id) do nothing
    $sql$;
  end if;
end;
$migration$;

-- Older policies can depend on trip_documents.editor_id. Remove those
-- dependencies before dropping the formerly public column.
do $policy_cleanup$
begin
  if to_regclass('public.trip_document_versions') is not null then
    execute 'drop policy if exists "only the editor can read trip versions" on public.trip_document_versions';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "editor can upload trip media" on storage.objects';
  end if;
end;
$policy_cleanup$;

drop policy if exists "only the editor can update the shared trip" on public.trip_documents;
alter table public.trip_documents drop column if exists editor_id;

create or replace function public.set_trip_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
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

alter table public.trip_documents enable row level security;
alter table public.trip_editors enable row level security;

grant select on public.trip_documents to anon, authenticated;
revoke insert, update, delete on public.trip_documents from anon, authenticated;
revoke all on public.trip_editors from anon, authenticated;

drop policy if exists "anyone can read the shared trip" on public.trip_documents;
create policy "anyone can read the shared trip"
on public.trip_documents for select
to anon, authenticated
using (true);

create or replace function public.is_trip_editor(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.trip_editors editor
    where editor.trip_id = p_trip_id
      and editor.editor_id = (select auth.uid())
  );
$$;

revoke all on function public.is_trip_editor(text) from public, anon;
grant execute on function public.is_trip_editor(text) to authenticated;

create table if not exists public.trip_document_versions (
  id bigint generated always as identity primary key,
  trip_id text not null references public.trip_documents(trip_id) on delete cascade,
  content jsonb not null,
  note text,
  content_size integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.trip_document_versions add column if not exists note text;
alter table public.trip_document_versions add column if not exists content_size integer not null default 0;

create index if not exists trip_document_versions_trip_created_idx
on public.trip_document_versions (trip_id, created_at desc, id desc);

alter table public.trip_document_versions enable row level security;
revoke all on public.trip_document_versions from anon;
revoke all on public.trip_document_versions from authenticated;
grant select (id, trip_id, content, note, content_size, created_at)
on public.trip_document_versions to authenticated;

drop policy if exists "only the editor can read trip versions" on public.trip_document_versions;
create policy "only the editor can read trip versions"
on public.trip_document_versions for select
to authenticated
using (public.is_trip_editor(trip_id));

drop function if exists public.save_trip_document(text, jsonb);
drop function if exists public.save_trip_document(text, jsonb, bigint, text);
create function public.save_trip_document(
  p_trip_id text,
  p_content jsonb,
  p_expected_revision bigint,
  p_version_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
  next_revision bigint;
  saved_version_id bigint;
  saved_at timestamptz;
  clean_note text;
  serialized_size integer;
begin
  if not public.is_trip_editor(p_trip_id) then
    raise exception 'Editor permission required' using errcode = '42501';
  end if;

  if p_content is null
    or jsonb_typeof(p_content) <> 'object'
    or jsonb_typeof(p_content -> 'html') <> 'string'
    or coalesce(length(p_content ->> 'html'), 0) = 0 then
    raise exception 'Invalid trip document' using errcode = '22023';
  end if;

  serialized_size := octet_length(convert_to(p_content::text, 'UTF8'));
  if serialized_size > 4194304 then
    raise exception 'Trip document exceeds 4 MiB' using errcode = '22023';
  end if;

  select revision into current_revision
  from public.trip_documents
  where trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip document not found' using errcode = 'P0002';
  end if;

  if p_expected_revision is null or p_expected_revision <> current_revision then
    raise exception 'Revision conflict: expected %, current %', p_expected_revision, current_revision
      using errcode = '40001';
  end if;

  clean_note := nullif(left(regexp_replace(coalesce(p_version_note, ''), '[[:cntrl:]]+', ' ', 'g'), 120), '');

  insert into public.trip_document_versions
    (trip_id, content, note, content_size, created_by)
  values
    (p_trip_id, p_content, clean_note, serialized_size, (select auth.uid()))
  returning id, created_at into saved_version_id, saved_at;

  next_revision := current_revision + 1;
  update public.trip_documents
  set content = p_content,
      revision = next_revision
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
    'revision', next_revision,
    'updated_at', saved_at
  );
end;
$$;

revoke all on function public.save_trip_document(text, jsonb, bigint, text) from public, anon;
grant execute on function public.save_trip_document(text, jsonb, bigint, text) to authenticated;

-- Photos are immutable WebP objects. Viewers use public object URLs, while only
-- the assigned editor can upload into that trip's content-addressed folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-media', 'trip-media', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can read trip media" on storage.objects;

drop policy if exists "editor can upload trip media" on storage.objects;
create policy "editor can upload trip media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-media'
  and public.is_trip_editor(split_part(name, '/', 1))
  and name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*/(photos|thumbs)/[a-f0-9]{64}\.webp$'
);

drop policy if exists "editor can update trip media" on storage.objects;
drop policy if exists "editor can delete trip media" on storage.objects;

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
