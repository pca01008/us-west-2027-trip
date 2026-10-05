import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { buildJob, jobSummary } from './configure-db-health-cron.mjs';

export async function prepareHealthSecrets(root) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(await readFile(path.join(root, 'trip-config.js'), 'utf8'), context, { timeout: 1_000 });
  const config = context.window.TRIP_CONFIG?.supabase;
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(config?.url ?? '') ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config?.publishableKey ?? '')) {
    throw new Error('Invalid public Supabase configuration');
  }
  const projectRef = new URL(config.url).hostname.split('.')[0];
  const directory = path.join(root, '.secrets');
  const secretsPath = path.join(directory, 'db-health.env');
  const cronPath = path.join(directory, 'db-health-cron.env');
  await mkdir(directory, { recursive: true });
  let token;
  let reused = false;
  try {
    const existing = parseEnv(await readFile(secretsPath, 'utf8'));
    token = existing.HEALTHCHECK_TOKEN;
    if (existing.HEALTHCHECK_PUBLISHABLE_KEY !== config.publishableKey) throw new Error('Existing publishable key differs; review the secrets file');
    buildJob({ projectRef, token });
    reused = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    token = randomBytes(32).toString('hex');
    await writeFile(secretsPath, `HEALTHCHECK_TOKEN=${token}\nHEALTHCHECK_PUBLISHABLE_KEY=${config.publishableKey}\n`, { flag: 'wx', mode: 0o600 });
  }
  try {
    const existing = parseEnv(await readFile(cronPath, 'utf8'));
    if (existing.HEALTHCHECK_TOKEN !== token || existing.SUPABASE_PROJECT_REF !== projectRef) {
      throw new Error('Existing cron configuration differs; review local files');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(cronPath, `SUPABASE_PROJECT_REF=${projectRef}\nHEALTHCHECK_TOKEN=${token}\nCRON_JOB_API_KEY=\n`, { flag: 'wx', mode: 0o600 });
  }
  return { reused, secretsPath, cronPath, job: jobSummary(buildJob({ projectRef, token })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareHealthSecrets(path.resolve(import.meta.dirname, '..')).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(() => {
    console.error('Unable to prepare healthcheck secrets. Check trip-config.js and existing .secrets files.');
    process.exitCode = 1;
  });
}
