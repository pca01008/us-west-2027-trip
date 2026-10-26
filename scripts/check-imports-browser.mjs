import { selectTripTab } from './browser-fixtures.mjs';
// Actual file input + application code, with a local revision-checked API only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('imports');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const legacy = JSON.parse(await readFile(new URL('tests/fixtures/import-v4.json', root), 'utf8'));
let row, saves, reads;
const stub = `<script>window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{email:window.TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:()=>{}},
  storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:location.origin+'/storage/v1/object/public/trip-media/'+path}})})},
  from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},
  rpc:(_name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),
  channel:()=>({on:()=>({subscribe:()=>{}})})
})};</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/mock/doc') { reads++; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(row)); return; }
    if (req.url === '/mock/save') {
      saves++;
      let body='';for await (const part of req) body+=part;
      const args=JSON.parse(body);
      const result=args.p_expected_revision!==row.revision ? {error:{code:'40001',message:'Revision conflict'}}
        : (row={content:args.p_content,revision:row.revision+1,updated_at:'2026-10-19T01:00:00Z'}, {data:{revision:row.revision,updated_at:row.updated_at}});
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    if (!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)) { res.writeHead(404).end();return; }
    let body=await readBrowserFixture(new URL(file,root));
    if(file==='index.html') body=source
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
      .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,stub)
      .replace('initializeTimetable();initializeDialogAccessibility();',
        'window.__importTest={captureState,normalizeState,migratePublishedState,recordHistory,flushDraftPersistence,readDraftRecord,pending:()=>pendingImport};initializeTimetable();initializeDialogAccessibility();');
    if(file==='trip-config.js') body+=`\nwindow.TRIP_CONFIG.supabase={url:'http://127.0.0.1:${server.address().port}',publishableKey:'fixture'};`;
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'image/webp');res.end(body);
  } catch(error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const errors=[];
const ready=page=>page.waitForFunction(()=>window.__importTest&&!document.body.classList.contains('hydrating'));
const state=page=>page.evaluate(()=>window.__importTest.normalizeState(window.__importTest.captureState()));
const stored=page=>page.evaluate(()=>window.__importTest.readDraftRecord());
async function upload(page, incoming, options={}) {
  const config=await page.evaluate(()=>({id:TRIP_CONFIG.tripId,version:TRIP_CONFIG.schemaVersion}));
  const json=(options.json??JSON.stringify(incoming)).replaceAll('<','\\u003c');
  const html=`<!doctype html><html data-trip-id="${options.tripId??config.id}" data-offline="${options.offline??'true'}" ${options.omitVersion?'':`data-schema-version="${options.version??config.version}"`}><body>${options.omitData?'':`<script id="offlineEmbeddedState" type="application/json">${json}</script>`}</body></html>`;
  await page.locator('#importFileInput').setInputFiles({name:'fixture.html',mimeType:'text/html',buffer:Buffer.from(html)});
}
async function apply(page) {
  await page.locator('#importApply').click();await page.locator('#importDialog').waitFor({state:'hidden'});
  await page.evaluate(()=>window.__importTest.flushDraftPersistence());
}
try {
  browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  for(const mobile of [false,true]) {
    row={content:{},revision:0,updated_at:'2026-10-19T00:00:00Z'};saves=0;reads=0;
    diagnostics.scenario(`import rejection, sanitization, migration and conflict / ${mobile ? "mobile" : "desktop"}`);
    const context=await diagnostics.context(browser, {viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    const attempted=[];
    await context.route('**/*',route=>{
      const url=route.request().url();if(url.includes('import-probe'))attempted.push(url);
      return url.startsWith(origin+'/')?route.continue():route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await ready(page);
    row={...row,content:await state(page),revision:3};await page.reload();await ready(page);
    const dateBaseline=await state(page),dateServer=structuredClone(row);
    const dateMove=await page.evaluate(state=>{
      const template=document.createElement('template');template.innerHTML=state.html;
      const row=template.content.querySelector('.day1 .timeline-row:last-child'),second=template.content.querySelector('.day2');
      second.insertBefore(row,second.querySelector('.timeline-row'));
      return {...state,html:template.innerHTML};
    },dateBaseline);
    await upload(page,dateMove);await page.locator('#importDialog').waitFor();
    assert.deepEqual(await page.locator('#importDiff li').allTextContents(),['DAY 2 일정 1 날짜: 2027-01-21 → 2027-01-22']);
    assert.equal(await page.locator('#importApply').isEnabled(),true,'A date-only move can be imported');
    await page.locator('#importCancel').click();
    assert.deepEqual(await state(page),dateBaseline,'Cancel retains the current document');
    assert.deepEqual(row,dateServer,'Comparison never publishes the date move');
    await selectTripTab(page, 'd1');await page.locator('#editBtn').click();
    await page.waitForFunction(()=>document.querySelector('.day1 .timeline-row h3').isContentEditable);
    await page.locator('.day1 .timeline-row h3').first().fill('보존해야 할 기존 초안');
    await page.evaluate(async()=>{window.__importTest.recordHistory();await window.__importTest.flushDraftPersistence();});
    const before=await state(page),draft=await stored(page),serverBefore=structuredClone(row);
    const rejected=[
      ['other trip',{tripId:'another-trip'},before,/이 여행/],
      ['not offline',{offline:'false'},before,/이 여행/],
      ['future version',{version:999},before,/더 새로운 버전/],
      ['missing version',{omitVersion:true},before,/파일 버전/],
      ['negative version',{version:-1},before,/파일 버전/],
      ['fractional version',{version:1.5},before,/파일 버전/],
      ['nonnumeric version',{version:'oops'},before,/파일 버전/],
      ['missing data',{omitData:true},before,/편집 데이터/],
      ['broken JSON',{json:'{"html":'},before,null],
      ['null data',{},null,/편집 데이터/],
      ['missing HTML',{}, {},/편집 데이터/],
      ['non-string HTML',{}, {html:42},/편집 데이터/],
      ['empty HTML',{}, {html:'   '},/편집 데이터/],
      ['future embedded version',{}, {...before,schemaVersion:999},/더 새로운 버전/],
      ['missing dual amounts',{}, {...before,expenses:[{id:'bad',amount:10,currency:'USD'}]},/복구/],
      ['damaged dual amount',{}, {...before,expenses:[{id:'bad',amountKrw:14000,amountUsd:null,amountSource:'usd',appliedExchangeRate:1400}]},/복구/],
      ['damaged legacy amount',{}, {...before,schemaVersion:5,expenses:[{id:'bad',amount:'Infinity',currency:'USD'}]},/복구/]
    ];
    for(const [name,options,incoming,message] of rejected) {
      diagnostics.scenario(`reject ${name} / ${mobile ? 'mobile' : 'desktop'}`);
      const previousReads=reads;
      await upload(page,incoming,options);await page.locator('#noticeDialog').waitFor({state:'visible'});
      assert.equal(await page.locator('#noticeTitle').textContent(),'작업본을 불러올 수 없습니다.',name);
      if(message)assert.match(await page.locator('#noticeDialog').textContent(),message,name);
      await page.getByRole('button',{name:'확인',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#importFileInput').value==='');
      assert.equal(await page.locator('#importDialog').isVisible(),false,name);
      assert.deepEqual(await state(page),before,name+' preserves visible state');
      assert.deepEqual(await stored(page),draft,name+' preserves IndexedDB draft');
      assert.deepEqual(row,serverBefore);assert.equal(saves,0);assert.equal(reads,previousReads,name+' rejected before remote comparison');
    }
    console.log(`Imports (${mobile?'mobile':'desktop'}): ${rejected.length} invalid files rejected; draft retained.`);

    diagnostics.scenario(`sanitize unsafe import / ${mobile ? 'mobile' : 'desktop'}`);
    const hostile=await page.evaluate(()=>{
      const raw=window.__importTest.captureState(),t=document.createElement('template');t.innerHTML=raw.html;
      const rows=t.content.querySelectorAll('.timeline-row'),checks=t.content.querySelectorAll('.checklist label');
      rows[1].dataset.rowId=rows[0].dataset.rowId;checks[1].dataset.checkId=checks[0].dataset.checkId;
      rows[0].querySelector('h3').textContent='정상 일정 유지';
      const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
      const photo=canvas.toDataURL('image/png');
      rows[0].querySelector('.card').insertAdjacentHTML('beforeend',`<div class="import-payload" style="color:red" onclick="window.__importExecuted=true">
        <script>window.__importExecuted=true<\/script><iframe src="https://invalid.example/import-probe-frame"></iframe><object data="https://invalid.example/import-probe-object"></object>
        <svg onload="window.__importExecuted=true"></svg><form action="https://invalid.example/import-probe-form"></form>
        <a class="safe-link" href="https://example.com/travel">정상 링크</a><a class="bad-link" href="javascript:window.__importExecuted=true">위험 링크</a><a class="bad-link" href="data:text/html,bad">데이터 링크</a>
        <img class="bad-image" src="javascript:window.__importExecuted=true" onerror="window.__importExecuted=true" data-full-url="javascript:window.__importExecuted=true">
        <div class="schedule-photos"><figure class="schedule-photo" data-photo-id="duplicate-photo"><img src="${photo}" srcset="https://invalid.example/import-probe-srcset 1x" data-full-url="${photo}" alt="정상 사진"><figcaption>사진 하나</figcaption></figure><figure class="schedule-photo" data-photo-id="duplicate-photo" data-full-path="../bad" data-thumb-path="../bad"><img src="${photo}" data-full-url="${photo}" alt="두 번째 사진"><figcaption>사진 둘</figcaption></figure></div></div>`);
      raw.schemaVersion=5;raw.html=t.innerHTML;raw.exchangeRate='not-a-number';raw.budgetKrw=-1;
      raw.expenses=[{id:'duplicate-expense',name:'정상 지출',amount:'12.5',currency:'USD'},{id:'duplicate-expense',name:'기존 지출',amount:'1',currency:'INVALID',date:'bad'}];
      return raw;
    });
    await upload(page,hostile);await page.locator('#importDialog').waitFor({state:'visible'});
    assert.deepEqual(await state(page),before,'Comparison must not apply anything');assert.deepEqual(await stored(page),draft);
    const previewIds=await page.evaluate(()=>{
      const t=document.createElement('template');t.innerHTML=window.__importTest.pending().state.html;
      return ['row','check','photo'].map(kind=>Array.from(t.content.querySelectorAll('[data-'+kind+'-id]')).map(el=>el.getAttribute('data-'+kind+'-id')));
    });
    for(const ids of previewIds)assert.equal(ids.length,new Set(ids).size,'Comparison IDs must already be unique');
    await apply(page);
    await page.locator('.bad-link').first().click();
    await page.locator('.bad-image').dispatchEvent('error');
    await page.waitForFunction(()=>document.querySelector('.import-payload .schedule-photo img').naturalWidth===2);
    const clean=await state(page);
    const inspection=await page.evaluate(()=>{
      const t=document.createElement('template');t.innerHTML=window.__importTest.normalizeState(window.__importTest.captureState()).html;
      const payload=t.content.querySelector('.import-payload');
      return {
        unsafe:payload.querySelectorAll('script,iframe,object,svg,form,[onclick],[onerror],[style],[srcset]').length,
        badLinks:Array.from(payload.querySelectorAll('.bad-link')).map(a=>a.getAttribute('href')),
        badImage:[payload.querySelector('.bad-image').getAttribute('src'),payload.querySelector('.bad-image').getAttribute('data-full-url')],
        safeLink:payload.querySelector('.safe-link').getAttribute('href'),rel:payload.querySelector('.safe-link').rel,
        photos:Array.from(payload.querySelectorAll('.schedule-photo')).map(p=>({src:p.querySelector('img').getAttribute('src'),full:p.querySelector('img').dataset.fullUrl,caption:p.querySelector('figcaption').textContent,paths:[p.dataset.fullPath,p.dataset.thumbPath]})),
        ids:['row','check','photo'].map(kind=>Array.from(t.content.querySelectorAll('[data-'+kind+'-id]')).map(el=>el.getAttribute('data-'+kind+'-id'))),
        defaults:[TRIP_CONFIG.ledger.defaultExchangeRate,TRIP_CONFIG.ledger.defaultBudgetKrw],executed:Boolean(window.__importExecuted)
      };
    });
    assert.equal(inspection.unsafe,0);assert.deepEqual(inspection.badLinks,[null,null]);assert.deepEqual(inspection.badImage,[null,null]);
    assert.equal(inspection.safeLink,'https://example.com/travel');assert.match(inspection.rel,/noopener/);
    for(const ids of inspection.ids) { assert.equal(ids.length,new Set(ids).size);assert.ok(ids.every(Boolean)); }
    assert.deepEqual(inspection.ids,previewIds,'Applying the preview must preserve its repaired IDs');
    assert.equal(inspection.photos.length,2);for(const photo of inspection.photos){assert.match(photo.src,/^data:image\/png;base64,/);assert.equal(photo.full,photo.src);assert.deepEqual(photo.paths,[undefined,undefined]);}
    assert.deepEqual(inspection.photos.map(p=>p.caption),['사진 하나','사진 둘']);
    assert.match(clean.html,/정상 일정 유지/);assert.equal(clean.exchangeRate,inspection.defaults[0]);assert.equal(clean.budgetKrw,inspection.defaults[1]);
    assert.deepEqual(clean.expenses.map(e=>e.amountUsd),[12.5,1]);assert.notEqual(clean.expenses[0].id,clean.expenses[1].id);
    assert.equal(inspection.executed,false);assert.deepEqual(attempted,[],'Unsafe media must not even issue a request');
    assert.equal(saves,0);assert.deepEqual(row,serverBefore);
    assert.deepEqual(await page.evaluate(async()=>window.__importTest.normalizeState((await window.__importTest.readDraftRecord()).state)),clean);
    console.log(`Imports (${mobile?'mobile':'desktop'}): malicious markup, duplicate IDs and invalid numbers sanitized; valid content retained.`);

    // Frozen v4 fixture: same IDs/content after repeated migration and file import.
    diagnostics.scenario(`legacy v4 migration / ${mobile ? 'mobile' : 'desktop'}`);
    const migration=await page.evaluate(raw=>{
      const api=window.__importTest,a=api.migratePublishedState(raw),b=api.migratePublishedState(raw);
      return {a,b,again:api.migratePublishedState(a)};
    },legacy);
    assert.deepEqual(migration.a,migration.b);assert.deepEqual(migration.a,migration.again);
    assert.match(migration.a.html,/legacy-row-/);assert.match(migration.a.html,/legacy-check-/);
    await upload(page,legacy,{version:4});await page.locator('#importDialog').waitFor({state:'visible'});await apply(page);
    const old=await state(page);
    const expected=await page.evaluate(raw=>window.__importTest.normalizeState(window.__importTest.migratePublishedState(raw),true),legacy);
    const identities=html=>[...html.matchAll(/data-(row|check|photo)-id="([^"]+)"/g)].map(m=>[m[1],m[2]]);
    assert.deepEqual(identities(old.html),identities(expected.html),'Import must use deterministic legacy IDs');
    for(const [kind,id] of [['row','kept-row'],['check','kept-check'],['photo','kept-photo']])assert.ok(identities(old.html).some(pair=>pair[0]===kind&&pair[1]===id),'Preserve existing '+kind+' ID');
    assert.deepEqual(old.checks,[true,false]);assert.deepEqual(old.expenses,expected.expenses);
    assert.deepEqual(old.expenses,[{id:'kept-expense',name:'예약금',amountKrw:35700,amountUsd:25.5,amountSource:'usd',appliedExchangeRate:1400,date:'2027-01-21',categoryId:'food'}]);
    for(const text of ['직접 수정한 여행 설명','직접 추가한 아침 일정','구버전 메모 보존','식당 예약','창가 자리','여권 확인','충전기 챙기기','사진 설명 보존'])assert.ok(old.html.includes(text),text);
    await upload(page,{...legacy,schemaVersion:undefined},{version:4});await page.locator('#importDialog').waitFor({state:'visible'});await apply(page);
    assert.deepEqual(await state(page),old,'Repeated import keeps IDs and content stable');
    console.log(`Imports (${mobile?'mobile':'desktop'}): v4 fixture retains content, checks and stable identities.`);

    diagnostics.scenario(`revision changed during import / ${mobile ? 'mobile' : 'desktop'}`);
    const incoming={...old,html:old.html.replace('직접 추가한 아침 일정','사용자가 확인한 새 일정')};
    const priorDraft=await stored(page);
    await upload(page,incoming);await page.locator('#importDialog').waitFor({state:'visible'});
    row={...row,revision:4,content:{...serverBefore.content,budgetKrw:7654321,exchangeRate:1555}};
    const newer=structuredClone(row);
    await page.locator('#importApply').click();
    await page.waitForFunction(()=>document.querySelector('#importSummary').textContent.includes('다시 계산'));
    assert.equal(await page.locator('#importDialog').isVisible(),true);assert.match(await page.locator('#importDiff').textContent(),/1555/);assert.doesNotMatch(await page.locator('#importDiff').textContent(),/예산|7,654,321/);
    assert.deepEqual(await state(page),old);assert.deepEqual(await stored(page),priorDraft);assert.equal(saves,0);assert.deepEqual(row,newer);
    // Canceling the refreshed comparison must also leave the draft intact.
    await page.locator('#importCancel').click();assert.deepEqual(await state(page),old);assert.deepEqual(await stored(page),priorDraft);
    await upload(page,incoming);await page.locator('#importDialog').waitFor({state:'visible'});
    row={...row,revision:5,content:{...row.content,budgetKrw:8765432}};
    await page.locator('#importApply').click();await page.waitForFunction(()=>document.querySelector('#importSummary').textContent.includes('다시 계산'));
    await apply(page);assert.equal(saves,0);assert.match((await state(page)).html,/사용자가 확인한 새 일정/);
    const importedDraft=await stored(page);assert.equal(importedDraft.baseRevision,5);assert.equal(importedDraft.baseState.budgetKrw,8765432);
    await page.locator('#editBtn').click();await page.locator('#noticeDialog').waitFor({state:'visible'});
    await page.locator('#noticeDialog').getByRole('button',{name:'저장하고 종료',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('저장 완료'));
    assert.equal(saves,1);assert.equal(row.revision,6);assert.match(row.content.html,/사용자가 확인한 새 일정/);
    assert.equal(await stored(page),null);
    console.log(`Imports (${mobile?'mobile':'desktop'}): revision change requires another confirmation; only explicit save publishes.`);
    await diagnostics.close(context);
  }
  assert.deepEqual(errors,[]);console.log('Import browser checks passed.');
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
