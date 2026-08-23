-- Run this in Supabase Dashboard > SQL Editor once for each new trip.
-- Before running it, create the editor account in Authentication > Users.
-- Change v_trip_id and v_editor_email when reusing the app for another trip.

do $$
declare
  v_trip_id text := 'us-west-2027';
  v_editor_email text := 'pca01008@gmail.com';
  v_editor_id uuid;
begin
  select id
    into v_editor_id
  from auth.users
  where lower(email) = lower(v_editor_email)
  limit 1;

  if v_editor_id is null then
    raise exception 'Editor account % was not found in Authentication > Users', v_editor_email;
  end if;

  insert into public.trip_documents (trip_id, editor_id)
  values (v_trip_id, v_editor_id)
  on conflict (trip_id) do update
  set editor_id = excluded.editor_id;
end;
$$;
