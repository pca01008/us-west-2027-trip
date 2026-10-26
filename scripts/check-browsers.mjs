// Separate processes retain each suite's diagnostics and deadline.
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from './check-ci.mjs';
const all=['diagnostics','drafts','storage','inputs','imports','versions','ledger','currency','ledger-compat','prep','auth','photos','theme','palette','navigation','pwa'];
const args=process.argv.slice(2),only=args.find(arg=>arg.startsWith('--only=')),modulePath=args.find(arg=>!arg.startsWith('--'));
const suites=only?only.slice(7).split(','):all;
if(args.some(arg=>arg.startsWith('--')&&arg!==only)||suites.some(suite=>!all.includes(suite))||new Set(suites).size!==suites.length)throw Error('Use --only=inputs,drafts for a labeled partial run.');
const controller=new AbortController();for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>controller.abort());
const results=[];
for(const suite of suites){
  if(controller.signal.aborted){results.push({suite,status:'not-run'});continue;}
  console.log(`\n${only?'PARTIAL browser':'Browser'} suite: ${suite}`);
  const deadlineMs=suite==='drafts'?300000:180000;
  const result=await runCommand(process.execPath,[fileURLToPath(new URL(`./check-${suite}-browser.mjs`,import.meta.url)),...(modulePath?[modulePath]:[])],{timeoutMs:deadlineMs,signal:controller.signal});
  results.push({suite,deadlineMs,...result});
  console.log(`${suite}: ${result.status}; ${(result.elapsedMs/1000).toFixed(1)}s / ${deadlineMs/1000}s`);
  if(result.elapsedMs>=deadlineMs*.75)console.warn(`Timing warning: ${suite} used >=75% of its deadline; investigate before increasing it.`);
}
const output=await mkdtemp(path.join(tmpdir(),'westbound-browser-timing-'));await writeFile(path.join(output,'results.json'),JSON.stringify({scope:only?'PARTIAL':'full Chromium',results},null,2));console.log('Browser timings:',output);
if(results.some(result=>result.status!=='passed'))process.exitCode=1;
else console.log(`${only?'PARTIAL: ':''}All ${suites.length} browser suites passed.`);
