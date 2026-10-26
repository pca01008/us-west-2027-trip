import { injectBrowserFixture } from './browser-fixtures.mjs';
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
const source = await readFile(process.env.IMPORTS_FIXTURE_HTML || new URL('index.html', root), 'utf8');
const legacy = JSON.parse(await readFile(new URL('tests/fixtures/import-v4.json', root), 'utf8'));
let row, saves, reads;
const readPlans=[];
function holdRead(){
  let release,start,finish;
  const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{start=resolve;}),finished=new Promise(resolve=>{finish=resolve;});
  const plan={gate,started,finished,release,start,finish};readPlans.push(plan);return plan;
}
const stub = `<script>
window.__importReads=[];
async function readImportDocument(){const read={settled:false};window.__importReads.push(read);try{return await(await fetch('/mock/doc')).json();}finally{read.settled=true;}}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{email:window.TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:()=>{}},
  storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:location.origin+'/storage/v1/object/public/trip-media/'+path}})})},
  from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await readImportDocument()})};return q;},
  rpc:(_name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),
  channel:()=>({on:()=>({subscribe:()=>{}})})
})};</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/mock/doc') { reads++;const plan=readPlans.shift();if(plan){plan.start();await plan.gate;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(row));plan?.finish();return; }
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
    if(file==='index.html') body=injectBrowserFixture(source
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
      .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,stub), 'window.__importTest={captureState,normalizeState,stateSummary,buildDiff,embedPhotos,migratePublishedState,applyImportSnapshot,applyImportedDraft,recordHistory,moveHistory,flushDraftPersistence,readDraftRecord,handleExternalSignOut,setEditorSession,snapshot:()=>documentSession.snapshot(),isApplying:()=>documentAdapter.isApplying(),pending:()=>pendingImportSnapshot()};');
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
async function finishRead(page,plan){
  plan.release();await plan.finished;
  await page.waitForFunction(()=>window.__importReads.every(read=>read.settled));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
try {
  browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  for(const mobile of [false,true]){
    row={content:{},revision:0,updated_at:'2026-10-26T00:00:00Z'};saves=0;reads=0;
    diagnostics.scenario(`photo resource comparison and import / ${mobile?'mobile':'desktop'}`);
    const context=await diagnostics.context(browser,{viewport:{width:mobile?390:1280,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await ready(page);
    row={...row,content:await state(page),revision:3};
    const baseline=structuredClone(row),initial=await state(page);
    const embedded=await page.evaluate(async snapshot=>(await window.__importTest.embedPhotos(snapshot)).state,initial);
    await upload(page,embedded);await page.locator('#importDialog').waitFor();
    assert.deepEqual(await page.locator('#importDiff li').allTextContents(),[],'Unchanged asset photos survive actual offline embedding');
    assert.equal(await page.locator('#importApply').isEnabled(),false);
    await page.locator('#importCancel').click();
    const incoming=await page.evaluate(async snapshot=>{
      const api=window.__importTest;
      const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
      const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,2,2);const original=canvas.toDataURL('image/png');
      ctx.fillStyle='blue';ctx.fillRect(0,0,2,2);const replacement=canvas.toDataURL('image/png');
      const hash=async value=>{const bytes=Uint8Array.from(atob(value.split(',')[1]),c=>c.charCodeAt(0));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');};
      const path=TRIP_CONFIG.tripId+'/photos/'+await hash(original)+'.png';
      const url=TRIP_CONFIG.supabase.url+'/storage/v1/object/public/trip-media/'+path;
      const change=(base,full,thumb=full)=>{const template=document.createElement('template');template.innerHTML=base.html;const img=template.content.querySelector('.schedule-photo img');img.src=thumb;img.dataset.fullUrl=full;return {...base,html:template.innerHTML};};
      const remote=change(snapshot,url),offline=change(snapshot,original);
      if(api.buildDiff(remote,offline).length)throw Error('Same bytes in Storage and old embedded exports must compare equal');
      if(api.buildDiff(remote,change(snapshot,url+'?download=1#image')).length)throw Error('Equivalent Storage URLs must compare equal');
      const withPath=(base,path)=>{const template=document.createElement('template');template.innerHTML=base.html;template.content.querySelector('.schedule-photo').dataset.fullPath=path;return {...base,html:template.innerHTML};};
      if(api.buildDiff(remote,withPath(remote,path)).length)throw Error('Matching stored paths and image URLs must compare equal');
      if(!api.buildDiff(remote,withPath(remote,TRIP_CONFIG.tripId+'/photos/'+await hash(replacement)+'.png')).length)throw Error('A changed stored path must remain visible');
      if(api.buildDiff(offline,change(snapshot,original.replace('base64,','base64,\n'))).length)throw Error('Equivalent base64 embedding must compare equal');
      for(const changed of [change(snapshot,replacement,original),change(snapshot,original,replacement)]){
        const changes=api.buildDiff(offline,changed).flatMap(group=>group.items);
        if(changes.length!==1||!changes[0].endsWith('사진 이미지 변경')||changes[0].includes('data:'))throw Error('Full/thumbnail replacement must have a concise image change');
      }
      return change(snapshot,replacement);
    },initial);
    await upload(page,incoming);await page.locator('#importDialog').waitFor();
    assert.deepEqual(await page.locator('#importDiff li').allTextContents(),['DAY 1 일정 3 사진 이미지 변경']);
    assert.equal(await page.locator('#importApply').isEnabled(),true,'Image-only replacement must enable Apply');
    await apply(page);
    const applied=await state(page),draft=await stored(page);
    assert.deepEqual(await page.evaluate(({a,b})=>window.__importTest.buildDiff(a,b),{a:incoming,b:applied}),[]);
    assert.ok(draft?.state.html.includes('data:image/png;base64,'),'The changed photo is retained in the durable draft');
    assert.equal(saves,0);assert.deepEqual(row,baseline,'Import never writes the shared document');
    assert.equal(await page.locator('.schedule-photo').first().getAttribute('data-photo-id'),'fixture-photo');
    assert.equal(await page.locator('.schedule-photo figcaption').first().textContent(),'테스트 사진');
    console.log(`Photo comparison (${mobile?'mobile':'desktop'}): replacement applied; unchanged embedded photos and URL variants remain equal.`);
    await diagnostics.close(context);
  }
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
    row={...row,content:{...await state(page),expenses:[{id:'retained-expense',name:'보존할 경비',amountKrw:14500,amountUsd:10,amountSource:'usd',appliedExchangeRate:1450,date:'2027-01-21',categoryId:'food'}]},revision:3};await page.reload();await ready(page);
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
    let before=await state(page);
    const draft=await stored(page),serverBefore=structuredClone(row);
    const sessionBefore=await page.evaluate(()=>window.__importTest.snapshot());
    const incomingCanceled={...before,html:before.html.replace('보존해야 할 기존 초안','취소할 가져오기')};
    async function assertImportRetained(){
      assert.deepEqual(await state(page),before,'Canceled import retains the visible draft');
      assert.deepEqual(await stored(page),draft,'Canceled import retains the durable draft');
      assert.deepEqual(await page.evaluate(()=>window.__importTest.snapshot()),sessionBefore,'Canceled import retains baseline and history');
      assert.equal(await page.locator('#noticeDialog').isVisible(),false,'Canceled work cannot open a late error');
      assert.equal(saves,0);assert.deepEqual(row,serverBefore);
    }
    for(const action of ['Cancel','Escape']){
      diagnostics.scenario(`in-flight import ${action} / ${mobile?'mobile':'desktop'}`);
      await upload(page,incomingCanceled);await page.locator('#importDialog').waitFor({state:'visible'});
      const plan=holdRead();await page.locator('#importApply').click();await plan.started;
      assert.equal(await page.locator('#importApply').isDisabled(),true,'Apply is disabled immediately');
      // Invoke the handler again as well as checking the disabled browser control.
      const readCount=reads;await page.evaluate(()=>window.__importTest.applyImportedDraft());
      assert.equal(reads,readCount,'Duplicate Apply cannot start another read');
      if(action==='Cancel')await page.locator('#importCancel').click();else await page.keyboard.press('Escape');
      await page.locator('#importDialog').waitFor({state:'hidden'});
      await finishRead(page,plan);await assertImportRetained();
      assert.equal(await page.evaluate(()=>window.__importTest.pending()),null);
    }
    diagnostics.scenario(`selection replaces in-flight Apply / ${mobile?'mobile':'desktop'}`);
    await upload(page,incomingCanceled);await page.locator('#importDialog').waitFor({state:'visible'});
    const replaced=holdRead();await page.locator('#importApply').click();await replaced.started;
    const replacement={...before,html:before.html.replace('보존해야 할 기존 초안','새로 선택한 가져오기')};
    await upload(page,replacement);await page.waitForFunction(()=>window.__importTest.pending()?.state.html.includes('새로 선택한 가져오기'));
    await finishRead(page,replaced);
    assert.equal(await page.locator('#importDialog').isVisible(),true);
    assert.equal(await page.locator('#importApply').isEnabled(),true);
    assert.match(await page.locator('#importDiff').textContent(),/새로 선택한 가져오기/);
    await page.locator('#importCancel').click();await assertImportRetained();

    diagnostics.scenario(`reversed file comparison reads / ${mobile?'mobile':'desktop'}`);
    const olderFile=holdRead();await upload(page,incomingCanceled);await olderFile.started;
    await upload(page,replacement);await page.waitForFunction(()=>window.__importTest.pending()?.state.html.includes('새로 선택한 가져오기'));
    await finishRead(page,olderFile);
    assert.match(await page.locator('#importDiff').textContent(),/새로 선택한 가져오기/);
    await page.locator('#importCancel').click();await assertImportRetained();

    diagnostics.scenario(`session loss during Apply / ${mobile?'mobile':'desktop'}`);
    await upload(page,incomingCanceled);await page.locator('#importDialog').waitFor({state:'visible'});
    const signedOut=holdRead();await page.locator('#importApply').click();await signedOut.started;
    await page.evaluate(()=>window.__importTest.setEditorSession(null));
    await page.locator('#importDialog').waitFor({state:'hidden'});await finishRead(page,signedOut);
    await assertImportRetained();
    await page.evaluate(()=>window.__importTest.setEditorSession({user:{email:TRIP_CONFIG.editorEmail}}));
    console.log(`Imports (${mobile?'mobile':'desktop'}): Cancel/Escape, replacement, reversed reads, session loss and duplicate Apply retain the draft.`);
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
    const malformed=await page.evaluate(raw=>{
      const mutations=[
        ['missing ledger',t=>t.content.querySelector('.moneyday').remove()],
        ['missing PREP',t=>t.content.querySelector('.prepday').remove()],
        ['missing day',t=>t.content.querySelector('.day2').remove()],
        ['duplicate day',t=>t.content.append(t.content.querySelector('.day2').cloneNode(true))],
        ['duplicate ledger',t=>t.content.append(t.content.querySelector('.moneyday').cloneNode(true))],
        ['wrong day class',t=>t.content.querySelector('.day2').classList.replace('day2','day99')],
        ['conflicting day classes',t=>t.content.querySelector('.day2').classList.add('day3')],
        ['missing panel class',t=>t.content.querySelector('.day2').classList.remove('panel')],
        ['nested day',t=>t.content.querySelector('.day1').append(t.content.querySelector('.day2'))],
        ['missing day heading',t=>t.content.querySelector('.day2 .day-head h2').remove()],
        ['missing day subtitle',t=>t.content.querySelector('.day2 .day-head p').remove()],
        ['missing checklist',t=>t.content.querySelector('.prepday .checklist').remove()],
        ['missing checkbox',t=>t.content.querySelector('.prepday .checklist label input').remove()],
        ['missing time',t=>t.content.querySelector('.day1 .timeline-row .time').remove()],
        ['missing card',t=>t.content.querySelector('.day1 .timeline-row .card').remove()],
        ['missing title',t=>t.content.querySelector('.day1 .timeline-row h3').remove()],
        ['missing remark',t=>t.content.querySelector('.day1 .timeline-row .remark').remove()],
        ['missing photo image',t=>t.content.querySelector('.schedule-photo img').remove()]
      ];
      return mutations.map(([name,mutate])=>{const t=document.createElement('template');t.innerHTML=raw.html;mutate(t);return [name,{...raw,html:t.innerHTML}];});
    },before);
    rejected.push(['paragraph only',{}, {...before,html:'<p>Incomplete document</p>'},/필수 화면 구조/]);
    rejected.push(...malformed.map(([name,incoming])=>[name,{},incoming,/필수 화면 구조/]));
    for(const [name,options,incoming,message] of rejected) {
      diagnostics.scenario(`reject ${name} / ${mobile ? 'mobile' : 'desktop'}`);
      const previousReads=reads;
      await upload(page,incoming,options);
      await Promise.race([page.locator('#noticeDialog').waitFor({state:'visible'}),page.locator('#importDialog').waitFor({state:'visible'})]);
      assert.equal(await page.locator('#noticeDialog').isVisible(),true,name+' must be rejected before comparison');
      assert.equal(await page.locator('#noticeTitle').textContent(),'작업본을 불러올 수 없습니다.',name);
      if(message)assert.match(await page.locator('#noticeDialog').textContent(),message,name);
      await page.getByRole('button',{name:'확인',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#importFileInput').value==='');
      assert.equal(await page.locator('#importDialog').isVisible(),false,name);
      assert.deepEqual(await state(page),before,name+' preserves visible state');
      assert.deepEqual(await stored(page),draft,name+' preserves IndexedDB draft');
      assert.deepEqual(await page.evaluate(()=>window.__importTest.snapshot()),sessionBefore,name+' preserves baseline and history');
      assert.equal(await page.evaluate(()=>window.__importTest.isApplying()),false,name+' leaves editing available');
      assert.deepEqual(row,serverBefore);assert.equal(saves,0);assert.equal(reads,previousReads,name+' rejected before remote comparison');
    }
    console.log(`Imports (${mobile?'mobile':'desktop'}): ${rejected.length} invalid files rejected; draft retained.`);

    const applyError=await page.evaluate(state=>{
      try{window.__importTest.applyImportSnapshot({...state,html:'<p>Invalid at application boundary</p>'},state,99,'bad time');}
      catch(error){return error.message;}
    },before);
    assert.match(applyError,/필수 화면 구조/,'Application revalidates even if file validation is bypassed');
    assert.deepEqual(await state(page),before);
    assert.deepEqual(await stored(page),draft);
    assert.deepEqual(await page.evaluate(()=>window.__importTest.snapshot()),sessionBefore);
    assert.equal(await page.evaluate(()=>window.__importTest.isApplying()),false);

    diagnostics.scenario(`render failure rollback and retry / ${mobile ? 'mobile' : 'desktop'}`);
    const renderFailure={...before,html:before.html.replace('보존해야 할 기존 초안','렌더링 실패 시험'),expenses:[],exchangeRate:1600};
    await upload(page,renderFailure);await page.locator('#importDialog').waitFor({state:'visible'});
    await page.evaluate(()=>{
      document.querySelector('#expenseName').value='아직 추가하지 않은 항목';
      document.querySelector('#expenseKrw').value='2500';
      document.querySelector('#expenseKrw').dispatchEvent(new Event('input',{bubbles:true}));
      window.__retainedMainNodes=Array.from(document.querySelector('main').childNodes);
      const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
      Object.defineProperty(Node.prototype,'textContent',{...descriptor,set(value){
        if(this.id==='totalKrw'){Object.defineProperty(Node.prototype,'textContent',descriptor);throw new Error('Forced import render failure');}
        descriptor.set.call(this,value);
      }});
    });
    await page.locator('#importApply').click();await page.locator('#noticeDialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#noticeTitle').textContent(),'편집본 적용 실패');
    assert.match(await page.locator('#noticeDialog').textContent(),/Forced import render failure/,'The fault must occur during rendering');
    await page.getByRole('button',{name:'확인',exact:true}).click();
    assert.deepEqual(await state(page),before,'Render failure restores document and ledger');
    assert.deepEqual(await stored(page),draft,'Render failure retains the stored draft');
    assert.deepEqual(await page.evaluate(()=>window.__importTest.snapshot()),sessionBefore,'Render failure retains baseline, revision, dirty state and history');
    assert.equal(await page.evaluate(()=>window.__importTest.isApplying()),false);
    assert.equal(await page.evaluate(()=>window.__retainedMainNodes.every((node,index)=>document.querySelector('main').childNodes[index]===node)),true,'Rollback restores original nodes');
    assert.equal(await page.locator('#expenseName').inputValue(),'아직 추가하지 않은 항목');
    assert.equal(await page.locator('#expenseKrw').inputValue(),'2500');
    assert.deepEqual(row,serverBefore);assert.equal(saves,0);
    await page.locator('#importCancel').click();
    await page.evaluate(()=>window.__importTest.moveHistory(-1));
    assert.match((await state(page)).html,/일정 1-1/,'Undo still works after rejection');
    await page.evaluate(()=>window.__importTest.moveHistory(1));
    assert.deepEqual(await state(page),before,'Redo recovers the retained draft');
    await page.evaluate(async()=>{document.querySelector('#expenseName').value='';document.querySelector('#expenseKrw').value='';document.querySelector('#expenseKrw').dispatchEvent(new Event('input',{bubbles:true}));await window.__importTest.flushDraftPersistence();});
    // Retry the same file after the fault is gone, then recover the prior draft through import.
    await upload(page,renderFailure);await page.locator('#importDialog').waitFor({state:'visible'});await apply(page);
    assert.match((await state(page)).html,/렌더링 실패 시험/);
    await upload(page,before);await page.locator('#importDialog').waitFor({state:'visible'});await apply(page);
    const recovered=await state(page);
    const summaries=await page.evaluate(({a,b})=>[window.__importTest.stateSummary(a),window.__importTest.stateSummary(b)],{a:recovered,b:before});
    assert.deepEqual(summaries[0],summaries[1],'A valid import recovers the same content after rollback');
    assert.deepEqual({...recovered,html:''},{...before,html:''},'A valid import recovers the same ledger and checks');
    before=recovered;
    const retainedDraft=await stored(page);

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
      t.content.querySelector('.moneyday').replaceChildren();
      raw.schemaVersion=5;raw.html=t.innerHTML;raw.exchangeRate='not-a-number';raw.budgetKrw=-1;
      raw.expenses=[{id:'duplicate-expense',name:'정상 지출',amount:'12.5',currency:'USD'},{id:'duplicate-expense',name:'기존 지출',amount:'1',currency:'INVALID',date:'bad'}];
      return raw;
    });
    await upload(page,hostile);await page.locator('#importDialog').waitFor({state:'visible'});
    assert.deepEqual(await state(page),before,'Comparison must not apply anything');assert.deepEqual(await stored(page),retainedDraft);
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
    assert.equal(await page.locator('main .panel.day').count(),13,'Legacy omitted days receive empty usable shells');
    assert.equal(await page.locator('.day2 .timeline-row').count(),0,'Legacy repair must not invent default events');
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
