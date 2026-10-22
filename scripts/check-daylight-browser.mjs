// The real candidate with a local revision-checked API and synthetic travel data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {readBrowserFixture,openAppTools,selectAppTab} from './browser-fixtures.mjs';
const root=new URL('../',import.meta.url),output=new URL('../docs/ui-concepts/previews/daylight-candidate/',import.meta.url);
await mkdir(output,{recursive:true});
const original=await readFile(new URL('index.html',root),'utf8');
let documentRow={content:{},revision:1},delay=0,fail=false;
const stub=`<script>window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:window.TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},rpc:(_name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),channel:()=>({on:()=>({subscribe:()=>{}})})})};</script>`;
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/mock/doc'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(documentRow));return;}
  if(req.url==='/mock/save'){
   let raw='';for await(const part of req)raw+=part;const args=JSON.parse(raw);if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   if(fail){fail=false;res.end(JSON.stringify({error:{message:'fixture failure'}}));return;}
   if(documentRow.revision!==args.p_expected_revision){res.end(JSON.stringify({error:{code:'40001',message:'Revision conflict'}}));return;}
   documentRow={content:args.p_content,revision:documentRow.revision+1,updated_at:new Date().toISOString()};res.end(JSON.stringify({data:documentRow,error:null}));return;
  }
  const url=new URL(req.url,'http://local'),relative=url.pathname.slice(1)||'index.html';
  if(!/^(index\.html|trip-config\.js|assets\/[\w.-]+|icons\/[\w.-]+)$/.test(relative)){res.writeHead(404).end();return;}
  let content=await readBrowserFixture(new URL(relative,root));
  if(relative==='index.html')content=original.replace(/<script id="pwaRegistration"[^>]*><\/script>/,'').replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/,stub).replace('initializeTimetable();initializeDialogAccessibility();','window.__daylight={captureState,normalizeState,applyState,fingerprint,buildDiff,checklistItems,patchChecklist,patchCheck,finishMutation,exportOfflineHtml,exportStaticHtml,recordHistory,isDirty,renderDaylightContext,pending:()=>pendingChecks.size};initializeTimetable();initializeDialogAccessibility();');
  res.setHeader('Content-Type',relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.js')?'text/javascript; charset=utf-8':'image/png');res.end(content);
 }catch(error){res.writeHead(500).end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch(),errors=[];
try{
 for(const width of [390,1440]){
  documentRow={content:{},revision:1};
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)||/^(file:|data:)/.test(route.request().url())?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  documentRow.content=await page.evaluate(()=>window.__daylight.captureState());
  const baseline=await page.evaluate(()=>window.__daylight.fingerprint(window.__daylight.captureState()));
  await page.locator('#editBtn').click();await page.locator('[data-check-action="important"]').first().click();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__daylight.fingerprint(window.__daylight.captureState())),baseline,'Cancel discards importance');
  await page.locator('#editBtn').click();await page.locator('[data-check-action="important"]').first().click();await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('#daylightContext [data-check-jump]').count(),1);
  assert.equal(await page.evaluate(()=>window.__daylight.isDirty()),false,'Importance is a standalone checklist save');
  assert.equal(await page.locator('main input[type=checkbox]').count(),12,'Derived region creates no duplicate checkbox');
  await page.locator('[data-check-jump]').click();assert.equal(await page.locator('.checklist input').first().evaluate(el=>el===document.activeElement),true);
  delay=700;await page.locator('.checklist input').first().click();await page.waitForFunction(()=>window.__daylight.pending()>0);
  assert.match(await page.locator('#daylightContext').innerText(),/저장 중/);await page.waitForFunction(()=>window.__daylight.pending()===0);delay=0;
  assert.equal(await page.locator('[data-check-jump]').count(),0,'Completed important item disappears only after success');
  assert.match(documentRow.content.html,/data-check-important="true"/);
  fail=true;await page.locator('[data-check-id="fixture-check-0"] input').click();await page.waitForFunction(()=>window.__daylight.pending()===0);
  assert.equal(await page.locator('[data-check-id="fixture-check-0"] input').isChecked(),true,'Failed uncheck restores completion');
  await page.locator('.check-feedback [data-retry-check]').click();await page.waitForFunction(()=>window.__daylight.pending()===0);assert.equal(await page.locator('[data-check-jump]').count(),1);
  await selectAppTab(page,'d1');await page.locator('#editBtn').click();
  const first=page.locator('.day1 .timeline-row').first();
  await first.locator('[data-media="stay"]').click();await page.locator('#stayEnabled').check();await page.locator('#stayCheckout').fill('2027-01-21');await page.locator('#stayApply').click();assert.match(await page.locator('#stayError').innerText(),/다음 날/);
  await page.locator('#stayCheckout').fill('2027-01-24');await page.locator('#stayApply').click();await page.locator('#stayDialog').waitFor({state:'hidden'});
  assert.match(await page.locator('#daylightContext').innerText(),/일정 1-1/);
  await page.locator('#undoBtn').click();assert.equal(await page.locator('.daylight-stay').count(),0);await page.locator('#redoBtn').click();assert.equal(await page.locator('.daylight-stay').count(),1);
  await first.locator('h3').fill('날짜별 숙소');await page.evaluate(()=>window.__daylight.recordHistory());assert.match(await page.locator('.daylight-stay').innerText(),/날짜별 숙소/);
  await page.locator('.day1 .timeline-row').nth(1).locator('[data-media="stay"]').click();await page.locator('#stayEnabled').check();await page.locator('#stayCheckout').fill('2027-01-23');await page.locator('#stayApply').click();assert.match(await page.locator('#stayError').innerText(),/겹칩니다/);await page.keyboard.press('Escape');
  const stored=await page.evaluate(()=>window.__daylight.captureState());
  const invariants=await page.evaluate(state=>{const a=window.__daylight,before=a.fingerprint(state);a.applyState(state);a.applyState(a.captureState());const after=a.fingerprint(a.captureState()),old=structuredClone(state);old.html=old.html.replaceAll(' data-check-important="true"','').replaceAll(/ data-stay-checkout="[^"]*"/g,'');return {before,after,diff:a.buildDiff(old,state),clean:a.normalizeState({...state,html:state.html+'<div data-check-important="true" data-stay-checkout="2027-02-30"></div>'}).html};},stored);
  assert.equal(invariants.after,invariants.before,'Repeated apply/capture is stable');assert.match(JSON.stringify(invariants.diff),/중요 표시/);assert.match(JSON.stringify(invariants.diff),/숙박 종료일/);assert.doesNotMatch(invariants.clean,/<div data-check-important/);
  await selectAppTab(page,'d3');assert.equal(await page.locator('.daylight-stay').count(),1);await selectAppTab(page,'d4');assert.equal(await page.locator('.daylight-stay').count(),0);
  const afterNav=await page.evaluate(()=>window.__daylight.fingerprint(window.__daylight.captureState()));assert.equal(afterNav,invariants.before,'Navigation never changes stored metadata');
  await page.evaluate(()=>{const a=window.__daylight,s=a.captureState();s.html=s.html.replace('data-row-id="default-1-2"','data-row-id="default-1-2" data-stay-checkout="2027-01-23"');a.applyState(s);});await selectAppTab(page,'d1');assert.match(await page.locator('.daylight-stay').innerText(),/확인 필요/);
  await page.evaluate(state=>window.__daylight.applyState(state),stored);
  // Preserve the candidate, then return to view mode without publishing.
  await page.evaluate(()=>{document.body.classList.remove('editing');document.body.classList.add('viewing');window.__daylight.applyState(window.__daylight.captureState());});
  for(const view of ['d1','prep','money']){
   await selectAppTab(page,view);await page.screenshot({path:fileURLToPath(new URL(`${width}-${view}.png`,output)),fullPage:true});
  }
  for(const screenWidth of [360,390,768,1280,1440]){await page.setViewportSize({width:screenWidth,height:900});const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().width).map(el=>el.tagName+'.'+el.className+'#'+el.id).slice(0,12));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${screenWidth}: ${overflow.join(', ')}`);}
  await page.setViewportSize({width,height:900});
  // Actual file execution in fresh contexts; no live API or shared storage.
  for(const kind of ['editable','readonly']){
   const download=page.waitForEvent('download');await page.evaluate(kind=>kind==='editable'?window.__daylight.exportOfflineHtml():window.__daylight.exportStaticHtml(),kind);
   const path=fileURLToPath(new URL(`${width}-${kind}.html`,output));await(await download).saveAs(path);
   const artifactContext=await browser.newContext({viewport:{width,height:900}});const requests=[];
   await artifactContext.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
   const artifact=await artifactContext.newPage();artifact.on('pageerror',e=>errors.push(e.message));await artifact.goto(pathToFileURL(path).href);
   if(kind==='editable')await artifact.waitForFunction(()=>!document.body.classList.contains('hydrating'));
   for(const id of ['prep','d1','d3','d4','d11','money'])await selectAppTab(artifact,id);
   await selectAppTab(artifact,'prep');assert.equal(await artifact.locator('[data-check-important="true"]').count(),1);
   await selectAppTab(artifact,'d1');assert.equal(await artifact.locator('[data-stay-checkout="2027-01-24"]').count(),1);
   if(kind==='readonly'){
    assert.match(await artifact.locator('.stay-readonly-note').innerText(),/2027-01-24/);assert.equal(await artifact.locator('.checklist input').first().isDisabled(),true);
    assert.ok(await artifact.locator('main').evaluate(el=>el.getBoundingClientRect().width>=innerWidth-80),'Readonly content uses the space freed by the removed sidebar');
   }else assert.match(await artifact.locator('.daylight-stay').innerText(),/날짜별 숙소/);
   await artifact.reload();if(kind==='editable')await artifact.waitForFunction(()=>!document.body.classList.contains('hydrating'));await selectAppTab(artifact,'prep');assert.equal(await artifact.locator('[data-check-important="true"]').count(),1);
   assert.equal(requests.length,0,'Export makes no external requests');await artifactContext.close();
  }
  await context.close();console.log(`PASS Daylight ${width}: importance, pending/failure, stays, overlap, history, metadata, navigation, exports, responsive`);
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('result.json',output),JSON.stringify({runtime:process.version,fixtureVersion:1,passed:true,widths:[390,1440],responsive:[360,390,768,1280,1440]},null,2));
}finally{await browser.close();server.close();}
