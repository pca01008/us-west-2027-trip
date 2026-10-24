// Reusable-currency checks use synthetic data and never contact production.
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureConfig, readBrowserFixture, selectTripTab } from './browser-fixtures.mjs';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const diagnostics=await createBrowserDiagnostics('currency');
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const output=await mkdtemp(path.join(tmpdir(),'westbound-currency-'));
const origin='http://127.0.0.1:37899';
const html=source.replace('data-offline="false"','data-offline="true"')
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
  .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,'')
  .replace('initializeTimetable();initializeDialogAccessibility();','window.__currencyTest={captureState,normalizeState,exportOfflineHtml,exportStaticHtml,flushDraftPersistence,persistState};initializeTimetable();initializeDialogAccessibility();');
const errors=[];
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  for(const [base,quote,rate,amount,expected,baseTotal,quoteTotal] of [
    ['KRW','JPY',10,'123',1230,'₩1,230','¥123'],
    ['EUR','USD',0.925,'10',9.25,'€9.25','$10.00']
  ]) {
    diagnostics.scenario(`${base}/${quote} entry, draft, CSV, offline and readonly exports`);
    const config=structuredClone(fixtureConfig);
    Object.assign(config,{schemaVersion:7,tripId:'currency-'+quote.toLowerCase(),cacheNamespace:'currency_'+base+'_'+quote});
    Object.assign(config.ledger,{currencies:{base,quote},defaultExchangeRate:rate});
    config.clocks.destination={label:'TOKYO',timeZone:'Asia/Tokyo'};
    config.days.forEach(day=>day.events.forEach(event=>delete event.photos));
    const context=await diagnostics.context(browser,{viewport:{width:390,height:844},locale:'ko-KR',acceptDownloads:true,serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.protocol==='file:'||url.protocol==='data:')return route.continue();
      if(url.origin!==origin)return route.abort();
      if(url.pathname==='/index.html')return route.fulfill({body:html,contentType:'text/html; charset=utf-8'});
      if(url.pathname==='/trip-config.js')return route.fulfill({body:'window.TRIP_CONFIG='+JSON.stringify(config),contentType:'text/javascript'});
      if(/^\/(assets|icons)\/[\w.-]+$/.test(url.pathname))return route.fulfill({body:await readBrowserFixture(new URL('..'+url.pathname,import.meta.url))});
      return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/index.html');
    await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    await selectTripTab(page,'money');
    assert.match(await page.locator('label[for="expenseUsd"]>span').innerText(),new RegExp(quote));
    await page.locator('#expenseName').fill('테스트 경비');
    await page.locator('#expenseUsd').fill(amount);
    assert.equal(await page.locator('#expenseKrw').inputValue(),String(expected));
    await page.locator('#addExpense').click();
    await page.waitForFunction(()=>window.__currencyTest.captureState().expenses.length===1);
    assert.equal(await page.locator('#totalKrw').innerText(),baseTotal);
    assert.equal(await page.locator('#totalUsd').innerText(),quoteTotal);
    let state=await page.evaluate(()=>window.__currencyTest.captureState());
    assert.deepEqual(state.currencyCodes,{base,quote});
    assert.equal(state.expenses[0].amountKrw,expected);
    assert.equal(state.expenses[0].appliedExchangeRate,rate);
    assert.equal(await page.evaluate(()=>window.__currencyTest.flushDraftPersistence()),true);
    await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    assert.equal((await page.evaluate(()=>window.__currencyTest.captureState())).expenses[0].amountKrw,expected);
    await selectTripTab(page,'money');
    const mismatch=await page.evaluate(()=>{const api=window.__currencyTest,state=api.captureState();state.currencyCodes.quote='GBP';try{api.normalizeState(state);return 'accepted';}catch(error){return error.code;}});
    assert.equal(mismatch,'DOCUMENT_CURRENCY');
    assert.equal((await page.evaluate(()=>window.__currencyTest.captureState())).currencyCodes.quote,quote);
    // CSV must identify the actual automatically calculated currency.
    const csvPending=page.waitForEvent('download');await page.locator('#expenseCsvExport').click();
    const csv=await csvPending;const csvPath=path.join(output,quote+'.csv');await csv.saveAs(csvPath);
    assert.match(await readFile(csvPath,'utf8'),new RegExp('"'+base+'","'+rate+'"'));
    for(const type of ['editable','readonly']){
      const pending=page.waitForEvent('download');
      await page.evaluate(type=>type==='editable'?window.__currencyTest.exportOfflineHtml():window.__currencyTest.exportStaticHtml(),type);
      const download=await pending,file=path.join(output,quote+'-'+type+'.html');await download.saveAs(file);
      const exported=await readFile(file,'utf8');
      assert.doesNotMatch(exported,/src="(?:src\/|trip-config\.js)/);
      const copy=await context.newPage();await copy.goto(pathToFileURL(file).href);
      if(type==='editable'){
        await copy.waitForFunction(()=>!document.body.classList.contains('hydrating'));
        const restored=await copy.evaluate(()=>window.__currencyTest.captureState());
        assert.deepEqual(restored.currencyCodes,{base,quote});assert.deepEqual(restored.expenses,state.expenses);
      }
      assert.equal(await copy.locator('#totalUsd').textContent(),quoteTotal);
      await copy.close();
    }
    // Reusing the same trip with another currency must block saving its draft.
    config.ledger.currencies={base,quote:'GBP'};
    await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    assert.match(await page.locator('#status').innerText(),/통화가 다릅니다/);
    assert.equal(await page.evaluate(()=>window.__currencyTest.persistState(window.__currencyTest.captureState())),false);
    await diagnostics.close(context);
  }
  assert.deepEqual(errors,[]);
  console.log('Currency browser checks passed: KRW/JPY and EUR/USD, entry, draft reload, CSV, both HTML exports, currency mismatch write block.');
  console.log('Synthetic output: '+output);
} catch(error) {await diagnostics.fail(error);throw error;}
finally {await browser?.close();}
