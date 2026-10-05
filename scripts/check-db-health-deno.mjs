import { createHealthHandler } from '../supabase/functions/trip-db-health/handler.mjs';

// deno run --allow-net=127.0.0.1 scripts/check-db-health-deno.mjs
// Uses only local HTTP fixtures; never connects to the production project.
let checks = 0, reads = 0;
function check(condition, message) {
  if (!condition) throw new Error(message);
  checks += 1;
}
const env = {
  SUPABASE_URL: 'https://xuzhcogshnjqtunkbsuo.supabase.co',
  HEALTHCHECK_TOKEN: 'c'.repeat(64),
  HEALTHCHECK_PUBLISHABLE_KEY: 'sb_publishable_fixture',
};
let mode = 'success';
const database = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, request => {
  reads += 1;
  check(request.method === 'GET', 'Database request must be read-only');
  check(request.headers.get('apikey') === env.HEALTHCHECK_PUBLISHABLE_KEY, 'Public API key missing');
  check(!request.headers.has('X-Healthcheck-Token'), 'Calling token leaked to DB');
  if (mode === 'missing') return Response.json([]);
  if (mode === 'error') return Response.json({ error: 'fixture' }, { status: 503 });
  if (mode === 'stall') return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('[{"id":')); } }));
  return Response.json([{ id: 1 }]);
});
const handler = createHealthHandler({
  env: name => env[name], timeoutMs: 100, retryDelayMs: 0,
  fetchImpl: (rawURL, options) => {
    const original = new URL(rawURL);
    return fetch(`http://127.0.0.1:${database.addr.port}${original.pathname}${original.search}`, options);
  },
});
const monitor = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, handler);
const url = `http://127.0.0.1:${monitor.addr.port}/functions/v1/trip-db-health`;
try {
  const denied = await fetch(url);
  check(denied.status === 401, 'Missing token must fail');
  await denied.text();
  check(reads === 0, 'Unauthorized call reached DB');
  const options = { headers: { 'X-Healthcheck-Token': env.HEALTHCHECK_TOKEN } };
  const success = await fetch(url, options);
  check(success.status === 200 && (await success.json()).ok === true, 'Successful read failed');
  check(success.headers.get('Cache-Control').includes('no-store'), 'Caching was not disabled');
  check(reads === 1, 'Successful request retried unexpectedly');
  for (const nextMode of ['missing', 'error', 'stall']) {
    mode = nextMode;
    const before = reads, started = performance.now();
    const failed = await fetch(url, options);
    check(failed.status === 503 && (await failed.json()).ok === false, `Failed to detect ${mode}`);
    check(reads === before + 2, `Expected one retry for ${mode}`);
    check(performance.now() - started < 2_000, `Deadline failed for ${mode}`);
  }
  mode = 'success';
  const recovered = await fetch(url, options);
  check(recovered.status === 200 && (await recovered.json()).ok === true, 'Failed to recover');
  console.log(`Deno HTTP runtime: ${checks} checks passed (authorization, read-only request, missing data, DB failure, stalled body cancellation, recovery).`);
} finally {
  await monitor.shutdown();
  await database.shutdown();
}
