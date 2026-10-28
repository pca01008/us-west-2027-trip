// Isolated current-source UI audit. No production requests or app mutations.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readBrowserFixture, injectBrowserFixture, selectTripTab } from '../../../scripts/browser-fixtures.mjs';

const root = new URL('../../../', import.meta.url);
const output = new URL('./', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const evidence = [], errors = [];
const server = createServer(async (req, res) => {
  try {
    const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(file)) return res.writeHead(404).end();
    let content = await readBrowserFixture(new URL(file, root));
    if (file === 'index.html') content = injectBrowserFixture(source.replace('data-offline="false"', 'data-offline="true"')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, ''));
    res.writeHead(200, {'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'}).end(content);
  } catch (error) { errors.push(error.message); res.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin||route.request().url()===new URL('readonly-fixture.html',output).href?route.continue():route.abort());
  const page = await context.newPage();page.setDefaultTimeout(7000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
  for (const id of ['prep','money','d1']) {
    await selectTripTab(page,id);
    const result=await page.locator('#panel-'+id).evaluate(el=>({panel:el.id,role:el.getAttribute('role'),labelledby:el.getAttribute('aria-labelledby'),missing:(el.getAttribute('aria-labelledby')||'').split(/\s+/).filter(id=>id&&!document.getElementById(id))}));
    assert.deepEqual(result.missing,[]);
    evidence.push({id:'rejected-label-hypothesis',...result});
  }
  await selectTripTab(page,'d1');
  await page.locator('#editBtn').click();
  const row=page.locator('.day1 .timeline-row').first();
  for(const input of ['https://','https://[bad]','https://example.test:99999']){
    assert.throws(()=>new URL(input));
    await row.locator('[data-media="map"]').click();
    await page.locator('#mapName').fill('Malformed map URL');
    await page.locator('#mapUrl').fill(input);
    await page.locator('#mapSave').click();
    const accepted=await page.locator('#mapDialog').isHidden();
    const href=accepted?await row.locator('.schedule-map a').getAttribute('href'):null;
    assert.equal(accepted,true);assert.equal(href,input);
    evidence.push({id:'F3',scenario:'Malformed map URL',input,accepted,href,confirmed:true});
  }
  // Export through the real UI and inspect its generated runtime separately.
  await page.locator('#editBtn').click();
  await page.getByRole('button',{name:'변경사항 폐기',exact:true}).click();
  await page.waitForFunction(()=>document.body.classList.contains('viewing'));
  await selectTripTab(page,'money');await page.locator('#editBtn').click();
  await page.locator('#settingsAddCategory').click();
  const icon=await page.locator('#categoryIconPicker button.active').evaluate(el=>({text:el.textContent,role:el.getAttribute('role'),pressed:el.getAttribute('aria-pressed'),checked:el.getAttribute('aria-checked')}));
  assert.equal(icon.pressed,null);assert.equal(icon.checked,null);
  evidence.push({id:'U2',scenario:'Selected category icon semantics',...icon,confirmed:true});
  await page.locator('#categoryCancel').click();await page.locator('#ledgerSettingsClose').click();
  await page.locator('#exportMenuBtn').click();
  const download=page.waitForEvent('download');await page.locator('#exportBtn').click();
  const artifact=await download;
  const exportPath=new URL('readonly-fixture.html',output);
  await artifact.saveAs(fileURLToPath(exportPath));
  const reader=await context.newPage();
  reader.on('pageerror',error=>errors.push(error.message));
  await reader.goto(exportPath.href);
  const photo=reader.locator('.schedule-photo:not(.map-capture) img').first();
  await photo.focus();await photo.press('Enter');
  assert.equal(await reader.locator('#photoViewer').isVisible(),true);
  assert.equal(await reader.locator('#photoViewerClose').evaluate(el=>document.activeElement===el),true);
  await reader.keyboard.press('Tab');
  const focus=await reader.evaluate(()=>({inViewer:document.querySelector('#photoViewer').contains(document.activeElement),tag:document.activeElement.tagName,activeElementId:document.activeElement.id,modalOpen:document.body.classList.contains('modal-open')}));
  assert.equal(focus.inViewer,false);
  evidence.push({id:'U1',scenario:'Readonly photo viewer Tab',...focus,confirmed:true});
  await reader.screenshot({path:fileURLToPath(new URL('readonly-viewer.png',output))});
  await reader.keyboard.press('Escape');assert.equal(await reader.locator('#photoViewer').isHidden(),true);
  assert.equal(await photo.evaluate(el=>document.activeElement===el),true);
  evidence.push({id:'export-close-control',scenario:'Escape closes viewer and restores photo focus',passed:true});
  await context.close();
} finally {
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await writeFile(new URL('ui-reproduction.json',output),JSON.stringify({recordedAt:new Date().toISOString(),node:process.version,browser:browser.version(),evidence,errors},null,2));
  await unlink(new URL('readonly-fixture.html',output)).catch(()=>{});
}
assert.deepEqual(errors,[]);
console.log(JSON.stringify(evidence,null,2));
