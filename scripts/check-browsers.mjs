// Run each suite in its own process so a failing suite cannot hide another one.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = ['diagnostics', 'drafts', 'storage', 'inputs', 'imports', 'ledger', 'prep', 'auth', 'photos', 'theme', 'pwa', 'daylight', 'daylight-live', 'daylight-layout'];
const failed = [];
for (const suite of suites) {
  console.log(`\nBrowser suite: ${suite}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./check-${suite}-browser.mjs`, import.meta.url)), ...process.argv.slice(2)], {
    stdio: 'inherit', timeout: 180_000, env: process.env
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
