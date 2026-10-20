// For isolated fixture browsers only: traces include DOM and network bodies.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function createBrowserDiagnostics(suite) {
  const output = await mkdtemp(path.join(tmpdir(), `westbound-${suite}-diagnostics-`));
  const contexts = new Map(), events = [], steps = [], captureErrors = [];
  let scenario = 'startup', nextContext = 0, failed = false;
  const log = (type, data) => {
    events.push({ time: new Date().toISOString(), scenario, type, ...data });
    if (events.length > 1000) events.shift();
  };
  const attempt = async (name, action) => {
    try { await action(); } catch (error) { captureErrors.push({ name, error: String(error) }); }
  };
  const api = {
    output,
    scenario(name) {
      scenario = name;
      steps.push({ time: new Date().toISOString(), scenario });
      console.log(`[${suite}] ${name}`);
    },
    async context(browser, options = {}) {
      const context = await browser.newContext(options);
      const record = { id: ++nextContext, scenario, pageErrors: [] };
      const pageIds = new Map();
      contexts.set(context, record);
      context.on('page', page => {
        const pageId = pageIds.size + 1;
        pageIds.set(page, pageId);
        page.on('console', message => log('console', { context: record.id, page: pageId, level: message.type(), message: message.text() }));
        page.on('pageerror', error => {
          record.pageErrors.push(error.message);
          log('pageerror', { context: record.id, page: pageId, message: error.stack || error.message });
        });
      });
      context.on('requestfailed', request => log('requestfailed', { context: record.id, method: request.method(), url: request.url(), error: request.failure()?.errorText }));
      context.on('response', response => {
        if (response.status() >= 400) log('http-error', { context: record.id, status: response.status(), url: response.url() });
      });
      record.pageIds = pageIds;
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
      return context;
    },
    async close(context) {
      const record = contexts.get(context);
      // Do not discover an uncaught browser error after its page/trace is gone.
      if (record?.pageErrors.length && !failed) throw new Error(`${record.scenario}: ${record.pageErrors.join('\n')}`);
      if (record && !failed) await context.tracing.stop();
      await context.close();
      contexts.delete(context);
    },
    async fail(error) {
      if (failed) return;
      failed = true;
      // Each capture is independent: a crashed page must not hide the trace or
      // replace the assertion that originally failed.
      for (const [context, record] of contexts) {
        for (const page of context.pages()) {
          const pageId = record.pageIds.get(page);
          await attempt(`context-${record.id}/page-${pageId}`, () => page.screenshot({ path: path.join(output, `context-${record.id}-page-${pageId}.png`), timeout: 5000 }));
        }
        await attempt(`context-${record.id}/trace`, () => context.tracing.stop({ path: path.join(output, `context-${record.id}-trace.zip`) }));
      }
      await attempt('failure.json', () => writeFile(path.join(output, 'failure.json'), JSON.stringify({
        suite, scenario, error: error?.stack || String(error), cause: error?.cause?.stack,
        steps, contexts: [...contexts.values()].map(({ pageIds, ...record }) => record), events, captureErrors
      }, null, 2)));
      console.error(`Browser failure: ${suite} / ${scenario}\nDiagnostics: ${output}`);
      if (captureErrors.length) console.error('Diagnostic capture errors:', captureErrors);
    }
  };
  return api;
}
