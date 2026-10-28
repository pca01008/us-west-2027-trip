import { injectBrowserFixture } from './browser-fixtures.mjs';
import { selectTripTab, selectTheme as selectPointerTheme } from './browser-fixtures.mjs';
// Exercise the real app in isolated offline fixtures; never contact production APIs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { readBrowserFixture } from './browser-fixtures.mjs';

const diagnostics = await createBrowserDiagnostics('inputs');
const args=process.argv.slice(2),functionalOnly=args.includes('--functional');
assert.ok(args.every(arg=>!arg.startsWith('--')||arg==='--functional'),'Unknown input-suite option');
const modulePath=args.find(arg=>!arg.startsWith('--'));
// Extra-engine smoke verifies behavior; Chromium owns rendered PNG evidence.
async function capture(page,options){if(!functionalOnly)await page.screenshot(options);}
if(functionalOnly)console.log('PARTIAL visual coverage: functional assertions only; PNG evidence belongs to the Chromium suite.');
async function waitForFixtureFonts(page){
  await page.evaluate(()=>{window.__fixtureFontsReady=false;document.fonts.load('700 16px "Pretendard Variable"','여행 ABC 0123').then(faces=>{window.__fixtureFontsReady=faces.length>0;});});
  await page.waitForFunction(()=>window.__fixtureFontsReady&&document.fonts.status==='loaded',null,{timeout:10000});
}
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const engine=process.env.TRIP_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','firefox','webkit'].includes(engine),'Unsupported browser engine');
async function selectTheme(page,value){
  if(engine==='webkit'){
    // WebKit can apply a radio's change then stall its pointer acknowledgement.
    // Exercise real keyboard activation; Chromium/Firefox retain pointer checks.
    await page.locator('#themeToggle').click();
    const radio=page.locator(`input[name="themePreference"][value="${value}"]`);
    await radio.focus();await radio.press('Space');
    if(await page.locator('#themeMenu').isVisible())await page.keyboard.press('Escape');
  }else await selectPointerTheme(page,value);
  await page.waitForFunction(value=>document.documentElement.dataset.themePreference===value&&document.querySelector(`input[name="themePreference"][value="${value}"]`).checked&&document.querySelector('#themeMenu').hidden,value);
}
if(engine==='webkit')console.log('WebKit theme fixtures use keyboard activation with applied/checked/closed assertions; pointer theme coverage belongs to Chromium/Firefox.');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-inputs-'));
const source = await readFile(new URL('index.html', root), 'utf8');
const server = createServer(async (req, res) => {
  const relative = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(relative)) { res.writeHead(404).end(); return; }
  try {
    let content = await readBrowserFixture(new URL(relative, root));
    if (relative === 'index.html') content = injectBrowserFixture(source.replace('data-offline="false"', 'data-offline="true"')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, ''), 'window.__inputsTest={captureState,applyState,normalizeState,recordHistory,exportOfflineHtml,exportStaticHtml,history:()=>{const {historyIndex,historyLength}=documentSession.snapshot();return {historyIndex,historyLength};}};');
    const ext = relative.split('.').at(-1);
    res.writeHead(200, { 'Content-Type': { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2' }[ext], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
for (let attempt = 0; ; attempt++) {
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(20000 + Math.floor(Math.random() * 30000), '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    break;
  } catch (error) { if (error.code !== 'EADDRINUSE' || attempt >= 4) throw error; }
}
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await playwright[engine].launch({ headless: true, ...(engine==='chromium'&&process.env.PWA_BROWSER_CHANNEL ? {channel:process.env.PWA_BROWSER_CHANNEL} : {}) });
  // Use real pointer and keyboard activation: label forwarding used to focus
  // an off-screen radio before change, losing the sticky tab position.
  for(const mobile of [false,true])for(const reducedMotion of ['reduce','no-preference']) {
    diagnostics.scenario(`tab navigation / ${mobile ? "mobile" : "desktop"} / ${reducedMotion}`);
    const context=await diagnostics.context(browser, {viewport:{width:mobile?390:1440,height:mobile?844:900},...(engine==='firefox'?{}:{isMobile:mobile}),hasTouch:mobile,reducedMotion});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));await waitForFixtureFonts(page);
    const snapshot=await page.evaluate(()=>{const api=window.__inputsTest;return api.normalizeState(api.captureState());});
    const label=id=>page.locator(id==='money'||id==='prep'?'[data-section="'+id+'"]':'.tabs label[for="'+id+'"]');
    const activate=locator=>mobile?locator.tap():locator.click();
    const settled=()=>page.waitForFunction(()=>Math.abs(document.querySelector('.tabs').getBoundingClientRect().top)<=2&&!document.querySelector('main').style.minHeight);
    const deep=async()=>{
      await selectTripTab(page, 'd3', mobile);
      await page.waitForFunction(()=>!document.querySelector('main').style.minHeight);
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.waitForFunction(()=>Math.abs(document.querySelector('.tabs').getBoundingClientRect().top)<=1);
    };
    // Section navigation hides the date strip outside the schedule.
    await activate(label('money'));assert.equal(await page.locator('.tabs').isHidden(),true);
    for(const target of ['money','prep','d11']) {
      await deep();
      // Position the fixture instantly: CSS smooth scrolling can leave the date
      // under the arrow and make Playwright scroll the page while retrying clicks.
      if(target==='d11')await label(target).evaluate(el=>{el.parentElement.scrollTo({left:el.offsetLeft,behavior:'instant'});});
      await activate(target==='d11'?label(target).locator('span').last():label(target));
      if(target==='d11')await settled();assert.equal(await page.locator('#'+target).isChecked(),true);
      assert.equal(await label(target).getAttribute(target==='d11'?'aria-selected':'aria-current'),target==='d11'?'true':'page');
      assert.equal(await label(target).evaluate(el=>document.activeElement===el),true,`Focus remains on the visible tab (${target})`);
    }
    await deep();await activate(label('d3'));await settled();
    assert.equal(await page.locator('#d3').isChecked(),true,'Reselecting a tab must not jump to the hidden radio');
    for(const [key,target] of [['ArrowRight','d4'],['Home','d1'],['End','d11'],['Enter','d11'],['Space','d11']]) {
      await page.keyboard.press(key);await settled();assert.equal(await page.locator('#'+target).isChecked(),true);
      assert.equal(await label(target).evaluate(el=>document.activeElement===el),true);
    }
    await deep();await page.evaluate(()=>{document.querySelector('[data-section="money"]').click();document.querySelector('[data-section="prep"]').click();document.querySelector('#nav-schedule').click();document.querySelector('label[for="d11"]').click();});
    await settled();assert.equal(await page.locator('#d11').isChecked(),true,'Rapid switching keeps the final selection');
    // Timetable reselect still returns to the tab's date, exactly once.
    await activate(label('d3'));await activate(page.locator('#timetableViewBtn'));await activate(page.locator('[data-tt-range="1"]'));
    await activate(page.locator('#timetableNext'));assert.equal(await page.locator('#timetableStart').inputValue(),'3');
    await page.evaluate(()=>{window.__tabChanges=0;document.addEventListener('change',event=>{if(event.target.matches('.day-radio'))window.__tabChanges++;});});
    await activate(label('d3'));assert.equal(await page.locator('#timetableStart').inputValue(),'2');
    assert.equal(await page.evaluate(()=>window.__tabChanges),1);
    await activate(label('d4'));assert.equal(await page.locator('#timetableStart').inputValue(),'3');
    assert.equal(await page.evaluate(()=>window.__tabChanges),2,'Each timetable tab activation fires one change');
    await activate(label('money'));assert.equal(await page.locator('#timetableView').isHidden(),true);
    await page.waitForFunction(()=>!document.querySelector('main').style.minHeight);
    assert.deepEqual(await page.evaluate(()=>{const api=window.__inputsTest;return api.normalizeState(api.captureState());}),snapshot,'Tab navigation does not change trip data');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await diagnostics.close(context);console.log((mobile?'Mobile':'Desktop')+' tabs ('+reducedMotion+'): header position, long-to-short switches, nested labels, reselect, keyboard, rapid switches, timetable and data preservation passed.');
  }
  for (const mobile of [false, true]) {
    diagnostics.scenario(`dialog keyboard focus / ${mobile ? 'mobile' : 'desktop'}`);
    const context=await diagnostics.context(browser,{viewport:{width:mobile?390:1440,height:900},reducedMotion:'reduce'});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));await waitForFixtureFonts(page);
    const focused=async locator=>assert.equal(await locator.evaluate(el=>el===document.activeElement),true,'Focus returns to the current trigger');
    const fieldError=async(id,dialog)=>{
      const input=page.locator('#'+id),error=page.locator('#'+id+'Error');
      await focused(input);assert.equal(await input.getAttribute('aria-invalid'),'true');
      assert.equal(await input.getAttribute('aria-describedby'),id+'Error');assert.equal(await error.isVisible(),true);
      assert.ok((await error.textContent()).trim());
      assert.equal(await error.evaluate((el,dialog)=>{const r=el.getBoundingClientRect();return !!el.closest(dialog)&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;},dialog),true,'Visible error stays inside the active dialog and viewport');
    };
    const open=async(trigger,dialog,initial)=>{
      await trigger.focus();await page.keyboard.press('Enter');await page.locator(dialog).waitFor({state:'visible'});await focused(page.locator(initial));
      const buttons=page.locator(dialog).locator('button:visible:not([disabled]),input:visible:not([disabled]),select:visible:not([disabled]),textarea:visible:not([disabled]),a[href]:visible');
      await buttons.first().focus();await page.keyboard.press('Shift+Tab');await focused(buttons.last());
      await page.keyboard.press('Tab');await focused(buttons.first());
    };
    await selectTripTab(page,'money');await page.locator('#expenseName').fill('Keyboard fixture');await page.locator('#expenseKrw').fill('14500');await page.locator('#addExpense').click();
    const expense=page.locator('[data-edit-expense]').first();
    for(const close of ['Escape','#expenseEditCancel','#expenseEditSave']){
      await open(expense,'#expenseDialog','#expenseEditName');
      if(close==='Escape')await page.keyboard.press(close);else await page.locator(close).press('Enter');
      await page.locator('#expenseDialog').waitFor({state:'hidden'});await focused(expense);
    }
    await open(expense,'#expenseDialog','#expenseEditName');await page.locator('#expenseEditName').fill('   ');await page.locator('#expenseEditSave').click();await fieldError('expenseEditName','#expenseDialog');
    await page.locator('#expenseEditName').fill('Corrected expense');assert.equal(await page.locator('#expenseEditNameError').isHidden(),true);await page.locator('#expenseEditSave').click();await focused(expense);
    await page.locator('#editBtn').focus();await page.keyboard.press('Enter');await page.locator('#ledgerSettingsDialog').waitFor({state:'visible'});
    for(const close of ['Escape','#categoryCancel','#categorySave']){
      const trigger=page.locator(close==='#categorySave'?'[data-category-edit="food"]':'#settingsAddCategory').filter({visible:true});
      await open(trigger,'#categoryDialog','#categoryName');
      const picker=page.locator('#categoryIconPicker');
      assert.equal(await picker.locator('[aria-pressed="true"]').count(),1);
      assert.equal(await picker.locator('button:not([aria-label]),button[aria-label=""]').count(),0);
      if(close==='#categorySave'){
        const previous=picker.locator('[aria-pressed="true"]');const oldIcon=await previous.getAttribute('data-category-icon');
        const chosen=picker.getByRole('button',{name:'카페',exact:true});await chosen.focus();await chosen.press('Space');
        await focused(chosen);assert.equal(await chosen.getAttribute('aria-pressed'),'true');
        assert.equal(await picker.locator(`[data-category-icon="${oldIcon}"]`).getAttribute('aria-pressed'),'false');
        assert.equal(await picker.locator('[aria-pressed="true"]').count(),1);
        await page.locator('#categoryName').fill('Updated food');
      }
      if(close==='Escape')await page.keyboard.press(close);else await page.locator(close).press('Enter');
      await page.locator('#categoryDialog').waitFor({state:'hidden'});await focused(trigger);
      assert.equal(await page.locator('#ledgerSettingsDialog').isVisible(),true,'Closing a child keeps its parent open');
      if(close==='#categorySave'){
        await open(trigger,'#categoryDialog','#categoryName');
        assert.equal(await picker.getByRole('button',{name:'카페',exact:true}).getAttribute('aria-pressed'),'true');
        assert.equal(await picker.locator('[aria-pressed="true"]').count(),1);
        await page.keyboard.press('Escape');await focused(trigger);
      }
    }
    for(const theme of ['light','dark']){
      // Set the theme before opening the parent; the background theme control is outside its focus trap.
      await page.keyboard.press('Escape');await selectTheme(page,theme);await page.locator('#editBtn').click();
      const trigger=page.locator('#settingsAddCategory');await open(trigger,'#categoryDialog','#categoryName');
      for(const value of ['', '   ', '']){
        await page.locator('#categoryName').fill(value);await page.locator('#categorySave').click();await fieldError('categoryName','#categoryDialog');
      }
      await capture(page,{path:path.join(output,`${mobile?'mobile':'desktop'}-${theme}-category-error.png`)});
      await page.locator('#categoryName').fill('Validated '+theme);assert.equal(await page.locator('#categoryNameError').isHidden(),true);assert.equal(await page.locator('#categoryName').getAttribute('aria-invalid'),'false');
      await page.locator('#categorySave').click();await focused(trigger);assert.ok(await page.locator('#settingsCategoryList').textContent().then(text=>text.includes('Validated '+theme)));
      await open(trigger,'#categoryDialog','#categoryName');assert.equal(await page.locator('#categoryNameError').isHidden(),true);await page.keyboard.press('Escape');await focused(trigger);
    }
    await page.keyboard.press('Escape');await focused(page.locator('#editBtn'));
    await selectTripTab(page,'d1');await page.locator('#editBtn').click();
    for(const [trigger,dialog,initial,cancel,save] of [
      [page.locator('.day1 [data-media="time"]').first(),'#scheduleTimeDialog','#scheduleTimeStart','#scheduleTimeCancel','#scheduleTimeSave'],
      [page.locator('.day1 [data-edit-photo]').first(),'#photoEditDialog','#photoCaption','#photoEditCancel','#photoEditSave']
    ])for(const close of ['Escape',cancel,save]){
      await open(trigger,dialog,initial);
      if(close==='Escape')await page.keyboard.press(close);else await page.locator(close).press('Enter');
      await page.locator(dialog).waitFor({state:'hidden'});await focused(trigger);
    }
    for(const theme of ['light','dark']){
      diagnostics.scenario(`photo metadata validation / ${mobile?'mobile':'desktop'} / ${theme}`);
      await selectTheme(page,theme);
      const trigger=page.locator('.day1 [data-edit-photo]').first(),dialog='#photoEditDialog';
      const caption=page.locator('#photoCaption'),alt=page.locator('#photoAlt');
      const snapshot=await page.evaluate(()=>window.__inputsTest.normalizeState(window.__inputsTest.captureState()));
      await open(trigger,dialog,'#photoCaption');
      for(const [captionValue,altValue] of [['','Valid alt'],['   ','Valid alt'],['Valid caption',''],['Valid caption','   '],['',''],['   ','   ']]){
        await caption.fill(captionValue);await alt.fill(altValue);
        for(let attempt=0;attempt<2;attempt++){
          await page.locator('#photoEditSave').click();
          await fieldError(captionValue.trim()?'photoAlt':'photoCaption',dialog);
          for(const [id,value] of [['photoCaption',captionValue],['photoAlt',altValue]]){
            assert.equal(await page.locator('#'+id).inputValue(),value,'Rejected submission preserves input');
            assert.equal(await page.locator('#'+id).getAttribute('aria-invalid'),String(!value.trim()));
            assert.equal(await page.locator('#'+id+'Error').isVisible(),!value.trim());
          }
          assert.deepEqual(await page.evaluate(()=>window.__inputsTest.normalizeState(window.__inputsTest.captureState())),snapshot,'Invalid metadata must not change the document');
        }
      }
      await capture(page,{path:path.join(output,`${mobile?'mobile':'desktop'}-${theme}-photo-error.png`)});
      await caption.fill('  Corrected '+theme+' caption  ');
      assert.equal(await caption.getAttribute('aria-invalid'),'false');assert.equal(await page.locator('#photoCaptionError').isHidden(),true);
      assert.equal(await alt.getAttribute('aria-invalid'),'true','Correcting caption preserves the alt error');
      await page.locator('#photoEditSave').click();await fieldError('photoAlt',dialog);
      await alt.fill('  Corrected '+theme+' alt  ');
      assert.equal(await alt.getAttribute('aria-invalid'),'false');assert.equal(await page.locator('#photoAltError').isHidden(),true);
      await page.locator('#photoEditSave').click();await page.locator(dialog).waitFor({state:'hidden'});await focused(trigger);
      const figure=page.locator('.day1 .schedule-photo').first();
      assert.equal(await figure.locator('figcaption').textContent(),'Corrected '+theme+' caption');
      assert.equal(await figure.locator('img').getAttribute('alt'),'Corrected '+theme+' alt');
      assert.equal(await figure.locator('img').getAttribute('aria-label'),'Corrected '+theme+' caption 크게 보기');
      for(const close of ['Escape','#photoEditCancel']){
        await open(trigger,dialog,'#photoCaption');
        for(const id of ['photoCaption','photoAlt']){
          assert.equal(await page.locator('#'+id+'Error').isHidden(),true);
          assert.equal(await page.locator('#'+id).getAttribute('aria-invalid'),'false');
        }
        assert.equal(await caption.inputValue(),'Corrected '+theme+' caption');
        assert.equal(await alt.inputValue(),'Corrected '+theme+' alt');
        await caption.fill('');await alt.fill('');await page.locator('#photoEditSave').click();await fieldError('photoCaption',dialog);
        if(close==='Escape')await page.keyboard.press(close);else await page.locator(close).click();
        await page.locator(dialog).waitFor({state:'hidden'});await focused(trigger);
      }
      await open(trigger,dialog,'#photoCaption');
      assert.equal(await page.locator('#photoCaptionError').isHidden(),true);assert.equal(await page.locator('#photoAltError').isHidden(),true);
      assert.equal(await caption.inputValue(),'Corrected '+theme+' caption');assert.equal(await alt.inputValue(),'Corrected '+theme+' alt');
      await page.keyboard.press('Escape');await focused(trigger);
    }
    const map=page.locator('.day1 [data-media="map"]').first();await open(map,'#mapDialog','#mapName');
    await page.locator('#mapName').fill(' ');await page.locator('#mapUrl').fill('http://example.test');await page.locator('#mapSave').click();await fieldError('mapName','#mapDialog');
    await page.locator('#mapName').fill('Test place');await page.locator('#mapSave').click();await fieldError('mapUrl','#mapDialog');
    const mapSnapshot=await page.evaluate(()=>({state:window.__inputsTest.normalizeState(window.__inputsTest.captureState()),history:window.__inputsTest.history()}));
    for(const url of ['https://','https://[bad]','https://example.test:99999']){
      await page.locator('#mapUrl').fill(url);await page.locator('#mapSave').click();await fieldError('mapUrl','#mapDialog');
      assert.deepEqual(await page.evaluate(()=>({state:window.__inputsTest.normalizeState(window.__inputsTest.captureState()),history:window.__inputsTest.history()})),mapSnapshot,'Invalid map submission preserves document and history');
      assert.equal(await page.evaluate(url=>{const api=window.__inputsTest,state=api.captureState(),template=document.createElement('template');template.innerHTML=state.html;const map=document.createElement('div');map.className='schedule-map';const link=document.createElement('a');link.href=url;link.textContent='Imported map';map.append(link);template.content.querySelector('.day1 .card').append(map);state.html=template.innerHTML;template.innerHTML=api.normalizeState(state,true).html;return template.content.querySelector('.day1 .schedule-map a').hasAttribute('href');},url),false,'Import strips malformed HTTPS links');
    }
    const validMap='https://example.test/map?q=서울&mode=walk#route';
    await page.locator('#mapUrl').fill(validMap);assert.equal(await page.locator('#mapUrlError').isHidden(),true);await page.locator('#mapSave').click();await focused(map);
    assert.equal(await page.locator('.day1 .schedule-map a').first().getAttribute('href'),validMap);
    assert.equal(await page.evaluate(()=>{const api=window.__inputsTest,state=api.normalizeState(api.captureState(),true),template=document.createElement('template');template.innerHTML=state.html;return template.content.querySelector('.day1 .schedule-map a').getAttribute('href');}),validMap,'Import preserves valid query and fragment');
    await diagnostics.close(context);console.log(`Dialog focus (${mobile?'mobile':'desktop'}): keyboard open, Tab wrapping, Escape/Cancel/Apply, nested dialogs and replaced triggers passed.`);
  }
  for (const mobile of [false, true]) {
    diagnostics.scenario(`input, import and export / ${mobile ? "mobile" : "desktop"}`);
    const context = await diagnostics.context(browser, { viewport: { width: mobile ? 390 : 1440, height: 900 }, ...(engine==='firefox'?{}:{isMobile:mobile}), hasTouch: mobile, reducedMotion: 'reduce', acceptDownloads: true });
    await context.route('**/*', route => /^(file:|data:)/.test(route.request().url()) || route.request().url().startsWith(origin) ? route.continue() : route.abort());
    context.on('page', p => { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); });
    const page = await context.newPage();
    const ready = async p => {await p.waitForFunction(() => !document.body.classList.contains('hydrating'));await waitForFixtureFonts(p);};
    const tab = p => selectTripTab(p, 'd1');
    await page.goto(origin); await ready(page); await tab(page); await page.locator('#editBtn').click();
    const oldRows = await page.locator('.day1 .timeline-row').count();
    await page.locator('#addTimeBtn').click();
    const start = page.locator('#scheduleTimeStart'), end = page.locator('#scheduleTimeEnd');
    assert.equal(await start.inputValue(), '', 'Examples must leave the new input value empty');
    assert.equal(await end.inputValue(), '');
    await start.pressSequentially('0930'); assert.equal(await start.inputValue(), '09:30');
    await end.click(); await end.pressSequentially('1130'); assert.equal(await end.inputValue(), '11:30');
    await end.press('Control+a'); await end.press('Backspace'); assert.equal(await end.inputValue(), '');
    await end.pressSequentially('1200'); assert.equal(await end.inputValue(), '12:00');
    await start.click(); await start.press('Control+a');
    await start.evaluate(el => { const data=new DataTransfer();data.setData('text/plain','10:15');const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:data});el.dispatchEvent(event); });
    assert.equal(await start.inputValue(), '10:15');
    await start.press('Control+z'); assert.equal(await start.inputValue(), '09:30');
    await start.press('Control+y'); assert.equal(await start.inputValue(), '10:15');
    // Mobile/IME input can be noncancelable. Simulate the browser mutation between events.
    await start.evaluate(el => {
      el.setSelectionRange(0, 0);
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: false, inputType: 'insertText', data: '0' }));
      el.value = '010:15';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }));
    });
    assert.equal(await start.inputValue(), '00:15', 'Noncancelable input must overwrite, not shift digits');
    await start.click(); await start.press('Control+a'); await start.pressSequentially('0930');
    assert.equal(await start.inputValue(), '09:30');
    await page.locator('#scheduleTimeSave').click();
    assert.equal(await page.locator('.day1 .timeline-row').count(), oldRows + 1);
    const row = page.locator('.day1 .timeline-row').last();
    const rowId = await row.getAttribute('data-row-id');
    const title = row.locator('h3'), detail = row.locator('.remark');
    assert.equal(await title.textContent(), ''); assert.equal(await detail.textContent(), '');
    assert.equal(await detail.getAttribute('data-placeholder'),'장소 또는 메모');
    assert.ok(['\"장소 또는 메모\"','attr(data-placeholder)'].includes(await detail.evaluate(el => getComputedStyle(el,'::before').content)),'Placeholder content is literal or an attribute reference (engine serialization)');
    await title.pressSequentially('Museum'); await detail.click(); await detail.pressSequentially('Los Angeles');
    assert.equal(await title.textContent(), 'Museum'); assert.equal(await detail.textContent(), 'Los Angeles');
    await detail.press('Control+a'); await detail.press('Backspace');
    assert.equal(await detail.getAttribute('data-empty'), 'true', 'Deleting all text restores the hint even with a remaining BR');
    // Composition must not rewrite nodes or the selection while Korean text is being composed.
    await detail.evaluate(el => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const text = document.createTextNode('서울'); el.replaceChildren(text);
      const range = document.createRange(); range.setStart(text, text.length); range.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(range);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: '서울', inputType: 'insertCompositionText' }));
      if (el.firstChild !== text || getSelection().anchorNode !== text) throw Error('Composition was disturbed');
      if (el.dataset.empty !== 'false') throw Error('Hint must disappear during composition');
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '서울' }));
    });
    assert.equal(await detail.textContent(), '서울'); assert.equal(await detail.getAttribute('data-empty'), 'false');
    await row.locator('[data-media="warning"]').click();
    const warning = row.locator('.schedule-warning-text');
    assert.equal(await warning.textContent(), ''); await warning.pressSequentially('Bring tickets');
    assert.equal(await warning.textContent(), 'Bring tickets');
    await page.evaluate(() => window.__inputsTest.recordHistory());
    await warning.press('Control+a'); await warning.press('Backspace');
    await page.evaluate(() => window.__inputsTest.recordHistory());
    await page.locator('#undoBtn').click(); assert.equal(await warning.textContent(), 'Bring tickets');
    await page.locator('#redoBtn').click(); assert.equal(await warning.textContent(), '');
    await title.fill(''); await detail.fill('');
    await page.evaluate(() => window.__inputsTest.recordHistory());
    const snapshot = await page.evaluate(() => window.__inputsTest.captureState());
    const stored = await page.evaluate(({ snapshot, rowId }) => {
      const template = document.createElement('template'); template.innerHTML = snapshot.html;
      const saved = template.content.querySelector(`[data-row-id="${rowId}"]`);
      return ['h3', '.remark', '.schedule-warning-text'].map(selector => saved.querySelector(selector).textContent);
    }, { snapshot, rowId });
    assert.deepEqual(stored, ['', '', ''], 'Hints must never become saved content');
    await page.evaluate(state => { const api = window.__inputsTest; api.applyState(api.normalizeState(state, true)); }, snapshot);
    assert.equal(await detail.getAttribute('data-empty'), 'true', 'Imported empty fields retain hints');
    // Preserve legacy/user content even when it happens to match old hint strings.
    await title.fill('새 일정'); await detail.fill('장소 또는 메모'); await warning.fill('새 주의사항');
    await page.evaluate(() => { const api = window.__inputsTest; api.applyState(api.captureState()); });
    assert.equal(await title.textContent(), '새 일정'); assert.equal(await detail.textContent(), '장소 또는 메모');
    assert.equal(await warning.textContent(), '새 주의사항');
    await title.fill(''); await detail.fill(''); await warning.fill('');
    await row.locator('[data-media="time"]').click(); await page.locator('#scheduleTimeMode').selectOption('label');
    await page.locator('#scheduleTimeLabel').fill('미정'); await page.locator('#scheduleTimeSave').click();
    await row.locator('[data-media="time"]').click(); await page.locator('#scheduleTimeLabel').pressSequentially('AM');
    assert.equal(await page.locator('#scheduleTimeLabel').inputValue(), 'AM', 'Existing text time is selected on open');
    await page.locator('#scheduleTimeCancel').click();
    const photo = page.locator('.day1 .schedule-photo').first();
    await photo.locator('[data-edit-photo]').click();
    await page.locator('#photoCaption').pressSequentially('Hotel');
    assert.equal(await page.locator('#photoCaption').inputValue(), 'Hotel', 'Photo caption can be replaced directly');
    await page.locator('#photoEditCancel').click();
    await selectTheme(page, 'dark');
    await row.scrollIntoViewIfNeeded(); await capture(page,{ path: path.join(output, `${mobile ? 'mobile' : 'desktop'}-empty-fields.png`) });
    // Both exports must survive script execution/reload with empty values and correct view styles.
    for (const kind of ['editable', 'readonly']) {
      const download = page.waitForEvent('download');
      await page.evaluate(kind => kind === 'editable' ? window.__inputsTest.exportOfflineHtml() : window.__inputsTest.exportStaticHtml(), kind);
      const file = path.join(output, `${mobile ? 'mobile' : 'desktop'}-${kind}.html`);
      await (await download).saveAs(file);
      const artifact = await context.newPage(); await artifact.goto(pathToFileURL(file).href);
      assert.ok(await artifact.evaluate(async () => (await document.fonts.load('700 16px "Pretendard Variable"', '여행 ABC 0123')).length > 0), 'Export embeds the real font for local files');
      assert.equal(await artifact.locator('#tripFontPreload').count(), 0, 'Export must not request a relative font preload');
      if (kind === 'editable') await ready(artifact);
      if(kind==='editable')await tab(artifact);
      const restored = artifact.locator(`[data-row-id="${rowId}"]`);
      assert.equal(await restored.locator('h3').textContent(), '');
      assert.equal(await restored.locator('h3').evaluate(el => getComputedStyle(el, '::before').content), '"제목 없음"');
      assert.equal(await restored.locator('.remark').isVisible(), false);
      assert.equal(await restored.locator('.schedule-warning').isVisible(), false);
      await artifact.reload(); if (kind === 'editable') await ready(artifact); if(kind==='editable')await tab(artifact);
      assert.equal(await restored.locator('h3').textContent(), '');
      if (kind === 'editable') {
        await artifact.locator('#editBtn').click();
        assert.equal(await restored.locator('.remark').isVisible(), true);
        await restored.locator('.remark').click(); await restored.locator('.remark').pressSequentially('Restored');
        assert.equal(await restored.locator('.remark').textContent(), 'Restored');
      } else {
        const outbound=[];
        await artifact.route('**/*',route=>{if(/^(file:|data:)/.test(route.request().url()))return route.continue();outbound.push(route.request().url());return route.abort();});
        await artifact.reload();
        const photo=artifact.locator('.schedule-photo:not(.map-capture) img').first(),close=artifact.locator('#photoViewerClose');
        for(const [open,exit] of [['Enter','Escape'],['Space','Close']]){
          await photo.focus();await photo.press(open);
          assert.equal(await artifact.locator('#photoViewer').isVisible(),true);
          assert.equal(await artifact.locator('body').evaluate(el=>el.classList.contains('modal-open')),true);
          assert.equal(await artifact.locator('main').evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true'),true);
          assert.equal(await artifact.locator('body').evaluate(el=>getComputedStyle(el).overflow),'hidden');
          for(const key of ['Tab','Shift+Tab','Tab']){await artifact.keyboard.press(key);assert.equal(await close.evaluate(el=>document.activeElement===el),true);}
          await photo.evaluate(el=>el.focus());assert.equal(await close.evaluate(el=>document.activeElement===el),true,'Background cannot take focus');
          await capture(artifact,{path:path.join(output,`${mobile?'mobile':'desktop'}-readonly-viewer.png`)});
          if(exit==='Escape')await artifact.keyboard.press(exit);else await close.click();
          assert.equal(await artifact.locator('#photoViewer').isHidden(),true);
          assert.equal(await photo.evaluate(el=>document.activeElement===el),true);
          assert.equal(await artifact.locator('main').evaluate(el=>el.inert),false);
          assert.equal(await artifact.locator('main').getAttribute('aria-hidden'),null);
          assert.equal(await artifact.locator('body').evaluate(el=>el.classList.contains('modal-open')),false);
        }
        assert.deepEqual(outbound,[],'Read-only photo viewer works with every network request blocked');
      }
      await artifact.close();
    }
    if (!mobile) {
      await context.route('**/*.woff2', route => route.fulfill({ status:503, body:'unavailable' }));
      const fallbackDownload = page.waitForEvent('download');
      await page.evaluate(() => window.__inputsTest.exportStaticHtml());
      const fallbackFile = path.join(output, 'readonly-font-fallback.html');
      await (await fallbackDownload).saveAs(fallbackFile);
      const fallbackArtifact = await context.newPage();await fallbackArtifact.goto(pathToFileURL(fallbackFile).href);
      assert.equal(await fallbackArtifact.locator('.title').isVisible(), true, 'Font failure preserves exported content');
      assert.equal(await fallbackArtifact.locator('#trip-app-styles').count(), 1, 'Font failure preserves all other styles');
      assert.equal(await fallbackArtifact.locator('#tripFontPreload').count(), 0);
      assert.equal(await fallbackArtifact.evaluate(() => Array.from(document.fonts).length), 0, 'Failed font has no broken relative URL in the export');
      await fallbackArtifact.close();
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await diagnostics.close(context);
    console.log(`${mobile ? 'Mobile viewport/touch' : 'Desktop'}: input, composition events, undo/redo, import, exports and reload passed.`);
  }
  assert.deepEqual(errors, []);
  console.log(functionalOnly?'Exported fixtures (functional mode; no PNG captures):':'Screenshots and exported fixtures:',output);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
