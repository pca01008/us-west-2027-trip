// Audit-only reproduction using the existing real-SDK, loopback-only fixture.
// Run from repository root: node docs/archive/2026-10-28-project-review/reproduce-auth.mjs
import { readFile, writeFile, unlink } from 'node:fs/promises';
const source = await readFile(new URL('../../../scripts/check-auth-browser.mjs', import.meta.url), 'utf8');
const boundary = 'try {\n  browser = await chromium.launch';
if (!source.includes(boundary)) throw Error('Auth fixture setup changed; review this probe before running.');
const prefix = source.slice(0, source.indexOf(boundary));
const scenarios = String.raw`
const evidence=[];
try {
  browser=await chromium.launch({headless:true});
  for (const cancellation of ['button','Escape']) {
    const {context,page}=await setup('audit: cancel pending login / '+cancellation);
    let release,started;
    const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
    await page.route('**/auth/v1/token?grant_type=password',async route=>{started();await gate;await route.continue();});
    await page.locator('#editBtn').click();
    await page.locator('#editorPassword').fill('fixture-password');
    await page.locator('#authSubmit').click();await entered;
    if(cancellation==='Escape')await page.keyboard.press('Escape');
    else await page.locator('#authCancel').click();
    assert.equal(await page.locator('#authDialog').isHidden(),true);
    release();await page.waitForFunction(()=>document.body.classList.contains('editing'));
    assert.equal(saves().length,0);
    evidence.push({id:'F2',scenario:'Cancel during password request',cancellation,unexpected:await page.locator('body').getAttribute('class'),publicWrites:saves().length,confirmed:true});
    await diagnostics.close(context);
  }
  {
    const {context,page}=await setup('audit: logout HTTP 503 still removes SDK session');
    await login(page);
    await page.locator('#editBtn').click();
    await page.route('**/auth/v1/logout?scope=local',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture logout unavailable'})}));
    await page.locator('#logoutBtn').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('로그아웃 완료'));
    const displayed=await page.locator('#status').textContent();
    const peer=await context.newPage();await peer.goto(origin+'/sdk-tab');
    const retained=await peer.evaluate(async()=>Boolean((await window.peer.auth.getSession()).data.session));
    assert.equal(retained,false);
    await page.locator('#editBtn').click();
    await page.waitForFunction(()=>!document.querySelector('#authDialog').hidden);
    evidence.push({id:'rejected-logout-hypothesis',scenario:'Logout HTTP 503',displayed,retainedSDKSession:retained,passwordRequired:await page.locator('#authDialog').isVisible(),defect:false});
    await peer.close();await diagnostics.close(context);
  }
  {
    const {context,page}=await setup('audit: edit-start completes after signout');
    await login(page);await page.locator('#editBtn').click();
    const peer=await context.newPage();await peer.goto(origin+'/sdk-tab');
    let release,started;
    const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);
    await page.route('**/rest/v1/trip_documents?*',async route=>{started();await gate;await route.continue();});
    await page.locator('#editBtn').click();await entered;
    await peer.evaluate(()=>window.peer.auth.signOut({scope:'local'}));
    await page.waitForFunction(()=>!document.body.classList.contains('authenticated'));
    release();await page.waitForFunction(()=>document.body.classList.contains('editing'));
    const authenticated=await page.locator('body').evaluate(el=>el.classList.contains('authenticated'));
    const editable=await title(page).getAttribute('contenteditable');
    assert.equal(authenticated,false);assert.equal(editable,'true');assert.equal(saves().length,0);
    evidence.push({id:'F1',scenario:'Delayed edit-start read after peer signout',authenticated,editable,publicWrites:saves().length,confirmed:true});
    await peer.close();await diagnostics.close(context);
  }
  console.log(JSON.stringify({recordedAt:new Date().toISOString(),node:process.version,browser:browser.version(),evidence,fixtureErrors,pageErrors,unexpectedHTTP},null,2));
  assert.deepEqual(fixtureErrors,[]);assert.deepEqual(pageErrors,[]);assert.deepEqual(unexpectedHTTP,[]);
} finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
`;
const generated = new URL('../../../scripts/.audit-auth-20261028.mjs', import.meta.url);
try {
  await writeFile(generated, prefix + scenarios);
  await import(generated.href);
} finally { await unlink(generated).catch(() => {}); }
