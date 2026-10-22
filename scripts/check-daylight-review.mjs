// Check the exact generated review file locally, or its deployed HTTPS URL.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {selectAppTab} from './browser-fixtures.mjs';
const source=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const hash=createHash('sha256').update(source).digest('hex').slice(0,12);
const target=process.argv[2]||new URL('../ui-preview/daylight-candidate.html',import.meta.url).href;
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const requests=[],errors=[];
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(url===target||url.startsWith('data:')||url.startsWith('file:'))return route.continue();
  requests.push(url);return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(target);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
 assert.equal(await page.locator('meta[name=daylight-source]').getAttribute('content'),hash);
 const isolation=await page.evaluate(()=>({offline:document.documentElement.dataset.offline,id:window.TRIP_CONFIG.tripId,namespace:window.TRIP_CONFIG.cacheNamespace,pwa:!!document.querySelector('#pwaRegistration'),sdk:!!window.supabase}));
 assert.equal(isolation.offline,'true');assert.equal(isolation.id,'daylight-review-'+hash);assert.equal(isolation.namespace,'daylight_review_'+hash);assert.equal(isolation.pwa,false);assert.equal(isolation.sdk,false);
 await selectAppTab(page,'d1');assert.match(await page.locator('.daylight-stay').innerText(),/첫 도시 숙소/);
 await selectAppTab(page,'d4');assert.match(await page.locator('.daylight-stay').innerText(),/다음 도시 숙소/);
 await selectAppTab(page,'d7');assert.equal(await page.locator('.daylight-stay').count(),0);
 await selectAppTab(page,'prep');assert.equal(await page.locator('[data-check-jump]').count(),2);
 await page.locator('.checklist input').first().check();await page.waitForFunction(()=>document.querySelectorAll('[data-check-jump]').length===1);
 await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));await selectAppTab(page,'prep');assert.equal(await page.locator('[data-check-jump]').count(),1);
 await selectAppTab(page,'money');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'Review must request no SDK/API/PWA/external assets');
 console.log(`PASS review ${target}: source ${hash}, isolated storage, stays, importance persistence, no external requests`);
}finally{await browser.close();}
