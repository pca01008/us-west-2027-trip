import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const workflow=await readFile(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');
test('the actual aggregate command rejects failure, cancellation, missing and skipped checks',()=>{
  const command=workflow.match(/run: node (scripts\/require-validation\.mjs)/)[1];
  const script=fileURLToPath(new URL('../'+command,import.meta.url));
  const run=needs=>spawnSync(process.execPath,[script],{env:{...process.env,RESULTS:JSON.stringify(needs)},stdio:'ignore'}).status;
  const success={validate:{result:'success'},sql:{result:'success'},browser:{result:'success'}};
  assert.equal(run(success),0);
  for(const name of Object.keys(success))for(const result of ['failure','cancelled','skipped'])assert.notEqual(run({...success,[name]:{result}}),0,`${name}: ${result}`);
  for(const needs of [{validate:success.validate}, {...success,extra:{result:'success'}}, {unrelated:success.validate,sql:success.sql,browser:success.browser}, null])assert.notEqual(run(needs),0);
  assert.notEqual(spawnSync(process.execPath,[script],{env:{...process.env,RESULTS:'invalid JSON'},stdio:'ignore'}).status,0);
});
test('publication requires aggregate and same-commit artifact, only main pushes deploy',()=>{
  const required=workflow.split('\n  required:')[1].split('\n  pages-build:')[0];
  assert.match(required,/uses: actions\/checkout@v4/);assert.match(required,/ref: \$\{\{ github.sha \}\}/);assert.match(required,/node-version-file: \.node-version/);
  const build=workflow.split('\n  pages-build:')[1].split('\n  deploy:')[0],deploy=workflow.split('\n  deploy:')[1];
  assert.match(build,/needs: required/);assert.match(build,/ref: \$\{\{ github.sha \}\}/);assert.match(build,/check-pages-artifact.mjs _site/);
  assert.match(deploy,/needs: \[required, pages-build\]/);assert.match(deploy,/github.event_name == 'push' && github.ref == 'refs\/heads\/main'/);assert.match(deploy,/Reject a superseded release/);
  assert.doesNotMatch(workflow.split('\n  deploy:')[0],/pages: write|id-token: write/);
});
test('artifact checker rejects omitted/modified assets and leaked authoring paths',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),site=await mkdtemp(path.join(tmpdir(),'westbound-pages-artifact-'));
  const check=()=>spawnSync(process.execPath,[path.join(root,'scripts/check-pages-artifact.mjs'),site],{stdio:'ignore'}).status;
  assert.notEqual(check(),0);
  for(const name of ['index.html','trip-config.js','sw.js','pwa.js','manifest.webmanifest','assets/PretendardVariable-1.3.9.woff2','icons/icon-192.png','daylight/index.html']){await mkdir(path.dirname(path.join(site,name)),{recursive:true});await copyFile(path.join(root,name),path.join(site,name));}
  assert.equal(check(),0);await writeFile(path.join(site,'index.html'),'wrong commit');assert.notEqual(check(),0);await copyFile(path.join(root,'index.html'),path.join(site,'index.html'));
  await mkdir(path.join(site,'docs'));await writeFile(path.join(site,'docs/private.md'),'fixture');assert.notEqual(check(),0);
});

// The probe uses the production gate without a branch-protection check named required.
test('intentional failure probe is manual, shares the gate and cannot publish',async()=>{
  const probe=await readFile(new URL('../.github/workflows/gate-probe.yml',import.meta.url),'utf8');
  assert.match(probe,/name: Gate probe \(intentional failure\)/);
  assert.match(probe,/on:\n  workflow_dispatch:/);
  assert.doesNotMatch(probe,/\n  (push|pull_request|schedule|required|deploy):|pages: write|id-token: write|deploy-pages|continue-on-error/);
  assert.doesNotMatch(workflow,/gate_probe/);
  assert.match(probe,/name: Fail deliberately\n        run: exit 1/);
  assert.equal((probe.match(/if: \$\{\{ false \}\}/g)||[]).length,2);
  const aggregate=probe.split('\n  probe-required:')[1].split('\n  probe-pages-build:')[0];
  assert.match(aggregate,/if: always\(\)/);assert.match(aggregate,/needs: \[validate, sql, browser\]/);
  assert.match(aggregate,/RESULTS: \$\{\{ toJSON\(needs\) \}\}/);assert.match(aggregate,/run: node scripts\/require-validation\.mjs/);
  assert.match(probe.split('\n  probe-pages-build:')[1],/needs: probe-required/);
});
