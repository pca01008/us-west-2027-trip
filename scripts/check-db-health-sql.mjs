import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHealthHandler } from '../supabase/functions/trip-db-health/handler.mjs';

// Optional standalone SQL integration check, using an externally installed PGlite.
// node scripts/check-db-health-sql.mjs <absolute path to PGlite dist/index.js>
const moduleName = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])).href : '@electric-sql/pglite';
const { PGlite } = await import(moduleName);
const db = await PGlite.create();
const migration = await readFile(new URL('../migrations/20261005_db_healthcheck.sql', import.meta.url), 'utf8');
let checks = 0;
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table public.trip_documents (trip_id text primary key, content jsonb, revision bigint);
    insert into public.trip_documents values ('us-west-2027', '{"fixture":"unchanged"}', 7);
  `);
  const before = (await db.query('select * from public.trip_documents')).rows;
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await db.query('select * from public.healthcheck')).rows, [{ id: 1 }]); checks += 1;
  assert.deepEqual((await db.query('select * from public.trip_documents')).rows, before); checks += 1;
  assert.equal((await db.query("select relrowsecurity from pg_class where oid = 'public.healthcheck'::regclass")).rows[0].relrowsecurity, true); checks += 1;
  await assert.rejects(db.query('insert into public.healthcheck values (2)'), error => error.code === '23514'); checks += 1;
  await assert.rejects(db.query('insert into public.healthcheck values (1)'), error => error.code === '23505'); checks += 1;
  await db.exec('set role anon');
  assert.deepEqual((await db.query('select id from public.healthcheck where id = 1 limit 1')).rows, [{ id: 1 }]); checks += 1;
  for (const statement of [
    'insert into public.healthcheck values (1)',
    'update public.healthcheck set id = 1',
    'delete from public.healthcheck',
    'truncate public.healthcheck',
    'alter table public.healthcheck add column secret text',
  ]) {
    await assert.rejects(db.query(statement), error => error.code === '42501'); checks += 1;
  }
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select id from public.healthcheck'), error => error.code === '42501'); checks += 1;
  await db.exec('reset role');

  // Run the production handler against the migrated PostgreSQL, as the public role.
  const token = 'b'.repeat(64);
  const env = { SUPABASE_URL: 'https://xuzhcogshnjqtunkbsuo.supabase.co', HEALTHCHECK_TOKEN: token, HEALTHCHECK_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
  const handler = createHealthHandler({
    env: name => env[name],
    sleep: async () => {},
    fetchImpl: async rawURL => {
      const url = new URL(rawURL);
      assert.equal(url.pathname, '/rest/v1/healthcheck');
      assert.equal(url.searchParams.get('select'), 'id');
      await db.exec('set role anon');
      try {
        const result = await db.query('select id from public.healthcheck where id = 1 limit 1');
        return new Response(JSON.stringify(result.rows));
      } finally { await db.exec('reset role'); }
    },
  });
  const request = () => new Request('https://health.example', { headers: { 'X-Healthcheck-Token': token } });
  assert.equal((await handler(request())).status, 200); checks += 1;
  await db.exec('delete from public.healthcheck');
  assert.equal((await handler(request())).status, 503); checks += 1;
  await db.exec(migration);
  assert.equal((await handler(request())).status, 200); checks += 1;
  assert.deepEqual((await db.query('select * from public.trip_documents')).rows, before); checks += 1;
  console.log(`SQL integration: ${checks} checks passed (migration twice, constraints, RLS, read/write permissions, handler recovery, unchanged trip fixture).`);
} finally {
  await db.close();
}
