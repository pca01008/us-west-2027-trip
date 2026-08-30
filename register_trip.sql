-- Run this once per trip after supabase_setup.sql.
-- Existing trip ownership is never reassigned silently.

do $$
declare
  v_trip_id text := 'us-west-2027';
  v_editor_email text := 'pca01008@gmail.com';
  v_editor_id uuid;
  v_existing_editor_id uuid;
begin
  if v_trip_id !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid trip id: %', v_trip_id;
  end if;

  select id into v_editor_id
  from auth.users
  where lower(email) = lower(v_editor_email)
  limit 1;

  if v_editor_id is null then
    raise exception 'Editor account % was not found in Authentication > Users', v_editor_email;
  end if;

  insert into public.trip_documents (trip_id)
  values (v_trip_id)
  on conflict (trip_id) do nothing;

  insert into public.trip_editors (trip_id, editor_id)
  values (v_trip_id, v_editor_id)
  on conflict (trip_id) do nothing;

  select editor_id into v_existing_editor_id
  from public.trip_editors
  where trip_id = v_trip_id;

  if v_existing_editor_id is distinct from v_editor_id then
    raise exception 'Trip % already belongs to another editor. Ownership was not changed.', v_trip_id;
  end if;
end;
$$;
