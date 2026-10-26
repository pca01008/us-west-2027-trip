import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const workflow=await readFile(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');
test('the actual aggregate command rejects failure, cancellation, missing and skipped checks',()=>{
  const command=workflow.match(/run: node -e '(const jobs=.*)'/)[1];
  const run=needs=>spawnSync(process.execPath,['-e',command],{env:{...process.env,RESULTS:JSON.stringify(needs)}}).status;
  const success={validate:{result:'success'},sql:{result:'success'},browser:{result:'success'}};
  assert.equal(run(success),0);
  for(const name of Object.keys(success))for(const result of ['failure','cancelled','skipped'])assert.notEqual(run({...success,[name]:{result}}),0,`${name}: ${result}`);
  assert.notEqual(run({validate:success.validate}),0);
});
test('publication requires aggregate and same-commit artifact, only main pushes deploy',()=>{
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
