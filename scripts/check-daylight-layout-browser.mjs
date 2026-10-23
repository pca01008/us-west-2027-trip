// Check actual content geometry, not just document overflow or an empty ledger.
// Both candidate and generated live HTML run locally with synthetic data only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {fixtureConfig, readBrowserFixture, selectAppTab, openAppTools} from './browser-fixtures.mjs';

const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'daylight-layout-'));
const config = structuredClone(fixtureConfig);
config.clocks.destination.label = 'US WEST / LAS VEGAS + LA';
const server = createServer(async (req, res) => {
  try {
    const file = new URL(req.url, 'http://local').pathname.slice(1) || 'index.html';
    if (!/^(?:daylight\/)?(?:index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)) {
      res.writeHead(404).end(); return;
    }
    let content;
    if (file.endsWith('index.html')) {
      content = (await readFile(new URL(file, root), 'utf8'))
        .replace('data-offline="false"', 'data-offline="true"')
        .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
        .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/, '')
        .replace('initializeTimetable();initializeDialogAccessibility();',
          'window.__layout={captureState,applyState,fingerprint};initializeTimetable();initializeDialogAccessibility();');
    } else if (file.endsWith('trip-config.js')) content = `window.TRIP_CONFIG=${JSON.stringify(config)};`;
    else content = await readBrowserFixture(new URL(file, root));
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'image/png');
    res.end(content);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
const widths = [320, 360, 390, 520, 540, 620, 621, 768, 1100, 1280, 1440];
const expenses = [
  {id:'flight', name:'테스트 도시 왕복 항공권 (예약 변경 및 추가 수하물 포함)', amount:3543400, currency:'KRW', date:'2026-03-31', categoryId:'transport'},
  {id:'hotel', name:'Example Hotel and Resort — A very long accommodation reservation name', amount:12345.67, currency:'USD', date:'2026-08-15', categoryId:'misc'},
  {id:'ticket', name:'테스트테마파크입장권과추가체험패키지예약확인용긴항목명', amount:527035, currency:'KRW', date:'2026-09-19', categoryId:'misc'}
];

async function verifyGeometry(page, width, view) {
  const issues = await page.evaluate(({width, view}) => {
    const failures = [], rect = el => el.getBoundingClientRect();
    const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    if (document.documentElement.scrollWidth > innerWidth) failures.push('Document overflows');
    const edit = rect(document.querySelector('#editBtn')), settings = rect(document.querySelector('#daylightSettingsToggle'));
    if (width <= 620 && Math.abs(edit.top - settings.top) > 1) failures.push('Settings must share the primary action row');
    if (view !== 'money') return failures;
    for (const row of document.querySelectorAll('.expense')) {
      const name = row.querySelector('.expense-primary b'), amount = row.querySelector('.expense-amount'), actions = row.querySelector('.expense-actions');
      for (const el of [name, amount, actions]) if (!inside(rect(el), rect(row))) failures.push('Expense content clips outside its row');
      if (name.scrollWidth > name.clientWidth + 1) failures.push('Expense name is truncated');
      for (const [a,b] of [[name,amount],[name,actions],[amount,actions]]) if (overlaps(rect(a),rect(b))) failures.push('Expense name, amount or actions overlap');
      for (const button of actions.children) if (rect(button).width < 44 || rect(button).height < 44) failures.push('Expense touch target below 44px');
    }
    const add = document.querySelector('#addExpense'), icon = add.querySelector('.button-icon');
    const range = document.createRange(); range.selectNodeContents(add.lastChild);
    if (Math.abs((rect(icon).top + rect(icon).bottom) / 2 - (range.getBoundingClientRect().top + range.getBoundingClientRect().bottom) / 2) > 4) failures.push('Add icon and label are not aligned');
    for (const field of document.querySelectorAll('.add-expense input,.add-expense select')) if (width <= 620 && parseFloat(getComputedStyle(field).fontSize) < 16) failures.push('Mobile input text below 16px');
    return failures;
  }, {width, view});
  assert.deepEqual(issues, [], `${width}px ${view}`);
}

try {
  for (const app of ['index.html', 'daylight/index.html']) {
    const context = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'ko-KR', reducedMotion:'reduce', serviceWorkers:'block'});
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/${app}`);
    await page.waitForFunction(() => window.__layout && !document.body.classList.contains('hydrating'));
    await page.evaluate(expenses => { const api=window.__layout; api.applyState({...api.captureState(),expenses}); }, expenses);
    const before = await page.evaluate(() => window.__layout.fingerprint(window.__layout.captureState()));
    for (const width of widths) {
      await page.setViewportSize({width,height:844});
      for (const view of ['d1','prep','money']) {
        await selectAppTab(page,view);
        await verifyGeometry(page,width,view);
        if ([390,1440].includes(width)) {
          await page.evaluate(() => scrollTo(0,0));
          await page.screenshot({path:path.join(output,`${app.replaceAll('/','-')}-${width}-${view}.png`)});
          if (view === 'money') await page.locator('.expenses-section').screenshot({path:path.join(output,`${app.replaceAll('/','-')}-${width}-expenses.png`)});
        }
      }
      await openAppTools(page);
      const box = await page.locator('.daylight-settings-panel').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `Settings clipped at ${width}px`);
      await page.locator('#daylightSettingsToggle').tap();
    }
    assert.equal(await page.evaluate(() => window.__layout.fingerprint(window.__layout.captureState())), before, 'Layout and navigation must not modify trip data');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-edit-expense="flight"]').tap();
    await page.locator('#expenseDialog').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await selectAppTab(page,'d1'); await page.locator('#editBtn').tap();
    for (const width of [320,390,620]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'Editing toolbar fits');
    }
    await context.close();
    console.log(`PASS ${app}: populated ledger, toolbar, clocks, form and settings across ${widths.join(', ')}px; touch edit, navigation and unchanged data`);
  }
  assert.deepEqual(errors,[]);
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); server.close(); }
