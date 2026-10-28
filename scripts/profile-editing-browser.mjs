// Optional measurement, not a timing gate. Synthetic offline trip; no production requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { injectBrowserFixture, readBrowserFixture, selectTripTab } from './browser-fixtures.mjs';

const root=new URL('../',import.meta.url),errors=[],outbound=[];
const source=await readFile(new URL('index.html',root),'utf8');
const html=injectBrowserFixture(source.replace('data-offline="false"','data-offline="true"')
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
  .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/,''),
  `window.__profile={captureState,fingerprint,flushDraftPersistence,readDraftRecord,recordHistory,moveHistory,
    cancelHistory:()=>documentSession.cancelHistory(),
    baseline:()=>{applyState(captureState());documentSession.establishBaseline(normalizeState(captureState()));initializeHistory();updateDirtyState();},
    historyLength:()=>documentSession.snapshot().historyLength};`);
const server=createServer(async(req,res)=>{
  try{
    const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    if(!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(file))return res.writeHead(404).end();
    const content=file==='index.html'?html:await readBrowserFixture(new URL(file,root));
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.woff2')?'font/woff2':'image/png'}).end(content);
  }catch(error){errors.push(error.message);res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,results=[];
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const cpuRate of [1,4])for(const photoCount of [0,8]){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',route=>{if(route.request().url().startsWith(origin)||route.request().url().startsWith('data:'))return route.continue();outbound.push(route.request().url());return route.abort();});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>window.__profile&&!document.body.classList.contains('hydrating'));
    await selectTripTab(page,'d1');await page.locator('#editBtn').click();
    const fixture=await page.evaluate(photoCount=>{
      document.querySelectorAll('.schedule-gallery').forEach(element=>element.remove());
      // Deterministic noisy 1600x1000 JPEGs approximate compressed photo byte cost.
      const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);let seed=42;
      for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}
      ctx.putImageData(pixels,0,0);
      const full=canvas.toDataURL('image/jpeg',.7),thumbCanvas=document.createElement('canvas');thumbCanvas.width=480;thumbCanvas.height=300;
      thumbCanvas.getContext('2d').drawImage(canvas,0,0,480,300);const thumb=thumbCanvas.toDataURL('image/jpeg',.76);
      const rows=Array.from(document.querySelectorAll('.timeline-row'));
      for(let i=0;i<photoCount;i++){
        const figure=document.createElement('figure');figure.className='schedule-photo';figure.dataset.photoId='profile-'+i;figure.dataset.staged='true';
        const img=document.createElement('img');img.alt='Synthetic photo '+i;img.src=thumb;img.dataset.fullUrl=full;
        const caption=document.createElement('figcaption');caption.textContent=img.alt;figure.append(img,caption);
        const gallery=document.createElement('div');gallery.className='schedule-gallery';gallery.append(figure);rows[i%rows.length].querySelector('.card').append(gallery);
      }
      window.__profile.baseline();
      return {events:rows.length,photos:photoCount,fullJpegBytes:Math.floor((full.length-full.indexOf(',')-1)*3/4),thumbnailBytes:Math.floor((thumb.length-thumb.indexOf(',')-1)*3/4),stateBytes:new Blob([JSON.stringify(window.__profile.captureState())]).size};
    },photoCount);
    const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
    const measured=await page.evaluate(async()=>{
      const api=window.__profile,title=document.querySelector('.day1 h3'),samples={capture:[],fingerprint:[],inputHandler:[],persist:[],history:[],undo:[],redo:[]};
      const measure=(key,fn)=>{const start=performance.now(),result=fn();samples[key].push(performance.now()-start);return result;};
      measure('capture',()=>api.captureState()); // Retain warm-up separately from five measured samples.
      samples.capture=[];
      for(let i=0;i<5;i++){
        const state=measure('capture',()=>api.captureState());measure('fingerprint',()=>api.fingerprint(state));
        title.textContent='Measured edit '+i;
        measure('inputHandler',()=>title.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:String(i)})));
        api.cancelHistory();
        const start=performance.now();if(!await api.flushDraftPersistence())throw Error('Draft persistence failed');samples.persist.push(performance.now()-start);
        const draft=await api.readDraftRecord();if(!draft?.state.html.includes('Measured edit '+i))throw Error('Draft content mismatch');
        measure('history',()=>api.recordHistory());
      }
      measure('undo',()=>api.moveHistory(-1));if(!document.querySelector('.day1 h3').textContent.includes('Measured edit 3'))throw Error('Undo mismatch');
      measure('redo',()=>api.moveHistory(1));if(!document.querySelector('.day1 h3').textContent.includes('Measured edit 4'))throw Error('Redo mismatch');
      if(!await api.flushDraftPersistence())throw Error('Final draft persistence failed');
      const summary=Object.fromEntries(Object.entries(samples).map(([key,values])=>{const sorted=[...values].sort((a,b)=>a-b);return [key,{samples:values.map(v=>+v.toFixed(1)),medianMs:+sorted[Math.floor(sorted.length/2)].toFixed(1),maxMs:+Math.max(...values).toFixed(1)}];}));
      return {summary,historySnapshots:api.historyLength()};
    });
    results.push({viewport:'390x844',cpuRate,...fixture,...measured});
    console.log(`Measured CPU ${cpuRate}x / ${photoCount} photos / ${(fixture.stateBytes/1024/1024).toFixed(2)} MiB`);
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  const result={recordedAt:new Date().toISOString(),sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,browser:browser.version(),scope:'Windows Chromium synthetic byte-cost baseline; CPU throttling and mobile viewport are not physical-phone evidence. Five samples, no timing thresholds or optimization.',results};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
