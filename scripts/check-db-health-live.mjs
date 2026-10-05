import assert from 'node:assert/strict';
import { buildJob } from './configure-db-health-cron.mjs';

// node --env-file=.secrets/db-health-cron.env scripts/check-db-health-live.mjs
// Authenticated GET reads only the health sentinel. No intentional production outage.
const job = buildJob({ projectRef: process.env.SUPABASE_PROJECT_REF, token: process.env.HEALTHCHECK_TOKEN });
let checks = 0;
for (const [name, options, status, ok] of [
  ['missing token', {}, 401, false],
  ['valid token', { headers: job.extendedData.headers }, 200, true],
  ['incorrect token', { headers: { 'X-Healthcheck-Token': 'invalid' } }, 401, false],
  ['unsupported method', { method: 'POST', headers: job.extendedData.headers }, 405, false],
]) {
  const response = await fetch(job.url, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  assert.equal(response.status, status, `${name}: unexpected HTTP status`);
  assert.match(response.headers.get('Cache-Control') ?? '', /no-store/, `${name}: response caching enabled`);
  assert.deepEqual(await response.json(), { ok }, `${name}: unexpected body`);
  checks += 3;
  console.log(`${name}: HTTP ${status}, no-store, expected status body`);
}
console.log(`Live healthcheck: ${checks} checks passed.`);
