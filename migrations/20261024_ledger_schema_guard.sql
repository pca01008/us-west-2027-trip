-- Apply before deploying schema 6 clients. Retains editor authorization and revision locking.
begin;
create or replace function public.save_trip_document(
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
  stored_schema_version numeric;
  incoming_schema_version numeric;
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

  if p_content ? 'schemaVersion' and (jsonb_typeof(p_content->'schemaVersion') <> 'number'
    or (p_content->>'schemaVersion') !~ '^[0-9]+$') then
    raise exception 'Invalid document schema' using errcode = '22023';
  end if;
  incoming_schema_version := coalesce((p_content->>'schemaVersion')::numeric, 0);

  select revision, coalesce((content->>'schemaVersion')::numeric, 0) into current_revision, stored_schema_version
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

  if incoming_schema_version < stored_schema_version then
    raise exception 'Document schema downgrade rejected; refresh the app' using errcode = '22023';
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

commit;
