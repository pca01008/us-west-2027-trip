-- Run in the existing Supabase project's SQL Editor before deploying the app.
-- Changes only photo MIME support and the existing editor INSERT policy.
begin;

update storage.buckets
set allowed_mime_types = array['image/webp','image/jpeg']
where id = 'trip-media';

drop policy if exists "editor can upload trip media" on storage.objects;
create policy "editor can upload trip media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-media'
  and public.is_trip_editor(split_part(name, '/', 1))
  and name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*/(photos|thumbs)/[a-f0-9]{64}\.(webp|jpg)$'
);

commit;
