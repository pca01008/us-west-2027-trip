import { selectTripTab } from './browser-fixtures.mjs';
// Real IndexedDB transactions with faults injected at browser API boundaries.
// Application storage functions are never replaced. All HTTP traffic stays local.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('storage');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
let row, saves;
const stub = `<script>window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{email:window.TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:()=>{},signOut:async()=>({})},
  from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},
  rpc:(_name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),
  channel:()=>({on:()=>({subscribe:()=>{}})})
})};</script>`;
const server = createServer(async (req,res) => {
  try {
    if(req.url==='/mock/doc'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(row));return;}
    if(req.url==='/mock/save'){
      let body='';for await(const part of req)body+=part;
      const args=JSON.parse(body);
      const result=args.p_expected_revision!==row.revision?{error:{code:'40001',message:'Revision conflict'}}
        :(saves++,row={content:args.p_content,revision:row.revision+1,updated_at:'2026-10-19T01:00:00Z'},{data:{revision:row.revision,updated_at:row.updated_at}});
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1)||'index.html';
    if(!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)){res.writeHead(404).end();return;}
    let body=await readBrowserFixture(new URL(file,root));
    if(file==='index.html')body=source
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
      .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,stub)
      .replace('data-offline="false"',url.searchParams.has('offline')?'data-offline="true"':'data-offline="false"')
      .replace('initializeTimetable();initializeDialogAccessibility();',`window.__storageTest={captureState,recordHistory,flushDraftPersistence,readDraftRecord,clearDraftRecord,discardDraft,discardAndLogout,saveAndFinish,exportOfflineHtml,handleExternalSignOut,recoverOnlineDraft,isDirty,key:DRAFT_RECORD_KEY,db:DRAFT_DB_NAME};initializeTimetable();initializeDialogAccessibility();`);
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'image/webp');res.end(body);
  }catch(error){res.writeHead(500).end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const errors=[];

function installFaults(fixtureOrigin) {
  // addInitScript also runs on the initial opaque about:blank document.
  if (location.origin !== fixtureOrigin) return;
  const nativeOpen=IDBFactory.prototype.open,nativePut=IDBObjectStore.prototype.put,nativeDelete=IDBObjectStore.prototype.delete;
  const fault=window.__idbFault={mode:sessionStorage.getItem('storage-test-fault')||'',hits:0,requestSuccesses:0};
  IDBFactory.prototype.open=function(...args){
    if(fault.mode==='open-throw'){fault.hits++;throw new DOMException('Injected open denial','SecurityError');}
    if(fault.mode==='open-error'){
      fault.hits++;
      const request={error:new DOMException('Injected open error','UnknownError')};
      queueMicrotask(()=>request.onerror?.(new Event('error')));return request;
    }
    return nativeOpen.apply(this,args);
  };
  const isDraft=key=>/^(online|offline):/.test(String(key));
  IDBObjectStore.prototype.put=function(value,key){
    if(isDraft(key)&&fault.mode==='quota'){fault.hits++;throw new DOMException('Injected full storage','QuotaExceededError');}
    const request=nativePut.call(this,value,key);
    if(isDraft(key)&&fault.mode==='write-abort'){
      fault.hits++;
      // The request succeeds, but the real transaction rolls back before commit.
      request.addEventListener('success',()=>{fault.requestSuccesses++;this.transaction.abort();});
    }
    return request;
  };
  IDBObjectStore.prototype.delete=function(key){
    const request=nativeDelete.call(this,key);
    if(isDraft(key)&&fault.mode==='delete-abort'){
      fault.hits++;request.addEventListener('success',()=>{fault.requestSuccesses++;this.transaction.abort();});
    }
    return request;
  };
  // Independent durable-state oracle, bypassing only the injected open fault.
  window.__durableDrafts=()=>new Promise((resolve,reject)=>{
    const request=nativeOpen.call(indexedDB,window.__storageTest.db,1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('records','readonly'),entries=[];
      const cursor=tx.objectStore('records').openCursor();
      cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(isDraft(c.key))entries.push(c.value);c.continue();};
      tx.oncomplete=()=>{db.close();resolve(entries);};tx.onabort=()=>{db.close();reject(tx.error);};
    };
  });
}
const ready=page=>page.waitForFunction(()=>window.__storageTest&&!document.body.classList.contains('hydrating'));
const title=page=>page.locator('.day1 .timeline-row h3').first();
const durable=page=>page.evaluate(()=>window.__durableDrafts());
const setFault=(page,mode)=>page.evaluate(mode=>{window.__idbFault.mode=mode;},mode);
async function edit(page,text){
  await selectTripTab(page, 'd1');
  if(!await page.locator('body').evaluate(el=>el.classList.contains('editing')))await page.locator('#editBtn').click();
  await page.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
  await title(page).fill(text);
  return page.evaluate(async()=>{window.__storageTest.recordHistory();return window.__storageTest.flushDraftPersistence();});
}
async function recover(page){
  await page.getByRole('button',{name:'초안 복구',exact:true}).click();await ready(page);
}
async function exportedState(page){
  const download=page.waitForEvent('download');
  await page.evaluate(()=>window.__storageTest.exportOfflineHtml());
  const html=await readFile(await(await download).path(),'utf8');
  assert.doesNotMatch(html,/<span[^>]+id="draftStorageWarning"/,'Export does not carry a transient storage warning');
  return JSON.parse(html.match(/<script id="offlineEmbeddedState"[^>]*>([\s\S]*?)<\/script>/)[1]);
}
async function setup(scenario,mobile,offline=false){
  diagnostics.scenario(`${scenario} / ${mobile ? "mobile" : "desktop"}`);
  row={content:{},revision:0,updated_at:'2026-10-19T00:00:00Z'};saves=0;
  const context=await diagnostics.context(browser, {viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(installFaults, origin);
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+(offline?'/?offline':''));await ready(page);
  row.content=await page.evaluate(()=>window.__storageTest.captureState());
  return {context,page};
}
try {
  browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  {
    const {context,page}=await setup('checkpoint and IDB unavailable',false);
    await edit(page,'Previous committed draft');
    await page.evaluate(()=>{const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes(':checkpoint:'))throw new DOMException('Checkpoint quota','QuotaExceededError');return setItem.call(this,key,value);};});
    await setFault(page,'quota');assert.equal(await edit(page,'Unsaved memory draft'),false);
    assert.match(await page.locator('#draftStorageWarning').innerText(),/새로고침 전에 공유 저장하거나 내보내세요/);
    assert.match((await exportedState(page)).html,/Unsaved memory draft/);
    await page.reload();await recover(page);assert.equal(await title(page).textContent(),'Previous committed draft');
    await diagnostics.close(context);
  }
  for(const mobile of [false,true]){
    for(const mode of ['open-error','open-throw','quota','write-abort']){
      const {context,page}=await setup(`write ${mode}`, mobile);
      assert.equal(await edit(page,'Durable draft'),true);
      let previous=await durable(page);
      if(mode.startsWith('open')){
        await page.evaluate(mode=>sessionStorage.setItem('storage-test-fault',mode),mode);
        await page.reload();await ready(page);
        assert.match(await page.locator('#draftStorageWarning').innerText(),/초안을 확인하지 못했습니다/);
        previous=await durable(page);
      }
      await setFault(page,mode);
      assert.equal(await edit(page,'Memory-only draft'),false,mode+' must report failure');
      assert.equal(await title(page).textContent(),'Memory-only draft');
      assert.equal(await page.evaluate(()=>window.__storageTest.isDirty()),true);
      assert.match(await page.locator('#draftStorageWarning').innerText(),/새로고침 전에 공유 저장하거나 내보내세요/);
      assert.deepEqual(await durable(page),previous,'Failed write must preserve the previous durable draft');
      assert.match((await page.evaluate(()=>window.__storageTest.readDraftRecord())).state.html,/Memory-only draft/);
      assert.match((await exportedState(page)).html,/Memory-only draft/,'Export includes the newest in-memory edits');
      assert.equal(saves,0);
      assert.ok(await page.evaluate(()=>window.__idbFault.hits)>0,'Fault must actually be exercised');
      if(mode==='write-abort')assert.ok(await page.evaluate(()=>window.__idbFault.requestSuccesses)>0);
      // Keep the IDB fault through pagehide; the synchronous checkpoint survives.
      await page.evaluate(()=>sessionStorage.removeItem('storage-test-fault'));
      await page.reload();await recover(page);
      assert.equal(await title(page).textContent(),mode.startsWith('open')?'Durable draft':'Memory-only draft','An initialized store checkpoints failed writes; failed startup preserves the previous draft');
      assert.equal(await edit(page,'Retried durable draft'),true);
      assert.equal(await page.locator('#draftStorageWarning').isVisible(),false);
      assert.match((await durable(page))[0].state.html,/Retried durable draft/);
      // Shared save is independent of local draft persistence.
      await setFault(page,mode.startsWith('open')?'quota':mode);
      assert.equal(await edit(page,'Shared save despite local failure'),false);
      assert.equal(await page.evaluate(()=>window.__storageTest.saveAndFinish()),true);
      assert.equal(saves,1);assert.match(row.content.html,/Shared save despite local failure/);
      assert.deepEqual(await durable(page),[]);
      await diagnostics.close(context);console.log(`Storage ${mode} (${mobile?'mobile':'desktop'}): warning, memory/export, durable reload, retry and shared save passed.`);
    }
    // A failed open is retried within the same page, including storage setup/locks.
    for(const mode of ['open-error','open-throw']){
      const {context,page}=await setup(`retry open ${mode}`, mobile);
      await page.evaluate(mode=>sessionStorage.setItem('storage-test-fault',mode),mode);
      await page.reload();await ready(page);
      assert.equal(await edit(page,'Retry without reload'),false);
      assert.equal(await page.evaluate(()=>window.__storageTest.clearDraftRecord()),false,'Unavailable DB is not a successful deletion');
      await setFault(page,'');
      assert.equal(await page.evaluate(()=>window.__storageTest.flushDraftPersistence()),true);
      assert.match((await durable(page))[0].state.html,/Retry without reload/);
      // Now fail opening again on reload: a server save may succeed while local
      // cleanup cannot. The warning must distinguish these two outcomes.
      await page.reload();await ready(page);
      assert.equal(await edit(page,'Published while DB unavailable'),false);
      assert.equal(await page.evaluate(()=>window.__storageTest.saveAndFinish()),true);
      assert.equal(saves,1);assert.match(row.content.html,/Published while DB unavailable/);
      assert.match(await page.locator('#status').innerText(),/공유 저장 완료/);
      assert.match(await page.locator('#draftStorageWarning').innerText(),/초안 삭제 실패/);
      assert.match((await durable(page))[0].state.html,/Retry without reload/);
      await setFault(page,'');assert.equal(await page.evaluate(()=>window.__storageTest.clearDraftRecord()),true);
      assert.deepEqual(await durable(page),[]);
      await diagnostics.close(context);
    }
    // Full storage can also abort the atomic claim of a draft during startup.
    for(const mode of ['quota','write-abort','delete-abort']){
      const {context,page}=await setup(`claim ${mode}`, mobile);await edit(page,'Draft before failed claim');
      await page.evaluate(mode=>sessionStorage.setItem('storage-test-fault',mode),mode);
      await page.reload();await ready(page);
      assert.match(await page.locator('#draftStorageWarning').innerText(),/초안을 확인하지 못했습니다/);
      const records=await durable(page);assert.equal(records.length,1);assert.match(records[0].state.html,/Draft before failed claim/);
      await setFault(page,'');
      await page.evaluate(()=>{void window.__storageTest.recoverOnlineDraft();});await recover(page);
      assert.equal(await title(page).textContent(),'Draft before failed claim');
      assert.equal(await page.evaluate(()=>window.__storageTest.flushDraftPersistence()),true);
      assert.equal((await durable(page)).length,1,'Claim retry moves, rather than duplicates, the prior record');
      await diagnostics.close(context);
    }
    for(const action of ['discardDraft','discardAndLogout']){
      const {context,page}=await setup(`delete ${action}`, mobile);await edit(page,'Do not discard on failure');
      const previous=await durable(page);await setFault(page,'delete-abort');
      assert.equal(await page.evaluate(action=>window.__storageTest[action](),action),false);
      assert.equal(await title(page).textContent(),'Do not discard on failure');
      assert.equal(await page.evaluate(()=>window.__storageTest.isDirty()),true);
      assert.match(await page.locator('#draftStorageWarning').innerText(),/초안 삭제 실패/);
      assert.deepEqual(await durable(page),previous);
      await setFault(page,'');assert.equal(await page.evaluate(action=>window.__storageTest[action](),action),true);
      assert.deepEqual(await durable(page),[]);assert.equal(await page.locator('#draftStorageWarning').isVisible(),false);
      await diagnostics.close(context);
    }
    // Publishing can complete while deletion of the old local draft rolls back.
    {
      const {context,page}=await setup('publish with failed cleanup', mobile);await edit(page,'Saved with cleanup failure');
      const previous=await durable(page);await setFault(page,'delete-abort');
      assert.equal(await page.evaluate(()=>window.__storageTest.saveAndFinish()),true);
      assert.equal(saves,1);assert.match(row.content.html,/Saved with cleanup failure/);
      assert.match(await page.locator('#draftStorageWarning').innerText(),/초안 삭제 실패/);
      assert.deepEqual(await durable(page),previous);
      await setFault(page,'');assert.equal(await page.evaluate(()=>window.__storageTest.clearDraftRecord()),true);
      assert.deepEqual(await durable(page),[]);await page.reload();await ready(page);
      assert.equal(await page.locator('#noticeDialog').isVisible(),false);
      await diagnostics.close(context);
    }
    // Recovery deletion must preserve the durable record and offer retry.
    {
      const {context,page}=await setup('recovery deletion', mobile);await edit(page,'Recovery deletion draft');
      await page.reload();await page.getByRole('button',{name:'초안 삭제',exact:true}).waitFor();
      const previous=await durable(page);await setFault(page,'delete-abort');
      await page.getByRole('button',{name:'초안 삭제',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#noticeTitle').textContent==='초안을 삭제하지 못했습니다.');
      assert.deepEqual(await durable(page),previous);
      await page.getByRole('button',{name:'확인',exact:true}).click();await ready(page);
      await page.reload();await recover(page);assert.equal(await title(page).textContent(),'Recovery deletion draft');
      assert.equal(await page.evaluate(()=>window.__storageTest.discardDraft()),true);assert.deepEqual(await durable(page),[]);
      await diagnostics.close(context);
    }
    // Logout must retain the newest memory snapshot, without claiming durability.
    {
      const {context,page}=await setup('logout memory recovery', mobile);await edit(page,'Old durable logout draft');
      await setFault(page,'quota');await edit(page,'Newest logout draft');
      await page.evaluate(()=>window.__storageTest.handleExternalSignOut());
      assert.match(await page.locator('#status').innerText(),/보관에 실패/);
      assert.match((await page.evaluate(()=>window.__storageTest.readDraftRecord())).state.html,/Newest logout draft/);
      await page.evaluate(()=>{void window.__storageTest.recoverOnlineDraft();});await recover(page);
      assert.equal(await title(page).textContent(),'Newest logout draft');
      await setFault(page,'');assert.equal(await page.evaluate(()=>window.__storageTest.flushDraftPersistence()),true);
      await diagnostics.close(context);
    }
    {
      const {context,page}=await setup('offline save failure', mobile,true);await edit(page,'Offline durable draft');
      const previous=await durable(page);await setFault(page,'quota');await edit(page,'Offline memory draft');
      assert.equal(await page.evaluate(()=>window.__storageTest.saveAndFinish()),false);
      assert.equal(await page.evaluate(()=>window.__storageTest.isDirty()),true);
      assert.deepEqual(await durable(page),previous);assert.match((await exportedState(page)).html,/Offline memory draft/);
      await setFault(page,'');const download=page.waitForEvent('download');
      assert.equal(await page.evaluate(()=>window.__storageTest.saveAndFinish()),true);await download;
      assert.equal((await durable(page))[0].dirty,false);assert.equal(saves,0);
      await diagnostics.close(context);
    }
    console.log(`Storage recovery/deletion/logout/offline (${mobile?'mobile':'desktop'}): passed.`);
  }
  assert.deepEqual(errors,[]);console.log('IndexedDB storage browser checks passed.');
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
