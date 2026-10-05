import { pathToFileURL } from 'node:url';

export function buildJob({ projectRef, token }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? '')) throw new Error('Invalid Supabase project reference');
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token ?? '')) throw new Error('Invalid healthcheck token');
  return {
    title: `DB healthcheck: ${projectRef}`,
    enabled: true,
    url: `https://${projectRef}.supabase.co/functions/v1/trip-db-health`,
    saveResponses: false,
    requestMethod: 0,
    requestTimeout: 30,
    redirectSuccess: false,
    schedule: {
      timezone: 'Asia/Seoul', expiresAt: 0,
      hours: [0, 6, 12, 18], minutes: [17],
      mdays: [-1], months: [-1], wdays: [-1],
    },
    notification: {
      onFailure: true, onFailureCount: 1, onSuccess: true, onDisable: true,
      mode: 2, selectedChannels: [0],
    },
    extendedData: { headers: { 'X-Healthcheck-Token': token }, body: '' },
  };
}

export function verifyJob(actual, expected) {
  for (const name of ['title', 'enabled', 'url', 'saveResponses', 'requestMethod', 'requestTimeout', 'redirectSuccess']) {
    if (actual?.[name] !== expected[name]) throw new Error(`Cron configuration mismatch: ${name}`);
  }
  for (const name of Object.keys(expected.schedule)) {
    if (JSON.stringify(actual.schedule?.[name]) !== JSON.stringify(expected.schedule[name])) {
      throw new Error(`Cron configuration mismatch: schedule.${name}`);
    }
  }
  for (const name of Object.keys(expected.notification)) {
    if (JSON.stringify(actual.notification?.[name]) !== JSON.stringify(expected.notification[name])) {
      throw new Error(`Cron configuration mismatch: notification.${name}`);
    }
  }
  const headers = actual.extendedData?.headers ?? {};
  const healthHeaders = Object.entries(headers).filter(([name]) => name.toLowerCase() === 'x-healthcheck-token');
  if (healthHeaders.length !== 1 || healthHeaders[0][1] !== expected.extendedData.headers['X-Healthcheck-Token'] ||
      Object.keys(headers).length !== 1 || (actual.extendedData?.body ?? '') !== '') {
    throw new Error('Cron configuration mismatch: request headers/body');
  }
}

export function jobSummary(job) {
  return {
    title: job.title, url: job.url, enabled: job.enabled,
    schedule: job.schedule, notification: job.notification,
    requestTimeout: job.requestTimeout, saveResponses: job.saveResponses,
    authentication: 'X-Healthcheck-Token (redacted)',
  };
}

export async function configureCron({ job, apiKey, fetchImpl = globalThis.fetch }) {
  if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error('CRON_JOB_API_KEY is required');
  // Prove the deployed function and token work before enabling any recurring work.
  const healthResponse = await fetchImpl(job.url, {
    headers: job.extendedData.headers,
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25_000),
  });
  if (healthResponse.status !== 200 || (await healthResponse.json()).ok !== true) {
    throw new Error('Deployed healthcheck preflight failed; no cron job was changed');
  }
  async function api(method, route, payload) {
    const response = await fetchImpl(`https://api.cron-job.org${route}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 200) throw new Error(`Cron API ${method} failed (HTTP ${response.status})`);
    return response.json();
  }
  const listing = await api('GET', '/jobs');
  if (!Array.isArray(listing.jobs) || listing.someFailed) throw new Error('Incomplete cron job list; stopped to avoid duplicates');
  const matches = listing.jobs.filter(existing => existing.title === job.title && existing.url === job.url);
  if (matches.length > 1) throw new Error('Multiple matching cron jobs; resolve duplicates in the Console');
  let jobId = matches[0]?.jobId;
  if (jobId !== undefined && (!Number.isSafeInteger(jobId) || jobId <= 0)) throw new Error('Invalid existing cron job ID');
  if (jobId === undefined) {
    // Verify configuration while disabled, then activate. Never blindly create a second job on errors.
    const disabledJob = { ...job, enabled: false };
    const created = await api('PUT', '/jobs', { job: disabledJob });
    jobId = created.jobId;
    if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new Error('Cron API returned an invalid job ID');
    const details = await api('GET', `/jobs/${jobId}`);
    verifyJob(details.jobDetails, disabledJob);
  }
  await api('PATCH', `/jobs/${jobId}`, { job });
  const details = await api('GET', `/jobs/${jobId}`);
  verifyJob(details.jobDetails, job);
  return { jobId, verified: true, ...jobSummary(job) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply') || args.length > 1) throw new Error('Usage: node scripts/configure-db-health-cron.mjs [--apply]');
  const job = buildJob({ projectRef: process.env.SUPABASE_PROJECT_REF, token: process.env.HEALTHCHECK_TOKEN });
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ dryRun: true, ...jobSummary(job) }, null, 2));
    return;
  }
  const result = await configureCron({ job, apiKey: process.env.CRON_JOB_API_KEY });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // HTTP/provider errors may echo credentials; deliberately omit raw exception text.
    console.error('Healthcheck setup failed. Check environment values, deployed function and cron-job.org Console.');
    process.exitCode = 1;
  });
}
