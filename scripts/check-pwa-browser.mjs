// Optional integration check: node scripts/check-pwa-browser.mjs [playwright/index.mjs]
// Uses an isolated browser and a local API fixture; never contacts the live trip database.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
// npm ci supplies the same SDK version locally. jsDelivr may reformat its UMD
// response, so only this fixture gets an integrity hash for the local bytes.
const htmlSource = await readFile(new URL('index.html', root), 'utf8');
const sdkURL = htmlSource.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"\s]+/)[0];
const sdkIntegrity = htmlSource.match(/integrity="(sha384-[^"]+)"/)[1];
const sdkPackage = JSON.parse(await readFile(new URL('node_modules/@supabase/supabase-js/package.json', root), 'utf8'));
assert.ok(sdkURL.endsWith('@' + sdkPackage.version), 'PWA fixture must use the deployed SDK version');
const sdk = await readFile(new URL('node_modules/@supabase/supabase-js/dist/umd/supabase.js', root));
const localIntegrity = 'sha384-' + createHash('sha384').update(sdk).digest('base64');
const mime = { html: 'text/html', js: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
let published = null;
let disconnected = false;
const server = createServer(async (req, res) => {
  if (disconnected) { req.socket.destroy(); return; }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture-supabase.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(sdk); return;
  }
  if (process.env.PWA_DEBUG) console.log('Request:', url.pathname);
  if (url.pathname === '/rest/v1/trip_documents') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(published)); return;
  }
  const relative = url.pathname.replace(/^\/trip\//, '').replace(/^\//, '') || 'index.html';
  if (!/^(index\.html|trip-config\.js|pwa\.js|sw\.js|manifest\.webmanifest|(?:icons|assets)\/[\w.-]+)$/.test(relative)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    let body = await readFile(new URL(relative, root));
    if (relative === 'index.html' || relative === 'sw.js') body = Buffer.from(body.toString()
      .replaceAll(sdkURL, `http://127.0.0.1:${server.address().port}/fixture-supabase.js`)
      .replaceAll(sdkIntegrity, localIntegrity));
    if (relative === 'trip-config.js') body = Buffer.from(body + `\nwindow.TRIP_CONFIG.supabase={url:'http://127.0.0.1:${server.address().port}',publishableKey:'sb_publishable_test'};`);
    res.writeHead(200, { 'Content-Type': mime[relative.split('.').at(-1)], 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  for (const basePath of ['/trip/', '/']) {
    published = null;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    await context.route('**/*', route => route.request().url().startsWith(`http://127.0.0.1:${server.address().port}/`) ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    if (process.env.PWA_DEBUG) page.on('console', message => console.log('Browser:', message.text()));
    const startURL = `http://127.0.0.1:${server.address().port}${basePath}`;
    await page.goto(startURL);
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await page.evaluate(() => typeof window.supabase?.createClient), 'function', 'SDK must load for the online fixture check');

    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
    assert.equal(new URL(manifest.start_url, startURL).href, startURL);
    const cdp = await context.newCDPSession(page);
    const { errors: manifestErrors, manifest: parsedManifest } = await cdp.send('Page.getAppManifest');
    assert.deepEqual(manifestErrors, []);
    assert.equal(parsedManifest.id, startURL, '앱 ID는 여행 시작 주소로 해석되어야 합니다.');
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    // Playwright's isolated context is incognito; actual installation is disabled there.
    assert.deepEqual(installabilityErrors.filter(error => error.errorId !== 'in-incognito'), []);

    published = await page.evaluate(() => {
      const main = document.querySelector('main').cloneNode(true);
      main.querySelector('h3').textContent = 'PWA 저장본 검증';
      return { revision: 41, updated_at: '2026-09-01T00:00:00Z', content: { schemaVersion: 5, html: main.innerHTML } };
    });
    await page.reload();
    // The initial empty fixture may leave a baseline draft; use the real recovery UI.
    await page.waitForFunction(() => !document.body.classList.contains('hydrating') || !document.querySelector('#noticeDialog').hidden);
    if (await page.locator('#noticeDialog').isVisible()) await page.getByRole('button', { name: '초안 삭제', exact: true }).click();
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    assert.match(await page.locator('main').textContent(), /PWA 저장본 검증/);
    await page.waitForFunction(async () => {
      const config = window.TRIP_CONFIG;
      return new Promise(resolve => {
        const req = indexedDB.open(config.cacheNamespace + '_trip_drafts');
        req.onsuccess = () => {
          const db = req.result, get = db.transaction('records').objectStore('records').get('public:' + config.tripId);
          get.onsuccess = () => { resolve(get.result?.revision === 41); db.close(); };
        };
      });
    });
    await page.locator('#themeSelect').selectOption('dark');
    await context.setOffline(true);
    disconnected = true;
    await page.reload();
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    assert.match(await page.locator('main').textContent(), /PWA 저장본 검증/);
    assert.match(await page.locator('#status').textContent(), /오프라인 캐시 표시/);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'Offline restart restores theme');
    await page.locator('#themeSelect').selectOption('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Theme changes work offline');
    await page.locator('label[for="d1"]').click();
    assert.equal(await page.locator('#d1').isChecked(), true);

    // Verify the previously broken path when the CDN SDK is unavailable as well.
    await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) if (request.url.endsWith('/fixture-supabase.js')) await cache.delete(request);
      }
    });
    await cdp.send('Network.clearBrowserCache');
    await page.reload();
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    assert.equal(await page.evaluate(() => typeof window.supabase), 'undefined');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'Theme bootstrap has no SDK dependency');
    assert.match(await page.locator('main').textContent(), /PWA 저장본 검증/);
    assert.match(await page.locator('#status').textContent(), /오프라인 캐시 표시/);

    await context.setOffline(false);
    disconnected = false;
    published.content.html = published.content.html.replace('PWA 저장본 검증', 'PWA 최신본 검증');
    published.revision = 42;
    await page.reload();
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    assert.match(await page.locator('main').textContent(), /PWA 최신본 검증/);
    assert.deepEqual(errors, []);
    console.log(`${basePath}: installability, mobile tabs, offline reload, theme persistence, missing SDK, online refresh passed`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
