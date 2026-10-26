// Real version controls against synthetic, gated local HTTP reads only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('versions');
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const source = await readFile(process.env.VERSIONS_FIXTURE_HTML || new URL('index.html', root), 'utf8');
const output = await mkdtemp(path.join(tmpdir(), 'westbound-versions-'));
const plans = new Map();
let versions = [], writes = 0;
function plan(url, { held = false, status = 200, data } = {}) {
  let release, start, finish;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { start = resolve; });
  const finished = new Promise(resolve => { finish = resolve; });
  const item = { gate, release, started, start, finished, finish, status, data };
  if (!held) release();
  plans.set(url, [...(plans.get(url) || []), item]);
  return item;
}
const stub = `<script>
window.__versionReads=[];window.__ignoreVersionAbort=true;
async function versionRead(url,signal){
  const read={url,aborted:false,settled:false};window.__versionReads.push(read);
  signal?.addEventListener('abort',()=>read.aborted=true,{once:true});
  try{const response=await fetch(url,{signal:window.__ignoreVersionAbort?undefined:signal});if(!response.ok)throw new Error('Fixture HTTP '+response.status);return {data:await response.json()};}
  finally{read.settled=true;}
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{email:TRIP_CONFIG.editorEmail}}}}),onAuthStateChange:callback=>{window.__signOut=()=>callback('SIGNED_OUT',null);},signOut:async()=>({})},
  storage:{from:()=>({getPublicUrl:key=>({data:{publicUrl:location.origin+'/assets/fixture.png'}})})},
  from:table=>{let id,signal;const q={select:()=>q,eq:(key,value)=>{if(key==='id')id=value;return q;},order:()=>q,abortSignal:value=>{signal=value;return q;},
    maybeSingle:async()=>({data:{content:{},revision:0}}),limit:()=>versionRead('/mock/versions',signal),single:()=>versionRead('/mock/version/'+id,signal)};return q;},
  channel:()=>({on:()=>({subscribe:()=>{}})})
})};</script>`;
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { writes++; res.writeHead(405).end(); return; }
    if (req.url.startsWith('/mock/')) {
      const item = plans.get(req.url)?.shift();
      if (item) { item.start(); await item.gate; }
      const data = item?.data ?? (req.url === '/mock/versions'
        ? versions.map(({content, ...metadata}) => metadata)
        : {content:versions.find(version => String(version.id) === req.url.split('/').at(-1))?.content});
      res.writeHead(item?.status || 200, {'Content-Type':'application/json'}).end(JSON.stringify(data));
      item?.finish(); return;
    }
    const url = new URL(req.url, 'http://localhost');
    const file = url.pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
    let body = await readBrowserFixture(new URL(file, root));
    if (file === 'index.html') {
      body = source.replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
        .replace(/<script src="[^"]*supabase[^"]*"[^>]*><\/script>/, stub)
        .replace('initializeTimetable();initializeDialogAccessibility();',
          'const originalVersionFlush=flushDraftPersistence;flushDraftPersistence=async(...args)=>{const result=await originalVersionFlush(...args);await window.__versionDraftGate?.();return result;};window.__versionTest={captureState,normalizeState};initializeTimetable();initializeDialogAccessibility();');
      if (url.searchParams.has('fastTimeout')) body = body.replace("다시 시도해 주세요.')),8000)", "다시 시도해 주세요.')),150)");
    }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
    res.end(body);
  } catch (error) { res.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
async function fixture(mobile, fast = false) {
  const context = await diagnostics.context(browser, { viewport:{width:mobile?390:1280,height:900}, isMobile:mobile, hasTouch:mobile, reducedMotion:'reduce' });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  await page.goto(origin + (fast ? '/?fastTimeout' : '/'));
  await page.waitForFunction(() => window.__versionTest && !document.body.classList.contains('hydrating') && document.body.classList.contains('authenticated'));
  const state = await page.evaluate(() => window.__versionTest.normalizeState(window.__versionTest.captureState()));
  versions = [1,2].map(id => ({id,note:'Fixture '+id,created_at:'2026-10-25T00:00:00Z',content_size:100,content:{...structuredClone(state),html:state.html.replace('일정 1-1','Historical '+id)}}));
  return {context,page,state};
}
async function open(page) {
  await page.locator('#versionsBtn').click();
  await page.locator('.version-item').nth(1).waitFor();
}
const choose = (page, id, action) => page.locator('.version-item').nth(id-1).getByRole('button', {name:action,exact:true}).click();
async function finish(page, item) {
  item.release(); await item.finished;
  await page.waitForFunction(() => window.__versionReads.every(read => read.settled));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function inactive(page, state) {
  assert.equal(await page.locator('#versionCompareDialog').isVisible(), false);
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('previewing')), false);
  assert.deepEqual(await page.evaluate(() => window.__versionTest.normalizeState(window.__versionTest.captureState())), state);
}
try {
  browser = await chromium.launch({headless:true,...(process.env.PWA_BROWSER_CHANNEL?{channel:process.env.PWA_BROWSER_CHANNEL}:{})});
  for (const mobile of [false,true]) {
    for (const action of ['비교','미리보기']) for (const close of ['button','escape']) {
      diagnostics.scenario(`${action}: close via ${close} / ${mobile?'mobile':'desktop'}`);
      const {context,page,state} = await fixture(mobile); await open(page);
      const pending = plan('/mock/version/1',{held:true}); await choose(page,1,action); await pending.started;
      if (close === 'button') await page.locator('#closeVersionsBtn').click(); else await page.keyboard.press('Escape');
      await finish(page,pending); await inactive(page,state);
      assert.equal(await page.locator('#versionDialog').isVisible(),false);
      assert.equal(await page.evaluate(() => window.__versionReads.at(-1).aborted),true);
      // Reopening must remain usable after cancellation.
      await open(page); await choose(page,2,'비교'); await page.locator('#versionCompareDialog').waitFor();
      assert.equal(await page.locator('#versionCompareTitle').textContent(),'버전 #2 차이');
      await diagnostics.close(context);
    }
    for (const first of ['비교','미리보기']) for (const second of ['비교','미리보기']) {
      diagnostics.scenario(`reversed responses ${first} → ${second} / ${mobile?'mobile':'desktop'}`);
      const {context,page} = await fixture(mobile); await open(page);
      const old = plan('/mock/version/1',{held:true}); await choose(page,1,first); await old.started;
      await choose(page,2,second);
      if (second === '비교') await page.locator('#versionCompareDialog').waitFor();
      else await page.waitForFunction(() => document.body.classList.contains('previewing'));
      await finish(page,old);
      assert.equal(await page.locator('#versionCompareDialog').isVisible(),second==='비교');
      if (second === '비교') assert.equal(await page.locator('#versionCompareTitle').textContent(),'버전 #2 차이');
      else {
        assert.match(await page.locator('#previewLabel').textContent(),/버전 #2/);
        assert.match(await page.locator('.day1 h3').first().textContent(),/Historical 2/);
        await page.locator('#closePreviewBtn').click();
      }
      await diagnostics.close(context);
    }
    for (const action of ['비교','미리보기','list']) {
      diagnostics.scenario(`sign-out during ${action} / ${mobile?'mobile':'desktop'}`);
      const {context,page,state} = await fixture(mobile);
      if (action !== 'list') await open(page);
      const pending = plan(action==='list'?'/mock/versions':'/mock/version/1',{held:true});
      if (action === 'list') await page.locator('#versionsBtn').click(); else await choose(page,1,action);
      await pending.started; await page.evaluate(() => window.__signOut());
      await page.waitForFunction(() => !document.body.classList.contains('authenticated'));
      await finish(page,pending); await inactive(page,state);
      assert.equal(await page.locator('#versionDialog').isVisible(),false);
      await diagnostics.close(context);
    }
    diagnostics.scenario(`closed/reopened list ignores old metadata / ${mobile?'mobile':'desktop'}`);
    {
      const {context,page} = await fixture(mobile);
      const old = plan('/mock/versions',{held:true,data:[{id:99,note:'Stale list'}]});
      await page.locator('#versionsBtn').click(); await old.started;
      await page.locator('#closeVersionsBtn').click(); await open(page); await finish(page,old);
      assert.equal(await page.locator('.version-item').count(),2);
      assert.doesNotMatch(await page.locator('#versionList').textContent(),/Stale list/);
      await diagnostics.close(context);
    }
    for (const boundary of ['close','new selection','sign-out']) {
      diagnostics.scenario(`preview interrupted during draft persistence: ${boundary} / ${mobile?'mobile':'desktop'}`);
      const {context,page,state} = await fixture(mobile); await open(page);
      await page.evaluate(()=>{
        window.__versionDraftGate=()=>new Promise(resolve=>{window.__releaseVersionDraft=resolve;window.__versionDraftEntered=true;});
      });
      await choose(page,1,'미리보기');
      await page.waitForFunction(()=>window.__versionDraftEntered);
      if(boundary==='close')await page.locator('#closeVersionsBtn').click();
      else if(boundary==='new selection'){await choose(page,2,'비교');await page.locator('#versionCompareDialog').waitFor();}
      else {await page.evaluate(()=>window.__signOut());await page.waitForFunction(()=>!document.body.classList.contains('authenticated'));}
      await page.evaluate(async()=>{window.__versionDraftGate=null;window.__releaseVersionDraft();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      if(boundary==='new selection'){
        assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('previewing')),false);
        assert.equal(await page.locator('#versionCompareTitle').textContent(),'버전 #2 차이');
      }else await inactive(page,state);
      await diagnostics.close(context);
    }
    for (const action of ['비교','미리보기','list']) for (const transport of ['ignores abort','honors abort']) {
      diagnostics.scenario(`stalled ${action}, ${transport} / ${mobile?'mobile':'desktop'}`);
      const {context,page,state} = await fixture(mobile,true);
      if (transport === 'honors abort') await page.evaluate(() => window.__ignoreVersionAbort=false);
      if (action !== 'list') await open(page);
      const pending = plan(action==='list'?'/mock/versions':'/mock/version/1',{held:true});
      if (action === 'list') await page.locator('#versionsBtn').click(); else await choose(page,1,action);
      await pending.started;
      await page.waitForFunction(() => document.querySelector('#versionLoadStatus').textContent.includes('시간이 초과'));
      assert.equal(await page.locator('#versionLoadStatus').isVisible(),true);
      await page.screenshot({path:path.join(output,`${mobile?'mobile':'desktop'}-${action==='list'?'list':'content'}-timeout.png`)});
      await inactive(page,state); await finish(page,pending); await inactive(page,state);
      // Retry uses the same control; a late response must not populate its cache.
      const readsBeforeRetry=await page.evaluate(()=>window.__versionReads.length);
      if (action === 'list') { await page.locator('#closeVersionsBtn').click(); await open(page); }
      else { await choose(page,1,action); if(action==='비교')await page.locator('#versionCompareDialog').waitFor();else await page.waitForFunction(()=>document.body.classList.contains('previewing')); }
      assert.equal(await page.evaluate(()=>window.__versionReads.length),readsBeforeRetry+1);
      assert.equal(await page.locator('#versionLoadStatus').isVisible(),false);
      await diagnostics.close(context);
    }
    diagnostics.scenario(`HTTP failure shown inside versions and retry / ${mobile?'mobile':'desktop'}`);
    {
      const {context,page} = await fixture(mobile); await open(page);
      plan('/mock/version/1',{status:503}); await choose(page,1,'비교');
      await page.waitForFunction(()=>document.querySelector('#versionLoadStatus').textContent.includes('불러오지 못'));
      assert.equal(await page.locator('#versionLoadStatus').isVisible(),true);
      await choose(page,1,'비교'); await page.locator('#versionCompareDialog').waitFor();
      await page.locator('#versionCompareClose').click(); await choose(page,1,'미리보기');
      await page.waitForFunction(()=>document.body.classList.contains('previewing'));
      await page.locator('#closePreviewBtn').click();
      await diagnostics.close(context);
    }
  }
  assert.equal(writes,0,'Version reads never publish or restore fixture data');
  console.log(`Versions: close/Escape, reversed selections, sign-out, stale lists, bounded reads and retries passed on desktop/mobile. Captures: ${output}`);
} catch (error) { await diagnostics.fail(error); throw error; }
finally { for(const items of plans.values())for(const item of items)item.release(); await browser?.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
