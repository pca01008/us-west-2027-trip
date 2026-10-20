// Execute a deliberately failing child, then inspect the artifacts it left
// before exiting. No app data, credentials, or external services are used.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBrowserDiagnostics } from './browser-diagnostics.mjs';
import { fixtureConfig, readBrowserFixture } from './browser-fixtures.mjs';

if (!process.env.DIAGNOSTICS_SELF_TEST) {
  // Verify that even an existing config/asset path returns synthetic content.
  const root = new URL('../', import.meta.url);
  const config = (await readBrowserFixture(new URL('trip-config.js', root))).toString();
  assert.equal(config, `window.TRIP_CONFIG=${JSON.stringify(fixtureConfig)};`);
  assert.equal(fixtureConfig.editorEmail, 'editor@example.test');
  assert.deepEqual(await readBrowserFixture(new URL('assets/airbnb.webp', root)), await readBrowserFixture(new URL('assets/nonexistent-private-photo.webp', root)));
  for (const mode of ['assertion', 'capture-error', 'startup', 'success']) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      env: { ...process.env, DIAGNOSTICS_SELF_TEST: mode }, encoding: 'utf8', timeout: 60000
    });
    assert.ifError(child.error);
    assert.equal(child.status, mode === 'success' ? 0 : 1, child.stderr);
    const output = child.stdout.match(/OUTPUT: (.+)/)?.[1]?.trim();
    assert.ok(output, child.stdout + child.stderr);
    assert.equal(path.dirname(output), tmpdir());
    assert.match(path.basename(output), /^westbound-diagnostics-self-test-diagnostics-/);
    const files = await readdir(output);
    if (mode === 'success') { assert.deepEqual(files, []); continue; }
    const report = JSON.parse(await readFile(path.join(output, 'failure.json'), 'utf8'));
    assert.equal(report.scenario, `self-test ${mode}`);
    assert.match(report.error, /deliberate diagnostic failure/);
    assert.ok(report.steps.some(step => step.scenario === report.scenario));
    if (mode === 'startup') { assert.deepEqual(report.contexts, []); continue; }
    assert.ok(report.events.some(event => event.type === 'console' && event.message === 'fixture console error'));
    assert.ok(report.events.some(event => event.type === 'pageerror' && event.message.includes('fixture page error')));
    assert.ok(report.events.some(event => event.type === 'requestfailed' && event.url.endsWith('/abort')));
    assert.ok(report.events.some(event => event.type === 'http-error' && event.status === 503));
    const zip = await readFile(path.join(output, 'context-1-trace.zip'));
    assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304');
    assert.ok(zip.length > 1000);
    if (mode === 'capture-error') {
      assert.ok(report.captureErrors.some(item => item.error.includes('screenshot unavailable')));
    } else {
      for (const page of [1, 3]) {
        const png = await readFile(path.join(output, `context-1-page-${page}.png`));
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      }
    }
  }
  console.log('Diagnostics: failure exit, scenario, multi-page screenshots, errors, trace, partial capture failure, startup and clean success passed.');
} else {
  const mode = process.env.DIAGNOSTICS_SELF_TEST;
  const diagnostics = await createBrowserDiagnostics('diagnostics-self-test');
  console.log(`OUTPUT: ${diagnostics.output}`);
  let browser;
  try {
    diagnostics.scenario(`self-test ${mode}`);
    if (mode === 'startup') throw new Error('deliberate diagnostic failure');
    const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
    browser = await chromium.launch({ headless: true, ...(process.env.PWA_BROWSER_CHANNEL ? { channel: process.env.PWA_BROWSER_CHANNEL } : {}) });
    const context = await diagnostics.context(browser);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/abort') return route.abort();
      return route.fulfill({ status: url.pathname === '/unavailable' ? 503 : 200, contentType: 'text/html', body: '<h1>Diagnostic fixture</h1>' });
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1/');
    if (mode === 'success') await diagnostics.close(context);
    else {
      const closed = await context.newPage(); await closed.close();
      const peer = await context.newPage(); await peer.goto('http://127.0.0.1/peer');
      const pageError = page.waitForEvent('pageerror');
      await page.evaluate(async () => {
        console.error('fixture console error');
        await fetch('/unavailable'); await fetch('/abort').catch(() => {});
        setTimeout(() => { throw new Error('fixture page error'); });
      });
      await pageError;
      if (mode === 'capture-error') page.screenshot = async () => { throw new Error('screenshot unavailable'); };
      assert.fail('deliberate diagnostic failure');
    }
  } catch (error) {
    await diagnostics.fail(error);
    process.exitCode = 1;
  } finally { await browser?.close(); }
}
