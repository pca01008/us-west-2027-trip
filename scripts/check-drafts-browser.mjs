// Regression checks against the real app with a local revision-checked API.
// All external requests are blocked; production data is never read or changed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const original = await readFile(new URL('index.html', root), 'utf8');
let row,saveMode,saveCalls,readFailures;
const reset = () => { saveMode='normal';saveCalls=0;readFailures=0;row = { content: {}, revision: 0, updated_at: new Date().toISOString() }; };
reset();
const stub = `<script>
window.__signedIn=true;
const nativeSetTimeout=window.setTimeout.bind(window);
window.setTimeout=(callback,delay,...args)=>nativeSetTimeout(callback,window.__shortSaveTimeout&&delay===12000?80:delay,...args);
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:window.__signedIn?{user:{email:window.TRIP_CONFIG.editorEmail}}:null}}),onAuthStateChange:()=>{},signOut:async options=>{window.__signOutOptions=options;window.__signedIn=false;return {};},signInWithPassword:async()=>{window.__signedIn=true;return {};}},
  from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},
  rpc:(_name,args)=>({abortSignal:async signal=>{if(window.__throwNextRpc){window.__throwNextRpc=false;throw Error('Simulated transport exception');}return (await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json();}}),
  channel:()=>({on:()=>({subscribe:()=>{}})})
})};</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/mock/doc') { if(readFailures>0){readFailures--;res.writeHead(503).end('Unavailable');return;}res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(row)); return; }
    if (req.url === '/mock/save') {
      let body = ''; for await (const part of req) body += part;
      const args = JSON.parse(body);saveCalls++;
      const mode=saveMode;saveMode='normal';
      if(mode==='timeout-before') {setTimeout(()=>res.end('{}'),300);return;}
      const result = args.p_expected_revision !== row.revision
        ? { error: { code: '40001', message: 'Revision conflict' } }
        : (row = { content: args.p_content, revision: row.revision + 1, updated_at: new Date().toISOString() }, { data: { revision: row.revision, updated_at: row.updated_at } });
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
    let body = await readFile(new URL(file, root));
    if (file === 'index.html') body = original
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, stub)
      .replace('data-offline="false"', url.searchParams.has('offline') ? 'data-offline="true"' : 'data-offline="false"')
      .replace('initializeTimetable();initializeDialogAccessibility();', `window.__draftTest={captureState,normalizeState,buildDiff,isDirty,recordHistory,flushDraftPersistence,readDraftRecord,writeDraftRecord,clearDraftRecord,moveHistory,discardDraft,persistState,saveAndFinish,handleExternalSignOut,closeNotice,
        busy:()=>saveInFlight||operationBusy,
        base:()=>lastSavedState,revision:()=>publishedRevision,pending:()=>pendingChecks.size,
        legacyDraft:async()=>{const record=await readDraftRecord();delete record.baseState;await writeDraftRecord(record);pendingDraft=false;clearTimeout(draftWriteTimer);},
        key:DRAFT_RECORD_KEY,legacyKey:LEGACY_DRAFT_RECORD_KEY,db:DRAFT_DB_NAME,sessionKey:DRAFT_SESSION_KEY};initializeTimetable();initializeDialogAccessibility();`);
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'image/webp');
    res.end(body);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const ready = page => page.waitForFunction(() => !document.body.classList.contains('hydrating'));
const stored = page => page.evaluate(() => window.__draftTest.readDraftRecord());
const title = page => page.locator('.day1 .timeline-row h3').first();
async function edit(page, text) {
  await page.locator('.tabs label[for="d1"]').click();
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
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  await ctx.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  ctx.on('page', page => { page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message)); });
  return ctx;
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  // Escape, replacement by another dialog, and explicit discard are distinct.
  {
    const ctx = await context(), page = await ctx.newPage(); await page.goto(origin); await ready(page);
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
    await ctx.close(); console.log('Logout: Escape/replaced preserve drafts; explicit discard removes them.');
  }
  // Recovery dismissal must retain the record through hydration and reload.
  {
    reset(); const ctx=await context(),page=await ctx.newPage();await page.goto(origin);await ready(page);
    const originalTitle=await title(page).textContent();await edit(page,'Recovery dismissal draft');
    for(const response of ['Escape','replaced']) {
      await page.reload();await page.locator('#noticeDialog').waitFor({state:'visible'});
      if(response==='Escape')await page.keyboard.press('Escape');
      else await page.evaluate(()=>window.__draftTest.closeNotice('replaced'));
      await ready(page);await page.waitForTimeout(850);
      assert.equal(await title(page).textContent(),originalTitle);
      assert.ok((await stored(page)).state.html.includes('Recovery dismissal draft'));
    }
    await page.locator('.tabs label[for="prep"]').click();await page.locator('.prepday .checklist input').first().click();
    await page.waitForFunction(()=>window.__draftTest.pending()===0);
    assert.ok((await stored(page)).state.html.includes('Recovery dismissal draft'),'Unrelated checklist save cannot clear deferred recovery');
    await page.reload();await page.getByRole('button',{name:'초안 삭제',exact:true}).click();await ready(page);
    assert.equal(await stored(page),null);await page.reload();await ready(page);
    assert.equal(await page.locator('#noticeDialog').isVisible(),false);
    await ctx.close();console.log('Recovery: Escape/replaced retain the draft; explicit deletion removes it across reload.');
  }
  // Checklist auto-save cannot bless a recovered stale document with its revision.
  for(const legacy of [false,true])for(const mobile of [false,true]) {
    reset();const ctx=await context(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});
    const page=await ctx.newPage();await page.goto(origin);await ready(page);
    row.content=await page.evaluate(()=>window.__draftTest.captureState());row.revision=1;
    await page.reload();await ready(page);const originalBudget=row.content.budgetKrw;
    await edit(page,'Recovered stale schedule');
    if(legacy)await page.evaluate(()=>window.__draftTest.legacyDraft());
    row={...row,content:{...row.content,budgetKrw:987654},revision:2};
    await page.reload();await recover(page);
    assert.equal(await page.evaluate(()=>window.__draftTest.captureState().budgetKrw),originalBudget);
    if(!legacy)assert.equal(await page.evaluate(()=>window.__draftTest.base().budgetKrw),originalBudget);
    await page.locator('.tabs label[for="prep"]').click();await page.locator('.prepday .checklist input').first().click();
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
    await ctx.close();console.log('Recovered '+(legacy?'legacy':'current')+' draft ('+(mobile?'mobile':'desktop')+'): checklist patch, reload and full-save conflict preserve remote budget.');
  }
  // Abort only the stalled response, then reconcile without an automatic retry.
  for(const mode of ['timeout-before','timeout-committed','timeout-newer','timeout-unverified','throw']) {
    reset();const ctx=await context(),page=await ctx.newPage();await page.goto(origin);await ready(page);
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
    await ctx.close();console.log('Full save '+mode+': reconciliation, draft retention, flag cleanup and explicit retry passed.');
  }
  // Undo removes persisted drafts and cancels pending debounce writes.
  {
    reset(); const ctx = await context(), page = await ctx.newPage(); await page.goto(origin); await ready(page);
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
    await ctx.close(); console.log('Undo/redo: clean reload, queued write cancellation, and dirty recovery passed.');
  }
  // Separate tabs, duplicated sessionStorage, saves/deletes, and closed-tab recovery.
  {
    reset(); const ctx = await context(), a = await ctx.newPage(); await a.goto(origin); await ready(a);
    await edit(a, 'Tab A draft');
    const popup = a.waitForEvent('popup'); await a.evaluate(url => window.open(url, '_blank'), origin);
    const b = await popup; await ready(b); await edit(b, 'Tab B draft');
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
    await ctx.close(); console.log('Tabs: independent drafts, duplicated tabs, save/discard isolation, reload/closed-tab recovery and external logout passed.');
  }
  // Legacy shared-key drafts survive the upgrade and are claimed by one page.
  {
    reset(); const ctx = await context(), page = await ctx.newPage(); await page.goto(origin); await ready(page);
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
    await ctx.close(); console.log('Legacy draft migration passed.');
  }
  // Offline clean baselines must not regress to the old file after undo/reload.
  {
    reset(); const ctx = await context(), page = await ctx.newPage(); await page.goto(origin + '/?offline'); await ready(page);
    await edit(page, 'Offline saved baseline');
    await page.evaluate(() => window.__draftTest.persistState(window.__draftTest.captureState()));
    await page.reload(); await ready(page); assert.equal(await title(page).textContent(), 'Offline saved baseline');
    await edit(page, 'Offline undone'); await page.locator('#undoBtn').click();
    await page.waitForFunction(async () => (await window.__draftTest.readDraftRecord())?.dirty === false);
    await page.reload(); await ready(page);
    assert.equal(await title(page).textContent(), 'Offline saved baseline');
    assert.equal(await page.evaluate(() => window.__draftTest.isDirty()), false);
    await ctx.close(); console.log('Offline undo preserves the saved baseline across reload.');
  }
  // Only the day subtitle differs: use the real file input and apply button.
  {
    reset(); const ctx = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
    await ctx.close(); console.log('Subtitle-only import and version comparison passed on a mobile viewport.');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
