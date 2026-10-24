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
        'window.__ledgerTest={captureState,applyState,applyStatePreservingInputs,normalizeState,buildDiff,migratePublishedState,exportOfflineHtml,exportStaticHtml};initializeTimetable();initializeDialogAccessibility();');
    res.writeHead(200, { 'Content-Type': { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml' }[file.split('.').at(-1)], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const header = '"날짜","내용","카테고리","원화 금액","달러 금액","자동 계산 통화","적용 환율"';
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
  '"2027-03-02","점심 Cafe","식비","10000","7.54","USD","1325.5"',
  '"2027-03-03","저녁 CAFE","식비","16357","12.34","KRW","1325.5"',
  '"2027-03-04","Cafe 이동","교통","2000.4","1.51","USD","1325.5"',
  '"","팁","교통","13","0.01","KRW","1325.5"'
];
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  for (const mobile of [false, true]) {
    const mode = mobile ? 'mobile' : 'desktop';
    diagnostics.scenario(`ledger startup / ${mode}`);
    const context = await diagnostics.context(browser, { viewport: { width: mobile ? 390 : 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR', reducedMotion: 'reduce', acceptDownloads: true, serviceWorkers: 'block' });
    await context.route('**/*', route => /^(file:|data:)/.test(route.request().url()) || new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(`${mode}: ${error.message}`));
    let scenario = 'startup'; diagnostics.scenario(`${mode} / ${scenario}`);
    let downloadIndex = 0;
    const text = selector => page.locator(selector).textContent();
    const activate = locator => mobile ? locator.tap() : locator.click();
    const totals = async expected => assert.deepEqual(await Promise.all(['#totalKrw', '#totalUsd'].map(text)), expected, scenario);
    const fixture = async (expenses, options = {}) => {
      await page.evaluate(({ expenses, options, categories }) => {
        const api = window.__ledgerTest;
        api.applyState(api.normalizeState({ ...api.captureState(), schemaVersion:5, expenses, categories, exchangeRate: 1325.5, exchangeRateUpdated: '', budgetKrw: 0, ...options }));
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
      await totals(['₩28,370', '$21.40']);
      assert.deepEqual(await page.locator('#categorySummary .category-total b').allTextContents(), ['₩26,357 · $19.88', '₩2,013 · $1.52']);
      assert.deepEqual(await page.locator('#categorySummary small').allTextContents(), []);
      await csv(mixedCsv);

      scenario = 'rate and budget changes through settings'; diagnostics.scenario(`${mode} / ${scenario}`);
      await settings(1400);
      await totals(['₩28,370', '$21.40']);
      assert.deepEqual(await page.locator('#categorySummary small').allTextContents(), []);
      await csv([mixedCsv[0], '"2027-03-03","저녁 CAFE","식비","16357","12.34","KRW","1325.5"', mixedCsv[2], '"","팁","교통","13","0.01","KRW","1325.5"']);
      scenario = 'rounding at half won and aggregate before rounding'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture([
        expense('below-half', '소수 원화', 1.49, 'KRW', '2027-03-02'),
        expense('half', '반 원화', 1.5, 'KRW', '2027-03-02'),
        expense('usd-half', '센트', 0.01, 'USD', '2027-03-02')
      ], { exchangeRate: 1350, budgetKrw: 16.49 });
      await totals(['₩17', '$0.01']);
      assert.deepEqual(await page.locator('.expense-amount').allTextContents(), ['₩1 · $0.00 자동 계산', '₩2 · $0.00 자동 계산', '₩14 자동 계산 · $0.01']);
      await csv(['"2027-03-02","소수 원화","식비","1.49","0","USD","1350"', '"2027-03-02","반 원화","식비","1.5","0","USD","1350"', '"2027-03-02","센트","식비","14","0.01","KRW","1350"']);

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
      await totals(['₩28,370', '$21.40']);
      await csv(['"2027-03-02","점심 Cafe","삭제된 카테고리","10000","7.54","USD","1325.5"', '"2027-03-03","저녁 CAFE","삭제된 카테고리","16357","12.34","KRW","1325.5"', mixedCsv[2], mixedCsv[3]]);

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
        '"2027-03-02","서울, 점심","여행, ""식비""","10","0.01","USD","1325.5"',
        '"2027-03-02","메모 ""둘""","여행, ""식비""","20","0.02","USD","1325.5"',
        '"2027-03-02","첫 줄\n둘째 줄\r\n셋째 줄","여행, ""식비""","30","0.02","USD","1325.5"',
        `"2027-03-02","'=1+1","'=1+1","40","0.03","USD","1325.5"`,
        `"2027-03-02","'+SUM(1,2)","여행, ""식비""","50","0.04","USD","1325.5"`,
        `"2027-03-02","'-1+2","여행, ""식비""","60","0.05","USD","1325.5"`,
        `"2027-03-02","'@SUM(1,2)","여행, ""식비""","70","0.05","USD","1325.5"`
      ]);

      scenario = 'empty ledger'; diagnostics.scenario(`${mode} / ${scenario}`);
      await fixture([]);
      await totals(['₩0', '$0.00']);
      assert.equal(await text('#expenses .remark'), '아직 기록된 경비가 없습니다.');
      assert.equal(await text('#categorySummary'), '아직 카테고리별 내역이 없습니다.');
      await csv([]);
      scenario = 'dual currency input, source transitions and fixed values'; diagnostics.scenario(`${mode} / ${scenario}`);
      await settings(1400);
      const krw=page.locator('#expenseKrw'),usd=page.locator('#expenseUsd');
      const saved=()=>page.evaluate(()=>window.__ledgerTest.captureState().expenses);
      await page.locator('#expenseName').fill('두 통화');
      await krw.fill('14000');assert.equal(await usd.inputValue(),'10');
      assert.equal(await text('#expenseUsdHint'),'수동 환율로 자동 계산');
      await usd.focus();assert.equal(await text('#expenseUsdHint'),'수동 환율로 자동 계산');
      // A real input event with the same number promotes it to direct input.
      await usd.fill('10');assert.equal(await text('#expenseUsdHint'),'');
      await krw.fill('14500');assert.equal(await usd.inputValue(),'10');
      await usd.fill('');assert.equal(await usd.inputValue(),'10.36');
      await krw.fill('');assert.equal(await usd.inputValue(),'');
      await usd.fill('10');assert.equal(await krw.inputValue(),'14000');
      await krw.fill('');assert.equal(await krw.inputValue(),'14000');
      await activate(page.locator('#addExpense'));
      assert.deepEqual((await saved()).map(({amountKrw,amountUsd,amountSource,appliedExchangeRate})=>({amountKrw,amountUsd,amountSource,appliedExchangeRate})),[{amountKrw:14000,amountUsd:10,amountSource:'usd',appliedExchangeRate:1400}]);
      assert.equal(await krw.inputValue(),'');assert.equal(await usd.inputValue(),'');
      await page.locator('#expenseName').fill('실제 결제');await krw.fill('14500');await usd.fill('10');await activate(page.locator('#addExpense'));
      await totals(['₩28,500','$20.00']);
      assert.equal((await saved())[1].amountSource,'both');
      assert.equal(await page.locator('#expenses .expense').nth(1).locator('small').count(),0);
      await settings(1500);await totals(['₩28,500','$20.00']);
      await activate(page.locator('[data-edit-expense]').first());
      assert.equal(await page.locator('#expenseEditKrw').inputValue(),'14000');
      await page.locator('#expenseEditName').fill('이름만 수정');await activate(page.locator('#expenseEditSave'));
      assert.equal((await saved())[0].appliedExchangeRate,1400);
      await activate(page.locator('[data-edit-expense]').first());
      await page.locator('#expenseEditUsd').fill('11');assert.equal(await page.locator('#expenseEditKrw').inputValue(),'16500');
      await page.keyboard.press('Escape');assert.equal((await saved())[0].amountUsd,10);
      await activate(page.locator('[data-edit-expense]').first());
      await page.locator('#expenseEditUsd').fill('11');await activate(page.locator('#expenseEditSave'));
      assert.equal((await saved())[0].amountKrw,16500);assert.equal((await saved())[0].appliedExchangeRate,1500);
      // Actual validation must preserve the string and focus the invalid field.
      for(const [value,hint] of [['0','0보다'],['1.1','원 단위'],['1e3','올바른'],['1,00','올바른'],['9007199254740992','범위']]){
        await page.locator('#expenseName').fill('검증');await krw.fill(value);await activate(page.locator('#addExpense'));
        assert.equal((await saved()).length,2);assert.equal(await krw.inputValue(),value);
        assert.match(await text('#expenseKrwHint'),new RegExp(hint));assert.equal(await krw.getAttribute('aria-invalid'),'true');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'expenseKrw');
      }
      await krw.fill('1');assert.equal(await usd.inputValue(),'0');await activate(page.locator('#addExpense'));
      assert.equal((await saved())[2].amountUsd,0);assert.equal((await saved())[2].amountSource,'krw');
      await page.locator('#expenseName').fill('갱신 중');await usd.fill('10');
      await usd.focus();await usd.evaluate(el=>el.setSelectionRange(1,2));
      await page.evaluate(()=>{const api=window.__ledgerTest;api.applyStatePreservingInputs({...api.captureState(),exchangeRate:1600});});
      assert.equal(await krw.inputValue(),'16000');assert.equal(await usd.inputValue(),'10');
      assert.deepEqual(await page.evaluate(()=>[document.activeElement.id,document.activeElement.selectionStart,document.activeElement.selectionEnd]),['expenseUsd',1,2]);
      await krw.fill('17000');
      await page.evaluate(()=>{const api=window.__ledgerTest;api.applyStatePreservingInputs({...api.captureState(),exchangeRate:1800});});
      assert.equal(await krw.inputValue(),'17000');assert.equal(await text('#expenseKrwHint'),'');
      // Comparing only a source change must still produce a real diff.
      assert.ok(await page.evaluate(()=>{const api=window.__ledgerTest,a=api.captureState(),b=structuredClone(a);b.expenses[0].amountSource='both';b.expenses[0].appliedExchangeRate=null;return api.buildDiff(a,b).some(g=>g.items.some(t=>t.includes('입력 출처')));}));
      // A changed/deleted expense cannot be overwritten from the open dialog.
      await activate(page.locator('[data-edit-expense]').first());
      await page.evaluate(()=>{const api=window.__ledgerTest,state=api.captureState();state.expenses.shift();api.applyStatePreservingInputs(state);});
      await activate(page.locator('#expenseEditSave'));assert.equal((await saved()).length,2);
      assert.match(await text('#status'),/내역이 변경/);await page.keyboard.press('Escape');
      const exportedExpenses=await saved(),renderedAmounts=await page.locator('.expense-amount').allTextContents();
      for(const kind of ['editable','readonly']){
        const pending=page.waitForEvent('download');
        await page.evaluate(kind=>kind==='editable'?window.__ledgerTest.exportOfflineHtml():window.__ledgerTest.exportStaticHtml(),kind);
        const artifactFile=path.join(output,`${mode}-dual-${kind}.html`);await(await pending).saveAs(artifactFile);
        const artifact=await context.newPage();await artifact.goto(pathToFileURL(artifactFile).href);
        if(kind==='editable'){
          await artifact.waitForFunction(()=>!document.body.classList.contains('hydrating'));await selectTripTab(artifact,'money');
          assert.deepEqual(await artifact.evaluate(()=>JSON.parse(document.querySelector('#offlineEmbeddedState').textContent).expenses),exportedExpenses);
          await artifact.reload();await artifact.waitForFunction(()=>!document.body.classList.contains('hydrating'));await selectTripTab(artifact,'money');
        }
        assert.deepEqual(await artifact.locator('.expense-amount').allTextContents(),renderedAmounts);
        await artifact.close();
      }
      for(const width of [320,390,1440]){
        await page.setViewportSize({width,height:900});await krw.fill('9007199254740991');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.locator('#addExpense').evaluate(el=>el.getBoundingClientRect().right<=el.closest('.expense-entry').getBoundingClientRect().right),true,'Button stays inside the entry card');
        await page.screenshot({path:path.join(output,`${mode}-${width}-dual-ledger.png`),fullPage:true});
        await krw.fill('1.1');await activate(page.locator('#addExpense'));
        await page.screenshot({path:path.join(output,`${mode}-${width}-dual-error.png`),fullPage:true});
      }
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
