const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const PROJECT_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/;
const KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;

function reply(status, ok, extraHeaders = {}) {
  return new Response(JSON.stringify({ ok }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...extraHeaders,
    },
  });
}

function sameToken(actual, expected) {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) {
    difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

// All network and body-reading work shares one deadline per attempt.
async function queryHealthRow(url, key, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Database request timed out'));
    }, timeoutMs);
  });
  const query = (async () => {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { apikey: key, Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error('Database request failed');
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== 1) {
      throw new Error('Health row missing or invalid');
    }
  })();
  try {
    await Promise.race([query, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export function createHealthHandler({
  env,
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 10_000,
  retryDelayMs = 1_000,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10_000 ||
      !Number.isFinite(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 1_000) {
    throw new Error('Invalid deadline configuration');
  }
  return async request => {
    if (request.method !== 'GET') return reply(405, false, { Allow: 'GET' });
    const token = env('HEALTHCHECK_TOKEN');
    if (!TOKEN_PATTERN.test(token ?? '')) return reply(503, false);
    if (!sameToken(request.headers.get('X-Healthcheck-Token'), token)) return reply(401, false);

    const projectURL = env('SUPABASE_URL');
    const key = env('HEALTHCHECK_PUBLISHABLE_KEY');
    // Only a public read key is accepted; never fall back to a service-role key.
    if (!PROJECT_URL_PATTERN.test(projectURL ?? '') || !KEY_PATTERN.test(key ?? '')) {
      return reply(503, false);
    }
    const url = new URL('/rest/v1/healthcheck', projectURL);
    url.searchParams.set('select', 'id');
    url.searchParams.set('id', 'eq.1');
    url.searchParams.set('limit', '1');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await queryHealthRow(url.href, key, fetchImpl, timeoutMs);
        return reply(200, true);
      } catch {
        if (attempt === 0) await sleep(retryDelayMs);
      }
    }
    return reply(503, false);
  };
}
