import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const source = await read('sw.js');
const scope = 'https://example.com/us-west-2027-trip/';

function worker() {
  const handlers = {}, stores = new Map(), requests = [];
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const records = stores.get(name);
      return {
        async match(request) { return records.get(key(request))?.clone(); },
        async put(request, response) { records.set(key(request), response.clone()); },
        async add(request) { records.set(key(request), new Response('precached')); },
        async addAll(requests) { for (const request of requests) await this.add(request); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const context = vm.createContext({
    URL, Request, Response, AbortController, setTimeout, clearTimeout, caches,
    console: { warn() {} },
    self: { registration: { scope }, location: { origin: new URL(scope).origin }, clients: { async claim() {} },
      addEventListener(type, fn) { handlers[type] = fn; } },
    fetch: async request => { requests.push(key(request)); return new Response('fresh'); }
  });
  vm.runInContext(source, context);
  return {
    context, stores, requests, caches,
    async install() { let done; handlers.install({ waitUntil(promise) { done = promise; } }); await done; },
    async activate() { let done; handlers.activate({ waitUntil(promise) { done = promise; } }); await done; },
    dispatch(path, options = {}) {
      let result;
      handlers.fetch({ request: { url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options },
        respondWith(promise) { result = promise; } });
      return result;
    }
  };
}

test('설치 리소스는 하위 경로에서 해석되고 PNG 크기와 SDK 해시가 일치한다', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  assert.equal(new URL(manifest.scope, scope).href, scope);
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    assert.ok(new URL(icon.src, scope).href.startsWith(scope));
    const png = await readFile(new URL('../' + icon.src, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  const html = await read('index.html');
  const sdk = html.match(/<script src="([^"]*supabase[^"]*)" integrity="([^"]+)"/);
  assert.ok(source.includes(sdk[1]) && source.includes(sdk[2]));
  const app = worker();
  await app.install();
  for (const url of [...app.stores.values()][0].keys()) {
    if (url.startsWith(scope)) await readFile(new URL('../' + url.slice(scope.length), import.meta.url));
  }
});

test('온라인 재실행은 최신 화면으로 캐시를 갱신하고 오프라인에서 이를 연다', async () => {
  const app = worker(); await app.install();
  assert.equal(await (await app.dispatch('./', { mode: 'navigate' })).text(), 'fresh');
  app.context.fetch = async () => { throw new Error('offline'); };
  assert.equal(await (await app.dispatch('./index.html', { mode: 'navigate' })).text(), 'fresh');
  assert.equal(await (await app.dispatch('./trip-config.js')).text(), 'precached');
});

test('서버 오류에서는 저장된 화면으로 복구한다', async () => {
  const app = worker(); await app.install();
  app.context.fetch = async () => new Response('unavailable', { status: 503 });
  assert.equal(await (await app.dispatch('./', { mode: 'navigate' })).text(), 'precached');
});

test('응답 없는 네트워크는 제한 시간 뒤 캐시로 복구한다', async () => {
  const app = worker(); await app.install();
  app.context.setTimeout = callback => setTimeout(callback, 5);
  app.context.fetch = async (_request, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  });
  assert.equal(await (await app.dispatch('./', { mode: 'navigate' })).text(), 'precached');
});

test('쿼리·미리보기 응답은 기본 화면 캐시를 덮어쓰지 않는다', async () => {
  const app = worker(); await app.install();
  await app.dispatch('./?previewDate=2027-01-25', { mode: 'navigate' });
  app.context.fetch = async () => { throw new Error('offline'); };
  assert.equal(await (await app.dispatch('./', { mode: 'navigate' })).text(), 'precached');
});

test('인증·API·POST·다른 페이지 요청은 가로채지 않는다', async () => {
  const app = worker(); await app.install();
  for (const [url, options] of [
    ['https://example.supabase.co/rest/v1/trip_documents', {}],
    ['https://example.supabase.co/auth/v1/token', {}],
    ['./index.html', { method: 'POST' }], ['./test.html', { mode: 'navigate' }],
    ['../other-app/', { mode: 'navigate' }], ['./trip-config.js?private=1', {}]
  ]) assert.equal(app.dispatch(url, options), undefined);
});

test('캐시 정리는 같은 앱·경로의 이전 버전에만 적용된다', async () => {
  const app = worker(); await app.install();
  const current = [...app.stores.keys()][0], old = current.replace(/v1$/, 'v0');
  app.stores.set(old, new Map()); app.stores.set('another-app', new Map());
  app.stores.set('westbound-pwa:other-scope:v0', new Map());
  await app.activate();
  assert.ok(app.stores.has(current)); assert.ok(!app.stores.has(old));
  assert.ok(app.stores.has('another-app')); assert.ok(app.stores.has('westbound-pwa:other-scope:v0'));
});

test('SDK 미연결 또는 오프라인 시작에서도 기존 공개본을 읽고 캐시 시점을 유지한다', async () => {
  const html = await read('index.html');
  const hydrate = html.match(/async function hydrate\(\)\{([\s\S]*?)\n  \}/)[0];
  for (const client of [null, {}]) {
    let displayed, baselineMetadata, status;
    const record = { state: { html: 'saved itinerary' }, revision: 7, cachedAt: '2026-09-01T00:00:00Z' };
    const context = vm.createContext({
      OFFLINE_MODE: false, client, navigator: { onLine: false }, lastSavedState: record.state,
      console: { warn() {} }, readPublicCache: async () => record,
      normalizeState: value => value, migratePublishedState: value => value,
      applyState: value => { displayed = value; },
      setPublishedBaseline: (_row, _state, metadata) => { baselineMetadata = metadata; },
      setStatus: value => { status = value; }, initializeHistory() {}, updateDirtyState() {},
      recoverOnlineDraft: async () => {}, finishHydration() {},
      // Halt after reading the cached state, before realtime setup for the mock client.
      TRIP_ID: 'test', getEditorSession: async () => {}
    });
    if (client) client.channel = () => ({ on: () => ({ subscribe() {} }) });
    vm.runInContext(hydrate, context);
    await context.hydrate();
    assert.equal(displayed.html, 'saved itinerary');
    assert.equal(baselineMetadata.cachedAt, record.cachedAt);
    assert.match(status, /오프라인 캐시 표시/);
  }
});

test('인터넷 연결 표시가 있어도 응답 없는 공유 서버 조회를 취소한다', async () => {
  const html = await read('index.html');
  const source = html.match(/async function fetchPublishedState\(\)\{([\s\S]*?)\n  \}/)[0];
  let signal;
  const query = {
    select() { return this; }, eq() { return this; },
    abortSignal(value) { signal = value; return this; },
    maybeSingle() { return new Promise(resolve => signal.addEventListener('abort', () => resolve({ error: new Error('timeout') }), { once: true })); }
  };
  const context = vm.createContext({
    OFFLINE_MODE: false, TRIP_ID: 'test', client: { from: () => query }, AbortController,
    setTimeout: fn => setTimeout(fn, 5), clearTimeout
  });
  vm.runInContext(source, context);
  await assert.rejects(context.fetchPublishedState(), /timeout/);
  assert.equal(signal.aborted, true);
});
