import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),output=new URL('../docs/ui-concepts/previews/daylight-comparison/',import.meta.url);
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!/^\/ui-preview\/daylight-(compare\.(html|js|css)|before\.html|after\.html|comparison\.json)$/.test(pathname)){res.writeHead(404).end();return;}
 try{const content=await readFile(new URL(pathname.slice(1),root));res.setHeader('Content-Type',pathname.endsWith('.html')?'text/html; charset=utf-8':pathname.endsWith('.css')?'text/css':'text/javascript');res.end(content);}catch(_){res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const target=process.argv[2]||`http://127.0.0.1:${server.address().port}/ui-preview/daylight-compare.html`;
const base=new URL('.',target).href,browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',serviceWorkers:'block'}),requests=[],errors=[];
 await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'daylight-')||url.startsWith('data:'))return route.continue();requests.push(url);return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>{errors.push(error.message);console.error('Page error:',error.message);});
 await page.goto(target);console.log('Loaded comparison');const ready=()=>page.locator('#status').filter({hasText:'준비가 됐습니다'}).waitFor();await ready();console.log('Both frames ready');
 const before=()=>page.frames().find(frame=>frame.url().includes('/daylight-before.html')),after=()=>page.frames().find(frame=>frame.url().includes('/daylight-after.html'));
 const config=frame=>frame.evaluate(()=>{const {tripId,cacheNamespace,...rest}=window.TRIP_CONFIG;return rest;});
 assert.deepEqual(await config(before()),await config(after()),'Both versions must have exactly the same input fixture');
 assert.notEqual(await before().evaluate(()=>window.TRIP_CONFIG.cacheNamespace),await after().evaluate(()=>window.TRIP_CONFIG.cacheNamespace));
 for(const frame of [before(),after()]){
  assert.equal(await frame.locator('script[src],#pwaRegistration').count(),0);
  assert.equal(await frame.locator('.day-radio:checked').getAttribute('id'),'d1');
 }
 await page.locator('#section').selectOption('money');
 assert.deepEqual(await before().locator('.expense-primary b').allTextContents(),await after().locator('.expense-primary b').allTextContents());
 assert.equal(await after().locator('.expense').count(),3);
 assert.equal(await before().locator('#totalConverted').innerText(),await after().locator('#totalConverted').innerText());
 await page.locator('#section').selectOption('d4');assert.equal(await before().locator('.day-radio:checked').getAttribute('id'),'d4');assert.match(await after().locator('.daylight-stay').innerText(),/다음 도시 숙소/);
 await page.locator('#schedule').selectOption('timetable');for(const frame of [before(),after()])assert.equal(await frame.locator('#timetableView').isVisible(),true);await page.locator('#schedule').selectOption('list');
 await page.locator('#theme').selectOption('dark');for(const frame of [before(),after()])assert.equal(await frame.locator('html').getAttribute('data-theme'),'dark');
 await page.locator('#theme').selectOption('light');await page.locator('#section').selectOption('prep');
 assert.equal(await after().locator('[data-check-jump]').count(),2);await before().locator('.checklist input').first().check();assert.equal(await after().locator('.checklist input').first().isChecked(),false,'Edits do not cross versions');
 await page.locator('#moment').selectOption('2027-01-24T12:00:00Z');await ready();assert.equal(await before().locator('.checklist input').first().isChecked(),true,'Moment change preserves local edit');
 assert.equal(await before().locator('#homeClock').innerText(),await after().locator('#homeClock').innerText());
 assert.equal(await before().locator('#tripProgressLabel').innerText(),await after().locator('#tripProgressLabel').innerText());
 await page.locator('#reset').click();await ready();for(const frame of [before(),after()])assert.equal(await frame.locator('.checklist input').first().isChecked(),false);
 for(const width of ['390','768','1440']){await page.locator('#viewport').selectOption(width);for(const frame of [before(),after()])assert.equal(await frame.evaluate(()=>innerWidth),Number(width),'Exact viewport width');}
 await page.locator('#viewport').selectOption('390');await page.locator('#section').selectOption('d1');for(const frame of [before(),after()])await frame.waitForFunction(()=>scrollY===0);await page.screenshot({path:fileURLToPath(new URL('side-by-side.png',output)),fullPage:true});
 await page.locator('#layout').selectOption('before');assert.equal(await page.locator('[data-side=after]').isVisible(),false);await page.locator('#layout').selectOption('after');assert.equal(await page.locator('[data-side=before]').isVisible(),false);
 await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Only the comparison region may scroll horizontally');
 assert.ok(await page.locator('#align').evaluate(el=>el.getBoundingClientRect().width)>140,'Mobile action never becomes a narrow vertical label');
 await page.screenshot({path:fileURLToPath(new URL('mobile.png',output)),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'No operating SDK, API, PWA or external media request');
 console.log('PASS comparison: identical fixture/totals, isolated edits/reset, synchronized date/theme/time, exact 390/768/1440 widths, single/pair display, no external requests');
}finally{await browser.close();server.close();}
