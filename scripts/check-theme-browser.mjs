// Isolated UI checks with local fixtures. No production API/auth calls or writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-theme-'));
const source = await readFile(new URL('index.html', root), 'utf8');
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const relative = url.pathname.replace(/^\/(trip|offline)\//, '') || 'index.html';
  if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(relative)) { res.writeHead(404).end(); return; }
  try {
    let body = await readFile(new URL(relative, root));
    if (relative === 'index.html') {
      body = source.replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
        .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '')
        // Read-only diagnostics are exposed only by this local test fixture.
        .replace('initializeTimetable();initializeDialogAccessibility();', 'window.__themeTest={captureState,isDirty};initializeTimetable();initializeDialogAccessibility();');
      if (url.pathname.startsWith('/offline/')) body = body.replace('data-offline="false"', 'data-offline="true"');
    }
    const ext = relative.split('.').at(-1);
    res.writeHead(200, { 'Content-Type': { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', svg: 'image/svg+xml', png: 'image/png' }[ext], 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
// Windows may allocate a Chromium-blocked port (e.g. 6669) for listen(0).
for (let attempt = 0; ; attempt++) {
  const port = 20000 + Math.floor(Math.random() * 30000);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    break;
  } catch (error) { if (error.code !== 'EADDRINUSE' || attempt >= 4) throw error; }
}
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? {channel:process.env.PWA_BROWSER_CHANNEL} : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, colorScheme: 'dark', reducedMotion: 'reduce', acceptDownloads: true });
  await context.route('**/*', route => route.request().url().startsWith(origin) || route.request().url().startsWith('file:') ? route.continue() : route.abort());
  context.on('page', page => { page.setDefaultTimeout(10000); page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); }); });
  const page = await context.newPage();
  const ready = async p => {
    await p.waitForFunction(() => !document.body.classList.contains('hydrating') || document.querySelector('#noticeDialog')?.hidden === false);
    const discard = p.getByRole('button', { name: '초안 삭제', exact: true });
    if (await discard.isVisible()) await discard.click();
    await p.waitForFunction(() => !document.body.classList.contains('hydrating'));
  };
  const theme = p => p.locator('html').getAttribute('data-theme');
  const choose = (p, value) => p.locator('#themeSelect').selectOption(value);
  const tab = (p, id) => p.locator(`.tabs label[for="${id}"]`).click();
  const color = (p, selector, property = 'backgroundColor') => p.locator(selector).first().evaluate((el, property) => getComputedStyle(el)[property], property);
  const capture = p => p.evaluate(() => JSON.stringify({ state: window.__themeTest.captureState(), dirty: window.__themeTest.isDirty() }));
  const unchanged = async (p, before) => assert.equal(await capture(p), before, 'Theme changes must preserve both content and the existing dirty flag');

  await page.goto(origin + '/trip/'); await ready(page);
  assert.equal(await theme(page), 'light', 'First visit must stay light on a dark system');
  const baseline = await capture(page);
  await choose(page, 'dark'); await unchanged(page, baseline);
  assert.equal(await color(page, 'body'), 'rgb(16, 25, 35)');
  assert.equal(await color(page, '.prepday'), 'rgb(25, 37, 50)');
  assert.equal(await color(page, '.checklist label'), 'rgb(32, 46, 61)');
  await page.screenshot({ path: path.join(output, 'mobile-dark-prep.png'), fullPage: true });
  await page.reload(); await ready(page); assert.equal(await theme(page), 'dark');
  await choose(page, 'system'); await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await choose(page, 'light'); await page.emulateMedia({ colorScheme: 'dark' }); assert.equal(await theme(page), 'light');
  assert.equal(await color(page, '.tabs label.is-active .tab-label-icon'), 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: path.join(output, 'mobile-light-prep.png'), fullPage: true });

  const second = await context.newPage(); await second.goto(origin + '/trip/index.html'); await ready(second);
  await choose(page, 'dark');
  await second.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await second.locator('#themeSelect').inputValue(), 'dark'); await second.close();

  for (const id of ['d1', 'd2', 'money']) {
    await tab(page, id);
    assert.equal(await color(page, '.day.is-active'), 'rgb(25, 37, 50)');
    await page.screenshot({ path: path.join(output, `mobile-dark-${id}.png`), fullPage: true });
  }
  assert.equal(await color(page, '.expense-filters'), 'rgb(36, 51, 68)');
  assert.equal(await color(page, '#expenseFilterQuery'), 'rgb(25, 37, 50)');
  await tab(page, 'd1');
  await page.getByRole('button', { name: '시간표', exact: true }).click();
  assert.equal(await color(page, '.tt-day-header'), 'rgb(36, 51, 68)');
  await page.screenshot({ path: path.join(output, 'mobile-dark-timetable-day.png'), fullPage: true });
  await page.getByRole('button', { name: '전체', exact: true }).click();
  assert.equal(await color(page, '.tt-overview-column'), 'rgb(25, 37, 50)');
  await page.screenshot({ path: path.join(output, 'mobile-dark-timetable.png'), fullPage: true });
  await page.getByRole('button', { name: '일별 일정', exact: true }).click();

  // Storage failure must not block choosing a theme or initialize the trip twice.
  const blocked = await context.newPage();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await blocked.goto(origin + '/trip/'); await ready(blocked); await choose(blocked, 'dark');
  assert.equal(await theme(blocked), 'dark'); assert.equal(await blocked.locator('#themeStorageStatus').isVisible(), true); await blocked.close();

  // Offline fixture permits local editing without credentials. Never authenticates.
  const offline = await context.newPage(); await offline.goto(origin + '/offline/'); await ready(offline);
  assert.equal(await theme(offline), 'light', 'Separate deployment scope starts fresh');
  await tab(offline, 'd1'); await offline.locator('#editBtn').click();
  const editingBaseline = await capture(offline); await choose(offline, 'dark'); await unchanged(offline, editingBaseline);
  assert.equal(await offline.locator('#undoBtn').isDisabled(), true);
  const title = offline.locator('.day.is-active h3').first(); await title.fill('테마 전환 중 편집 유지 검증');
  await offline.waitForFunction(() => !document.querySelector('#undoBtn').disabled);
  const edited = await capture(offline); await choose(offline, 'light'); assert.equal(await capture(offline), edited);
  await choose(offline, 'dark'); assert.equal(await capture(offline), edited);
  assert.equal(await offline.locator('#undoBtn').isDisabled(), false);
  await offline.locator('#undoBtn').click(); await unchanged(offline, editingBaseline);
  await offline.locator('#editBtn').click();
  const discardChanges = offline.getByRole('button', { name: '변경사항 폐기', exact: true });
  if (await discardChanges.isVisible()) await discardChanges.click();

  // Every dialog's surface/input is inspected, including normally authenticated tools.
  const dialogColors = await offline.evaluate(() => Array.from(document.querySelectorAll('.notice-card,.auth-card,.version-card')).map(el => getComputedStyle(el).backgroundColor));
  assert.ok(dialogColors.length > 10); assert.ok(dialogColors.every(c => c === 'rgb(25, 37, 50)'));
  await offline.locator('#exportMenuBtn').click();
  await offline.screenshot({ path: path.join(output, 'mobile-dark-export-dialog.png') });
  const editableDownload = offline.waitForEvent('download'); await offline.locator('#offlineExportBtn').click();
  const editablePath = path.join(output, 'editable.html'); await (await editableDownload).saveAs(editablePath);
  const editable = await readFile(editablePath, 'utf8');
  assert.match(editable, /id="tripThemeBootstrap"/); assert.match(editable, /id="themeSelect"/);
  assert.doesNotMatch(editable.match(/<html[^>]*>/)[0], /data-theme=|data-theme-preference=/);
  assert.doesNotMatch(editable, /src="(?:\.\/)?pwa\.js"/);
  const artifactContext = await browser.newContext({ colorScheme: 'dark' });
  const artifact = await artifactContext.newPage(); artifact.on('pageerror', e => errors.push(e.message));
  await artifact.goto(pathToFileURL(editablePath).href); await ready(artifact);
  assert.equal(await theme(artifact), 'light'); await choose(artifact, 'dark');
  await artifact.reload(); await ready(artifact); assert.equal(await theme(artifact), 'dark');
  await artifactContext.close();

  await offline.locator('#exportMenuBtn').click();
  const readonlyDownload = offline.waitForEvent('download'); await offline.locator('#exportBtn').click();
  const readonlyPath = path.join(output, 'readonly.html'); await (await readonlyDownload).saveAs(readonlyPath);
  const readonly = await readFile(readonlyPath, 'utf8');
  assert.doesNotMatch(readonly, /<script id="tripThemeBootstrap"|id="themeSelect"/);
  assert.doesNotMatch(readonly.match(/<html[^>]*>/)[0], /data-theme=|data-theme-preference=/);
  const readonlyContext = await browser.newContext({ colorScheme: 'dark' });
  const readOnlyPage = await readonlyContext.newPage(); readOnlyPage.on('pageerror', e => errors.push(e.message));
  await readOnlyPage.goto(pathToFileURL(readonlyPath).href);
  assert.equal(await color(readOnlyPage, '.panel'), 'rgb(255, 255, 255)');
  await tab(readOnlyPage, 'money'); await readonlyContext.close();

  await offline.emulateMedia({ media: 'print' });
  assert.equal(await color(offline, '.panel'), 'rgb(255, 255, 255)');
  assert.equal(await offline.locator('.theme-toolbar').isVisible(), false);
  await offline.emulateMedia({ media: 'screen' }); assert.equal(await theme(offline), 'dark');
  for (const width of [320, 390, 768, 1440]) {
    await offline.setViewportSize({ width, height: 900 });
    assert.ok(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
  }
  await offline.evaluate(() => window.scrollTo(0, 0));
  await offline.screenshot({ path: path.join(output, 'desktop-dark.png'), fullPage: true });
  await context.close();
  assert.deepEqual(errors, []);
  console.log('Theme checks passed: preferences, sync, editing, dialogs, exports, print and responsive layout.');
  console.log('Screenshots and exported fixtures:', output);
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
