import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSuites,checkEnvironment,runCommand,verify } from '../scripts/check-ci.mjs';
import { mkdtemp,mkdir,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const baseline={platform:'linux',release:'ID=ubuntu\nVERSION_ID="24.04"',node:'24.22.1',npm:'11.19.1',expectedNode:'24.22.1',expectedNpm:'11.19.1'};
test('required environment rejects mismatched tools, OS and browser overrides',()=>{
  checkEnvironment(baseline);
  for(const change of [{platform:'win32'},{release:'ID=ubuntu\nVERSION_ID="26.04"'},{node:'22.22.1'},{npm:''},{channel:'chrome'},{engine:'webkit'}])assert.throws(()=>checkEnvironment({...baseline,...change}));
});
test('full and explicitly partial selections cannot hide unknown or duplicate stages',()=>{
  assert.deepEqual(selectSuites([]),['validate','sql','browser']);assert.deepEqual(selectSuites(['--suite=sql']),['sql']);
  for(const args of [['--skip-sql'],['--suite=unknown'],['--suite=sql','--suite=sql']])assert.throws(()=>selectSuites(args));
});
test('missing prerequisites stop before tests; subset success remains PARTIAL',async()=>{
  let calls=0;const execute=async()=>{calls++;return {status:'passed'};};
  const failed=await verify({suites:selectSuites([]),prepare:async()=>{throw Error('Missing SQL');},execute});
  assert.equal(failed.status,'setup-failed');assert.equal(calls,0);assert.ok(Object.values(failed.results).every(item=>item.status==='not-run'));
  const partial=await verify({suites:['validate'],prepare:async()=>({versions:{}}),execute});assert.equal(partial.scope,'PARTIAL');assert.equal(partial.results.sql.status,'not-run');
});
test('failed/stale-output validation and browser failure propagate without a full pass',async()=>{
  for(const failure of ['validate','browser']){
    const calls=[];const report=await verify({suites:selectSuites([]),prepare:async()=>({versions:{}}),execute:async suite=>{calls.push(suite);return {status:suite===failure?'failed':'passed',code:suite===failure?1:0};}});
    assert.equal(report.status,'failed');assert.equal(report.results[failure].code,1);if(failure==='validate')assert.deepEqual(calls,['validate']);
  }
});
test('child exit failure, setup failure, deadline and cancellation remain distinct',async()=>{
  assert.equal((await runCommand(process.execPath,['-e','process.exit(7)'],{stdio:'ignore'})).code,7);
  assert.equal((await runCommand('nonexistent-trip-test-program',[],{stdio:'ignore'})).status,'setup-failed');
  assert.equal((await runCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:60,stdio:'ignore'})).status,'deadline');
  const controller=new AbortController();setTimeout(()=>controller.abort(),60);
  assert.equal((await runCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:controller.signal,stdio:'ignore'})).status,'cancelled');
});
test('actual generated-output check rejects changed source without repairing output',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'westbound-stale-output-'));
  await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'src/trip'),{recursive:true});
  const script=path.join(root,'scripts/build-app.mjs');await writeFile(script,await readFile(new URL('../scripts/build-app.mjs',import.meta.url)));
  const source=path.join(root,'src/index.html');await writeFile(source,'<!doctype html>\n<p>Fixture</p>');await writeFile(path.join(root,'src/trip/config.js'),'// fixture\n');
  assert.equal(spawnSync(process.execPath,[script]).status,0);
  const before=await readFile(path.join(root,'index.html'),'utf8');await writeFile(source,'<!doctype html>\n<p>Changed source</p>');
  const result=spawnSync(process.execPath,[script,'--check'],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/is stale/);assert.equal(await readFile(path.join(root,'index.html'),'utf8'),before);
});
