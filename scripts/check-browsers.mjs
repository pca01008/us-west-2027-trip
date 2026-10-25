// Run each suite in its own process so a failing suite cannot hide another one.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = ['diagnostics', 'drafts', 'storage', 'inputs', 'imports', 'ledger', 'currency', 'ledger-compat', 'prep', 'auth', 'photos', 'theme', 'palette', 'navigation', 'pwa'];
const failed = [];
for (const suite of suites) {
  console.log(`\nBrowser suite: ${suite}`);
  // Drafts includes lifecycle, storage and photo fault matrices on CI hardware.
  const timeout = suite === 'drafts' ? 300_000 : 180_000;
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./check-${suite}-browser.mjs`, import.meta.url)), ...process.argv.slice(2)], {
    stdio: 'inherit', timeout, env: process.env
  });
  if (result.status !== 0) {
    failed.push(suite);
    if (result.error) console.error(result.error.message);
  }
}
if (failed.length) {
  console.error(`Browser suites failed: ${failed.join(', ')}`);
  process.exitCode = 1;
} else console.log(`\nAll ${suites.length} browser suites passed.`);
