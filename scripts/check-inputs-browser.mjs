import { selectTripTab, selectTheme } from './browser-fixtures.mjs';
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
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const output = await mkdtemp(path.join(tmpdir(), 'westbound-inputs-'));
const source = await readFile(new URL('index.html', root), 'utf8');
const server = createServer(async (req, res) => {
  const relative = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|trip-config\.js|(?:icons|assets)\/[\w.-]+)$/.test(relative)) { res.writeHead(404).end(); return; }
  try {
    let content = await readBrowserFixture(new URL(relative, root));
    if (relative === 'index.html') content = source.replace('data-offline="false"', 'data-offline="true"')
      .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
      .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '')
      .replace('initializeTimetable();initializeDialogAccessibility();',
        'window.__inputsTest={captureState,applyState,normalizeState,recordHistory,exportOfflineHtml,exportStaticHtml};initializeTimetable();initializeDialogAccessibility();');
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
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? {channel:process.env.PWA_BROWSER_CHANNEL} : {}) });
  // Use real pointer and keyboard activation: label forwarding used to focus
  // an off-screen radio before change, losing the sticky tab position.
  for(const mobile of [false,true])for(const reducedMotion of ['reduce','no-preference']) {
    diagnostics.scenario(`tab navigation / ${mobile ? "mobile" : "desktop"} / ${reducedMotion}`);
    const context=await diagnostics.context(browser, {viewport:{width:mobile?390:1440,height:mobile?844:900},isMobile:mobile,hasTouch:mobile,reducedMotion});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>!document.body.classList.contains('hydrating'));
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
      // Reveal distant dates by horizontal scrolling before the real pointer click.
      if(target==='d11')await label(target).evaluate(el=>{el.parentElement.scrollLeft=el.offsetLeft;});
      await activate(target==='d11'?label(target).locator('span').last():label(target));
      if(target==='d11')await settled();assert.equal(await page.locator('#'+target).isChecked(),true);
      assert.equal(await label(target).getAttribute(target==='d11'?'aria-selected':'aria-current'),target==='d11'?'true':'page');
      assert.equal(await label(target).evaluate(el=>document.activeElement===el),true,'Focus remains on the visible tab');
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
    diagnostics.scenario(`input, import and export / ${mobile ? "mobile" : "desktop"}`);
    const context = await diagnostics.context(browser, { viewport: { width: mobile ? 390 : 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', acceptDownloads: true });
    await context.route('**/*', route => /^(file:|data:)/.test(route.request().url()) || route.request().url().startsWith(origin) ? route.continue() : route.abort());
    context.on('page', p => { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); });
    const page = await context.newPage();
    const ready = p => p.waitForFunction(() => !document.body.classList.contains('hydrating'));
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
    await start.evaluate(el => el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: (() => { const data = new DataTransfer(); data.setData('text/plain', '10:15'); return data; })() })));
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
    assert.equal(await detail.evaluate(el => getComputedStyle(el, '::before').content), '"장소 또는 메모"');
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
    await row.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `${mobile ? 'mobile' : 'desktop'}-empty-fields.png`) });
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
  console.log('Screenshots and exported fixtures:', output);
} catch (error) {
  await diagnostics.fail(error);
  throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
