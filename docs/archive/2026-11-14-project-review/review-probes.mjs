// Dated review probes. Synthetic data only; no production requests or app edits.
// Run from repository root: node docs/archive/2026-11-14-project-review/review-probes.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { injectBrowserFixture, readBrowserFixture, selectTripTab, selectTheme } from '../../../scripts/browser-fixtures.mjs';

const root = new URL('../../../', import.meta.url);
const output = new URL('./', import.meta.url);
const api = `window.__review={captureState,documentSession,photosController,createPhotosController,
  setEditingUI,initializeHistory,dialogs,showDialog,ledgerController,receivePublishedState,readPublicCache};`;
const html = injectBrowserFixture((await readFile(new URL('index.html', root), 'utf8'))
  .replace('data-offline="false"','data-offline="true"')
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
  .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,''), api);
const server = createServer(async (req,res) => {
  const file = new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if (!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)) return res.writeHead(404).end();
  try {
    const content = file === 'index.html' ? html : await readBrowserFixture(new URL(file,root));
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.woff2')?'font/woff2':'image/png'}).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const results={date:'2026-11-14',scope:'Synthetic Chromium development review',checks:[],pageErrors:[]};
try {
  browser=await chromium.launch({headless:true});
  results.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>results.pageErrors.push(error.message));
  const ready=async()=>{await page.goto(origin);await page.waitForFunction(()=>window.__review&&!document.body.classList.contains('hydrating'));await page.evaluate(()=>document.fonts.ready);};
  await ready();
  for(const [width,theme,section] of [[1440,'light','d1'],[390,'light','prep'],[390,'dark','money']]) {
    await page.setViewportSize({width,height:900});await selectTheme(page,theme);await selectTripTab(page,section);
    await page.evaluate(()=>scrollTo(0,0));
    results.checks.push(await page.evaluate(({width,theme,section})=>({id:'layout',width,theme,section,headerHeight:document.querySelector('header').getBoundingClientRect().height,firstTaskTop:document.querySelector(section==='prep'?'.checklist input':section==='money'?'#expenseDate':'.day1 .timeline-row').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}),{width,theme,section}));
    await page.screenshot({path:fileURLToPath(new URL(`${theme}-${width}-${section}.png`,output)),fullPage:true});
  }

  await page.setViewportSize({width:1440,height:900});await selectTheme(page,'light');await selectTripTab(page,'d1');
  await page.locator('#editBtn').click();await page.waitForFunction(()=>document.body.classList.contains('editing'));
  results.checks.push(await page.evaluate(()=>{
    const row=document.querySelector('.day1 .timeline-row'),title=row.querySelector('h3'),original=title.textContent;
    title.focus();title.textContent='Last input immediately before deletion';
    title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'n'}));
    row.querySelector('[data-delete-row]').click();
    document.querySelector('#undoBtn').click();
    return {id:'F1',scenario:'Type, delete within history debounce, Undo',original,expected:'Last input immediately before deletion',actual:document.querySelector('.day1 .timeline-row h3').textContent};
  }));
  await page.screenshot({path:fileURLToPath(new URL('undo-after-delete.png',output))});

  results.checks.push(await page.evaluate(()=>{
    const fields=[...document.querySelectorAll('main [contenteditable="true"]')].filter(el=>el.getClientRects().length);
    return {id:'U2',scenario:'Accessible names on itinerary editing fields',fields:fields.map(el=>({tag:el.tagName,className:el.className,text:el.textContent.slice(0,50),role:el.getAttribute('role'),label:el.getAttribute('aria-label'),labelledby:el.getAttribute('aria-labelledby'),placeholder:el.dataset.placeholder}))};
  }));
  const cdp=await context.newCDPSession(page);
  const {root:dom}=await cdp.send('DOM.getDocument');
  const computedNames=[];
  for(const selector of ['.day1 .day-head p','.day1 .card h3','.day1 .remark']) {
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector});
    const {nodes}=await cdp.send('Accessibility.getPartialAXTree',{nodeId,fetchRelatives:false});
    computedNames.push({selector,nodes});
  }
  results.checks.push({id:'U2-AX',scenario:'Chromium computed accessibility nodes',computedNames});
  await cdp.detach();
  await page.evaluate(()=>window.__review.showDialog(document.querySelector('#exportDialog')));
  await page.locator('#exportDialog').waitFor({state:'visible'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  results.checks.push(await page.evaluate(()=>{
    const nav=document.querySelector('#tab-money');nav.focus();
    return {id:'U1',scenario:'Background focus while a modal is open',activeElement:document.activeElement.id,dialogContainsFocus:document.querySelector('#exportDialog').contains(document.activeElement),backgroundInert:nav.closest('[inert]')!==null,backgroundAriaHidden:nav.closest('[aria-hidden="true"]')!==null};
  }));
  await page.keyboard.press('Tab');
  results.checks.push(await page.evaluate(()=>({id:'U1-Tab',scenario:'Tab after focus moved outside modal',activeElement:document.activeElement.id,dialogContainsFocus:document.querySelector('#exportDialog').contains(document.activeElement)})));
  await writeFile(new URL('modal-accessibility-tree.txt',output),await page.locator('body').ariaSnapshot());
  await page.locator('#exportCancel').click();

  await page.evaluate(()=>window.__review.setEditingUI(false));await selectTripTab(page,'money');
  for(const name of ['Expense A','Expense B']) {
    await page.locator('#expenseName').fill(name);await page.locator('#expenseKrw').fill('1000');await page.locator('#addExpense').click();
  }
  await page.waitForFunction(()=>document.querySelectorAll('#expenses .expense').length===2);
  await page.locator('[data-move-expense][data-move-direction="1"]').first().focus();await page.keyboard.press('Enter');
  results.checks.push(await page.evaluate(()=>({id:'U3',scenario:'Keyboard reorder of an expense',activeTag:document.activeElement.tagName,activeId:document.activeElement.id,order:[...document.querySelectorAll('.expense-primary b')].map(el=>el.textContent)})));

  // Hold thumbnail encoding after full encoding: cancellation must be checked
  // before committing the completed asynchronous photo into the document.
  results.checks.push(await page.evaluate(async()=>{
    const row=document.createElement('div');row.innerHTML='<article class="card"><div class="schedule-media-tools"></div></article>';
    let cancelled=false,resolveThumb;let mutated=0,compressCalls=0;const statuses=[];
    const ctrl=window.__review.createPhotosController({
      $:()=>null,OFFLINE_MODE:true,blobToDataUrl:async()=> 'data:image/webp;base64,AA==',
      compressImage:async()=>{compressCalls++;if(compressCalls===2)return new Promise(resolve=>resolveThumb=resolve);return new Blob(['full'],{type:'image/webp'});},
      decoratePhotoFigure:()=>{},escapeHtml:value=>value,finishMutation:()=>mutated++,
      isOperationBusy:()=>false,isOperationCancelled:()=>cancelled,setOperationBusy:()=>{},
      setStatus:value=>statuses.push(value),showChoice:async()=>{},uid:()=> 'probe-photo',updatePhotoMoveButtons:()=>{}
    });
    ctrl.selectActiveScheduleRow(row);const attaching=ctrl.attachPhotos([{name:'probe.jpg',size:10}]);
    while(!resolveThumb)await Promise.resolve();cancelled=true;resolveThumb(new Blob(['thumb'],{type:'image/webp'}));await attaching;
    return {id:'F2',scenario:'Cancel during thumbnail encoding',attachedAfterCancel:row.querySelectorAll('.schedule-photo').length,mutated,status:statuses.at(-1)};
  }));
  assert.equal(results.pageErrors.length,0,'Probe harness should not create uncaught app errors');
  await context.close();
  const cacheContext=await browser.newContext({serviceWorkers:'block'});
  await cacheContext.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const a=await cacheContext.newPage(),b=await cacheContext.newPage();
  for(const tab of [a,b]){await tab.goto(origin);await tab.waitForFunction(()=>window.__review&&!document.body.classList.contains('hydrating'));}
  await b.evaluate(()=>{const api=window.__review;return api.receivePublishedState({revision:20,updated_at:'2026-11-14T01:00:00Z',content:api.captureState()},'realtime');});
  await b.waitForFunction(async()=> (await window.__review.readPublicCache())?.revision===20);
  const before=await b.evaluate(async()=> (await window.__review.readPublicCache()).revision);
  await a.evaluate(()=>{const api=window.__review;return api.receivePublishedState({revision:10,updated_at:'2026-11-14T00:00:00Z',content:api.captureState()},'refresh');});
  await a.waitForFunction(async()=> (await window.__review.readPublicCache())?.revision===10);
  const after=await b.evaluate(async()=> (await window.__review.readPublicCache()).revision);
  results.checks.push({id:'F3',scenario:'Newer public cache from tab B overwritten by delayed older adoption in tab A',before,after});
  await cacheContext.close();
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await writeFile(new URL('review-probes.json',output),JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify(results,null,2));
