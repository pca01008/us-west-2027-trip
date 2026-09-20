// Exercise the actual app with a revision-checked local server. No production access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-prep-'));
const original = await readFile(new URL('index.html', root), 'utf8');
let row, failures, conflict, writes, delay;
const reset = () => { row = { content: {}, revision: 1, updated_at: new Date().toISOString() }; failures = 0; conflict = null; writes = []; delay = 0; };
reset();
const stub = `<script>
window.__signedIn=true;
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:window.__signedIn?{user:{email:window.TRIP_CONFIG.editorEmail}}:null}}),signInWithPassword:async()=>{window.__signedIn=true;return {};},signOut:async()=>{window.__signedIn=false;return {};},onAuthStateChange:()=>{}},
 from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await (await fetch('/mock/doc')).json()})};return q;},
 rpc:(name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),
 channel:()=>({on:(_type,_filter,callback)=>{window.__emitRemote=callback;return {subscribe:()=>{}};}})
})};
</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/mock/doc') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(row)); return; }
    if (req.url === '/mock/save') {
      let body = ''; for await (const chunk of req) body += chunk;
      const args = JSON.parse(body); if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (conflict) { const change = conflict; conflict = null; change(row); row.revision++; }
      let response;
      if (failures > 0) { failures--; response = {error:{message:'Simulated save failure'}}; }
      else if (row.revision !== args.p_expected_revision) response = {error:{code:'40001',message:'Revision conflict'}};
      else { row={content:args.p_content,revision:row.revision+1,updated_at:new Date().toISOString()};writes.push(structuredClone(args));response={data:{revision:row.revision,updated_at:row.updated_at}}; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response)); return;
    }
    const url = new URL(req.url, 'http://localhost');
    const relative = url.pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(relative)) { res.writeHead(404).end(); return; }
    let content = await readFile(new URL(relative, root));
    if (relative === 'index.html') content = original
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, stub)
      .replace('initializeTimetable();initializeDialogAccessibility();', `window.__prepTest={captureState,applyState,normalizeState,checklistItems,patchChecklist,patchCheck,isDirty,finishMutation,recordHistory,refreshPublishedState,
        pending:()=>pendingChecks.size,base:()=>lastSavedState,revision:()=>publishedRevision,editorItems:()=>clone(checklistEditorItems),
        draft:()=>{expenses.push({id:'unsaved-expense',name:'Unsaved meal',amount:25,currency:'USD',date:'2027-05-01',categoryId:'misc'});renderLedger();finishMutation();},
        storageFailure:()=>{writeDraftRecord=async()=>false;}};initializeTimetable();initializeDialogAccessibility();`)
      .replace('data-offline="false"', url.searchParams.has('offline') ? 'data-offline="true"' : 'data-offline="false"');
    res.setHeader('Content-Type', relative.endsWith('.html') ? 'text/html; charset=utf-8' : relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');res.end(content);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await chromium.launch({headless:true,channel:process.env.PWA_BROWSER_CHANNEL || 'chrome'});
  for (const mobile of [false,true]) {
    reset();
    const context = await browser.newContext({viewport:{width:mobile?390:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    const ready = () => page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    const idle = () => page.waitForFunction(()=>window.__prepTest.pending()===0 && !document.querySelector('#editBtn').disabled);
    const check = index => page.locator('.prepday .checklist label input').nth(index);
    await page.goto(origin);await ready();
    row.content=await page.evaluate(()=>window.__prepTest.captureState());
    assert.equal(await page.locator('#editBtn').innerText(),'목록 편집');
    // Authentication precedes mutation, and cancellation is a true no-op.
    await page.evaluate(()=>window.__signedIn=false);await check(0).click();
    await page.locator('#authDialog').waitFor({state:'visible'});assert.equal(await check(0).isChecked(),false);
    await page.locator('#authCancel').click();assert.equal(writes.length,0);assert.equal(await check(0).isEnabled(),true);
    await check(0).click();await page.locator('#editorPassword').fill('fixture');await page.locator('#authSubmit').click();await idle();
    assert.equal(row.content.checks[0],true);
    if(await page.evaluate(()=>window.__prepTest.isDirty()))console.log(await page.evaluate(()=>{const api=window.__prepTest,a=JSON.stringify(api.normalizeState(api.captureState())),b=JSON.stringify(api.normalizeState(api.base()));let i=0;while(a[i]===b[i]&&i<a.length)i++;return {i,a:a.slice(i-120,i+300),b:b.slice(i-120,i+300),checks:api.captureState().checks,base:api.base().checks};}));
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),false,'Auto-save leaves no manual-save draft');
    await page.reload();await ready();assert.equal(await check(0).isChecked(),true,'Check survives reload');
    await check(0).focus();await page.keyboard.press('Space');await idle();assert.equal(row.content.checks[0],false);
    assert.equal(await check(0).evaluate(el=>document.activeElement===el),true,'Keyboard focus survives auto-save');
    await page.keyboard.press('Space');await idle();assert.equal(row.content.checks[0],true);
    // Queue independent rows and retain the last toggle after completion.
    delay=200;await check(1).click();await check(2).click();await idle();delay=0;
    assert.equal(row.content.checks[1],true);assert.equal(row.content.checks[2],true);
    await check(1).click();await idle();assert.equal(row.content.checks[1],false);
    failures=1;await check(1).click();await idle();assert.equal(await check(1).isChecked(),false,'Failure rolls back');
    assert.match(await page.locator('.check-feedback[data-error="true"]').innerText(),/저장 실패/);
    await page.locator('[data-retry-check]').click();await idle();assert.equal(row.content.checks[1],true);
    // A concurrent write is merged from the new remote snapshot on CAS retry.
    conflict=doc=>{doc.content.checks[3]=true;doc.content.budgetKrw=432100;};
    await check(4).click();await idle();assert.equal(row.content.checks[3],true);assert.equal(row.content.checks[4],true);assert.equal(row.content.budgetKrw,432100);
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),false);
    // Content editing uses distinct text inputs and disabled completion controls.
    await page.locator('#editBtn').click();await page.locator('#checklistDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#checklistEditorRows input[type="checkbox"]').first().isDisabled(),true);
    const beforeItems=await page.evaluate(()=>window.__prepTest.checklistItems(window.__prepTest.captureState()));
    await page.locator('.checklist-text').first().fill('여권 확인 완료');
    await page.locator('[data-check-action="down"]').first().click();
    assert.equal(await page.locator('#checklistEditorRows input[type="checkbox"]').nth(1).isChecked(),true);
    await page.locator('#checklistAdd').click();await page.locator('.checklist-text').last().fill('새 준비물');
    assert.equal(await page.locator('#checklistEditorRows input[type="checkbox"]').last().isChecked(),false);
    await page.locator('#themeSelect').evaluate(el=>{el.value='dark';el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-list-editor.png`)});
    await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    assert.equal(await page.locator('#noticeDialog').isVisible(),false,'No second save confirmation');
    const afterItems=await page.evaluate(()=>window.__prepTest.checklistItems(window.__prepTest.captureState()));
    assert.equal(afterItems[1].id,beforeItems[0].id);assert.equal(afterItems[1].text,'여권 확인 완료');assert.equal(afterItems[1].checked,true);assert.equal(afterItems.at(-1).checked,false);
    if(await page.evaluate(()=>window.__prepTest.isDirty()))console.log(await page.evaluate(()=>{const api=window.__prepTest,a=JSON.stringify(api.normalizeState(api.captureState())),b=JSON.stringify(api.normalizeState(api.base()));let i=0;while(a[i]===b[i]&&i<a.length)i++;return {i,a:a.slice(i-120,i+300),b:b.slice(i-120,i+300)};}));
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),false);
    // Cancel, Escape and blank validation leave the saved list intact.
    const savedShape=JSON.stringify(afterItems);await page.locator('#editBtn').click();await page.locator('.checklist-text').first().fill('취소할 내용');await page.keyboard.press('Escape');
    assert.equal(await page.locator('#checklistDialog').isVisible(),false);assert.equal(await check(0).isEnabled(),true);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__prepTest.checklistItems(window.__prepTest.captureState()))),savedShape);
    await page.locator('#editBtn').click();await page.locator('#checklistAdd').click();await page.locator('#checklistSave').click();assert.match(await page.locator('#checklistEditorError').innerText(),/빈 항목/);await page.locator('#checklistCancel').click();
    // Save failure keeps the list editor and entered values available for retry.
    await page.locator('#editBtn').click();await page.locator('.checklist-text').last().fill('수정 후 재시도');failures=1;await page.locator('#checklistSave').click();
    await page.waitForFunction(()=>document.querySelector('#checklistEditorError').textContent.includes('저장 실패'));assert.equal(await page.locator('.checklist-text').last().inputValue(),'수정 후 재시도');
    await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    // A remote completion change during list save must survive a CAS retry.
    await page.locator('#editBtn').click();await page.locator('.checklist-text').last().fill('동시 체크 보존');
    conflict=doc=>{doc.content.checks[6]=true;};await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});assert.equal(row.content.checks[6],true);
    // Concurrent list edits must not be overwritten; reopening fetches the new list.
    await page.locator('#editBtn').click();await page.locator('.checklist-text').last().fill('내 목록 편집');
    conflict=doc=>{doc.content.html=doc.content.html.replace('동시 체크 보존','다른 기기 편집');};
    await page.locator('#checklistSave').click();await page.waitForFunction(()=>document.querySelector('#checklistEditorError').textContent.includes('다른 곳'));
    assert.match(row.content.html,/다른 기기 편집/);await page.locator('#checklistCancel').click();
    await page.locator('#editBtn').click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.checklist-text')).at(-1)?.value==='다른 기기 편집');
    await page.locator('.checklist-text').last().fill('최신 목록 확인');await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    // Preserve an unrelated ledger draft entered while an auto-save is in flight.
    delay=500;await check(5).click();await page.waitForFunction(()=>window.__prepTest.pending()>0);
    await page.locator('.tabs label[for="money"]').click();await page.locator('#expenseName').fill('입력 중인 경비');
    await page.evaluate(()=>window.__prepTest.draft());assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),true);
    await idle();delay=0;assert.equal(row.content.expenses.some(e=>e.id==='unsaved-expense'),false);
    assert.equal(await page.locator('#expenseName').inputValue(),'입력 중인 경비','In-progress form input survives auto-save');
    await page.locator('.tabs label[for="prep"]').click();
    assert.equal(await page.evaluate(()=>window.__prepTest.captureState().expenses.some(e=>e.id==='unsaved-expense')),true);
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),true);
    // A deleted remote item must fail safely without checking the row that moved into its position.
    const removedId=await page.locator('.prepday .checklist label').last().getAttribute('data-check-id');
    row.content=await page.evaluate(state=>{const api=window.__prepTest;return api.patchChecklist(state,api.checklistItems(state).slice(0,-1));},row.content);row.revision++;
    const beforeDeletionAttempt=writes.length;await page.locator('.prepday .checklist label input').last().click();await idle();
    assert.equal(writes.length,beforeDeletionAttempt);assert.match(await page.locator('.check-feedback[data-error="true"]').innerText(),/항목이 삭제/);assert.ok(!row.content.html.includes(removedId));
    await page.locator('#editBtn').click();await page.locator('.checklist-text').last().fill('초안 보존 확인');await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    assert.equal(row.content.expenses.some(e=>e.id==='unsaved-expense'),false);assert.equal(await page.evaluate(()=>window.__prepTest.captureState().expenses.some(e=>e.id==='unsaved-expense')),true);
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),true);
    // Global schedule editing cannot mutate checklist completion or text.
    await page.locator('.tabs label[for="d1"]').click();await page.locator('#editBtn').click();await page.locator('.tabs label[for="prep"]').click();
    assert.equal(await check(0).isDisabled(),true);assert.equal(await page.locator('.prepday label>span').first().getAttribute('contenteditable'),'false');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    console.log(`${mobile?'Mobile':'Desktop'}: authentication, auto-save/reload, queue, rollback/retry, revision conflict, editor, cancel, blank input and draft isolation passed.`);
    await context.close();
  }
  // New rows always start incomplete, even among completed rows and after a save retry.
  for(const mobile of [false,true]) {
    reset();
    const context=await browser.newContext({viewport:{width:mobile?390:1440,height:900},isMobile:mobile,hasTouch:mobile});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    await page.goto(origin);await ready();row.content=await page.evaluate(()=>window.__prepTest.captureState());row.content.checks.fill(true);
    await page.reload();await ready();
    await page.locator('#editBtn').click();await page.locator('#checklistAdd').click();
    const originalCount=row.content.checks.length;
    await page.locator('.checklist-text').last().fill('첫 번째 새 항목');
    for(let i=originalCount;i>0;i--)await page.locator('[data-check-action="up"]').nth(i).click();
    await page.locator('#checklistAdd').click();await page.locator('.checklist-text').last().fill('두 번째 새 항목');
    const items=await page.evaluate(()=>window.__prepTest.editorItems());
    assert.equal(await page.locator('#checklistEditorRows input').first().isChecked(),false);
    assert.equal(await page.locator('#checklistEditorRows input').last().isChecked(),false);
    // Simulate a conflicting server snapshot carrying checked flags for the new IDs.
    const stale=await page.evaluate(({state,items})=>window.__prepTest.patchChecklist(state,items.map(item=>({...item,checked:true}))),{state:row.content,items});
    conflict=doc=>{doc.content=stale;};
    await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    assert.deepEqual(row.content.checks,[false,...Array(originalCount).fill(true),false],'New IDs cannot inherit checked defaults at save');
    await page.reload();await ready();
    assert.equal(await page.locator('.prepday .checklist input').first().isChecked(),false);
    assert.equal(await page.locator('.prepday .checklist input').last().isChecked(),false);
    await page.locator('.prepday .checklist input').first().click();await page.waitForFunction(()=>window.__prepTest.pending()===0);
    await page.locator('#editBtn').click();await page.locator('.checklist-text').first().fill('사용자가 완료한 항목');
    await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    assert.equal(row.content.checks[0],true,'Later edits preserve an explicitly completed item');
    // The legacy add button also goes through the editor, never an editable checkbox label.
    await page.locator('#addCheckBtn').evaluate(button=>button.click());await page.locator('#checklistDialog').waitFor({state:'visible'});
    await page.locator('.checklist-text').last().fill('이전 추가 버튼의 새 항목');
    await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    assert.equal(row.content.checks.at(-1),false);
    await context.close();console.log(`${mobile?'Mobile':'Desktop'}: new items remain unchecked after reorder, save conflict and reload; existing completion is preserved.`);
  }
  reset();
  const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/?offline');await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  await page.locator('.prepday input').first().click();await page.waitForFunction(()=>window.__prepTest.pending()===0);assert.equal(writes.length,0);
  await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));assert.equal(await page.locator('.prepday input').first().isChecked(),true);
  await page.locator('#editBtn').click();await page.locator('.checklist-text').first().fill('오프라인 문구 수정');await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
  await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));assert.equal(await page.locator('.prepday label>span').first().textContent(),'오프라인 문구 수정');assert.equal(await page.locator('.prepday input').first().isChecked(),true);
  await page.evaluate(()=>window.__prepTest.storageFailure());await page.locator('.prepday input').nth(1).click();await page.waitForFunction(()=>window.__prepTest.pending()===0);assert.equal(await page.locator('.prepday input').nth(1).isChecked(),false);
  console.log('Offline: local persistence/reload and storage failure rollback passed.');await context.close();
  assert.deepEqual(errors,[]);console.log('Screenshots:',output);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
