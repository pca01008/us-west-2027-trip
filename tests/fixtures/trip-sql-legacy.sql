-- Earlier layout: public editor_id, no revision/note/content_size, policies
-- depending on editor_id. Values are synthetic and must survive the upgrade.
create table public.trip_documents (
  trip_id text primary key, content jsonb not null default '{}',
  editor_id uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.trip_documents (trip_id, content, editor_id) values
  ('sql-trip-a', '{"html":"<main>기존 일정</main>","checks":{"packed":true}}', '00000000-0000-4000-8000-000000000001'),
  ('sql-trip-b', '{"html":"<main>다른 여행</main>"}', '00000000-0000-4000-8000-000000000002');
alter table public.trip_documents enable row level security;
create policy "only the editor can update the shared trip"
on public.trip_documents for update to authenticated using (editor_id = auth.uid());
create table public.trip_document_versions (
  id bigint generated always as identity primary key,
  trip_id text not null references public.trip_documents(trip_id) on delete cascade,
  content jsonb not null, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
insert into public.trip_document_versions (trip_id, content, created_by)
select trip_id, content, editor_id from public.trip_documents;
alter table public.trip_document_versions enable row level security;
create policy "only the editor can read trip versions"
on public.trip_document_versions for select to authenticated using (
  exists (select 1 from public.trip_documents d where d.trip_id = trip_document_versions.trip_id and d.editor_id = auth.uid())
);
create policy "editor can upload trip media"
on storage.objects for insert to authenticated with check (
  exists (select 1 from public.trip_documents d where d.trip_id = split_part(name, '/', 1) and d.editor_id = auth.uid())
);
create function public.save_trip_document(text, jsonb) returns void language sql as $$ select; $$;
