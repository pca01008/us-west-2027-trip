import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test, { after } from 'node:test';
import pg from 'pg';

// Never infer credentials from the app, DATABASE_URL, or Supabase configuration.
const rawURL = process.env.TRIP_SQL_TEST_URL;
if (!rawURL) throw new Error('Set TRIP_SQL_TEST_URL to a disposable local PostgreSQL superuser URL.');
const baseURL = new URL(rawURL);
if (!['postgres:', 'postgresql:'].includes(baseURL.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(baseURL.hostname)
    || baseURL.search || baseURL.hash) {
  throw new Error('TRIP_SQL_TEST_URL must use loopback PostgreSQL, without query parameters or a fragment.');
}
const source = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [setup, registration, bootstrap, legacy] = await Promise.all([
  source('supabase_setup.sql'), source('register_trip.sql'),
  source('tests/fixtures/trip-sql-bootstrap.sql'), source('tests/fixtures/trip-sql-legacy.sql'),
]);
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const VIEWER = '00000000-0000-4000-8000-000000000003';
const TRIP = 'sql-trip-a';
const OTHER = 'sql-trip-b';
const versionColumns = 'id, trip_id, content, note, content_size, created_at';
const saveSQL = 'select public.save_trip_document($1, $2::jsonb, $3::bigint, $4) as saved';
const document = label => ({ html: `<main>${label}</main>`, checks: { packed: true } });
const sqlString = value => `'${value.replaceAll("'", "''")}'`;
function register(trip = TRIP, email = 'editor-a@example.invalid') {
  // Replace only the two configuration literals; execute the real DO block.
  assert.match(registration, /v_trip_id text := '[^']*';/);
  assert.match(registration, /v_editor_email text := '[^']*';/);
  return registration.replace(/v_trip_id text := '[^']*';/, () => `v_trip_id text := ${sqlString(trip)};`)
    .replace(/v_editor_email text := '[^']*';/, () => `v_editor_email text := ${sqlString(email)};`);
}
async function connect(url) {
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000,
    statement_timeout: 10000, query_timeout: 15000, application_name: 'trip-sql-test' });
  await client.connect();
  return client;
}
const admin = await connect(baseURL);
const createdRoles = [];
after(async () => {
  try { for (const role of createdRoles) await admin.query(`drop role ${role}`); }
  finally { await admin.end(); }
});
for (const role of ['anon', 'authenticated']) {
  const { rows } = await admin.query('select rolsuper, rolbypassrls from pg_roles where rolname = $1', [role]);
  if (!rows.length) {
    await admin.query(`create role ${role} nologin nosuperuser nobypassrls`);
    createdRoles.push(role);
  } else {
    assert.equal(rows[0].rolsuper, false, `${role} must not bypass permissions`);
    assert.equal(rows[0].rolbypassrls, false, `${role} must not bypass RLS`);
  }
}

async function isolated(autoGrants, run) {
  const name = `trip_sql_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseURL);
  url.pathname = `/${name}`;
  await admin.query(`create database ${name} template template0`);
  const clients = [];
  try {
    const open = async () => { const c = await connect(url); clients.push(c); return c; };
    const db = await open();
    await db.query(bootstrap);
    if (autoGrants) {
      await db.query(`
        alter default privileges in schema public grant all on tables to anon, authenticated;
        alter default privileges in schema public grant all on sequences to anon, authenticated;
      `);
    }
    // A real table and identity sequence prove the selected defaults before the
    // production SQL runs. No RLS can mask missing grants in this control.
    await db.query('create table public.sql_grant_probe (id bigint generated always as identity)');
    await db.query('insert into public.sql_grant_probe default values');
    for (const uid of [null, A]) {
      const role = uid === null ? 'anon' : 'authenticated';
      assert.equal((await db.query("select has_sequence_privilege($1, 'public.sql_grant_probe_id_seq', 'USAGE') as allowed", [role])).rows[0].allowed, autoGrants);
      const readProbe = () => asUser(db, uid, () => db.query('select id from public.sql_grant_probe'));
      if (autoGrants) assert.equal((await readProbe()).rows.length, 1);
      else await rejected(readProbe, '42501');
    }
    await db.query('drop table public.sql_grant_probe');
    await run(db, open);
  } finally {
    try { await Promise.all(clients.map(c => c.end())); }
    finally { await admin.query(`drop database ${name} with (force)`); }
  }
}
async function asUser(db, uid, action) {
  await db.query('begin');
  try {
    await db.query(`set local role ${uid === null ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? '']);
    const result = await action();
    await db.query('commit');
    return result;
  } catch (error) { await db.query('rollback'); throw error; }
}
const save = (db, uid, trip, content, revision, note = null) => asUser(db, uid,
  async () => (await db.query(saveSQL, [trip, JSON.stringify(content), revision, note])).rows[0].saved);
async function snapshot(db) {
  const result = {};
  for (const [table, order] of [['trip_documents', 'trip_id'], ['trip_editors', 'trip_id'], ['trip_document_versions', 'id']]) {
    result[table] = (await db.query(`select * from public.${table} order by ${order}`)).rows;
  }
  return result;
}
const rejected = (action, code) => assert.rejects(action, error => error.code === code);

async function checkFreshInstall(autoGrants, t) {
  await isolated(autoGrants, async (db, open) => {
    await db.query(setup);
    await db.query(register());
    await db.query(register(OTHER, 'editor-b@example.invalid'));

    await t.test('normal save increments once and stores the exact document and metadata', async () => {
      const content = document('첫 저장');
      const result = await save(db, A, TRIP, content, 0, 'note\n' + 'x'.repeat(150));
      assert.equal(result.revision, 1);
      const row = (await db.query('select * from public.trip_documents where trip_id = $1', [TRIP])).rows[0];
      const version = (await db.query('select * from public.trip_document_versions where id = $1', [result.version_id])).rows[0];
      assert.deepEqual(row.content, content);
      assert.equal(row.revision, '1');
      assert.equal(new Date(result.updated_at).getTime(), row.updated_at.getTime());
      assert.deepEqual(version.content, content);
      assert.equal(version.created_by, A);
      assert.equal(version.note, 'note ' + 'x'.repeat(115));
      const bytes = (await db.query('select octet_length(convert_to($1::jsonb::text, \'UTF8\')) as size', [JSON.stringify(content)])).rows[0].size;
      assert.equal(version.content_size, bytes);
      await save(db, B, OTHER, document('다른 여행 버전'), 0);
    });

    await t.test('anonymous, non-editor, missing identity and another trip editor cannot save or read private versions', async () => {
      const before = await snapshot(db);
      for (const uid of [null, VIEWER, '', B]) {
        await rejected(() => save(db, uid, TRIP, document('denied'), 1), '42501');
        const readVersions = () => asUser(db, uid, () => db.query(`select ${versionColumns} from public.trip_document_versions where trip_id = $1`, [TRIP]));
        if (uid === null) await rejected(readVersions, '42501');
        else assert.deepEqual((await readVersions()).rows, []);
        await rejected(() => asUser(db, uid, () => db.query('select * from public.trip_editors')), '42501');
      }
      assert.equal((await asUser(db, A, () => db.query(`select ${versionColumns} from public.trip_document_versions where trip_id = $1`, [TRIP]))).rows.length, 1);
      await rejected(() => asUser(db, A, () => db.query('select created_by from public.trip_document_versions')), '42501');
      assert.equal((await asUser(db, null, () => db.query('select content from public.trip_documents'))).rows.length, 2);
      assert.deepEqual(await snapshot(db), before);
    });

    await t.test('direct writes to documents, versions and editor mapping are denied even for the editor', async () => {
      const before = await snapshot(db);
      for (const uid of [null, VIEWER, A, B]) {
        for (const sql of [
          `insert into public.trip_documents (trip_id) values ('direct')`,
          `update public.trip_documents set content = '{}' where trip_id = '${TRIP}'`,
          `delete from public.trip_documents where trip_id = '${TRIP}'`,
          'truncate public.trip_documents cascade',
          `insert into public.trip_document_versions (trip_id, content, created_by) values ('${TRIP}', '{}', '${A}')`,
          'update public.trip_document_versions set note = \'direct\'',
          'delete from public.trip_document_versions', 'truncate public.trip_document_versions',
          `insert into public.trip_editors (trip_id, editor_id) values ('direct', '${A}')`,
          `update public.trip_editors set editor_id = '${B}'`,
          'delete from public.trip_editors', 'truncate public.trip_editors',
        ]) await rejected(() => asUser(db, uid, () => db.query(sql)), '42501');
      }
      assert.deepEqual(await snapshot(db), before);
    });

    await t.test('conflicts, malformed documents and size overflow leave documents and history unchanged', async () => {
      const before = await snapshot(db);
      for (const rev of [null, 0, 2, -1]) {
        await rejected(() => save(db, A, TRIP, document('stale'), rev), '40001');
        assert.deepEqual(await snapshot(db), before);
      }
      for (const content of [null, [], 'text', 1, true, {}, { html: null }, { html: '' }, { html: 1 }, { html: [] }, { html: {} }, { html: '한'.repeat(1_400_000) }]) {
        await rejected(() => save(db, A, TRIP, content, 1), '22023');
        assert.deepEqual(await snapshot(db), before);
      }
      await rejected(() => asUser(db, A, () => db.query(saveSQL, [TRIP, null, 1, null])), '22023');
      assert.deepEqual(await snapshot(db), before);
    });

    await t.test('two independent connections overlap: one save commits, the blocked save conflicts', async () => {
      const first = await open();
      const second = await open();
      const pid1 = (await first.query('select pg_backend_pid() as pid')).rows[0].pid;
      const pid2 = (await second.query('select pg_backend_pid() as pid')).rows[0].pid;
      assert.notEqual(pid1, pid2);
      const before = await snapshot(db);
      let pending;
      try {
        for (const c of [first, second]) {
          await c.query('begin');
          await c.query('set local role authenticated');
          await c.query("select set_config('request.jwt.claim.sub', $1, true)", [A]);
        }
        const winner = document('connection one');
        await first.query(saveSQL, [TRIP, JSON.stringify(winner), 1, null]);
        pending = second.query(saveSQL, [TRIP, JSON.stringify(document('connection two')), 1, null])
          .then(result => ({ result }), error => ({ error }));
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const row = (await db.query('select $1::int = any(pg_blocking_pids($2::int)) as blocked', [pid1, pid2])).rows[0];
          if (row.blocked) { blocked = true; break; }
          await delay(20);
        }
        assert.equal(blocked, true, 'second connection must actually wait on the first transaction');
        await first.query('commit');
        const loser = await pending;
        assert.equal(loser.error?.code, '40001');
        await second.query('rollback');
        const afterSave = await snapshot(db);
        const row = afterSave.trip_documents.find(d => d.trip_id === TRIP);
        assert.equal(row.revision, '2');
        assert.deepEqual(row.content, winner);
        assert.equal(afterSave.trip_document_versions.length, before.trip_document_versions.length + 1);
        assert.deepEqual(afterSave.trip_document_versions.slice(0, -1), before.trip_document_versions);
        assert.deepEqual(afterSave.trip_document_versions.at(-1).content, winner);
        assert.deepEqual(afterSave.trip_documents.find(d => d.trip_id === OTHER), before.trip_documents.find(d => d.trip_id === OTHER));
      } finally {
        await first.query('rollback');
        if (pending) await pending;
        await second.query('rollback');
      }
    });

    await t.test('retain the latest 50 versions per trip, including tied timestamps', async () => {
      const before = await snapshot(db);
      const ids = [];
      await asUser(db, A, async () => {
        // All created_at values tie within this transaction; id must break ties.
        for (let i = 0; i < 55; i++) {
          const result = (await db.query(saveSQL, [TRIP, JSON.stringify(document(`version ${i}`)), 2 + i, null])).rows[0].saved;
          assert.equal(result.revision, 3 + i);
          ids.push(String(result.version_id));
        }
      });
      const current = await snapshot(db);
      assert.deepEqual(current.trip_document_versions.filter(v => v.trip_id === TRIP).map(v => v.id), ids.slice(-50));
      assert.deepEqual(current.trip_document_versions.filter(v => v.trip_id === OTHER), before.trip_document_versions.filter(v => v.trip_id === OTHER));
      assert.deepEqual(current.trip_documents.find(d => d.trip_id === OTHER), before.trip_documents.find(d => d.trip_id === OTHER));
      assert.equal(current.trip_documents.find(d => d.trip_id === TRIP).revision, '57');
      assert.deepEqual(current.trip_documents.find(d => d.trip_id === TRIP).content, document('version 54'));
    });

    await t.test('setup and registration reruns preserve all data and reject ownership changes', async () => {
      const before = await snapshot(db);
      await db.query(setup);
      await db.query(register());
      await db.query(register(OTHER, 'EDITOR-B@EXAMPLE.INVALID'));
      assert.deepEqual(await snapshot(db), before);
      await assert.rejects(db.query(register(TRIP, 'editor-b@example.invalid')), /Ownership was not changed/);
      await assert.rejects(db.query(register('missing-user', 'missing@example.invalid')), /was not found/);
      await assert.rejects(db.query(register('../invalid')), /Invalid trip id/);
      assert.deepEqual(await snapshot(db), before);
      assert.equal((await db.query("select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'trip_documents'")).rows[0].n, 1);
    });

    await t.test('Storage SQL policies enforce trip paths and immutable objects (no Storage service)', async () => {
      const hash = 'a'.repeat(64);
      const name = `${TRIP}/photos/${hash}.webp`;
      const insert = (uid, objectName, bucket = 'trip-media') => asUser(db, uid, () => db.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [bucket, objectName]));
      await insert(A, name);
      await insert(A, `${TRIP}/thumbs/${hash}.jpg`);
      await insert(B, `${OTHER}/photos/${hash}.jpg`);
      await db.query("insert into storage.buckets (id, name) values ('other-bucket', 'other-bucket')");
      for (const uid of [null, VIEWER, '', B]) await rejected(() => insert(uid, `${TRIP}/photos/${'b'.repeat(64)}.jpg`), '42501');
      for (const invalid of [
        `${OTHER}/photos/${hash}.webp`, `../${TRIP}/photos/${hash}.webp`,
        `${TRIP}/photos/../${hash}.webp`, `${TRIP}/photos/${hash}.png`,
        `${TRIP}/photos/${hash.toUpperCase()}.jpg`, `${TRIP}/photos/${hash.slice(1)}.jpg`,
        `${TRIP}/files/${hash}.jpg`, `${TRIP}/photos/${hash}.jpg/extra`,
      ]) await rejected(() => insert(A, invalid), '42501');
      await rejected(() => insert(A, name, 'other-bucket'), '42501');
      await rejected(() => insert(A, name), '23505');
      const before = (await db.query('select * from storage.objects order by id')).rows;
      assert.deepEqual((await asUser(db, A, () => db.query('select * from storage.objects'))).rows, []);
      // Give test-only read visibility so a missing UPDATE/DELETE restriction
      // cannot be masked by the lack of a SELECT policy. Never applied to production.
      await db.query('create policy sql_test_object_visibility on storage.objects for select to anon, authenticated using (true)');
      await rejected(() => asUser(db, A, () => db.query(`insert into storage.objects (bucket_id, name) values ('trip-media', $1) on conflict (bucket_id, name) do update set name = excluded.name`, [name])), '42501');
      for (const uid of [null, VIEWER, A, B]) {
        assert.equal((await asUser(db, uid, () => db.query('update storage.objects set name = $1 where name = $1', [name]))).rowCount, 0);
        assert.equal((await asUser(db, uid, () => db.query('delete from storage.objects where name = $1', [name]))).rowCount, 0);
      }
      assert.deepEqual((await db.query('select * from storage.objects order by id')).rows, before);
      await db.query('drop policy sql_test_object_visibility on storage.objects');
      const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'trip-media'")).rows[0];
      assert.deepEqual(bucket, { public: true, file_size_limit: '5242880', allowed_mime_types: ['image/webp', 'image/jpeg'] });
    });

    await t.test('the 4 MiB boundary uses serialized UTF-8 bytes, accepting exactly the limit', async () => {
      const overhead = (await db.query(`select octet_length(convert_to('{"html":""}'::jsonb::text, 'UTF8')) as n`)).rows[0].n;
      const content = { html: 'x'.repeat(4194304 - overhead) };
      const before = await snapshot(db);
      await rejected(() => save(db, A, TRIP, { html: content.html + 'x' }, 57), '22023');
      assert.deepEqual(await snapshot(db), before);
      const result = await save(db, A, TRIP, content, 57);
      assert.equal(result.revision, 58);
      const version = (await db.query('select content, content_size from public.trip_document_versions where id = $1', [result.version_id])).rows[0];
      assert.equal(version.content_size, 4194304);
      assert.deepEqual(version.content, content);
    });
    await t.test('schema 6 rejects old tabs without changing documents or versions; converted restoration succeeds', async () => {
      const migration=await source('migrations/20261024_ledger_schema_guard.sql');
      await db.query(migration);await db.query(migration);
      const content={...document('dual amounts'),schemaVersion:6,expenses:[{id:'meal',amountKrw:14500,amountUsd:10,amountSource:'both',appliedExchangeRate:null}]};
      assert.equal((await save(db,A,TRIP,content,58)).revision,59);
      const before=await snapshot(db);
      for(const schemaVersion of [undefined,4,5,'6',null,-1,6.5]){
        await rejected(()=>save(db,A,TRIP,{...document('old client PREP save'),...(schemaVersion===undefined?{}:{schemaVersion})},59),'22023');
        assert.deepEqual(await snapshot(db),before);
      }
      await rejected(()=>save(db,B,TRIP,content,59),'42501');
      await rejected(()=>save(db,A,TRIP,content,58),'40001');
      assert.equal((await save(db,A,TRIP,{...content,html:'<main>converted historical version</main>'},59)).revision,60);
    });
  });
}

async function checkLegacyUpgrade(autoGrants) {
  await isolated(autoGrants, async db => {
    await db.query(legacy);
    const oldDocuments = (await db.query('select * from public.trip_documents order by trip_id')).rows;
    const oldVersions = (await db.query('select * from public.trip_document_versions order by id')).rows;
    await db.query(setup);
    const upgraded = await snapshot(db);
    assert.deepEqual(upgraded.trip_documents, oldDocuments.map(({ editor_id, ...row }) => ({ ...row, revision: '0' })));
    assert.deepEqual(upgraded.trip_editors.map(({ trip_id, editor_id }) => ({ trip_id, editor_id })), oldDocuments.map(({ trip_id, editor_id }) => ({ trip_id, editor_id })));
    assert.deepEqual(upgraded.trip_document_versions, oldVersions.map(row => ({ ...row, note: null, content_size: 0 })));
    assert.equal((await db.query("select to_regprocedure('public.save_trip_document(text,jsonb)') as old")).rows[0].old, null);
    await db.query(setup);
    await db.query(register());
    await db.query(register(OTHER, 'editor-b@example.invalid'));
    assert.deepEqual(await snapshot(db), upgraded);
    await rejected(() => save(db, B, TRIP, document('denied after upgrade'), 0), '42501');
    await rejected(() => asUser(db, A, () => db.query('update public.trip_documents set content = \'{}\'')), '42501');
    assert.deepEqual((await asUser(db, B, () => db.query(`select ${versionColumns} from public.trip_document_versions where trip_id = $1`, [TRIP]))).rows, []);
    assert.equal((await save(db, A, TRIP, document('업그레이드 후 저장'), 0)).revision, 1);
    const saved = await snapshot(db);
    await db.query(setup);
    await db.query(register());
    assert.deepEqual(await snapshot(db), saved);
    assert.deepEqual(saved.trip_documents.find(d => d.trip_id === OTHER), upgraded.trip_documents.find(d => d.trip_id === OTHER));
  });
}

for (const autoGrants of [true, false]) {
  const mode = autoGrants ? 'automatic grants' : 'explicit grants only';
  test(`fresh install (${mode}): real PostgreSQL save, permissions and Storage policies`,
    { timeout: 90000 }, t => checkFreshInstall(autoGrants, t));
  test(`legacy upgrade (${mode}) preserves schedules, versions and editor links through repeated SQL`,
    { timeout: 30000 }, () => checkLegacyUpgrade(autoGrants));
}
