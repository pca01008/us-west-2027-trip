import { selectTripTab } from './browser-fixtures.mjs';
// Exercise real ledger rendering, UI changes and downloaded CSV bytes offline.
// Only fixture setup uses an app hook; calculations and exports are not mocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('ledger');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-ledger-'));
const source = await readFile(new URL('index.html', root), 'utf8');
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
  try {
    let content = await readBrowserFixture(new URL(file, root));
    if (file === 'index.html') content = source.replace('data-offline="false"', 'data-offline="true"')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/, '')
      .replace('initializeTimetable();initializeDialogAccessibility();',
        'window.__ledgerTest={captureState,applyState,normalizeState};initializeTimetable();initializeDialogAccessibility();');
    res.writeHead(200, { 'Content-Type': { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml' }[file.split('.').at(-1)], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const header = '"날짜","내용","카테고리","통화","금액","원화 환산액"';
const categories = [{ id: 'food', name: '식비', icon: '🍽️' }, { id: 'travel', name: '교통', icon: '🚗' }];
const expense = (id, name, amount, currency, date, categoryId = 'food') => ({ id, name, amount, currency, date, categoryId });
const mixed = [
  expense('krw-meal', '점심 Cafe', 10000, 'KRW', '2027-03-02'),
  expense('usd-meal', '저녁 CAFE', 12.34, 'USD', '2027-03-03'),
  expense('krw-travel', 'Cafe 이동', 2000.4, 'KRW', '2027-03-04', 'travel'),
  expense('usd-tip', '팁', 0.01, 'USD', '', 'travel')
];
// Literal expected results: never compute expectations with the app's helpers.
const mixedCsv = [
  '"2027-03-02","점심 Cafe","식비","KRW","10000","10000"',
  '"2027-03-03","저녁 CAFE","식비","USD","12.34","16357"',
  '"2027-03-04","Cafe 이동","교통","KRW","2000.4","2000"',
  '"","팁","교통","USD","0.01","13"'
];
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  for (const mobile of [false, true]) {
    const mode = mobile ? 'mobile' : 'desktop';
    diagnostics.scenario(`ledger startup / ${mode}`);
    const context = await diagnostics.context(browser, { viewport: { width: mobile ? 390 : 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR', reducedMotion: 'reduce', acceptDownloads: true, serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(`${mode}: ${error.message}`));
    let scenario = 'startup'; diagnostics.scenario(`${mode} / ${scenario}`);
    let downloadIndex = 0;
    const text = selector => page.locator(selector).textContent();
    const activate = locator => mobile ? locator.tap() : locator.click();
    const totals = async expected => assert.deepEqual(await Promise.all(['#totalKrw', '#totalUsd', '#totalConverted'].map(text)), expected, scenario);
    const fixture = async (expenses, options = {}) => {
      await page.evaluate(({ expenses, options, categories }) => {
        const api = window.__ledgerTest;
        api.applyState(api.normalizeState({ ...api.captureState(), expenses, categories, exchangeRate: 1325.5, exchangeRateUpdated: '', budgetKrw: 0, ...options }));
      }, { expenses, options, categories });
    };
    const csv = async expectedLines => {
      const pending = page.waitForEvent('download');
      await activate(page.locator('#expenseCsvExport'));
      const download = await pending;
      assert.match(download.suggestedFilename(), /_EXPENSES_\d{4}-\d{2}-\d{2}\.csv$/);
      const file = path.join(output, `${mode}-${++downloadIndex}.csv`);
      await download.saveAs(file);
      const bytes = await readFile(file);
      assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${scenario}: UTF-8 BOM`);
      assert.equal(bytes.toString('utf8'), '\ufeff' + [header, ...expectedLines].join('\r\n'), `${scenario}: downloaded CSV`);
    };
    const settings = async rate => {
      await activate(page.locator('#editBtn'));
      if (rate !== undefined) await page.locator('#settingsExchangeRate').fill(String(rate));
      await activate(page.locator('#ledgerSettingsClose'));
      await page.locator('#ledgerSettingsDialog').waitFor({ state: 'hidden' });
    };
    try {
      await page.goto(origin);
      await page.waitForFunction(() => window.__ledgerTest && !document.body.classList.contains('hydrating'));
      await selectTripTab(page, 'money', mobile);
      scenario = 'mixed currency and unset budget'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture(mixed);
      await totals(['₩12,000', '$12.35', '₩28,370']);
      assert.deepEqual(await page.locator('#categorySummary .category-total b').allTextContents(), ['₩10,000 + $12.34', '₩2,000 + $0.01']);
      assert.deepEqual(await page.locator('#categorySummary small').allTextContents(), ['(원화 환산 ₩26,357)', '(원화 환산 ₩2,014)']);
      await csv(mixedCsv);

      scenario = 'rate and budget changes through settings'; diagnostics.scenario(`${mode} / ${scenario}`);
      await settings(1400);
      await totals(['₩12,000', '$12.35', '₩29,290']);
      assert.deepEqual(await page.locator('#categorySummary small').allTextContents(), ['(원화 환산 ₩27,276)', '(원화 환산 ₩2,014)']);
      await csv([mixedCsv[0], '"2027-03-03","저녁 CAFE","식비","USD","12.34","17276"', mixedCsv[2], '"","팁","교통","USD","0.01","14"']);
      scenario = 'rounding at half won and aggregate before rounding'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture([
        expense('below-half', '소수 원화', 1.49, 'KRW', '2027-03-02'),
        expense('half', '반 원화', 1.5, 'KRW', '2027-03-02'),
        expense('usd-half', '센트', 0.01, 'USD', '2027-03-02')
      ], { exchangeRate: 1350, budgetKrw: 16.49 });
      await totals(['₩3', '$0.01', '₩16']);
      assert.deepEqual(await page.locator('.expense-amount').allTextContents(), ['₩1', '₩2', '$0.01']);
      await csv(['"2027-03-02","소수 원화","식비","KRW","1.49","1"', '"2027-03-02","반 원화","식비","KRW","1.5","2"', '"2027-03-02","센트","식비","USD","0.01","14"']);

      await fixture(mixed, { budgetKrw: 987654 });
      assert.equal(await page.locator('#budgetOverview,#settingsBudgetKrw,.expense-filters,.expense-filter-summary').count(), 0);
      assert.doesNotMatch(await page.locator('.moneyday').innerText(), /등록순/);
      assert.equal(await page.evaluate(() => window.__ledgerTest.captureState().budgetKrw), 987654);
      assert.equal(await page.locator('[data-move-expense="krw-meal"][data-move-direction="-1"]').isDisabled(), true);
      assert.equal(await page.locator('[data-move-expense="usd-tip"][data-move-direction="1"]').isDisabled(), true);
      await activate(page.locator('[data-move-expense="usd-meal"][data-move-direction="-1"]'));
      await page.waitForFunction(() => document.querySelector('#expenses .expense').dataset.expenseId === 'usd-meal');
      await csv([mixedCsv[1], mixedCsv[0], mixedCsv[2], mixedCsv[3]]);
      await selectTripTab(page, 'prep', mobile);await selectTripTab(page, 'money', mobile);
      assert.equal(await page.locator('#expenses .expense').first().getAttribute('data-expense-id'), 'usd-meal');
      // A previous HTML snapshot may still contain removed controls and compatibility metadata.
      await page.evaluate(() => {
        const api=window.__ledgerTest, state=api.captureState();
        const template=document.createElement('template');template.innerHTML=state.html;
        template.content.querySelector('.moneyday').insertAdjacentHTML('beforeend','<div id="budgetOverview">옛 예산</div><div class="expense-filters"><input id="expenseFilterQuery" value="숨은 필터"></div>');
        template.content.querySelector('.prepday label').dataset.checkImportant='true';
        template.content.querySelector('.timeline-row').dataset.stayCheckout='2027-01-23';
        state.html=template.innerHTML;api.applyState(state);
      });
      assert.equal(await page.locator('#budgetOverview,.expense-filters').count(), 0);
      assert.equal(await page.evaluate(() => window.__ledgerTest.captureState().budgetKrw), 987654);
      assert.equal(await page.locator('.prepday label').first().getAttribute('data-check-important'), 'true');
      assert.equal(await page.locator('.timeline-row').first().getAttribute('data-stay-checkout'), '2027-01-23');
      await csv([mixedCsv[1], mixedCsv[0], mixedCsv[2], mixedCsv[3]]);
      await fixture(mixed);
      scenario = 'delete category preserves amounts and exports'; diagnostics.scenario(`${mode} / ${scenario}`);
      await activate(page.locator('#editBtn'));
      await activate(page.locator('#settingsCategoryList [data-category-delete="food"]'));
      await activate(page.locator('#noticeDialog').getByRole('button', { name: '삭제', exact: true }));
      await page.locator('#settingsCategoryList [data-category-delete="food"]').waitFor({ state: 'detached' });
      await activate(page.locator('#ledgerSettingsClose'));
      assert.equal(await page.locator('#expenseCategory option[value="deleted"]').count(), 0);
      assert.deepEqual(await page.locator('#expenses .expense-category-badge').allTextContents(), ['🗑️ 삭제된 카테고리', '🗑️ 삭제된 카테고리', '🚗 교통', '🚗 교통']);
      await totals(['₩12,000', '$12.35', '₩28,370']);
      await csv(['"2027-03-02","점심 Cafe","삭제된 카테고리","KRW","10000","10000"', '"2027-03-03","저녁 CAFE","삭제된 카테고리","USD","12.34","16357"', mixedCsv[2], mixedCsv[3]]);

      scenario = 'CSV punctuation, multiline Korean and formula prefixes'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture([
        expense('comma', '서울, 점심', 10, 'KRW', '2027-03-02'),
        expense('quote', '메모 "둘"', 20, 'KRW', '2027-03-02'),
        expense('newline', '첫 줄\n둘째 줄\r\n셋째 줄', 30, 'KRW', '2027-03-02'),
        expense('equals', '=1+1', 40, 'KRW', '2027-03-02', 'formula'),
        expense('plus', '+SUM(1,2)', 50, 'KRW', '2027-03-02'),
        expense('minus', '-1+2', 60, 'KRW', '2027-03-02'),
        expense('at', '@SUM(1,2)', 70, 'KRW', '2027-03-02')
      ], { categories: [{ id: 'food', name: '여행, "식비"', icon: '🍽️' }, { id: 'formula', name: '=1+1', icon: '📦' }] });
      await csv([
        '"2027-03-02","서울, 점심","여행, ""식비""","KRW","10","10"',
        '"2027-03-02","메모 ""둘""","여행, ""식비""","KRW","20","20"',
        '"2027-03-02","첫 줄\n둘째 줄\r\n셋째 줄","여행, ""식비""","KRW","30","30"',
        `"2027-03-02","'=1+1","'=1+1","KRW","40","40"`,
        `"2027-03-02","'+SUM(1,2)","여행, ""식비""","KRW","50","50"`,
        `"2027-03-02","'-1+2","여행, ""식비""","KRW","60","60"`,
        `"2027-03-02","'@SUM(1,2)","여행, ""식비""","KRW","70","70"`
      ]);

      scenario = 'empty ledger'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture([]);
      await totals(['₩0', '$0.00', '₩0']);
      assert.equal(await text('#expenses .remark'), '아직 기록된 경비가 없습니다.');
      assert.equal(await text('#categorySummary'), '아직 카테고리별 내역이 없습니다.');
      await csv([]);
      console.log(`${mode}: mixed totals, rate changes, rounding, budget compatibility, ordering, deleted categories and ${downloadIndex} CSV downloads passed.`);
    } catch (error) {
      await diagnostics.fail(new Error(`${mode} ledger scenario: ${scenario}`, { cause: error }));
      throw new Error(`${mode} ledger scenario: ${scenario}`, { cause: error });
    } finally { await diagnostics.close(context); }
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally {
  console.log('Ledger downloads:', output);
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
