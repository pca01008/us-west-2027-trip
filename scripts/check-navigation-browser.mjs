// Legacy refinement regression checks, with synthetic data and no production requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readBrowserFixture, selectTripTab, selectTheme } from './browser-fixtures.mjs';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
const playwright = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const engine = process.env.TRIP_BROWSER_ENGINE || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), `Unsupported browser: ${engine}`);
const root = new URL('../', import.meta.url);
const diagnostics = await createBrowserDiagnostics(`navigation-${engine}`);
const output = diagnostics.output;
await mkdir(output, { recursive: true });
const source = (await readFile(new URL('index.html', root), 'utf8'))
  .replace('data-offline="false"', 'data-offline="true"')
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
  .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/, '')
  .replace('initializeTimetable();initializeDialogAccessibility();', 'window.__navigationTest={captureState,applyStatePreservingInputs,updateTripProgress,updateWorldClocks};initializeTimetable();initializeDialogAccessibility();');
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
  try {
    const content = file === 'index.html' ? source : await readBrowserFixture(new URL(file, root));
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'image/png' }); res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const ready = page => page.waitForFunction(() => window.__navigationTest && !document.body.classList.contains('hydrating'));
let browser;
try {
  browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  diagnostics.scenario('visitor date boundaries');
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await diagnostics.context(browser, { timezoneId, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    const offset = timezoneId === 'Asia/Seoul' ? '+09:00' : '-08:00';
    for (const [date, selected] of [['2027-01-20T23:59:59','prep'],['2027-01-21T00:00:00','d1'],['2027-01-25T12:00:00','d5'],['2027-01-31T23:59:59','d11'],['2027-02-01T00:00:00','money']]) {
      await page.goto(origin + '/?previewDate=' + encodeURIComponent(date + offset));await ready(page);
      assert.equal(await page.locator('.day-radio:checked').getAttribute('id'), selected, timezoneId + date);
      await page.locator('#nav-schedule').click();
      assert.equal(await page.locator('.day-radio:checked').getAttribute('id'), /^d/.test(selected) ? selected : 'd1');
    }
    // The same instant crosses a different local day in the two visitor zones.
    await page.goto(origin + '/?previewDate=2027-01-21T00:00:00Z');await ready(page);
    assert.equal(await page.locator('.day-radio:checked').getAttribute('id'), timezoneId === 'Asia/Seoul' ? 'd1' : 'prep');
    await diagnostics.close(context);
  }
  diagnostics.scenario('section state, draft input and refresh');
  const context = await diagnostics.context(browser, { viewport: { width: 390, height: 844 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();page.setDefaultTimeout(10000);
  await page.goto(origin);await ready(page);
  await selectTripTab(page, 'd4', true);await page.locator('#timetableViewBtn').tap();
  await page.locator('[data-tt-range="1"]').tap();await page.locator('#timetableNext').tap();
  const start = await page.locator('#timetableStart').inputValue();
  await selectTripTab(page, 'money', true);
  assert.equal(await page.locator('.tabs').isVisible(), false);assert.equal(await page.locator('#scheduleViewSwitch').isVisible(), false);
  await page.locator('#expenseName').fill('입력 중인 경비');await page.locator('#expenseUsd').fill('12.34');
  await selectTripTab(page, 'prep', true);await page.locator('#nav-schedule').tap();
  assert.equal(await page.locator('#d4').isChecked(), true);assert.equal(await page.locator('#timetableView').isVisible(), true);
  assert.equal(await page.locator('#timetableStart').inputValue(), start);
  await page.evaluate(() => { const api=window.__navigationTest;api.applyStatePreservingInputs(api.captureState());api.updateTripProgress();api.updateWorldClocks(); });
  assert.equal(await page.locator('#d4').isChecked(), true);assert.equal(await page.locator('#timetableView').isVisible(), true);
  await selectTripTab(page, 'money', true);
  assert.equal(await page.locator('#expenseName').inputValue(), '입력 중인 경비');assert.equal(await page.locator('#expenseUsd').inputValue(), '12.34');
  await page.locator('#addExpense .button-icon').tap();await page.waitForFunction(() => document.querySelectorAll('#expenses .expense').length === 1);
  await page.locator('[data-edit-expense]').tap();await page.locator('#expenseEditName').fill('수정한 경비');await page.locator('#expenseEditSave').tap();
  await page.waitForFunction(() => document.querySelector('#expenses .expense-primary b').textContent === '수정한 경비');
  await selectTripTab(page, 'prep', true);await selectTripTab(page, 'money', true);
  assert.equal(await page.locator('#expenses .expense-primary b').textContent(), '수정한 경비');
  await page.reload();await ready(page);await selectTripTab(page, 'money', true);
  assert.equal(await page.locator('#expenses .expense-primary b').textContent(), '수정한 경비', 'Offline draft survives reload');
  diagnostics.scenario('theme menu keyboard and focus');
  await page.locator('#themeToggle').click();assert.equal(await page.locator('#themeToggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#themeMenu').isHidden(), true);assert.equal(await page.locator('#themeToggle').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('html').getAttribute('data-theme-preference'), 'dark');assert.equal(await page.locator('#themeMenu').isHidden(), true);
  assert.equal(await page.locator('#themeToggle').evaluate(el => el === document.activeElement), true);
  await page.locator('#themeToggle').click();await page.keyboard.press('Tab');
  assert.equal(await page.locator('#themeMenu').isHidden(), true);assert.equal(await page.locator('#themeToggle').evaluate(el => el === document.activeElement), false);
  await page.locator('#themeToggle').click();await page.locator('.world-clocks').click();assert.equal(await page.locator('#themeMenu').isHidden(), true);
  await page.locator('#themeToggle').click();await page.locator('#themeToggle').click();assert.equal(await page.locator('#themeMenu').isHidden(), true);
  diagnostics.scenario('responsive geometry, themes and screenshots');
  for (const theme of ['light','dark']) {
    await selectTheme(page, theme);
    for (const width of [320,390,519,520,521,620,621,680,681,768,899,900,901,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#themeToggle').click();
      const geometry=await page.evaluate(() => {
        const menu=document.querySelector('#themeMenu').getBoundingClientRect(),add=document.querySelector('#addExpense'),rect=add.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();
        return { overflow:document.documentElement.scrollWidth>innerWidth, menu:[menu.left,menu.right], add:[rect.width,rect.height,add.scrollWidth,add.clientWidth], nav:nav.bottom, overlap:rect.top < document.querySelector('#expenseUsd').getBoundingClientRect().bottom && rect.bottom > document.querySelector('#expenseUsd').getBoundingClientRect().top && rect.left < document.querySelector('#expenseUsd').getBoundingClientRect().right, hit:document.elementFromPoint(menu.right-12,menu.bottom-12)?.closest('#themeMenu')?.id };
      });
      assert.equal(geometry.overflow,false,`overflow ${theme} ${width}`);assert.ok(geometry.menu[0]>=0&&geometry.menu[1]<=width,`menu ${width}`);assert.equal(geometry.hit,'themeMenu');
      assert.ok(geometry.add[1]>=44&&geometry.add[2]<=geometry.add[3],`add ${width}`);assert.equal(geometry.nav,900);assert.equal(geometry.overlap,false,`currency/add overlap ${width}`);
      if ([320,390,768,1440].includes(width)) await page.screenshot({ path:path.join(output, `${theme}-${width}-menu.png`) });
      await page.keyboard.press('Escape');
      await page.locator('#expenses .expense').last().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
      assert.ok(await page.locator('#expenses .expense').last().evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top),`last row ${width}`);
      if ([320,1440].includes(width)) await page.screenshot({ path:path.join(output, `${theme}-${width}-ledger.png`), fullPage:true });
    }
  }
  // Reduced visual viewport approximates the layout available above a keyboard.
  await page.setViewportSize({ width:390,height:360 });await page.locator('#expenseName').focus();await page.locator('#addExpense').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#addExpense').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top));
  await page.setViewportSize({width:640,height:450});await page.evaluate(()=>document.documentElement.style.zoom='2');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>document.documentElement.style.zoom='');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-remove-expense]').click();await page.locator('#noticeDialog').getByRole('button',{name:'삭제',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#expenses .expense').length===0);
  await diagnostics.close(context);
  console.log(`${engine}: Navigation/date boundaries, drafts, theme focus, responsive layout and ledger CRUD passed. Screenshots: ${output}`);
} catch(error) { await diagnostics.fail(error);throw error; }
finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
