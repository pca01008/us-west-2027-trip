import { injectBrowserFixture, injectDaylightFixture } from './browser-fixtures.mjs';
// Only loopback fixtures: prove incompatible documents cannot replace an existing draft.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fixtureConfig, readBrowserFixture } from './browser-fixtures.mjs';

const root=new URL('../',import.meta.url);
const sources=await Promise.all(['index.html','daylight/index.html'].map(file=>readFile(new URL(file,root),'utf8')));
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),daylight=url.pathname.startsWith('/daylight/');
    const file=url.pathname.replace(/^\/(?:daylight\/)?/,'')||'index.html';
    let body;
    if(file==='index.html')body=(daylight?injectDaylightFixture:injectBrowserFixture)(sources[daylight?1:0]
      .replace('data-offline="false"','data-offline="true"')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
      .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/,''), 'window.__compat={captureState,normalizeState,writeDraftRecord,readDraftRecord,clearDraftRecord,persistState};');
    else if(file==='trip-config.js')body=`window.TRIP_CONFIG=${JSON.stringify({...fixtureConfig,schemaVersion:daylight?5:6})};`;
    else if(/^(?:assets|icons)\/[\w.-]+$/.test(file))body=await readBrowserFixture(new URL(file,root));
    else {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'image/png'}).end(body);
  }catch(error){res.writeHead(500).end(error.message);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  for(const scenario of ['future-main','future-daylight','damaged-money']){
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+(scenario==='future-daylight'?'/daylight/':'/'));
    await page.waitForFunction(()=>window.__compat&&!document.body.classList.contains('hydrating'));
    const record=await page.evaluate(async scenario=>{
      const api=window.__compat,base=api.captureState(),state=structuredClone(base);
      if(scenario==='damaged-money')state.expenses=[{id:'bad',name:'손상 내역',amountKrw:14000,amountUsd:null,amountSource:'usd',appliedExchangeRate:1400}];
      else state.schemaVersion=scenario==='future-daylight'?6:999;
      const record={tripId:TRIP_CONFIG.tripId,schemaVersion:state.schemaVersion,state,baseState:base,baseRevision:1,dirty:true,savedAt:new Date().toISOString()};
      if(!await api.writeDraftRecord(record))throw new Error('Fixture draft was not stored');
      return await api.readDraftRecord();
    },scenario);
    await page.reload();await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
    assert.match(await page.locator('#status').textContent(),scenario==='damaged-money'?/지출 데이터를 읽지 못했습니다/:/앱을 새로고침/);
    const result=await page.evaluate(async()=>{
      const api=window.__compat,state=api.captureState();
      return {write:await api.writeDraftRecord({state,dirty:false}),clear:await api.clearDraftRecord(),save:await api.persistState(state),record:await api.readDraftRecord()};
    });
    assert.equal(result.write,false);assert.equal(result.clear,false);assert.equal(result.save,false);
    assert.deepEqual(result.record,record);assert.deepEqual(errors,[]);
    await context.close();console.log(`${scenario}: unsupported document refused; existing IndexedDB draft retained; write, clear and save blocked.`);
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
