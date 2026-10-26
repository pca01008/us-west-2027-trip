import { injectBrowserFixture } from './browser-fixtures.mjs';
import { selectTripTab } from './browser-fixtures.mjs';
// Regression checks against the real app with a local revision-checked API.
// All external requests are blocked; production data is never read or changed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('drafts');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const original = await readFile(new URL('index.html', root), 'utf8');
let row,saveMode,saveCalls,readFailures,versions;
let photoMode='normal',photoCalls=[],photoAborts=0;
const photoObjects=new Set();
const reset = () => { versions=[];saveMode='normal';saveCalls=0;readFailures=0;row = { content: {}, revision: 0, updated_at: new Date().toISOString() }; };
reset();
const stub = `<script>
window.__signedIn=!window.__startSignedOut;
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:window.__signedIn?{access_token:'fixture-token',user:{email:window.TRIP_CONFIG.editorEmail}}:null}}),onAuthStateChange:()=>{},signOut:async options=>{window.__signOutOptions=options;window.__signedIn=false;return {};},signInWithPassword:async()=>{window.__signedIn=true;return {};}},
  storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:location.origin+'/storage/v1/object/public/'+bucket+'/'+path}})})},
  from:()=>{let id;const q={select:()=>q,eq:(key,value)=>{if(key==='id')id=value;return q;},order:()=>q,limit:async()=>({data:await(await fetch('/mock/versions')).json()}),single:async()=>({data:(await(await fetch('/mock/versions')).json()).find(item=>item.id===id)}),abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},
  rpc:(_name,args)=>({abortSignal:async signal=>{if(window.__throwNextRpc){window.__throwNextRpc=false;throw Error('Simulated transport exception');}return (await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json();}}),
  channel:()=>({on:(_event,_filter,callback)=>{window.__emitRemote=callback;return {subscribe:()=>{}};}})
})};</script>`;
const server = createServer(async (req, res) => {
  try {
    if(req.url.startsWith('/storage/v1/object/')){
      const mode=photoMode,method=req.method,path=req.url.replace('/public/','/');
      photoCalls.push(method);res.on('close',()=>{if(!res.writableEnded)photoAborts++;});
      const hang=mode==='head'&&method==='HEAD'||mode.startsWith('upload')&&method==='POST'||mode.startsWith('download')&&method==='GET';
      if(method==='POST'){
        for await(const _part of req){};
        assert.equal(req.headers.authorization,'Bearer fixture-token');
        assert.equal(req.headers['x-upsert'],'false');
        assert.ok(['image/webp','image/jpeg'].includes(req.headers['content-type']));
        // An upload can commit even when its response is lost; retries must reuse it.
        photoObjects.add(path);
      }
      if(hang){
        if(mode.endsWith('-body')){res.writeHead(200,{'Content-Type':method==='POST'?'application/json':'image/jpeg'});res.write(method==='POST'?'{':'partial image');}
        return;
      }
      if(method==='HEAD'){res.writeHead(photoObjects.has(path)?200:400).end();return;}
      if(method==='POST'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({Key:path}));return;}
      res.setHeader('Content-Type','image/jpeg');res.end('fixture image');return;
    }
    if (req.url === '/mock/versions') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(versions));return;}
    if (req.url === '/mock/doc') { if(readFailures>0){readFailures--;res.writeHead(503).end('Unavailable');return;}res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(row)); return; }
    if (req.url === '/mock/save') {
      let body = ''; for await (const part of req) body += part;
      const args = JSON.parse(body);saveCalls++;
      const mode=saveMode;saveMode='normal';
      if(mode==='timeout-before') {setTimeout(()=>res.end('{}'),300);return;}
      const result = args.p_expected_revision !== row.revision
        ? { error: { code: '40001', message: 'Revision conflict' } }
        : (row = { content: args.p_content, revision: row.revision + 1, updated_at: new Date().toISOString() }, { data: { revision: row.revision, updated_at: row.updated_at } });
      if(mode==='delayed') {setTimeout(()=>res.end(JSON.stringify(result)),1500);return;}
      if(mode.startsWith('timeout-')) {
        if(mode==='timeout-newer')row={...row,content:{...row.content,budgetKrw:987654},revision:row.revision+1};
        if(mode==='timeout-unverified')readFailures=1;
        setTimeout(()=>res.end(JSON.stringify(result)),300);return;
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const url = new URL(req.url, 'http://localhost');
    const file = url.pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|assets\/[\w.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
    let body = await readBrowserFixture(new URL(file, root));
    if (file === 'index.html') body = injectBrowserFixture(original
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, stub)
      .replace('data-offline="false"', url.searchParams.has('offline') ? 'data-offline="true"' : 'data-offline="false"'), `Object.defineProperty(runtimeOptions,'saveMs',{get:()=>window.__shortSaveTimeout?80:12000});runtimeOptions.historyDelay=()=>window.__holdHistory?60000:400;runtimeOptions.photoTimeout=value=>window.__shortPhotoTimeout&&[10000,60000].includes(value)?150:value;window.__draftTest={captureState,normalizeState,buildDiff,isDirty,recordHistory,flushDraftPersistence,queueDraftPersistence,readDraftRecord,writeDraftRecord,clearDraftRecord,moveHistory,discardDraft,discardAndLogout,logoutPreservingDraft,scheduleSessionTimers,getEditorSession,persistState,saveAndFinish,handleExternalSignOut,closeNotice,
        refreshPublishedState,readPublicCache,closePreview,enterHistoricalPreview,sessionSnapshot:()=>documentSession.snapshot(),exportOfflineHtml,exportStaticHtml,busy:()=>isSaveInFlight()||isOperationBusy(),
        stagePhoto:async()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const full=canvas.toDataURL('image/jpeg'),thumb=canvas.toDataURL('image/webp');let row=$('.day1 .timeline-row');selectActiveScheduleRow(row);const card=row.querySelector('.card');let gallery=card.querySelector('.schedule-photos');if(!gallery){gallery=document.createElement('div');gallery.className='schedule-photos';card.appendChild(gallery);}gallery.appendChild(createPhotoFigure({fullUrl:full,thumbUrl:thumb,staged:true},'Network draft'));recordHistory();await flushDraftPersistence();},
        remotePhotoState:()=>{const state=captureState(),template=document.createElement('template');template.innerHTML=state.html;const img=template.content.querySelector('.schedule-photo img');img.src=location.origin+'/storage/v1/object/public/trip-media/download.jpg';img.dataset.fullUrl=img.src;state.html=template.innerHTML;return state;},
        base:()=>documentSession.snapshot().lastSavedState,revision:()=>documentSession.snapshot().publishedRevision,pending:()=>pendingCheckCount(),dirty:()=>documentSession.snapshot().pendingDraft,historyIndex:()=>documentSession.snapshot().historyIndex,
        legacyDraft:async()=>{const record=await readDraftRecord();delete record.baseState;await writeDraftRecord(record);draftWorkflow.deferRecovery();documentSession.markClean();draftWorkflow.cancelPendingWrites();},
        activityKey:SESSION_ACTIVITY_KEY,key:DRAFT_RECORD_KEY,legacyKey:LEGACY_DRAFT_RECORD_KEY,db:DRAFT_DB_NAME,sessionKey:DRAFT_SESSION_KEY};`);
    if(file==='trip-config.js')body=body+`\nwindow.TRIP_CONFIG.supabase={url:'http://127.0.0.1:${server.address().port}',publishableKey:'fixture-key'};`;
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'image/webp');
    res.end(body);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const ready = page => page.waitForFunction(() => Boolean(window.__draftTest)&&Boolean(document.body)&&!document.body.classList.contains('hydrating'));
const stored = page => page.evaluate(() => window.__draftTest.readDraftRecord());
const title = page => page.locator('.day1 .timeline-row h3').first();
async function edit(page, text) {
  await selectTripTab(page, 'd1');
  if (!await page.locator('body').evaluate(el => el.classList.contains('editing'))) await page.locator('#editBtn').click();
  await page.waitForFunction(() => document.querySelector('.day1 .timeline-row h3').isContentEditable);
  await title(page).fill(text);
  await page.evaluate(async () => { window.__draftTest.recordHistory(); await window.__draftTest.flushDraftPersistence(); });
}
async function recover(page) {
  await page.locator('#noticeDialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#noticeTitle').textContent(), '저장하지 않은 초안을 찾았습니다.');
  await page.getByRole('button', { name: '초안 복구', exact: true }).click();
  await ready(page);
}
async function context(scenario, options = {}) {
  diagnostics.scenario(scenario);
  const ctx = await diagnostics.context(browser, { viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  await ctx.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  ctx.on('page', page => { page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message)); });
  return ctx;
}
async function seed(page) {
  row.content=await page.evaluate(()=>window.__draftTest.captureState());
  versions=[{id:1,created_at:new Date().toISOString(),note:'Historical version',content:{...structuredClone(row.content),budgetKrw:0}}];
  row={...row,content:{...row.content,budgetKrw:987654},revision:2};
  await page.reload();await ready(page);
}
async function preview(page) {
  await page.locator('#versionsBtn').click();
  await page.locator('.version-item').getByRole('button',{name:'미리보기',exact:true}).click();
  await page.waitForFunction(()=>document.body.classList.contains('previewing'));
}
async function enterExpense(page,name='New expense') {
  await selectTripTab(page, 'money');
  await page.locator('#expenseName').fill(name);await page.locator('#expenseUsd').fill('25');
  await page.locator('#addExpense').click();
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  for(const mobile of [false,true]){
    reset();const ctx=await context(`pending input Undo/Redo and reload / ${mobile?'mobile':'desktop'}`,mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{}),page=await ctx.newPage();
    await page.goto(origin);await ready(page);
    const baseline=await title(page).textContent();
    await selectTripTab(page,'d1');await page.locator('#editBtn').click();
    await page.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
    await title(page).fill('RECORDED EDIT');
    await page.waitForFunction(()=>!document.querySelector('#undoBtn').disabled);
    // Hold only the history timer so real typing/clicks reliably occur before it.
    // Exact 0..399ms and post-Undo timer behavior are covered by the unit clock.
    await page.evaluate(()=>{window.__holdHistory=true;});
    for(const text of ['FAST','FAST SECOND','FAST SECOND EDIT'])await title(page).fill(text);
    assert.equal(await page.evaluate(()=>window.__draftTest.historyIndex()),1);
    await page.locator('#undoBtn').click();
    assert.equal(await title(page).textContent(),'RECORDED EDIT');
    assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),true);
    await page.locator('#redoBtn').click();
    assert.equal(await title(page).textContent(),'FAST SECOND EDIT');
    await page.reload();await recover(page);
    assert.equal(await title(page).textContent(),'FAST SECOND EDIT','Redo persists the newest text for recovery');
    await diagnostics.close(ctx);
    // A clean Undo clears recovery storage; Redo remains available until reload.
    reset();const cleanCtx=await context(`Undo to clean baseline and reload / ${mobile?'mobile':'desktop'}`,mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{}),cleanPage=await cleanCtx.newPage();
    await cleanPage.goto(origin);await ready(cleanPage);
    await selectTripTab(cleanPage,'d1');await cleanPage.locator('#editBtn').click();
    await cleanPage.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
    await title(cleanPage).fill('RECORDED EDIT');
    await cleanPage.waitForFunction(()=>!document.querySelector('#undoBtn').disabled);
    await cleanPage.evaluate(()=>{window.__holdHistory=true;});
    await title(cleanPage).fill('TEMPORARY EDIT');
    await cleanPage.locator('#undoBtn').click();
    assert.equal(await title(cleanPage).textContent(),'RECORDED EDIT');
    await cleanPage.locator('#undoBtn').click();
    assert.equal(await title(cleanPage).textContent(),baseline);
    await cleanPage.waitForFunction(async()=>!(await window.__draftTest.readDraftRecord()));
    assert.equal(await cleanPage.locator('#redoBtn').isEnabled(),true);
    await cleanPage.reload();await ready(cleanPage);
    assert.equal(await title(cleanPage).textContent(),baseline);
    assert.equal(await cleanPage.locator('#noticeDialog').isHidden(),true,'Clean Undo must not offer a stale draft');
    await diagnostics.close(cleanCtx);
  }
  console.log('Pending input Undo/Redo: exact text, continuous edits, redo recovery and clean Undo reload passed on desktop/mobile.');
  // Hold only the history debounce: input, storage, lifecycle and recovery run
  // normally. No helper records history or flushes the draft for these edits.
  for(const selector of ['.day1 h3','.day1 .remark','.schedule-warning-text'])for(const boundary of ['reload','pagehide','hidden','signout']){
    reset();const ctx=await context(`first input ${selector} / ${boundary}`),page=await ctx.newPage();
    await page.goto(origin);await ready(page);
    if(selector==='.schedule-warning-text'){
      row.content=await page.evaluate(()=>{const state=window.__draftTest.captureState(),template=document.createElement('template');template.innerHTML=state.html;template.content.querySelector('.day1 .card').insertAdjacentHTML('beforeend','<div class="schedule-warning"><span class="schedule-warning-text">Fixture caution</span></div>');state.html=template.innerHTML;return state;});
      await page.reload();await ready(page);
    }
    await selectTripTab(page,'d1');await page.locator('#editBtn').click();
    await page.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
    await page.evaluate(()=>{window.__holdHistory=true;});
    const field=page.locator(selector).first(),text=`First input ${selector} ${boundary}`;
    // Force reload to depend on the synchronous checkpoint, not a lucky IDB commit.
    if(boundary==='reload')await page.evaluate(()=>{
      const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){if(String(key).startsWith('online:'))throw new DOMException('Interrupted draft write','QuotaExceededError');return put.call(this,value,key);};
    });
    await field.fill(text);
    assert.equal(await page.evaluate(()=>window.__draftTest.historyIndex()),0,'History must still be pending');
    assert.equal(await page.evaluate(()=>window.__draftTest.dirty()),true,'First input is dirty immediately');
    assert.equal(await page.locator('#saveBtn').isEnabled(),true);
    if(boundary==='reload')assert.ok(await page.evaluate(text=>{const api=window.__draftTest;return JSON.parse(localStorage.getItem(api.db+':checkpoint:'+api.key))?.state.html.includes(text);},text),'Input checkpoints before any lifecycle event');
    assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true,'Navigation must be protected before history');
    if(boundary==='signout'){
      await page.evaluate(()=>window.__draftTest.handleExternalSignOut());
      assert.notEqual(await page.locator(selector).first().textContent(),text,'Sign-out returns to the saved view');
      assert.ok((await stored(page)).state.html.includes(text),'Sign-out retains the first input');
    }else if(boundary==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    else if(boundary==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    await page.reload();await recover(page);
    assert.equal(await page.locator(selector).first().textContent(),text,'Recovery must contain the first input');
    await diagnostics.close(ctx);
  }
  {
    reset();const ctx=await context('continuous input and first input after save'),page=await ctx.newPage();await page.goto(origin);await ready(page);
    await edit(page,'Saved baseline');assert.equal(await page.evaluate(()=>window.__draftTest.saveAndFinish()),true);
    await selectTripTab(page,'d1');await page.locator('#editBtn').click();
    await page.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
    await page.evaluate(()=>{window.__holdHistory=true;});
    for(const text of ['A','AB','ABC','Continuous first edit after save'])await title(page).fill(text);
    assert.equal(await page.evaluate(()=>window.__draftTest.historyIndex()),0);
    await page.reload();await recover(page);assert.equal(await title(page).textContent(),'Continuous first edit after save');
    await diagnostics.close(ctx);
  }
  console.log('First-input protection: title/detail/caution, reload/checkpoint, pagehide, hidden, sign-out, continuous input and saved baseline passed.');
  // Exercise actual fetch aborts, response-body stalls, draft retention and retry.
  for(const mobile of [false,true])for(const mode of ['head','upload','upload-body','download','download-body'])for(const cancel of [false,true]){
    reset();photoMode='normal';photoCalls=[];photoAborts=0;photoObjects.clear();
    const ctx=await context(`photo ${mode} / ${cancel ? "cancel" : "timeout"} / ${mobile ? "mobile" : "desktop"}`, mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{}),page=await ctx.newPage();
    await page.goto(origin);await ready(page);await edit(page,'Photo network draft');
    await page.evaluate(()=>window.__draftTest.stagePhoto());
    const draft=await stored(page),downloads=[];page.on('download',download=>downloads.push(download));
    photoMode=mode;
    await page.evaluate(({mode,cancel})=>{
      window.__shortPhotoTimeout=!cancel;window.__photoResult=undefined;
      const api=window.__draftTest;
      const task=mode.startsWith('download')?api.exportOfflineHtml(api.remotePhotoState()):api.saveAndFinish();
      task.then(result=>window.__photoResult=Boolean(result));
    },{mode,cancel});
    const method=mode==='head'?'HEAD':mode.startsWith('upload')?'POST':'GET';
    for(let i=0;i<100&&!photoCalls.includes(method);i++)await new Promise(resolve=>setTimeout(resolve,20));
    assert.ok(photoCalls.includes(method),'Expected a photo request');
    if(cancel)await page.locator('#cancelOperationBtn').click();
    if(mode.startsWith('download')&&!cancel){
      await page.locator('#noticeDialog').waitFor({state:'visible'});
      await page.getByRole('button',{name:'확인',exact:true}).click();
    }
    await page.waitForFunction(()=>window.__photoResult!==undefined&&!window.__draftTest.busy());
    for(let i=0;i<100&&photoAborts===0;i++)await new Promise(resolve=>setTimeout(resolve,20));
    assert.ok(photoAborts>0,'Request must be aborted at the local server');
    assert.equal(saveCalls,0,'Failed photo preparation must not publish');
    assert.equal(downloads.length,0,'Failed offline export must not download an incomplete file');
    assert.equal((await stored(page)).state.html,draft.state.html,'Staged photo and text must survive');
    assert.equal(await page.locator('#cancelOperationBtn').isVisible(),false);
    if(!mode.startsWith('download'))assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('editing')),true);
    photoMode='normal';await page.evaluate(()=>window.__shortPhotoTimeout=false);
    if(mode.startsWith('download')){
      const download=page.waitForEvent('download');
      await page.evaluate(()=>window.__draftTest.exportOfflineHtml(window.__draftTest.remotePhotoState()));
      await download;
      assert.equal((await stored(page)).state.html,draft.state.html);
    }else{
      assert.equal(await page.evaluate(()=>window.__draftTest.saveAndFinish()),true);
      assert.equal(saveCalls,1);assert.equal(await stored(page),null);
      assert.ok(!row.content.html.includes('data-staged="true"'));
    }
    await diagnostics.close(ctx);console.log('Photo '+mode+' '+(cancel?'cancel':'timeout')+' ('+(mobile?'mobile':'desktop')+'): request aborted, draft retained, retry passed.');
  }
  for(const cancel of [false,true]){
    reset();photoMode='normal';photoCalls=[];photoAborts=0;
    const ctx=await context(`readonly export / ${cancel ? "cancel" : "timeout"}`),page=await ctx.newPage();await page.goto(origin);await ready(page);await edit(page,'Readonly export draft');
    await page.evaluate(async()=>{
      const api=window.__draftTest;await api.stagePhoto();
      const img=document.querySelector('.schedule-photo img');img.src=location.origin+'/storage/v1/object/public/trip-media/download.jpg';img.dataset.fullUrl=img.src;
      api.recordHistory();await api.flushDraftPersistence();
    });
    const draft=await stored(page),downloads=[];page.on('download',download=>downloads.push(download));photoMode='download-body';
    await page.evaluate(cancel=>{window.__shortPhotoTimeout=!cancel;window.__photoResult=undefined;window.__draftTest.exportStaticHtml().then(()=>window.__photoResult=true);},cancel);
    for(let i=0;i<100&&!photoCalls.includes('GET');i++)await new Promise(resolve=>setTimeout(resolve,20));
    if(cancel)await page.locator('#cancelOperationBtn').click();
    await page.waitForFunction(()=>window.__photoResult&&!window.__draftTest.busy());
    assert.equal(downloads.length,cancel?0:1,'Readonly export falls back on timeout but never on cancellation');
    if(!cancel)assert.match(await page.locator('#status').textContent(),/온라인 주소 사용/);
    assert.equal((await stored(page)).state.html,draft.state.html);
    await diagnostics.close(ctx);console.log('Readonly export '+(cancel?'cancel':'timeout')+': draft retained; '+(cancel?'no download':'online photo fallback')+'.');
  }
  photoMode='normal';
  for(const mobile of [false,true]) {
    const options=mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{};
    // Saving the PREP list must leave an unapplied, deferred schedule draft intact.
    {
      reset();const ctx=await context(`deferred draft PREP save / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      const sharedTitle=await title(page).textContent();await edit(page,'Deferred schedule before PREP save');
      const sharedRevision=row.revision;
      await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await ready(page);
      const originalDraft=await stored(page);
      assert.ok(originalDraft?.state.html.includes('Deferred schedule before PREP save'));
      assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false,'Deferred draft is not applied to the shared view');
      await selectTripTab(page, 'prep');await page.locator('#editBtn').click();
      await page.locator('#checklistDialog').waitFor({state:'visible'});
      await page.locator('.checklist-text').first().fill('PREP saved while recovery deferred');
      await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
      await page.waitForFunction(()=>document.querySelector('#status').textContent==='목록 저장됨');
      assert.equal(saveCalls,1);assert.equal(row.revision,sharedRevision+1);
      assert.ok(row.content.html.includes('PREP saved while recovery deferred'));
      assert.ok(!row.content.html.includes('Deferred schedule before PREP save'),'PREP save does not publish the schedule draft');
      assert.equal(await title(page).textContent(),sharedTitle);
      assert.deepEqual(await stored(page),originalDraft,'PREP list save must not delete or replace the deferred draft');
      await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});
      assert.match(await page.locator('.prepday .checklist').textContent(),/PREP saved while recovery deferred/);
      await recover(page);
      assert.equal(await title(page).textContent(),'Deferred schedule before PREP save');
      assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),true);
      assert.equal(saveCalls,1,'Recovery does not automatically publish the draft');
      await diagnostics.close(ctx);console.log(`Deferred draft (${mobile?'mobile':'desktop'}): PREP list saves independently; original draft survives and restores after reload.`);
    }
    // The actual version buttons must preserve a draft through timers, pagehide,
    // nested previews, and reload, while every ordinary save remains blocked.
    {
      reset();const ctx=await context(`preview draft protection / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      await enterExpense(page,'Original unsaved expense');
      await page.evaluate(()=>window.__draftTest.flushDraftPersistence());
      const originalDraft=await stored(page);
      await preview(page);await preview(page);
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),0);
      assert.equal(await page.locator('#saveBtn').isDisabled(),true);
      await enterExpense(page,'Blocked preview expense');
      assert.deepEqual(await page.evaluate(()=>window.__draftTest.captureState().expenses),[]);
      assert.equal(await page.evaluate(()=>window.__draftTest.persistState(window.__draftTest.captureState()).then(Boolean)),false);
      assert.equal(await page.evaluate(()=>window.__draftTest.saveAndFinish().then(Boolean)),false);
      await page.evaluate(()=>{window.__draftTest.queueDraftPersistence();window.dispatchEvent(new Event('pagehide'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForTimeout(850);
      assert.deepEqual((await stored(page)).state,originalDraft.state);
      assert.equal(saveCalls,0);assert.equal(row.content.budgetKrw,987654);
      await page.reload();await recover(page);
      assert.deepEqual(await page.evaluate(()=>window.__draftTest.captureState().expenses),originalDraft.state.expenses);
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),987654);
      await preview(page);await page.locator('#closePreviewBtn').click();
      await enterExpense(page,'After preview');
      assert.equal(await page.evaluate(()=>window.__draftTest.saveAndFinish().then(Boolean)),true);
      assert.equal(row.content.budgetKrw,987654);assert.equal(row.content.expenses.length,2);
      await diagnostics.close(ctx);console.log(`Preview (${mobile?'mobile':'desktop'}): draft survives timers/pagehide/reload; edits and saves blocked; normal save after close passed.`);
    }
    // A clean preview creates no dirty draft; only explicit version restore may
    // publish the historical document, after its dedicated confirmation.
    {
      reset();const ctx=await context(`preview explicit restore / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      await preview(page);
      assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false);
      await page.evaluate(()=>window.__draftTest.flushDraftPersistence());assert.equal(await stored(page),null);
      await page.locator('#versionsBtn').click();
      await page.locator('.version-item').getByRole('button',{name:'복원',exact:true}).click();
      await page.locator('#versionCompareRestore').click();
      await page.getByRole('button',{name:'취소',exact:true}).click();
      assert.equal(row.content.budgetKrw,987654);assert.equal(saveCalls,0);
      await page.locator('#versionCompareRestore').click();
      await page.locator('#noticeDialog').getByRole('button',{name:'복원',exact:true}).click();
      await page.waitForFunction(()=>!document.body.classList.contains('previewing')&&!window.__draftTest.busy());
      assert.equal(row.content.budgetKrw,0);assert.equal(row.revision,3);assert.equal(saveCalls,1);
      assert.equal(await stored(page),null);
      await diagnostics.close(ctx);console.log(`Preview (${mobile?'mobile':'desktop'}): clean view and explicit restore confirmation passed.`);
    }
    for(const exit of ['save','discard','external','timeout','reset']) {
      reset();const ctx=await context(`preview exit ${exit} / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      await enterExpense(page,'Original before preview exit');await preview(page);
      if(exit==='external')await page.evaluate(()=>window.__draftTest.handleExternalSignOut());
      else if(exit==='timeout')await page.evaluate(()=>window.__draftTest.logoutPreservingDraft('자동 로그아웃되었습니다.'));
      else if(exit==='reset')await page.evaluate(()=>window.__draftTest.discardDraft());
      else{
        await page.locator('#logoutBtn').click();
        await page.getByRole('button',{name:exit==='save'?'저장 후 로그아웃':'폐기 후 로그아웃',exact:true}).click();
        await page.waitForFunction(()=>!window.__signedIn);
      }
      assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('previewing')),false);
      assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false);
      assert.equal(row.content.budgetKrw,987654);
      assert.equal(row.content.expenses.length,exit==='save'?1:0);
      if(exit==='external'||exit==='timeout')assert.equal((await stored(page)).state.expenses[0].name,'Original before preview exit');
      else await page.waitForFunction(async()=>await window.__draftTest.readDraftRecord()===null);
      await diagnostics.close(ctx);
    }
    console.log(`Preview (${mobile?'mobile':'desktop'}): logout save/discard, external sign-out, timeout and reset all leave preview safely.`);
    for(const source of ['reload','external','timeout']) for(const choice of ['초안 복구','초안 삭제']) {
      reset();const ctx=await context(`deferred recovery ${source} / ${choice} / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      const sharedTitle=await title(page).textContent();await edit(page,'Original unrecovered title');
      if(source==='reload'){
        await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await ready(page);
      }else{
        if(source==='timeout')await page.evaluate(()=>window.__draftTest.logoutPreservingDraft('자동 로그아웃되었습니다.'));
        else await page.evaluate(async()=>{window.__signedIn=false;await window.__draftTest.handleExternalSignOut();});
        assert.equal(await title(page).textContent(),sharedTitle);
        assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false);
        // Duplicate external notifications must not release the recovery guard.
        await page.evaluate(()=>window.__draftTest.handleExternalSignOut());
      }
      const originalDraft=await stored(page);
      // Schedule editing, ledger settings, and import must resolve the same
      // deferred draft before opening an editor or the system file picker.
      for(const panel of ['d1','money','import']){
        if(panel!=='import')await selectTripTab(page, panel);
        await page.locator(panel==='import'?'#importBtn':'#editBtn').click();
        if(source!=='reload'&&panel==='d1'){
          await page.locator('#authDialog').waitFor({state:'visible'});
          await page.locator('#editorPassword').fill('local-test-password');await page.locator('#authSubmit').click();
        }
        await page.locator('#noticeDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
        assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('editing')),false);
        assert.equal(await page.locator('#ledgerSettingsDialog').isVisible(),false);
        assert.deepEqual(await stored(page),originalDraft);
      }
      await enterExpense(page,'After deferred recovery');
      await page.locator('#noticeDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
      await page.waitForTimeout(850);
      assert.deepEqual(await stored(page),originalDraft);
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().expenses.length),0);
      // A background writer must also refuse to replace the deferred record.
      assert.equal(await page.evaluate(()=>window.__draftTest.writeDraftRecord({state:window.__draftTest.captureState(),dirty:true})),false);
      await page.locator('#addExpense').click();await page.locator('#noticeDialog').waitFor({state:'visible'});
      await page.getByRole('button',{name:choice,exact:true}).click();
      await page.waitForFunction(()=>window.__draftTest.captureState().expenses.some(item=>item.name==='After deferred recovery'));
      assert.equal(await title(page).textContent(),choice==='초안 복구'?'Original unrecovered title':sharedTitle);
      await page.evaluate(()=>window.__draftTest.flushDraftPersistence());
      await page.reload();await recover(page);
      assert.equal(await title(page).textContent(),choice==='초안 복구'?'Original unrecovered title':sharedTitle);
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().expenses[0].name),'After deferred recovery');
      assert.equal(saveCalls,0);
      await diagnostics.close(ctx);console.log(`Deferred draft (${mobile?'mobile':'desktop'}, ${source}, ${choice}): cancel preserves original; explicit choice protects new work across reload.`);
    }
    // F3: delayed network responses must not roll display, baseline or cache back.
    {
      reset();const ctx=await context(`remote ordering / ${mobile?'mobile':'desktop'}`,options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      const initialContent=structuredClone(row.content);
      const makeRow=revision=>({revision,updated_at:new Date().toISOString(),content:{...structuredClone(initialContent),
        html:initialContent.html.replace('일정 1-1','Remote '+revision),budgetKrw:revision*1000,
        expenses:[{id:'ordering-expense',name:'Expense '+revision,amountKrw:1450,amountUsd:1,amountSource:'usd',appliedExchangeRate:1450,date:'2027-01-21',categoryId:'misc'}]}});
      let onRead;await page.route(origin+'/mock/doc',route=>onRead(route));
      let taskId=0;
      async function startRead(){
        const intercepted=new Promise(resolve=>{onRead=resolve;});const id=taskId++;
        await page.evaluate(id=>{window.__orderedReads??=[];window.__orderedReads[id]=window.__draftTest.refreshPublishedState('reconnect');},id);
        return {id,route:await intercepted};
      }
      async function complete(read,value){await read.route.fulfill({json:value});await page.evaluate(id=>window.__orderedReads[id],read.id);}
      async function assertRevision(revision){
        const actual=await page.evaluate(async()=>({current:window.__draftTest.captureState(),session:window.__draftTest.sessionSnapshot(),cache:await window.__draftTest.readPublicCache()}));
        for(const state of [actual.current,actual.session.lastSavedState,actual.cache.state]){
          assert.ok(state.html.includes('Remote '+revision));assert.equal(state.budgetKrw,revision*1000);assert.equal(state.expenses[0].name,'Expense '+revision);
        }
        assert.equal(actual.session.publishedRevision,revision);assert.equal(actual.cache.revision,revision);
      }
      const older=await startRead(),newer=await startRead();await complete(newer,makeRow(12));await complete(older,makeRow(11));await assertRevision(12);
      const late=await startRead();await page.evaluate(row=>window.__emitRemote({new:row}),makeRow(14));await complete(late,makeRow(13));await assertRevision(14);
      const before=await page.evaluate(async()=>({session:window.__draftTest.sessionSnapshot(),cache:await window.__draftTest.readPublicCache(),status:document.querySelector('#status').textContent}));
      await page.evaluate(rows=>rows.forEach(row=>window.__emitRemote({new:row})),[makeRow(14),makeRow(13)]);
      assert.deepEqual(await page.evaluate(async()=>({session:window.__draftTest.sessionSnapshot(),cache:await window.__draftTest.readPublicCache(),status:document.querySelector('#status').textContent})),before);
      const oldRevision=await startRead();await complete(oldRevision,makeRow(11));await assertRevision(14);
      await page.evaluate(()=>window.__draftTest.enterHistoricalPreview({...window.__draftTest.base(),budgetKrw:3}));
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),3);
      await page.evaluate(rows=>rows.forEach(row=>window.__emitRemote({new:row})),[makeRow(16),makeRow(15)]);
      assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),3);assert.equal(await page.evaluate(()=>window.__draftTest.sessionSnapshot().pendingRemoteState.row.revision),16);
      await page.evaluate(()=>window.__draftTest.closePreview());await assertRevision(14);
      const afterPreview=await startRead();await complete(afterPreview,makeRow(16));await assertRevision(16);
      await page.unroute(origin+'/mock/doc');row=makeRow(16);await edit(page,'Local ordering draft');const originalDraft=await stored(page);
      row=makeRow(17);await page.evaluate(()=>window.__draftTest.refreshPublishedState('reconnect'));
      assert.equal(await page.evaluate(()=>window.__draftTest.sessionSnapshot().pendingRemoteState.row.revision),17);
      await page.evaluate(rows=>rows.forEach(row=>window.__emitRemote({new:row})),[makeRow(18),makeRow(17),makeRow(18)]);
      assert.equal(await title(page).textContent(),'Local ordering draft');assert.equal(await page.evaluate(()=>window.__draftTest.revision()),16);
      assert.equal(await page.evaluate(()=>window.__draftTest.sessionSnapshot().pendingRemoteState.row.revision),18);
      assert.ok(await page.evaluate(()=>window.__draftTest.sessionSnapshot().pendingRemoteState.state.html.includes('Remote 18')));
      assert.deepEqual(await stored(page),originalDraft);assert.equal((await page.evaluate(()=>window.__draftTest.readPublicCache())).revision,16);assert.equal(saveCalls,0);
      await diagnostics.close(ctx);console.log(`Remote ordering (${mobile?'mobile':'desktop'}): reversed refresh, Realtime, duplicates, preview and dirty reconnect preserve display/baseline/cache/draft.`);
    }
    // Incoming shared updates must preserve an entry that has not been added.
    for(const delivery of ['visible','reconnect','realtime']) {
      reset();const ctx=await context(`shared inputs ${delivery} / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      await selectTripTab(page, 'money');
      const category=row.content.categories.findLast(item=>!item.system).id;
      const values={expenseName:'택시비 Airport',expenseUsd:'37',expenseDate:'2027-03-15',expenseCategory:category};
      for(const [id,value] of Object.entries(values)) {
        const field=page.locator('#'+id);
        if(id==='expenseCategory')await field.selectOption(value);else await field.fill(value);
      }
      const remoteExpense={id:'remote-expense',name:'Shared meal',amountKrw:17400,amountUsd:12,amountSource:'usd',appliedExchangeRate:1450,date:'2027-03-14',categoryId:'misc'};
      for(const removed of [false,true]) {
        await page.locator('#expenseName').focus();await page.locator('#expenseName').evaluate(el=>el.setSelectionRange(1,3));
        row={...row,content:{...row.content,expenses:[remoteExpense],budgetKrw:removed?234567:123456,
          categories:row.content.categories.filter(item=>!removed||item.id!==category)},revision:row.revision+1};
        if(delivery==='realtime')await page.evaluate(row=>window.__emitRemote({new:row}),row);
        else assert.equal(await page.evaluate(reason=>window.__draftTest.refreshPublishedState(reason),delivery),true);
        for(const [id,value] of Object.entries(values)) {
          if(removed&&id==='expenseCategory')continue;
          assert.equal(await page.locator('#'+id).inputValue(),value,`${delivery} preserves ${id}`);
        }
        assert.deepEqual(await page.evaluate(()=>[document.activeElement.id,document.activeElement.selectionStart,document.activeElement.selectionEnd]),['expenseName',1,3]);
        assert.deepEqual(await page.evaluate(()=>window.__draftTest.captureState().expenses),[remoteExpense]);
        assert.equal(await page.evaluate(()=>window.__draftTest.revision()),row.revision);
        assert.equal(await page.evaluate(()=>window.__draftTest.base().budgetKrw),row.content.budgetKrw);
        assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false);
        assert.equal(await stored(page),null,'Unsubmitted input is not a persisted draft');
        if(removed)assert.equal(await page.locator('#expenseCategory').evaluate(el=>Boolean(el.value)&&el.value!=='deleted'&&el.selectedOptions.length===1&&!el.selectedOptions[0].disabled),true,'Deleted category falls back to a valid choice');
      }
      const fallback=await page.locator('#expenseCategory').inputValue();assert.notEqual(fallback,category);
      await page.locator('#addExpense').click();await page.evaluate(()=>window.__draftTest.flushDraftPersistence());
      const added=(await stored(page)).state.expenses;
      assert.equal(added.length,2);assert.deepEqual(added[1],{id:added[1].id,name:values.expenseName,amountKrw:53650,amountUsd:37,amountSource:'usd',appliedExchangeRate:1450,date:values.expenseDate,categoryId:fallback});
      assert.equal(saveCalls,0);assert.deepEqual(row.content.expenses,[remoteExpense]);
      await diagnostics.close(ctx);console.log(`Shared inputs (${mobile?'mobile':'desktop'}, ${delivery}): fields, focus/caret, category removal and subsequent add passed.`);
    }
    // Hold the real save response while typing the next entry. Verify every
    // field, focus/caret and that the entry is not silently submitted.
    {
      reset();const ctx=await context(`inputs during save / ${mobile ? "mobile" : "desktop"}`, options),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
      await enterExpense(page,'First saved expense');saveMode='delayed';
      await page.evaluate(()=>{window.__saveResult=undefined;window.__draftTest.saveAndFinish().then(result=>window.__saveResult=Boolean(result));});
      await page.waitForFunction(()=>window.__draftTest.busy());
      await page.locator('#expenseName').fill('During save');await page.locator('#expenseUsd').fill('25');
      await page.locator('#expenseDate').fill('2027-03-15');
      await page.locator('#expenseCategory').selectOption('misc');
      await page.locator('#expenseName').focus();await page.locator('#expenseName').evaluate(el=>el.setSelectionRange(3,6));
      await page.waitForFunction(()=>window.__saveResult===true);
      for(const [id,value] of Object.entries({expenseName:'During save',expenseUsd:'25',expenseDate:'2027-03-15',expenseCategory:'misc'}))assert.equal(await page.locator('#'+id).inputValue(),value);
      assert.deepEqual(await page.evaluate(()=>[document.activeElement.id,document.activeElement.selectionStart,document.activeElement.selectionEnd]),['expenseName',3,6]);
      assert.equal(row.content.expenses.length,1);assert.equal(await stored(page),null);
      await page.locator('#addExpense').click();await page.evaluate(()=>window.__draftTest.flushDraftPersistence());
      assert.equal((await stored(page)).state.expenses.length,2);
      assert.equal(row.content.expenses.length,1);
      await diagnostics.close(ctx);console.log(`Save inputs (${mobile?'mobile':'desktop'}): all next-entry fields and focus survive delayed save, then submit normally.`);
    }
  }
  // Exercise the actual inactivity timers and warning actions with a virtual clock.
  for(const choice of ['timeout','continue','save','discard','clean','deferred']) {
    reset();const ctx=await context(`inactivity ${choice}`),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
    const sharedTitle=await title(page).textContent();
    if(choice!=='clean')await edit(page,'Inactivity draft');
    if(choice==='deferred'){
      await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await ready(page);
    }
    await page.clock.install();
    await page.evaluate(()=>window.__draftTest.scheduleSessionTimers(Date.now()));
    await page.clock.fastForward(29*60*1000);
    await page.locator('#noticeDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#noticeTitle').textContent(),'자동 로그아웃 예정');
    assert.match(await page.locator('#sessionCountdown').textContent(),/자동 로그아웃/);
    assert.equal(await page.evaluate(()=>window.__signedIn),true);
    if(['timeout','clean','deferred'].includes(choice))await page.clock.fastForward(60*1000);
    else await page.getByRole('button',{name:{continue:'계속 사용',save:'저장 후 로그아웃',discard:'폐기 후 로그아웃'}[choice],exact:true}).click();
    if(choice==='continue'){
      await page.clock.fastForward(60*1000);
      assert.equal(await page.evaluate(()=>window.__signedIn),true);
      assert.equal(await title(page).textContent(),'Inactivity draft');
      assert.ok((await stored(page)).state.html.includes('Inactivity draft'));
    }else{
      await page.waitForFunction(()=>!window.__signedIn);
      assert.deepEqual(await page.evaluate(()=>window.__signOutOptions),{scope:'local'});
      assert.equal(await page.locator('#noticeDialog').isVisible(),false);
      assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('editing')||el.classList.contains('authenticated')),false);
      if(choice==='timeout'||choice==='deferred'){
        assert.equal(await title(page).textContent(),sharedTitle);
        const draft=await stored(page);assert.ok(draft.state.html.includes('Inactivity draft'));
        await page.clock.resume();
        // Reload while signed out cannot apply or delete the retained draft.
        await page.addInitScript(()=>window.__startSignedOut=true);
        await page.reload();await ready(page);
        assert.equal(await page.locator('#noticeDialog').isVisible(),false);
        assert.equal(await title(page).textContent(),sharedTitle);assert.deepEqual(await stored(page),draft);
        await selectTripTab(page, 'd1');await page.locator('#editBtn').click();
        await page.locator('#authDialog').waitFor({state:'visible'});
        assert.equal(await page.locator('#noticeDialog').isVisible(),false);
        await page.locator('#editorPassword').fill('local-test-password');await page.locator('#authSubmit').click();
        await recover(page);assert.equal(await title(page).textContent(),'Inactivity draft');
      }else assert.equal(await stored(page),null);
    }
    assert.equal(saveCalls,choice==='save'?1:0);
    await diagnostics.close(ctx);console.log('Inactivity '+choice+': warning, session and draft policy passed.');
  }
  // Expiry discovered by an auth check and during startup must also retain drafts.
  for(const reload of [false,true]){
    reset();const ctx=await context(`expired session / ${reload ? "startup" : "auth check"}`),page=await ctx.newPage();await page.goto(origin);await ready(page);await seed(page);
    const sharedTitle=await title(page).textContent();await edit(page,'Expired session draft');const draft=await stored(page);
    await page.evaluate(()=>localStorage.setItem(window.__draftTest.activityKey,String(Date.now()-31*60*1000)));
    if(reload){await page.reload();await ready(page);}
    else assert.equal(await page.evaluate(()=>window.__draftTest.getEditorSession()),null);
    await page.waitForFunction(()=>!window.__signedIn);
    const retained=await stored(page);assert.ok(retained.savedAt>=draft.savedAt);
    assert.deepEqual({...retained,savedAt:draft.savedAt},draft);assert.equal(await title(page).textContent(),sharedTitle);
    assert.equal(await page.locator('#noticeDialog').isVisible(),false);
    assert.equal(saveCalls,0);await diagnostics.close(ctx);console.log('Expired session '+(reload?'startup':'auth check')+': retained draft and signed out.');
  }
  // Escape, replacement by another dialog, and explicit discard are distinct.
  {
    const ctx = await context('logout draft choices'), page = await ctx.newPage(); await page.goto(origin); await ready(page);
    await edit(page, 'Keep after Escape');
    await page.locator('#logoutBtn').click(); await page.locator('#noticeDialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__signedIn), true);
    assert.equal(await title(page).textContent(), 'Keep after Escape');
    assert.ok((await stored(page)).state.html.includes('Keep after Escape'));
    await page.locator('#logoutBtn').click(); await page.locator('#noticeDialog').waitFor({ state: 'visible' });
    await page.evaluate(() => window.__draftTest.closeNotice('replaced'));
    assert.equal(await page.evaluate(() => window.__signedIn), true);
    await page.locator('#logoutBtn').click(); await page.getByRole('button', { name: '폐기 후 로그아웃', exact: true }).click();
    await page.waitForFunction(() => !window.__signedIn);
    assert.equal(await stored(page), null);
    assert.deepEqual(await page.evaluate(()=>window.__signOutOptions),{scope:'local'});
    await diagnostics.close(ctx); console.log('Logout: Escape/replaced preserve drafts; explicit discard removes them.');
  }
  // Recovery dismissal must retain the record through hydration and reload.
  {
    reset(); const ctx=await context('recovery dismissal and deletion'),page=await ctx.newPage();await page.goto(origin);await ready(page);
    const originalTitle=await title(page).textContent();await edit(page,'Recovery dismissal draft');
    for(const response of ['Escape','replaced']) {
      await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});
      if(response==='Escape')await page.keyboard.press('Escape');
      else await page.evaluate(()=>window.__draftTest.closeNotice('replaced'));
      await ready(page);await page.waitForTimeout(850);
      assert.equal(await title(page).textContent(),originalTitle);
      assert.ok((await stored(page)).state.html.includes('Recovery dismissal draft'));
    }
    await selectTripTab(page, 'prep');await page.locator('.prepday .checklist input').first().click();
    await page.waitForFunction(()=>window.__draftTest.pending()===0);
    assert.ok((await stored(page)).state.html.includes('Recovery dismissal draft'),'Unrelated checklist save cannot clear deferred recovery');
    await page.reload();await page.getByRole('button',{name:'초안 삭제',exact:true}).click();await ready(page);
    assert.equal(await stored(page),null);await page.reload();await ready(page);
    assert.equal(await page.locator('#noticeDialog').isVisible(),false);
    await diagnostics.close(ctx);console.log('Recovery: Escape/replaced retain the draft; explicit deletion removes it across reload.');
  }
  // Checklist auto-save cannot bless a recovered stale document with its revision.
  for(const legacy of [false,true])for(const mobile of [false,true]) {
    reset();const ctx=await context(`recovered ${legacy ? "legacy" : "current"} draft / ${mobile ? "mobile" : "desktop"}`, mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});
    const page=await ctx.newPage();await page.goto(origin);await ready(page);
    row.content=await page.evaluate(()=>window.__draftTest.captureState());row.revision=1;
    await page.reload();await ready(page);const originalBudget=row.content.budgetKrw;
    await edit(page,'Recovered stale schedule');
    if(legacy)await page.evaluate(()=>window.__draftTest.legacyDraft());
    row={...row,content:{...row.content,budgetKrw:987654},revision:2};
    await page.reload();await recover(page);
    assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),originalBudget);
    if(!legacy)assert.equal(await page.evaluate(()=>window.__draftTest.base().budgetKrw),originalBudget);
    await selectTripTab(page, 'prep');await page.locator('.prepday .checklist input').first().click();
    await page.waitForFunction(()=>window.__draftTest.pending()===0);
    assert.equal(row.revision,3,'Checklist patch succeeds against the latest remote revision');
    assert.equal(row.content.budgetKrw,987654);assert.ok(row.content.checks.some(Boolean));
    assert.equal(await page.evaluate(()=>window.__draftTest.revision()),1,'Stale draft keeps its revision');
    await page.evaluate(()=>window.__draftTest.flushDraftPersistence());
    if(legacy)assert.equal((await stored(page)).baseState,null,'Unknown baseline remains unknown after persistence');
    await page.reload();await recover(page);
    await page.evaluate(()=>{window.__saveResult=undefined;window.__draftTest.persistState(window.__draftTest.captureState()).then(result=>window.__saveResult=Boolean(result));});
    await page.locator('#noticeDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#noticeTitle').textContent(),'다른 저장본이 먼저 반영되었습니다.');
    assert.equal(row.content.budgetKrw,987654);assert.equal(row.revision,3);
    await page.getByRole('button',{name:'계속 편집',exact:true}).click();await page.waitForFunction(()=>window.__saveResult===false);
    assert.ok((await stored(page)).state.html.includes('Recovered stale schedule'));
    await page.evaluate(()=>{window.__saveResult=undefined;window.__draftTest.saveAndFinish().then(result=>window.__saveResult=Boolean(result));});
    await page.locator('#noticeDialog').waitFor({state:'visible'});
    await page.getByRole('button',{name:mobile?'최신본으로 전환':'내 초안으로 덮어쓰기',exact:true}).click();
    await page.waitForFunction(()=>window.__saveResult!==undefined);
    assert.equal(await page.evaluate(()=>window.__draftTest.isDirty()),false);
    assert.equal(await stored(page),null);
    assert.equal(row.content.budgetKrw,mobile?987654:originalBudget,'Overwrite requires explicit confirmation; latest-view choice preserves remote content');
    assert.equal(await page.evaluate(()=>window.__draftTest.revision()),row.revision);
    await diagnostics.close(ctx);console.log('Recovered '+(legacy?'legacy':'current')+' draft ('+(mobile?'mobile':'desktop')+'): checklist patch, reload and full-save conflict preserve remote budget.');
  }
  // Abort only the stalled response, then reconcile without an automatic retry.
  for(const mode of ['timeout-before','timeout-committed','timeout-newer','timeout-unverified','throw']) {
    reset();const ctx=await context(`full save ${mode}`),page=await ctx.newPage();await page.goto(origin);await ready(page);
    row.content=await page.evaluate(()=>window.__draftTest.captureState());row.revision=1;await page.reload();await ready(page);
    await edit(page,'Save failure draft '+mode);
    await page.evaluate(mode=>{window.__shortSaveTimeout=true;window.__throwNextRpc=mode==='throw';},mode);
    saveMode=mode;
    const success=await page.evaluate(()=>window.__draftTest.saveAndFinish().then(Boolean));
    assert.equal(await page.evaluate(()=>window.__draftTest.busy()),false,'Every result releases save and operation flags');
    assert.equal(saveCalls,mode==='throw'?0:1,'No automatic retry');
    if(mode==='timeout-committed') {
      assert.equal(success,true);assert.equal(row.revision,2);assert.equal(await stored(page),null);
      assert.equal(await page.evaluate(()=>window.__draftTest.revision()),2);
    }else{
      assert.equal(success,false);assert.ok((await stored(page)).state.html.includes('Save failure draft '+mode));
      assert.equal(await page.evaluate(()=>window.__draftTest.revision()),1,'Unverified saves keep the old revision');
      assert.match(await page.locator('#status').textContent(),mode==='throw'?/transport exception/:/시간이 초과/);
      if(mode==='timeout-newer')assert.equal(row.content.budgetKrw,987654);
      if(mode==='timeout-before'||mode==='throw') {
        assert.equal(row.revision,1);saveMode='normal';
        assert.equal(await page.evaluate(()=>window.__draftTest.saveAndFinish().then(Boolean)),true,'An explicit retry is available');
        assert.equal(row.revision,2);
      }
    }
    await diagnostics.close(ctx);console.log('Full save '+mode+': reconciliation, draft retention, flag cleanup and explicit retry passed.');
  }
  // Undo removes persisted drafts and cancels pending debounce writes.
  {
    reset(); const ctx = await context('undo and redo persistence'), page = await ctx.newPage(); await page.goto(origin); await ready(page);
    const originalTitle = await title(page).textContent();
    await edit(page, 'Undo persisted edit'); await page.locator('#undoBtn').click();
    await page.waitForFunction(async () => (await window.__draftTest.readDraftRecord()) === null);
    assert.equal(await title(page).textContent(), originalTitle);
    assert.equal(await page.evaluate(() => window.__draftTest.isDirty()), false);
    await title(page).fill('Undo queued edit'); await page.evaluate(() => window.__draftTest.recordHistory());
    await page.locator('#undoBtn').click(); await page.waitForTimeout(850);
    assert.equal(await stored(page), null);
    await page.reload(); await ready(page);
    assert.equal(await page.locator('#noticeDialog').isVisible(), false);
    assert.equal(await title(page).textContent(), originalTitle);
    await edit(page, 'Redo survives'); await page.locator('#undoBtn').click(); await page.locator('#redoBtn').click();
    await page.evaluate(() => window.__draftTest.flushDraftPersistence());
    assert.ok((await stored(page)).state.html.includes('Redo survives'));
    await page.reload(); await recover(page); assert.equal(await title(page).textContent(), 'Redo survives');
    await diagnostics.close(ctx); console.log('Undo/redo: clean reload, queued write cancellation, and dirty recovery passed.');
  }
  // Separate tabs, duplicated sessionStorage, saves/deletes, and closed-tab recovery.
  {
    reset(); const ctx = await context('independent and duplicated tabs'), a = await ctx.newPage(); await a.goto(origin); await ready(a);
    await a.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(String(key).startsWith('online:'))throw new DOMException('Interrupted draft write','QuotaExceededError');return put.call(this,value,key);};});
    await edit(a, 'Tab A draft');
    const popup = a.waitForEvent('popup'); await a.evaluate(url => window.open(url, '_blank'), origin);
    const b = await popup; await ready(b); await edit(b, 'Tab B draft');
    assert.equal(await b.locator('#noticeDialog').isVisible(),false,'A duplicate cannot claim the live tab checkpoint');
    assert.notEqual(await a.evaluate(() => window.__draftTest.key), await b.evaluate(() => window.__draftTest.key));
    assert.ok((await stored(a)).state.html.includes('Tab A draft'));
    assert.ok((await stored(b)).state.html.includes('Tab B draft'));
    assert.equal(await b.evaluate(() => window.__draftTest.persistState(window.__draftTest.captureState()).then(Boolean)), true);
    assert.equal(await stored(b), null); assert.ok((await stored(a)).state.html.includes('Tab A draft'));
    await edit(b, 'Discard B only'); await b.evaluate(() => window.__draftTest.discardDraft());
    assert.equal(await stored(b), null); assert.ok((await stored(a)).state.html.includes('Tab A draft'));
    await a.reload(); await recover(a); assert.equal(await title(a).textContent(), 'Tab A draft');
    await a.evaluate(() => window.__draftTest.flushDraftPersistence()); await a.close();
    const c = await ctx.newPage(); await c.goto(origin); await recover(c); assert.equal(await title(c).textContent(), 'Tab A draft');
    await c.evaluate(() => window.__draftTest.handleExternalSignOut());
    assert.ok((await stored(c)).state.html.includes('Tab A draft'), 'External logout retains this tab’s draft');
    await diagnostics.close(ctx); console.log('Tabs: independent drafts, duplicated tabs, save/discard isolation, reload/closed-tab recovery and external logout passed.');
  }
  // Legacy shared-key drafts survive the upgrade and are claimed by one page.
  {
    reset(); const ctx = await context('legacy shared-key migration'), page = await ctx.newPage(); await page.goto(origin); await ready(page);
    const originalTitle = await title(page).textContent();
    await edit(page, 'Legacy draft');
    await page.evaluate(async originalTitle => {
      const api = window.__draftTest, record = await api.readDraftRecord();
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(api.db);
        req.onsuccess = () => { const db = req.result, tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(record, api.legacyKey); tx.objectStore('records').delete(api.key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
      });
      // Avoid pagehide writing a second copy under the new key.
      document.querySelector('.day1 h3').textContent = originalTitle;
      api.recordHistory();
    }, originalTitle);
    await page.reload(); await recover(page); assert.equal(await title(page).textContent(), 'Legacy draft');
    await diagnostics.close(ctx); console.log('Legacy draft migration passed.');
  }
  // Offline clean baselines must not regress to the old file after undo/reload.
  {
    reset(); const ctx = await context('offline baseline after undo'), page = await ctx.newPage(); await page.goto(origin + '/?offline'); await ready(page);
    await edit(page, 'Offline saved baseline');
    await page.evaluate(() => window.__draftTest.persistState(window.__draftTest.captureState()));
    await page.reload(); await ready(page); assert.equal(await title(page).textContent(), 'Offline saved baseline');
    await edit(page, 'Offline undone'); await page.locator('#undoBtn').click();
    await page.waitForFunction(async () => (await window.__draftTest.readDraftRecord())?.dirty === false);
    await page.reload(); await ready(page);
    assert.equal(await title(page).textContent(), 'Offline saved baseline');
    assert.equal(await page.evaluate(() => window.__draftTest.isDirty()), false);
    await diagnostics.close(ctx); console.log('Offline undo preserves the saved baseline across reload.');
  }
  // Only the day subtitle differs: use the real file input and apply button.
  {
    reset(); const ctx = await context('subtitle-only import / mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await page.goto(origin); await ready(page);
    row.content = await page.evaluate(() => window.__draftTest.captureState());
    const fixture = await page.evaluate(() => {
      const api = window.__draftTest, state = api.captureState(), template = document.createElement('template');
      template.innerHTML = state.html; template.content.querySelector('.day1 .day-head p').textContent = '새 날짜별 설명';
      const changed = { ...state, html: template.innerHTML };
      const diff = api.buildDiff(state, changed); if (!diff.some(group => group.items.some(item => item.includes('새 날짜별 설명')))) throw new Error('Subtitle absent from version diff');
      return '<html data-trip-id="'+window.TRIP_CONFIG.tripId+'" data-offline="true" data-schema-version="'+window.TRIP_CONFIG.schemaVersion+'"><script id="offlineEmbeddedState" type="application/json">'+JSON.stringify(changed).replace(/</g,'\\u003c')+'</script></html>';
    });
    await page.locator('#importFileInput').setInputFiles({ name: 'subtitle.html', mimeType: 'text/html', buffer: Buffer.from(fixture) });
    await page.locator('#importDialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#importDiff').textContent(), /DAY 1 설명.*새 날짜별 설명/);
    assert.equal(await page.locator('#importApply').isEnabled(), true);
    await page.locator('#importApply').click(); await page.locator('#importDialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.day1 .day-head p').textContent(), '새 날짜별 설명');
    assert.equal(await page.evaluate(() => window.__draftTest.isDirty()), true);
    assert.ok(!row.content.html.includes('새 날짜별 설명'), 'Import remains an unpublished draft');
    await diagnostics.close(ctx); console.log('Subtitle-only import and version comparison passed on a mobile viewport.');
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
