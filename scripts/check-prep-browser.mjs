import { selectTripTab } from './browser-fixtures.mjs';
// Exercise the actual app with a revision-checked local server. No production access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('prep');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-prep-'));
const original = await readFile(new URL('index.html', root), 'utf8');
let row, failures, conflict, writes, delay, nextSave, readUnavailable, saveRequests;
const reset = () => { row = { content: {}, revision: 1, updated_at: new Date().toISOString() }; failures = 0; conflict = null; writes = []; delay = 0; nextSave = null; readUnavailable = false; saveRequests = 0; };
reset();
const stub = `<script>
window.__signedIn=true;
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:window.__signedIn?{user:{email:window.TRIP_CONFIG.editorEmail}}:null}}),signInWithPassword:async()=>{window.__signedIn=true;return {};},signOut:async()=>{window.__signedIn=false;return {};},onAuthStateChange:()=>{}},
 from:()=>{let signal;const q={select:()=>q,eq:()=>q,abortSignal:s=>{signal=s;return q;},maybeSingle:async()=>{const response=await fetch('/mock/doc',{signal});if(!response.ok)throw new Error('Verification unavailable');return {data:await response.json()};}};return q;},
 rpc:(name,args)=>({abortSignal:async signal=>{const response=await (await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json();if(response.transport)throw new TypeError('Failed to fetch');return response;}}),
 channel:()=>({on:(_type,_filter,callback)=>{window.__emitRemote=callback;return {subscribe:()=>{}};}})
})};
</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/mock/doc') { if(readUnavailable){res.writeHead(503).end();return;} res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(row)); return; }
    if (req.url === '/mock/save') {
      let body = ''; for await (const chunk of req) body += chunk;
      const args = JSON.parse(body);saveRequests++;const fault=nextSave;nextSave=null;
      if(fault?.beforeCommit){await new Promise(resolve=>setTimeout(resolve,400));res.destroy();return;}
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (conflict) { const change = conflict; conflict = null; change(row); row.revision++; }
      let response;
      if (failures > 0) { failures--; response = {error:{message:'Simulated save failure'}}; }
      else if (row.revision !== args.p_expected_revision) response = {error:{code:'40001',message:'Revision conflict'}};
      else { row={content:args.p_content,revision:row.revision+1,updated_at:new Date().toISOString()};writes.push(structuredClone(args));response={data:{revision:row.revision,updated_at:row.updated_at}}; }
      if(fault){
        fault.afterCommit?.(row);readUnavailable=Boolean(fault.unavailable);
        if(fault.transport){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({transport:true}));return;}
        if(fault.sdkError){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:0,error:{message:'TypeError: Failed to fetch'}}));return;}
        await new Promise(resolve=>setTimeout(resolve,400));
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response)); return;
    }
    const url = new URL(req.url, 'http://localhost');
    const relative = url.pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(relative)) { res.writeHead(404).end(); return; }
    let content = await readBrowserFixture(new URL(relative, root));
    if (relative === 'index.html') content = original
      .replaceAll('setTimeout(()=>controller.abort(),12000)', url.searchParams.has('uncertain')?'setTimeout(()=>controller.abort(),120)':'setTimeout(()=>controller.abort(),12000)')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, stub)
      .replace('initializeTimetable();initializeDialogAccessibility();', `window.__prepTest={captureState,applyState,normalizeState,checklistItems,patchChecklist,patchCheck,isDirty,finishMutation,recordHistory,refreshPublishedState,
        pending:()=>pendingChecks.size,base:()=>lastSavedState,revision:()=>publishedRevision,editorItems:()=>clone(checklistEditorItems),
        draft:()=>{expenses.push({id:'unsaved-expense',name:'Unsaved meal',amountKrw:36250,amountUsd:25,amountSource:'usd',appliedExchangeRate:1450,date:'2027-05-01',categoryId:'misc'});renderLedger();finishMutation();},
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
  browser = await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL ? {channel:process.env.PWA_BROWSER_CHANNEL} : {})});
  for (const mobile of [false,true]) {
    reset();
    diagnostics.scenario(`checklist editing and save / ${mobile ? "mobile" : "desktop"}`);
    const context = await diagnostics.context(browser, {viewport:{width:mobile?390:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    const ready = () => page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    const idle = () => page.waitForFunction(()=>window.__prepTest.pending()===0 && !document.querySelector('#editBtn').disabled);
    let originalIds=[];
    const check=index=>page.locator('.prepday .checklist label[data-check-id="'+originalIds[index]+'"] input');
    const storedCheck=index=>row.content.checks[Array.from(row.content.html.matchAll(/data-check-id="([^"]+)"/g)).findIndex(match=>match[1]===originalIds[index])];
    await page.goto(origin);await ready();
    row.content=await page.evaluate(()=>window.__prepTest.captureState());
    originalIds=await page.evaluate(()=>window.__prepTest.checklistItems(window.__prepTest.captureState()).map(item=>item.id));
    assert.equal(await page.locator('#editBtn').innerText(),'목록 편집');
    // Authentication precedes mutation, and cancellation is a true no-op.
    await page.evaluate(()=>window.__signedIn=false);await check(0).click();
    await page.locator('#authDialog').waitFor({state:'visible'});assert.equal(await check(0).isChecked(),false);
    await page.locator('#authCancel').click();assert.equal(writes.length,0);assert.equal(await check(0).isEnabled(),true);
    await check(0).click();await page.locator('#editorPassword').fill('fixture');await page.locator('#authSubmit').click();await idle();
    assert.equal(storedCheck(0),true);
    if(await page.evaluate(()=>window.__prepTest.isDirty()))console.log(await page.evaluate(()=>{const api=window.__prepTest,a=JSON.stringify(api.normalizeState(api.captureState())),b=JSON.stringify(api.normalizeState(api.base()));let i=0;while(a[i]===b[i]&&i<a.length)i++;return {i,a:a.slice(i-120,i+300),b:b.slice(i-120,i+300),checks:api.captureState().checks,base:api.base().checks};}));
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),false,'Auto-save leaves no manual-save draft');
    await page.reload();await ready();assert.equal(await check(0).isChecked(),true,'Check survives reload');
    await check(0).focus();await page.keyboard.press('Space');await idle();assert.equal(storedCheck(0),false);
    assert.equal(await check(0).evaluate(el=>document.activeElement===el),true,'Keyboard focus survives auto-save');
    await page.keyboard.press('Space');await idle();assert.equal(storedCheck(0),true);
    // Queue independent rows and retain the last toggle after completion.
    delay=200;await check(1).click();await check(2).click();await idle();delay=0;
    assert.equal(storedCheck(1),true);assert.equal(storedCheck(2),true);
    await check(1).click();await idle();assert.equal(storedCheck(1),false);
    failures=1;await check(1).click();await idle();assert.equal(await check(1).isChecked(),false,'Failure rolls back');
    assert.match(await page.locator('.check-feedback[data-error="true"]').innerText(),/저장 실패/);
    await page.locator('[data-retry-check]').click();await idle();assert.equal(storedCheck(1),true);
    // A concurrent write is merged from the new remote snapshot on CAS retry.
    conflict=doc=>{doc.content.checks[3]=true;doc.content.budgetKrw=432100;};
    await check(4).click();await idle();assert.equal(storedCheck(3),true);assert.equal(storedCheck(4),true);assert.equal(row.content.budgetKrw,432100);
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
    await page.locator('input[name=themePreference][value=dark]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
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
    conflict=doc=>{doc.content.checks[6]=true;};await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});assert.equal(storedCheck(6),true);
    // Concurrent list edits must not be overwritten; reopening fetches the new list.
    await page.locator('#editBtn').click();await page.locator('.checklist-text').last().fill('내 목록 편집');
    conflict=doc=>{doc.content.html=doc.content.html.replace('동시 체크 보존','다른 기기 편집');};
    await page.locator('#checklistSave').click();await page.waitForFunction(()=>document.querySelector('#checklistEditorError').textContent.includes('다른 곳'));
    assert.match(row.content.html,/다른 기기 편집/);await page.locator('#checklistCancel').click();
    await page.locator('#editBtn').click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.checklist-text')).at(-1)?.value==='다른 기기 편집');
    await page.locator('.checklist-text').last().fill('최신 목록 확인');await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
    // Preserve an unrelated ledger draft entered while an auto-save is in flight.
    delay=500;await check(5).click();await page.waitForFunction(()=>window.__prepTest.pending()>0);
    await selectTripTab(page, 'money');await page.locator('#expenseName').fill('입력 중인 경비');
    await page.evaluate(()=>window.__prepTest.draft());assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),true);
    await idle();delay=0;assert.equal(row.content.expenses.some(e=>e.id==='unsaved-expense'),false);
    assert.equal(await page.locator('#expenseName').inputValue(),'입력 중인 경비','In-progress form input survives auto-save');
    await selectTripTab(page, 'prep');
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
    await selectTripTab(page, 'd1');await page.locator('#editBtn').click();await selectTripTab(page, 'prep');
    assert.equal(await check(0).isDisabled(),true);assert.equal(await page.locator('.prepday label>span').first().getAttribute('contenteditable'),'false');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    console.log(`${mobile?'Mobile':'Desktop'}: authentication, auto-save/reload, queue, rollback/retry, revision conflict, editor, cancel, blank input and draft isolation passed.`);
    await diagnostics.close(context);
  }
  // New rows always start incomplete, even among completed rows and after a save retry.
  for(const mobile of [false,true]) {
    reset();
    diagnostics.scenario(`checklist completion and reorder / ${mobile ? "mobile" : "desktop"}`);
    const context=await diagnostics.context(browser, {viewport:{width:mobile?390:1440,height:900},isMobile:mobile,hasTouch:mobile});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    await page.goto(origin);await ready();row.content=await page.evaluate(()=>window.__prepTest.captureState());
    const ids=await page.evaluate(()=>window.__prepTest.checklistItems(window.__prepTest.captureState()).map(item=>item.id));
    const order=()=>page.locator('.prepday .checklist label').evaluateAll(labels=>labels.map(label=>label.dataset.checkId));
    const toggle=async id=>{await page.locator('[data-check-id="'+id+'"] input').click();await page.waitForFunction(()=>window.__prepTest.pending()===0);};
    const decorated=id=>page.locator('[data-check-id="'+id+'"]>span').first().evaluate(span=>getComputedStyle(span).textDecorationLine);
    await toggle(ids[5]);
    assert.deepEqual(await order(),[ids[5],...ids.filter(id=>id!==ids[5])]);
    assert.equal(await decorated(ids[5]),'line-through');
    await toggle(ids[8]);
    assert.deepEqual(await order(),[ids[5],ids[8],...ids.filter(id=>id!==ids[5]&&id!==ids[8])],'New completion joins the bottom of the completed group');
    await toggle(ids[5]);
    assert.deepEqual(await order(),[ids[8],ids[5],...ids.filter(id=>id!==ids[5]&&id!==ids[8])],'Unchecking returns the item to the first incomplete position');
    assert.equal(await decorated(ids[5]),'none');
    failures=1;const beforeFailure=await order();await toggle(ids[10]);
    assert.deepEqual(await order(),beforeFailure,'Failed save preserves order');assert.equal(await decorated(ids[10]),'none');
    await page.locator('[data-retry-check]').click();await page.waitForFunction(()=>window.__prepTest.pending()===0);
    const savedOrder=[ids[8],ids[10],ids[5],...ids.filter(id=>![ids[5],ids[8],ids[10]].includes(id))];
    assert.deepEqual(await order(),savedOrder);
    await page.reload();await ready();assert.deepEqual(await order(),savedOrder);assert.equal(await decorated(ids[10]),'line-through');
    // Last incomplete item and repeated writes must not disturb an all-complete list.
    for(const id of savedOrder.filter(id=>![ids[8],ids[10]].includes(id)))await toggle(id);
    assert.deepEqual(await order(),savedOrder);assert.ok(row.content.checks.every(Boolean));
    const idempotent=await page.evaluate(({state,id})=>window.__prepTest.patchCheck(state,id,true),{state:row.content,id:ids[8]});
    assert.deepEqual(idempotent,row.content);
    console.log(`${mobile?'Mobile':'Desktop'}: completion order, strike-through, uncheck, retry, reload and all-complete cases passed.`);
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
    await diagnostics.close(context);console.log(`${mobile?'Mobile':'Desktop'}: new items remain unchecked after reorder, save conflict and reload; existing completion is preserved.`);
  }
  // Lost responses must be reconciled by operation, even when later remote
  // changes make the complete document differ from the submitted snapshot.
  for(const kind of ['checkbox','list'])for(const draft of [false,true])for(const outcome of ['timeout','transport','sdk-error','newer-remote','before-commit','unavailable']) {
    reset();diagnostics.scenario(`uncertain ${kind} / ${outcome} / draft=${draft}`);
    const context=await diagnostics.context(browser,{viewport:{width:draft?390:1440,height:900}});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/?uncertain');await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    row.content=await page.evaluate(()=>window.__prepTest.captureState());
    if(draft)await page.evaluate(()=>window.__prepTest.draft());
    const originalRevision=row.revision;
    const localRevision=await page.evaluate(()=>window.__prepTest.revision());
    const ids=await page.evaluate(()=>window.__prepTest.checklistItems(window.__prepTest.captureState()).map(item=>item.id));
    const checkbox=()=>page.locator('[data-check-id="'+ids[0]+'"] input');
    if(kind==='list'){
      await page.locator('#editBtn').click();await page.locator('.checklist-text').first().fill('응답 유실 목록 수정');
      await page.locator('#checklistAdd').click();await page.locator('.checklist-text').last().fill('응답 유실 새 항목');
    }
    nextSave={
      transport:outcome==='transport',sdkError:outcome==='sdk-error',beforeCommit:outcome==='before-commit',unavailable:outcome==='unavailable',
      afterCommit:outcome==='newer-remote'?doc=>{doc.content.budgetKrw=987654;doc.content.checks[1]=true;if(kind==='list')doc.content.checks[doc.content.checks.length-1]=true;doc.revision++;}:null
    };
    if(kind==='checkbox')await checkbox().click();else await page.locator('#checklistSave').click();
    const uncertain=['before-commit','unavailable'].includes(outcome);
    if(kind==='checkbox'){
      await page.waitForFunction(()=>window.__prepTest.pending()===0);
      assert.equal(await checkbox().isChecked(),!uncertain,'Only a verified result changes the confirmed checkbox');
      assert.match(await page.locator('.check-feedback').innerText(),uncertain?/저장 결과 확인 필요/:/저장됨/);
      assert.equal(await page.locator('[data-retry-check]').count(),uncertain?1:0);
    }else if(uncertain){
      await page.waitForFunction(()=>document.querySelector('#checklistEditorError').textContent.includes('저장 결과 확인 필요'));
      assert.equal(await page.locator('.checklist-text').first().inputValue(),'응답 유실 목록 수정');
      assert.equal(await page.locator('.checklist-text').last().inputValue(),'응답 유실 새 항목');
    }else{
      await page.locator('#checklistDialog').waitFor({state:'hidden'});
      assert.match(await page.locator('#status').innerText(),/목록 저장됨/);
      assert.equal(await page.locator('.prepday label>span').first().textContent(),'응답 유실 목록 수정');
    }
    assert.equal(saveRequests,1,'Ambiguous writes are never automatically retried');
    assert.equal(writes.length,outcome==='before-commit'?0:1);
    assert.equal(row.revision,originalRevision+(outcome==='before-commit'?0:outcome==='newer-remote'?2:1));
    const storedItems=await page.evaluate(state=>window.__prepTest.checklistItems(state),row.content);
    if(kind==='checkbox')assert.equal(storedItems.find(item=>item.id===ids[0]).checked,outcome!=='before-commit');
    if(kind==='list')assert.equal(storedItems.some(item=>item.text==='응답 유실 새 항목'),outcome!=='before-commit');
    if(outcome==='newer-remote'){
      assert.equal(await page.evaluate(()=>window.__prepTest.revision()),draft?localRevision:row.revision,'A draft with older unrelated data keeps its conflict baseline');
      if(!draft)assert.equal(await page.evaluate(()=>window.__prepTest.captureState().budgetKrw),987654);
      if(kind==='list')assert.equal(await page.locator('.prepday .checklist input').last().isChecked(),true,'Verified newer completion survives list reconciliation');
    }
    assert.equal(row.content.expenses.some(e=>e.id==='unsaved-expense'),false,'Checklist writes never publish the unrelated draft');
    assert.equal(await page.evaluate(()=>window.__prepTest.captureState().expenses.some(e=>e.id==='unsaved-expense')),draft);
    assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),draft);
    if(uncertain){
      // A manual retry first reads the latest document. An already committed
      // operation completes without generating another version.
      if(outcome==='unavailable'){
        row.content.budgetKrw=765432;
        if(kind==='list')row.content.checks[row.content.checks.length-1]=true;
        row.revision++;
      }
      readUnavailable=false;
      if(kind==='checkbox')await page.locator('[data-retry-check]').click();else await page.locator('#checklistSave').click();
      if(kind==='checkbox')await page.waitForFunction(()=>window.__prepTest.pending()===0);else await page.locator('#checklistDialog').waitFor({state:'hidden'});
      assert.equal(writes.length,1);assert.equal(saveRequests,outcome==='unavailable'?1:2);
      assert.equal(await page.evaluate(()=>window.__prepTest.isDirty()),draft);
      if(kind==='list'&&outcome==='unavailable')assert.equal(await page.locator('.prepday .checklist input').last().isChecked(),true,'Retry preserves completion of a new item after an uncertain commit');
    }
    await diagnostics.close(context);
  }
  reset();
  diagnostics.scenario('offline checklist persistence');
  const context=await diagnostics.context(browser);await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/?offline');await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  await page.locator('.prepday input').first().click();await page.waitForFunction(()=>window.__prepTest.pending()===0);assert.equal(writes.length,0);
  await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));assert.equal(await page.locator('.prepday input').first().isChecked(),true);
  await page.locator('#editBtn').click();await page.locator('.checklist-text').first().fill('오프라인 문구 수정');await page.locator('#checklistSave').click();await page.locator('#checklistDialog').waitFor({state:'hidden'});
  await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));assert.equal(await page.locator('.prepday label>span').first().textContent(),'오프라인 문구 수정');assert.equal(await page.locator('.prepday input').first().isChecked(),true);
  await page.evaluate(()=>window.__prepTest.storageFailure());await page.locator('.prepday input').nth(1).click();await page.waitForFunction(()=>window.__prepTest.pending()===0);assert.equal(await page.locator('.prepday input').nth(1).isChecked(),false);
  console.log('Offline: local persistence/reload and storage failure rollback passed.');await diagnostics.close(context);
  assert.deepEqual(errors,[]);console.log('Screenshots:',output);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
