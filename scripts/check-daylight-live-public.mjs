// Read-only smoke check. Never log, persist or modify the shared document.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
const base=process.argv[2]||'https://pca01008.github.io/us-west-2027-trip/';
assert.ok(base.startsWith('https://')&&base.endsWith('/'));
const browser=await chromium.launch(),results=[];
try{
 for(const suffix of ['', 'daylight/']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const shared=page.waitForResponse(response=>response.url().includes('/rest/v1/trip_documents?')&&response.status()===200);
  await page.goto(base+suffix);
  const response=await shared,body=await response.json(),row=Array.isArray(body)?body[0]:body;
  assert.ok(row?.revision>0&&row.content?.html);
  await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  assert.equal(await page.locator('.daylight-nav').count(),suffix?1:0);
  assert.equal(await page.locator('.prepday .checklist input[type=checkbox]').count(),row.content.checks.length);
  assert.doesNotMatch(await page.locator('#status').innerText(),/실패|캐시 표시/);
  const config=await page.evaluate(()=>({tripId:TRIP_CONFIG.tripId,namespace:TRIP_CONFIG.cacheNamespace,supabase:TRIP_CONFIG.supabase}));
  const checks=await page.locator('.prepday .checklist input[type=checkbox]').evaluateAll(inputs=>inputs.map(input=>input.checked));
  assert.deepEqual(checks,row.content.checks);
  if(suffix){
   assert.ok(await page.locator('meta[name=daylight-live-source]').getAttribute('content'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#editBtn').click();await page.locator('#authDialog').waitFor({state:'visible'});
  }
  assert.deepEqual(errors,[]);
  results.push({path:suffix||'/',revision:row.revision,checks:checks.length,expenses:row.content.expenses?.length||0,config,digest:createHash('sha256').update(JSON.stringify(row.content)).digest('hex')});
  await context.close();
 }
 assert.equal(results[0].revision,results[1].revision,'Shared revision differs; rerun if someone saved during the check');
 assert.equal(results[0].digest,results[1].digest);
 assert.equal(results[0].config.tripId,results[1].config.tripId);
 assert.deepEqual(results[0].config.supabase,results[1].config.supabase);
 assert.notEqual(results[0].config.namespace,results[1].config.namespace);
 // A fresh anonymous context verifies both installed scopes in one browser.
 // The worker caches GET shell resources only; no credentials are supplied.
 const installed=await browser.newContext();
 await installed.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
 const pages=[];
 for(const suffix of ['', 'daylight/']){
  const page=await installed.newPage();await page.goto(base+suffix);
  await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope);
  assert.equal(scope,base+suffix);
  await page.waitForFunction(expected=>navigator.serviceWorker.controller?.scriptURL===expected,base+suffix+'sw.js');
  await page.waitForFunction(async()=>new Promise(resolve=>{
   const req=indexedDB.open(TRIP_CONFIG.cacheNamespace+'_trip_drafts');
   req.onsuccess=()=>{const db=req.result,get=db.transaction('records').objectStore('records').get('public:'+TRIP_CONFIG.tripId);get.onsuccess=()=>{resolve(Boolean(get.result?.revision));db.close();};};
  }));
  pages.push(page);
 }
 await installed.setOffline(true);
 for(const [index,page] of pages.entries()){
  await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  assert.equal(await page.locator('.daylight-nav').count(),index);
  assert.match(await page.locator('#status').innerText(),/오프라인 캐시 표시/);
  assert.equal(await page.locator('.prepday .checklist input[type=checkbox]').count(),results[index].checks);
 }
 await installed.close();
 console.log(JSON.stringify({passed:true,sites:results.map(({path,revision,checks,expenses})=>({path,revision,checks,expenses})),realWrites:0,login:'dialog only; credentials not submitted',offline:'both apps reload independently in one browser'}));
}finally{await browser.close();}
