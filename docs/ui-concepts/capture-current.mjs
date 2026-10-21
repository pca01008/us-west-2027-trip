import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000}});
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://ui.local') return route.abort();
  const file = url.pathname.slice(1) || 'index.html';
  try {
    let body = await readFile(new URL(file, root));
    if (file === 'index.html') body = body.toString().replace(/<script id="pwaRegistration"[^>]*><\/script>/, '').replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '');
    if (file === 'trip-config.js') body = body.toString().replace(/supabase: \{[\s\S]*?\n  \},/, 'supabase: {},');
    await route.fulfill({body,contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'image/webp'});
  } catch { await route.abort(); }
});
await page.goto('http://ui.local/index.html');
await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
await page.screenshot({path:new URL('current-desktop.png',import.meta.url).pathname.slice(1)});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:new URL('current-mobile.png',import.meta.url).pathname.slice(1)});
console.log(await page.locator('.tabs').innerText());
await browser.close();
