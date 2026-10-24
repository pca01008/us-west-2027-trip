// Synthetic fixtures only. Optional before/after checks never contact the live app.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBrowserFixture, selectTripTab, selectTheme } from './browser-fixtures.mjs';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('index.html', root), 'utf8');
const baseline = process.env.PALETTE_BASELINE_HTML ? await readFile(process.env.PALETTE_BASELINE_HTML, 'utf8') : null;
const output = process.env.PALETTE_OUTPUT_DIR ? path.resolve(process.env.PALETTE_OUTPUT_DIR) : await mkdtemp(path.join(tmpdir(), 'westbound-palette-'));
await mkdir(output, { recursive: true });
const diagnostics = await createBrowserDiagnostics('palette');
const prepare = html => html.replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
  .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '');
const errors = [], results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
  const context = await diagnostics.context(browser, { reducedMotion: 'reduce', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://palette.local') return route.abort();
    const relative = url.pathname.replace(/^\/(before|after)\//, '');
    if (!/^(index\.html|trip-config\.js|(?:assets|icons)\/[\w.-]+)$/.test(relative)) return route.abort();
    try {
      const ext = path.extname(relative);
      const body = relative === 'index.html' ? prepare(url.pathname.startsWith('/before/') ? baseline : source) : await readBrowserFixture(new URL(relative, root));
      await route.fulfill({ body, contentType: { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' }[ext] });
    } catch { await route.abort(); }
  });
  const pages = {};
  for (const version of baseline ? ['before', 'after'] : ['after']) {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await page.clock.setFixedTime(new Date('2026-10-25T03:00:00Z'));
    await page.goto(`http://palette.local/${version}/index.html`);
    await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
    await page.evaluate(() => document.fonts.ready);
    pages[version] = page;
  }
  const styles = page => page.evaluate(() => {
    const properties = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'boxShadow', 'textShadow', 'outlineColor', 'fill', 'stroke', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'opacity', 'display'];
    return Array.from(document.querySelectorAll('body,body *')).filter(el => !['SCRIPT', 'TEMPLATE'].includes(el.tagName)).map(el => {
      const colors = pseudo => { const s = getComputedStyle(el, pseudo); return properties.map(p => s[p]); };
      return [el.tagName, el.id, colors(null), colors('::before'), colors('::after')];
    });
  });
  async function capture(label) {
    let beforeStyles, beforeImage;
    for (const [version, page] of Object.entries(pages)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const computed = await styles(page);
      const image = await page.screenshot({ path: path.join(output, `${label}-${version}.png`), animations: 'disabled' });
      if (version === 'before') { beforeStyles = computed; beforeImage = image; }
      else if (baseline) {
        assert.deepEqual(computed, beforeStyles, `${label}: computed styles changed`);
        assert.ok(image.equals(beforeImage), `${label}: rendered pixels changed`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`);
    }
    results.push(label);
  }
  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark']) {
      diagnostics.scenario(`${width}px ${theme} palette`);
      for (const page of Object.values(pages)) { await page.setViewportSize({ width, height: 1000 }); await selectTheme(page, theme); }
      for (const tab of ['d1', 'prep', 'money']) {
        for (const page of Object.values(pages)) await selectTripTab(page, tab);
        await capture(`${width}-${theme}-${tab}`);
      }
      for (const page of Object.values(pages)) {
        await selectTripTab(page, 'd1');
        await page.getByRole('button', { name: '시간표', exact: true }).click();
      }
      for (const range of ['1', 'all']) {
        for (const page of Object.values(pages)) await page.locator(`[data-tt-range="${range}"]`).click();
        await capture(`${width}-${theme}-timetable-${range}`);
      }
      for (const page of Object.values(pages)) {
        await page.getByRole('button', { name: '일별 일정', exact: true }).click();
        await page.emulateMedia({ media: 'print' });
      }
      await capture(`${width}-${theme}-print`);
      for (const page of Object.values(pages)) await page.emulateMedia({ media: 'screen' });
    }
  }
  const palette = await pages.after.locator('html').evaluate(el => {
    const style = getComputedStyle(el);
    return Object.fromEntries(['canvas', 'cream', 'heading-ink', 'navy', 'timeline-accent', 'blue', 'accent', 'header-bg', 'total-primary-bg', 'activity-bg'].map(name => [name, style.getPropertyValue('--' + name).trim()]));
  });
  assert.equal(palette.cream, palette.canvas);
  assert.equal(palette.navy, palette['heading-ink']);
  assert.equal(palette.blue, palette['timeline-accent']);
  assert.ok(Object.values(palette).every(Boolean));
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ baselineCompared: Boolean(baseline), scenarios: results, errors }, null, 2));
  await diagnostics.close(context);
  console.log(`Palette checks passed: ${results.length} mobile/desktop, light/dark, itinerary/PREP/ledger/timetable/print scenarios${baseline ? '; before/after computed styles and PNG bytes identical' : ''}.`);
  console.log('Screenshots:', output);
} catch (error) { await diagnostics.fail(error); throw error; }
finally { await browser?.close(); }
