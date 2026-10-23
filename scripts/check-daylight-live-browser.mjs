// Shared API fixture: verify legacy and generated live Daylight writes together.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {chromium} from 'playwright';
import {fixtureConfig,readBrowserFixture,selectAppTab} from './browser-fixtures.mjs';
import {preserveDaylightMetadata} from './daylight-legacy-compat.mjs';
const root=new URL('../',import.meta.url);
const candidate=await readFile(new URL('index.html',root),'utf8');
const live=await readFile(new URL('daylight/index.html',root),'utf8');
const hash=createHash('sha256').update(candidate.replaceAll('\r\n','\n')).digest('hex').slice(0,12);
assert.ok(live.includes('name="daylight-live-source" content="'+hash+'"'),'Rebuild daylight/ after source changes');
const configAt=async path=>{const context={window:{}};runInNewContext(await readFile(new URL(path,root),'utf8'),context);return JSON.parse(JSON.stringify(context.window.TRIP_CONFIG));};
const originalConfig=await configAt('trip-config.js'),liveConfig=await configAt('daylight/trip-config.js');
assert.equal(liveConfig.tripId,originalConfig.tripId);
assert.equal(liveConfig.editorEmail,originalConfig.editorEmail);
assert.deepEqual(liveConfig.supabase,originalConfig.supabase);
assert.equal(liveConfig.cacheNamespace,originalConfig.cacheNamespace+'_daylight');
for(const file of ['pwa.js','sw.js'])assert.equal(await readFile(new URL('daylight/'+file,root),'utf8'),await readFile(new URL(file,root),'utf8'));
const legacy=preserveDaylightMetadata(execFileSync('git',['show','22ecee3:index.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6}),candidate);
let row={content:{},revision:1},writes=0;
const stub=`<script>window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:window.TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:async()=>({data:await(await fetch('/mock/doc')).json()})};return q;},rpc:(_name,args)=>({abortSignal:async signal=>(await fetch('/mock/save',{method:'POST',body:JSON.stringify(args),signal})).json()}),channel:()=>({on:()=>({subscribe:()=>{}})})})};</script>`;
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/mock/doc'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(row));return;}
  if(req.url==='/mock/save'){
   let raw='';for await(const part of req)raw+=part;const args=JSON.parse(raw);writes++;
   assert.equal(args.p_trip_id,fixtureConfig.tripId);
   if(args.p_expected_revision!==row.revision){res.end(JSON.stringify({error:{code:'40001',message:'Revision conflict'}}));return;}
   row={content:args.p_content,revision:row.revision+1,updated_at:new Date().toISOString()};res.end(JSON.stringify({data:row}));return;
  }
  const path=new URL(req.url,'http://local').pathname,isDaylight=path.startsWith('/daylight/'),name=path.replace(/^\/daylight\//,'').replace(/^\//,'')||'index.html';
  let data;
  if(name==='index.html')data=(isDaylight?live:legacy).replace(/<script id="pwaRegistration"[^>]*><\/script>/,'').replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/,stub).replace('initializeTimetable();initializeDialogAccessibility();','window.__live={captureState,buildDiff,applyState,isDirty};initializeTimetable();initializeDialogAccessibility();');
  else if(name==='trip-config.js')data='window.TRIP_CONFIG='+JSON.stringify({...fixtureConfig,cacheNamespace:fixtureConfig.cacheNamespace+(isDaylight?'_daylight':'')})+';';
  else if(/^(assets|icons)\/[\w.-]+$/.test(name))data=await readBrowserFixture(new URL(name,root));
  else {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'image/png');res.end(data);
 }catch(error){res.writeHead(500).end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const old=await context.newPage(),day=await context.newPage();for(const page of [old,day])page.on('pageerror',error=>errors.push(error.message));
 const ready=page=>page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
 await day.goto(origin+'/daylight/');await ready(day);row.content=await day.evaluate(()=>__live.captureState());
 await old.goto(origin+'/');await ready(old);
 assert.equal(await old.locator('.daylight-nav').count(),0,'Legacy UI stays intact');
 assert.equal(await day.locator('.daylight-nav').count(),1);
 assert.notEqual(await old.evaluate(()=>TRIP_CONFIG.cacheNamespace),await day.evaluate(()=>TRIP_CONFIG.cacheNamespace));
 await day.locator('#editBtn').click();await day.locator('[data-check-action=important]').first().click();await day.locator('#checklistSave').click();await day.locator('#checklistDialog').waitFor({state:'hidden'});
 const id='fixture-check-0';
 await old.reload();await ready(old);assert.equal(await old.locator(`[data-check-id="${id}"]`).getAttribute('data-check-important'),'true');
 await old.locator(`[data-check-id="${id}"] input`).check();await old.waitForFunction(()=>!document.querySelector('.checklist input:disabled'));
 assert.match(row.content.html,/data-check-important="true"/,'Legacy check preserves importance');
 await old.locator('#editBtn').click();await old.locator('.checklist-text').first().fill('기존 앱에서 수정');await old.locator('#checklistSave').click();await old.locator('#checklistDialog').waitFor({state:'hidden'});
 assert.match(row.content.html,/data-check-important="true"/,'Legacy list edit preserves importance');
 await day.reload();await ready(day);assert.equal(await day.locator(`[data-check-id="${id}"] input`).isChecked(),true);assert.match(await day.locator(`[data-check-id="${id}"]`).innerText(),/기존 앱에서 수정/);
 // Importance-only changes must stop a stale legacy list save.
 await old.locator('#editBtn').click();await day.locator('#editBtn').click();await day.locator('[data-check-action=important]').first().click();await day.locator('#checklistSave').click();await day.locator('#checklistDialog').waitFor({state:'hidden'});
 await old.locator('.checklist-text').first().fill('충돌하는 수정');await old.locator('#checklistSave').click();await old.waitForFunction(()=>document.querySelector('#checklistEditorError').textContent.includes('다른 곳'));await old.locator('#checklistCancel').click();
 assert.doesNotMatch(row.content.html,/충돌하는 수정/);
 await selectAppTab(day,'d1');await day.locator('#editBtn').click();await day.locator('.day1 [data-media=stay]').first().click();await day.locator('#stayEnabled').check();await day.locator('#stayCheckout').fill('2027-01-24');await day.locator('#stayApply').click();
 await day.locator('#editBtn').click();await day.getByRole('button',{name:'저장하고 종료',exact:true}).click();await day.waitForFunction(()=>!__live.isDirty());
 assert.match(row.content.html,/data-stay-checkout="2027-01-24"/);
 await old.reload();await ready(old);
 const differences=await old.evaluate(()=>{const state=__live.captureState(),without=structuredClone(state);without.html=without.html.replaceAll(/ data-stay-checkout="[^"]*"/g,'');return __live.buildDiff(state,without);});
 assert.match(JSON.stringify(differences),/숙박 종료일/,'Legacy import/restore comparison exposes metadata loss');
 await selectAppTab(old,'prep');await old.locator(`[data-check-id="${id}"] input`).uncheck();await old.waitForFunction(()=>!document.querySelector('.checklist input:disabled'));
 assert.match(row.content.html,/data-stay-checkout="2027-01-24"/,'Legacy check preserves stay metadata');
 assert.deepEqual(errors,[]);assert.ok(writes>=6);
 console.log('PASS live coexistence: shared revision-checked saves, isolated drafts, legacy importance/stay preservation, stale list conflicts, import differences, no live API writes.');
}finally{await browser.close();server.close();}
