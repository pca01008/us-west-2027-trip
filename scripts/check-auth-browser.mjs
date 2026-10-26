import { injectBrowserFixture } from './browser-fixtures.mjs';
import { selectTripTab } from './browser-fixtures.mjs';
// Real, version-matched Supabase SDK against local HTTP fixtures only.
// No auth methods or app auth handlers are replaced or invoked by the tests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('auth');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const sdkPackage = JSON.parse(await readFile(new URL('node_modules/@supabase/supabase-js/package.json', root), 'utf8'));
const sdkURL = source.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"\s]+/)[0];
assert.ok(sdkURL.endsWith('@' + sdkPackage.version), 'Auth fixture must use the deployed SDK version');
const sdk = await readFile(new URL('node_modules/@supabase/supabase-js/dist/umd/supabase.js', root));
const integrity = 'sha384-' + createHash('sha384').update(sdk).digest('base64');
const email = 'editor@example.test';
let row, passwordMode, refreshMode, ttl, serial, requests, tokens;
function reset() {
  row = { content: {}, revision: 1, updated_at: '2026-10-19T00:00:00Z' };
  passwordMode = 'success'; refreshMode = 'success'; ttl = 3600; serial = 0; requests = []; tokens = new Map();
}
function session(userEmail, expiresIn = ttl) {
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: userEmail, app_metadata: {}, user_metadata: {}, created_at: row.updated_at };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, email: userEmail, exp: Math.floor(Date.now()/1000)+expiresIn, serial: ++serial })}.fixture-signature`;
  const result = { access_token, refresh_token: `fixture-refresh-${serial}`, token_type: 'bearer', expires_in: expiresIn, user };
  tokens.set(access_token, result); tokens.set(result.refresh_token, result);
  return result;
}
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const token = tokens.get(req.headers.authorization?.replace(/^Bearer /, ''));
      requests.push({ path: url.pathname, grant: url.searchParams.get('grant_type'), accessToken: token?.access_token });
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'password') {
          assert.equal(body.email, email);
          if (passwordMode === 'outage') return json(res, 503, { message: 'Fixture auth unavailable' });
          if (body.password === 'wrong') return json(res, 400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return json(res, 200, session(passwordMode === 'non-editor' ? 'viewer@example.test' : email));
        }
        assert.equal(url.searchParams.get('grant_type'), 'refresh_token');
        assert.ok(tokens.has(body.refresh_token), 'Refresh must use an issued token');
        if (refreshMode === 'expired') return json(res, 400, { code: 'refresh_token_not_found', msg: 'Refresh token expired' });
        return json(res, 200, session(email, 3600));
      }
      if (url.pathname === '/auth/v1/logout') { assert.ok(token); res.writeHead(204).end(); return; }
      if (url.pathname === '/rest/v1/trip_documents') return json(res, 200, row);
      if (url.pathname === '/rest/v1/rpc/save_trip_document') {
        if (token?.user.email !== email) return json(res, 403, { message: 'Editor required' });
        if (body.p_expected_revision !== row.revision) return json(res, 409, { code: '40001', message: 'Revision conflict' });
        row = { content: body.p_content, revision: row.revision + 1, updated_at: row.updated_at };
        return json(res, 200, { revision: row.revision, updated_at: row.updated_at });
      }
      throw new Error(`Unexpected API: ${req.method} ${url.pathname}`);
    }
    if (url.pathname === '/fixture-supabase.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(sdk); return; }
    if (url.pathname === '/sdk-tab') {
      // This tab has no app session channel or activity-storage listeners.
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<script src="/fixture-supabase.js" integrity="${integrity}"></script><script>window.peer=supabase.createClient(location.origin,'sb_publishable_test');</script>`); return;
    }
    const file = url.pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
    let content = await readBrowserFixture(new URL(file, root));
    if (file === 'trip-config.js') content += `\nObject.assign(window.TRIP_CONFIG,{editorEmail:'${email}',cacheNamespace:'auth_fixture',supabase:{url:location.origin,publishableKey:'sb_publishable_test'}});`;
    if (file === 'index.html') content = injectBrowserFixture(source
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(sdkURL, '/fixture-supabase.js').replace(/integrity="sha384-[^"]+"/, `integrity="${integrity}"`), `window.__authTest={captureState,readDraftRecord,flushDraftPersistence,session:()=>sessionService.current()};window.__authEvents=[];client.auth.onAuthStateChange(event=>window.__authEvents.push(event));`);
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }).end(content);
  } catch (error) { fixtureErrors.push(error.message); json(res, 500, { message: error.message }); }
});
const fixtureErrors = [], pageErrors = [], unexpectedHTTP = [];
reset();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const ready = page => page.waitForFunction(() => window.__authTest && !document.body.classList.contains('hydrating'));
const title = page => page.locator('.day1 .timeline-row h3').first();
const saves = () => requests.filter(request => request.path.includes('/rpc/'));
const refreshes = () => requests.filter(request => request.grant === 'refresh_token');
async function setup(scenario) {
  diagnostics.scenario(scenario);
  reset();
  const context = await diagnostics.context(browser, { reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    unexpectedHTTP.push(route.request().url()); return route.abort();
  });
  // Realtime is outside this auth fixture; keep even WebSocket traffic local.
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => pageErrors.push(error.message));
  if (process.env.AUTH_DEBUG) page.on('console', message => console.log('Browser:', message.text()));
  await page.goto(origin); await ready(page);
  row.content = await page.evaluate(() => window.__authTest.captureState());
  await selectTripTab(page, 'd1');
  return { context, page };
}
async function submit(page, password = 'fixture-password') {
  await page.locator('#editorPassword').fill(password);
  await page.locator('#authSubmit').click();
  await page.waitForFunction(() => document.querySelector('#authDialog').hidden || !document.querySelector('#authSubmit').disabled);
}
async function login(page) {
  await page.locator('#editBtn').click(); await submit(page);
  await page.waitForFunction(() => document.body.classList.contains('editing'));
}
async function draft(page, text) {
  await title(page).fill(text);
  await page.waitForFunction(() => !document.querySelector('#saveBtn').disabled);
  assert.equal(await page.evaluate(() => window.__authTest.flushDraftPersistence()), true);
  return page.evaluate(async () => (await window.__authTest.readDraftRecord()).state);
}
async function assertProtected(page, expectedDraft) {
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('authenticated') || el.classList.contains('editing')), false);
  assert.equal(await title(page).getAttribute('contenteditable'), 'false');
  assert.equal(await page.locator('#logoutBtn').isVisible(), false);
  assert.equal(await page.locator('#saveBtn').isDisabled(), true);
  assert.deepEqual(await page.evaluate(async () => (await window.__authTest.readDraftRecord()).state), expectedDraft);
  assert.equal(saves().length, 0, 'No save may be attempted before successful reauthentication and confirmation');
}
async function recoverAndSave(page, expectedText) {
  await page.getByRole('button', { name: '초안 복구', exact: true }).click();
  await page.waitForFunction(() => document.body.classList.contains('editing'));
  assert.equal(await title(page).textContent(), expectedText);
  await page.locator('#editBtn').click();
  await page.getByRole('button', { name: '저장하고 종료', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('공유 저장 완료'));
  assert.equal(saves().length, 1);
  assert.ok(row.content.html.includes(expectedText));
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  {
    const { context, page } = await setup("cross-tab sign-out, login failures and retry");
    await login(page);
    const savedDraft = await draft(page, 'SDK 인증 실패에도 보존할 초안');
    const peer = await context.newPage(); await peer.goto(origin + '/sdk-tab');
    assert.equal(await peer.evaluate(async () => (await window.peer.auth.getSession()).data.session.user.email), email);
    assert.equal(await peer.evaluate(async () => (await window.peer.auth.signOut({ scope: 'local' })).error), null);
    await page.waitForFunction(() => window.__authEvents.includes('SIGNED_OUT') && document.querySelector('#status').textContent.includes('초안은 이 브라우저에 보관'));
    await assertProtected(page, savedDraft);
    await peer.close(); await page.reload(); await ready(page);
    await assertProtected(page, savedDraft);
    await selectTripTab(page, 'd1'); await page.locator('#editBtn').click();
    await submit(page, 'wrong');
    assert.match(await page.locator('#authError').textContent(), /비밀번호/);
    await assertProtected(page, savedDraft);
    passwordMode = 'outage'; await submit(page);
    assert.match(await page.locator('#authError').textContent(), /로그인 서버/);
    await assertProtected(page, savedDraft);
    passwordMode = 'non-editor'; await submit(page);
    assert.match(await page.locator('#authError').textContent(), /로그인 세션/);
    assert.ok(await page.evaluate(() => window.__authEvents.includes('SIGNED_IN')), 'Real SDK accepted the session, but the app must reject its email');
    await assertProtected(page, savedDraft);
    passwordMode = 'success'; await submit(page);
    await recoverAndSave(page, 'SDK 인증 실패에도 보존할 초안');
    assert.ok(requests.some(request => request.path === '/auth/v1/logout'));
    await diagnostics.close(context);
    console.log('Auth: SDK cross-tab sign-out, reload, invalid password, HTTP 503, non-editor session, retry, draft recovery and save passed.');
  }
  for (const expired of [false, true]) {
    const { context, page } = await setup(`token refresh / ${expired ? "expired" : "success"}`);
    await page.clock.install(); ttl = 150;
    await login(page);
    const savedDraft = await draft(page, expired ? '만료 후 복구할 초안' : '토큰 갱신 중인 초안');
    const oldToken = await page.evaluate(() => window.__authTest.session().access_token);
    refreshMode = expired ? 'expired' : 'success';
    // Let the SDK's timer detect the refresh margin or actual access-token expiry.
    // A rejected proactive refresh can preserve a still-valid access token.
    await page.clock.fastForward(expired ? 180_000 : 90_000);
    await page.waitForFunction(event => window.__authEvents.includes(event), expired ? 'SIGNED_OUT' : 'TOKEN_REFRESHED');
    assert.equal(refreshes().length, 1);
    if (expired) {
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('초안은 이 브라우저에 보관'));
      await assertProtected(page, savedDraft);
      await page.reload(); await ready(page); await assertProtected(page, savedDraft);
      await selectTripTab(page, 'd1'); await page.locator('#editBtn').click(); await submit(page);
      await recoverAndSave(page, '만료 후 복구할 초안');
    } else {
      const refreshedToken = await page.evaluate(() => window.__authTest.session().access_token);
      assert.notEqual(refreshedToken, oldToken, 'Refreshed SDK token reaches the app session');
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('authenticated') && el.classList.contains('editing')), true);
      assert.equal(await title(page).textContent(), '토큰 갱신 중인 초안');
      assert.deepEqual(await page.evaluate(async () => (await window.__authTest.readDraftRecord()).state), savedDraft);
      await page.locator('#editBtn').click(); await page.getByRole('button', { name: '저장하고 종료', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('공유 저장 완료'));
      assert.equal(saves().length, 1);
      assert.equal(saves()[0].accessToken, refreshedToken, 'Save uses the refreshed bearer token');
    }
    await diagnostics.close(context);
    console.log(`Auth: automatic ${expired ? 'refresh rejection, sign-out, reload and reauthentication' : 'token refresh with continuous editing'} passed.`);
  }
  assert.deepEqual(fixtureErrors, []); assert.deepEqual(pageErrors, []); assert.deepEqual(unexpectedHTTP, []);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
