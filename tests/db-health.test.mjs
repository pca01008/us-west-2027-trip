import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHealthHandler } from '../supabase/functions/trip-db-health/handler.mjs';
import { buildJob, configureCron, jobSummary, verifyJob } from '../scripts/configure-db-health-cron.mjs';
import { prepareHealthSecrets } from '../scripts/prepare-db-health.mjs';

const projectRef = 'xuzhcogshnjqtunkbsuo';
const token = 'a'.repeat(64);
const key = 'sb_publishable_fixture';
const values = { SUPABASE_URL: `https://${projectRef}.supabase.co`, HEALTHCHECK_TOKEN: token, HEALTHCHECK_PUBLISHABLE_KEY: key };
const request = (options = {}) => new Request('https://health.example/functions/v1/trip-db-health', {
  headers: { 'X-Healthcheck-Token': token }, ...options,
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fixture({ env = values, fetchImpl = async () => json([{ id: 1 }]), timeoutMs = 50, retryDelayMs = 0 } = {}) {
  const calls = [], sleeps = [];
  const handler = createHealthHandler({
    env: name => env[name], timeoutMs, retryDelayMs,
    fetchImpl: async (...args) => { calls.push(args); return fetchImpl(...args); },
    sleep: async ms => { sleeps.push(ms); },
  });
  return { handler, calls, sleeps };
}

test('successful healthcheck performs one bounded read and returns only status', async () => {
  const { handler, calls, sleeps } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(calls.length, 1);
  const [rawURL, options] = calls[0], url = new URL(rawURL);
  assert.equal(url.origin, values.SUPABASE_URL);
  assert.equal(url.pathname, '/rest/v1/healthcheck');
  assert.deepEqual(Object.fromEntries(url.searchParams), { select: 'id', id: 'eq.1', limit: '1' });
  assert.equal(options.method, 'GET');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.apikey, key);
  assert.ok(!JSON.stringify(options.headers).includes(token));
  assert.equal(options.headers.Authorization, undefined);
  assert.deepEqual(sleeps, []);
});

for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
  test(`rejects ${method} without querying DB`, async () => {
    const { handler, calls } = fixture();
    const response = await handler(request({ method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET');
    assert.equal(calls.length, 0);
  });
}
for (const actual of [undefined, '', 'a'.repeat(63), 'a'.repeat(63) + 'b', 'b'.repeat(64)]) {
  test(`rejects ${actual === undefined ? 'absent' : 'incorrect'} token without a database request (${actual?.length ?? 0})`, async () => {
    const { handler, calls } = fixture();
    const response = await handler(request({ headers: actual === undefined ? {} : { 'X-Healthcheck-Token': actual } }));
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });
}
for (const [name, value] of [
  ['HEALTHCHECK_TOKEN', undefined], ['HEALTHCHECK_TOKEN', 'short'],
  ['HEALTHCHECK_PUBLISHABLE_KEY', undefined], ['HEALTHCHECK_PUBLISHABLE_KEY', 'sb_secret_forbidden'],
  ['HEALTHCHECK_PUBLISHABLE_KEY', 'eyJ.service.role'],
  ['SUPABASE_URL', 'http://example.supabase.co'], ['SUPABASE_URL', 'https://evil.example'],
  ['SUPABASE_URL', `https://${projectRef}.supabase.co/other`],
]) {
  test(`fails closed for invalid ${name}: ${String(value)}`, async () => {
    const { handler, calls } = fixture({ env: { ...values, [name]: value } });
    assert.equal((await handler(request())).status, 503);
    assert.equal(calls.length, 0);
  });
}
test('accepts canonical Supabase URL with a trailing slash', async () => {
  const { handler } = fixture({ env: { ...values, SUPABASE_URL: values.SUPABASE_URL + '/' } });
  assert.equal((await handler(request())).status, 200);
});
test('transient error retries once, waits, and recovers', async () => {
  let attempt = 0;
  const { handler, calls, sleeps } = fixture({ retryDelayMs: 1_000, fetchImpl: async () => ++attempt === 1 ? json({ error: 'private details' }, 503) : json([{ id: 1 }]) });
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [1_000]);
});
for (const [name, responseFactory] of [
  ['missing row', () => json([])], ['wrong ID', () => json([{ id: 2 }])],
  ['string ID', () => json([{ id: '1' }])], ['duplicate rows', () => json([{ id: 1 }, { id: 1 }])],
  ['null result', () => json(null)], ['object result', () => json({ id: 1 })],
  ['invalid JSON', () => new Response('not json')],
  ['HTTP 401', () => json({ secret: token }, 401)], ['HTTP 404', () => json({}, 404)],
  ['HTTP 500', () => json({}, 500)], ['redirect', () => new Response(null, { status: 302 })],
  ['network exception', () => { throw new Error(token); }],
]) {
  test(`reports ${name} as unavailable after exactly two attempts`, async () => {
    const { handler, calls, sleeps } = fixture({ fetchImpl: async () => responseFactory() });
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.equal(await response.text(), '{"ok":false}');
    assert.equal(calls.length, 2);
    assert.equal(sleeps.length, 1);
  });
}
for (const mode of ['fetch never resolves', 'JSON body never finishes']) {
  test(`deadline covers ${mode} and cancels both attempts`, async () => {
    const { handler, calls } = fixture({ timeoutMs: 20, fetchImpl: async () => {
      if (mode === 'fetch never resolves') return new Promise(() => {});
      return { status: 200, json: () => new Promise(() => {}) };
    } });
    const started = Date.now();
    assert.equal((await handler(request())).status, 503);
    assert.ok(Date.now() - started < 1_000);
    assert.equal(calls.length, 2);
    for (const [, options] of calls) assert.equal(options.signal.aborted, true);
  });
}
test('timeout on first attempt can recover on the second', async () => {
  let attempt = 0;
  const { handler, calls } = fixture({ timeoutMs: 20, fetchImpl: async () => ++attempt === 1 ? new Promise(() => {}) : json([{ id: 1 }]) });
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls.length, 2);
});
test('production deadlines cap two attempts and delay at 21 seconds', () => {
  assert.doesNotThrow(() => createHealthHandler({ env: () => undefined }));
  for (const options of [{ timeoutMs: 10_001 }, { retryDelayMs: 1_001 }, { timeoutMs: 0 }, { timeoutMs: NaN }, { retryDelayMs: -1 }]) {
    assert.throws(() => createHealthHandler({ env: () => undefined, ...options }));
  }
});
test('actual HTTP read retries 503, sends public key, and returns no DB contents', async () => {
  let attempts = 0;
  const server = createServer((req, res) => {
    attempts += 1;
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.apikey, key);
    assert.equal(req.headers['x-healthcheck-token'], undefined);
    assert.equal(req.url, '/rest/v1/healthcheck?select=id&id=eq.1&limit=1');
    res.writeHead(attempts === 1 ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(attempts === 1 ? '{"error":"fixture"}' : '[{"id":1}]');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { handler } = fixture({ timeoutMs: 1_000, fetchImpl: (rawURL, options) => {
      const original = new URL(rawURL);
      return fetch(`http://127.0.0.1:${server.address().port}${original.pathname}${original.search}`, options);
    } });
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(attempts, 2);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

const job = buildJob({ projectRef, token });
test('cron plan uses four daily reads and account email for failure, recovery, disable', () => {
  assert.deepEqual(job.schedule, { timezone: 'Asia/Seoul', expiresAt: 0, hours: [0, 6, 12, 18], minutes: [17], mdays: [-1], months: [-1], wdays: [-1] });
  assert.deepEqual(job.notification, { onFailure: true, onFailureCount: 1, onSuccess: true, onDisable: true, mode: 2, selectedChannels: [0] });
  assert.equal(job.requestTimeout, 30);
  assert.equal(job.saveResponses, false);
  assert.equal(job.redirectSuccess, false);
  assert.ok(!JSON.stringify(jobSummary(job)).includes(token));
});
test('cron plan rejects unsafe project references and header tokens', () => {
  for (const projectRef of [undefined, '../other', 'https://evil.example', 'short']) assert.throws(() => buildJob({ projectRef, token }));
  for (const token of [undefined, 'short', 'a'.repeat(64) + '\r\nBad: header']) assert.throws(() => buildJob({ projectRef, token }));
});
test('read-back verification catches wrong schedules, auth, notifications and enabled status', () => {
  verifyJob(structuredClone(job), job);
  for (const mutate of [
    value => { value.enabled = false; }, value => { value.url += '/'; },
    value => { value.schedule.hours = [0]; }, value => { value.notification.mode = 0; },
    value => { value.notification.onFailure = false; }, value => { value.extendedData.headers = {}; },
    value => { value.extendedData.headers.Authorization = 'extra'; },
    value => { value.extendedData.body = 'unexpected'; },
  ]) {
    const changed = structuredClone(job); mutate(changed);
    assert.throws(() => verifyJob(changed, job));
  }
});

function cronFixture({ existing = [], someFailed = false, preflight = json({ ok: true }), corrupt = false } = {}) {
  const calls = [];
  let stored;
  return { calls, fetchImpl: async (url, options = {}) => {
    calls.push([url, options]);
    if (url === job.url) return preflight;
    if (url.endsWith('/jobs') && options.method === 'GET') return json({ jobs: existing, someFailed });
    if (url.endsWith('/jobs') && options.method === 'PUT') { stored = JSON.parse(options.body).job; return json({ jobId: 123 }); }
    if (url.endsWith('/jobs/123') && options.method === 'PATCH') { stored = JSON.parse(options.body).job; return json({}); }
    if (url.endsWith('/jobs/123') && options.method === 'GET') {
      const result = structuredClone(stored);
      if (corrupt) result.notification.mode = 0;
      return json({ jobDetails: result });
    }
    throw new Error('Unexpected fixture request');
  } };
}
test('registration proves health, creates disabled, verifies, enables, and verifies again', async () => {
  const { calls, fetchImpl } = cronFixture();
  const result = await configureCron({ job, apiKey: 'fixture-api-key', fetchImpl });
  assert.equal(result.verified, true);
  assert.equal(result.jobId, 123);
  assert.ok(!JSON.stringify(result).includes(token));
  assert.deepEqual(calls.map(([, options]) => options.method ?? 'GET'), ['GET', 'GET', 'PUT', 'GET', 'PATCH', 'GET']);
  assert.equal(JSON.parse(calls[2][1].body).job.enabled, false);
  assert.equal(JSON.parse(calls[4][1].body).job.enabled, true);
  for (const [, options] of calls.slice(1)) {
    assert.equal(options.headers.Authorization, 'Bearer fixture-api-key');
    assert.equal(options.redirect, 'error');
  }
});
test('registration reuses an existing matching job without duplicates', async () => {
  const { calls, fetchImpl } = cronFixture({ existing: [{ ...job, jobId: 123 }] });
  assert.equal((await configureCron({ job, apiKey: 'fixture-api-key', fetchImpl })).jobId, 123);
  assert.equal(calls.filter(([, options]) => options.method === 'PUT').length, 0);
});
for (const preflight of [json({ ok: false }, 503), json({ ok: false }), new Response('invalid JSON')]) {
  test('failed preflight causes no cron API calls', async () => {
    const { calls, fetchImpl } = cronFixture({ preflight });
    await assert.rejects(configureCron({ job, apiKey: 'fixture-api-key', fetchImpl }));
    assert.equal(calls.length, 1);
  });
}
test('incomplete lists and duplicate jobs cause no writes', async () => {
  for (const options of [{ someFailed: true }, { existing: [{ ...job, jobId: 123 }, { ...job, jobId: 456 }] }]) {
    const { calls, fetchImpl } = cronFixture(options);
    await assert.rejects(configureCron({ job, apiKey: 'fixture-api-key', fetchImpl }));
    assert.equal(calls.length, 2);
  }
});
test('incorrect returned configuration leaves newly created job disabled', async () => {
  const { calls, fetchImpl } = cronFixture({ corrupt: true });
  await assert.rejects(configureCron({ job, apiKey: 'fixture-api-key', fetchImpl }));
  assert.equal(calls.filter(([, options]) => options.method === 'PATCH').length, 0);
});
test('missing API key performs no network calls', async () => {
  const { calls, fetchImpl } = cronFixture();
  await assert.rejects(configureCron({ job, fetchImpl }));
  assert.equal(calls.length, 0);
});

test('production deadlines abort actual stalled HTTP bodies within the cron limit', { timeout: 30_000 }, async () => {
  let attempts = 0, closed = 0;
  const server = createServer((req, res) => {
    attempts += 1;
    res.on('close', () => { closed += 1; });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('[{"id":');
    // Deliberately leave the HTTP body open until AbortController cancels it.
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const handler = createHealthHandler({ env: name => values[name], fetchImpl: (rawURL, options) => {
      const original = new URL(rawURL);
      return fetch(`http://127.0.0.1:${server.address().port}${original.pathname}${original.search}`, options);
    } });
    const started = performance.now();
    const response = await handler(request());
    const elapsed = performance.now() - started;
    assert.equal(response.status, 503);
    assert.equal(attempts, 2);
    assert.ok(elapsed >= 20_000 && elapsed < 27_000, `Expected about 21s, observed ${elapsed}ms`);
    // Allow the cancellation to reach the fixture server before checking sockets.
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(closed, 2);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

async function withSecretsFixture(run) {
  const prefix = path.join(tmpdir(), 'westbound-health-secrets-');
  const root = await mkdtemp(prefix);
  try {
    await writeFile(path.join(root, 'trip-config.js'), `window.TRIP_CONFIG={supabase:${JSON.stringify({ url: values.SUPABASE_URL, publishableKey: key })}};`);
    await run(root);
  } finally {
    // Restrict recursive cleanup to this exact, freshly created fixture directory.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('westbound-health-secrets-'));
    await rm(root, { recursive: true, force: true });
  }
}
test('secret preparation creates matching random tokens and a redacted plan', async () => withSecretsFixture(async root => {
  const result = await prepareHealthSecrets(root);
  const secrets = parseEnv(await readFile(result.secretsPath, 'utf8'));
  const cron = parseEnv(await readFile(result.cronPath, 'utf8'));
  assert.match(secrets.HEALTHCHECK_TOKEN, /^[a-f0-9]{64}$/);
  assert.equal(secrets.HEALTHCHECK_PUBLISHABLE_KEY, key);
  assert.equal(cron.HEALTHCHECK_TOKEN, secrets.HEALTHCHECK_TOKEN);
  assert.equal(cron.SUPABASE_PROJECT_REF, projectRef);
  assert.equal(cron.CRON_JOB_API_KEY, '');
  assert.ok(!JSON.stringify(result).includes(secrets.HEALTHCHECK_TOKEN));
}));
test('secret preparation preserves tokens and an existing cron API key on rerun', async () => withSecretsFixture(async root => {
  const first = await prepareHealthSecrets(root);
  const firstSecrets = await readFile(first.secretsPath, 'utf8');
  const cron = (await readFile(first.cronPath, 'utf8')).replace('CRON_JOB_API_KEY=', 'CRON_JOB_API_KEY=fixture-api-key');
  await writeFile(first.cronPath, cron);
  assert.equal((await prepareHealthSecrets(root)).reused, true);
  assert.equal(await readFile(first.secretsPath, 'utf8'), firstSecrets);
  assert.equal(await readFile(first.cronPath, 'utf8'), cron);
}));
test('secret preparation detects mismatched files without overwriting them', async () => withSecretsFixture(async root => {
  const first = await prepareHealthSecrets(root);
  const corrupted = (await readFile(first.cronPath, 'utf8')).replace(projectRef, 'different-reference');
  await writeFile(first.cronPath, corrupted);
  await assert.rejects(prepareHealthSecrets(root));
  assert.equal(await readFile(first.cronPath, 'utf8'), corrupted);
}));
test('secret preparation rejects administrator keys before creating secrets', async () => withSecretsFixture(async root => {
  await writeFile(path.join(root, 'trip-config.js'), `window.TRIP_CONFIG={supabase:{url:'${values.SUPABASE_URL}',publishableKey:'sb_secret_forbidden'}};`);
  await assert.rejects(prepareHealthSecrets(root));
  await assert.rejects(readFile(path.join(root, '.secrets', 'db-health.env')), error => error.code === 'ENOENT');
}));
