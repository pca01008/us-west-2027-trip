-- Minimal Supabase contracts for a disposable PostgreSQL database.
-- Auth JWT verification and the Storage HTTP/object service are NOT emulated.
create schema auth;
create table auth.users (id uuid primary key, email text unique not null);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Start with broad Supabase-style grants so RLS and explicit revokes matter.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id bigint generated always as identity primary key,
  bucket_id text references storage.buckets(id), name text not null,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage on all sequences in schema storage to anon, authenticated;

insert into auth.users values
  ('00000000-0000-4000-8000-000000000001', 'editor-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'editor-b@example.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'viewer@example.invalid');
