import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, access } from 'node:fs/promises';
import { tmpdir, arch, availableParallelism } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
export function selectSuites(args) {
  if (!args.length) return ['validate', 'sql', 'browser'];
  if (args.length !== 1 || !/^--suite=(validate|sql|browser)$/.test(args[0])) throw Error('Use no arguments for full verification, or --suite=validate|sql|browser for a PARTIAL check.');
  return [args[0].slice(8)];
}
export function checkEnvironment({ platform, release, node, npm, expectedNode, expectedNpm, channel, engine }) {
  if (platform !== 'linux' || !/^ID=ubuntu$/m.test(release) || !/^VERSION_ID="?24\.04"?$/m.test(release)) throw Error('Required baseline is Ubuntu 24.04. Windows/other Linux checks are development evidence; see docs/OPERATIONS.md#validation.');
  if (node !== expectedNode || npm !== expectedNpm) throw Error(`Use Node ${expectedNode} / npm ${expectedNpm}; received Node ${node} / npm ${npm}.`);
  if (channel || engine) throw Error('Unset PWA_BROWSER_CHANNEL and TRIP_BROWSER_ENGINE for required checks; pinned browsers are required.');
}
export function runCommand(command, args, { timeoutMs=180000, signal, env=process.env, cwd=root, stdio='inherit' }={}) {
  return new Promise(resolve => {
    const start=Date.now();let reason=null,done=false,hardStop;
    if(signal?.aborted){resolve({status:'cancelled',code:null,elapsedMs:0});return;}
    const child=spawn(command,args,{cwd,env,stdio,detached:process.platform!=='win32'});
    const kill=force=>{
      if(!child.pid)return;
      if(process.platform==='win32'){spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',timeout:3000});child.kill('SIGKILL');}
      else try{process.kill(-child.pid,force?'SIGKILL':'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
    };
    const stop=why=>{if(done||reason)return;reason=why;kill(false);hardStop=setTimeout(()=>kill(true),2000);};
    const cancel=()=>stop('cancelled'),timer=setTimeout(()=>stop('deadline'),timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});
    const finish=result=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(hardStop);signal?.removeEventListener('abort',cancel);resolve({...result,elapsedMs:Date.now()-start});};
    child.once('error',error=>finish({status:'setup-failed',code:null,error:error.message}));
    child.once('close',(code,terminationSignal)=>{if(reason&&process.platform!=='win32')kill(true);finish({status:reason||(code===0?'passed':terminationSignal?'signal':'failed'),code,signal:terminationSignal});});
  });
}

async function preflight(suites) {
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const expectedNode=(await readFile(path.join(root,'.node-version'),'utf8')).trim();
  const expectedNpm=pkg.packageManager.slice(4),npmCli=process.env.npm_execpath;
  const release=process.platform==='linux'?await readFile('/etc/os-release','utf8'):'';
  const npm=npmCli?spawnSync(process.execPath,[npmCli,'--version'],{encoding:'utf8'}).stdout?.trim():'';
  console.log('Environment baseline:',JSON.stringify({platform:process.platform,os:release.split('\n').find(line=>line.startsWith('PRETTY_NAME='))||process.platform,arch:arch(),node:process.version,npm}));
  checkEnvironment({platform:process.platform,release,node:process.versions.node,npm,expectedNode,expectedNpm,channel:process.env.PWA_BROWSER_CHANNEL,engine:process.env.TRIP_BROWSER_ENGINE});
  if(!npmCli)throw Error('Run through npm run test:ci after npm ci.');
  const versions={os:release.split('\n').find(line=>line.startsWith('PRETTY_NAME=')),arch:arch(),parallelism:availableParallelism(),unitFileConcurrency:1,node:process.version,npm};
  for(const [name,version] of Object.entries(pkg.devDependencies)){
    let installed;try{installed=JSON.parse(await readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;}catch{throw Error(`Missing ${name}; run npm ci.`);}
    if(installed!==version)throw Error(`${name}: expected ${version}; run npm ci.`);
    versions[name]=installed;
  }
  if(suites.includes('sql')){
    const raw=process.env.TRIP_SQL_TEST_URL;
    if(!raw)throw Error('Missing TRIP_SQL_TEST_URL: start disposable loopback PostgreSQL 17.');
    const url=new URL(raw);
    if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.search||url.hash)throw Error('SQL must use disposable loopback PostgreSQL without URL options.');
    const {default:pg}=await import('pg');const client=new pg.Client({connectionString:raw,connectionTimeoutMillis:5000,query_timeout:5000});
    try{await client.connect();const {rows}=await client.query('show server_version');versions.postgres=rows[0].server_version;if(!versions.postgres.startsWith('17.'))throw Error('PostgreSQL 17 required.');}finally{await client.end();}
  }
  if(suites.includes('browser')){
    const playwright=await import('playwright');versions.browsers={};
    for(const name of ['chromium','firefox','webkit']){
      try{await access(playwright[name].executablePath());const browser=await playwright[name].launch({headless:true});try{versions.browsers[name]=browser.version();}finally{await browser.close();}}
      catch{throw Error(`Missing/unusable pinned ${name}; run npx playwright install --with-deps chromium firefox webkit.`);}
    }
  }
  console.log('Verified tools:',JSON.stringify(versions));
  return {npmCli,versions};
}
export async function verify({suites,prepare,execute,signal}) {
  const results=Object.fromEntries(['validate','sql','browser'].map(name=>[name,{status:'not-run'}]));
  let environment;
  try{environment=await prepare(suites);}catch(error){return {scope:suites.length===3?'full':'PARTIAL',status:'setup-failed',error:error.message,results};}
  for(const suite of suites){
    try{results[suite]=await execute(suite,environment,signal);}catch(error){results[suite]={status:'setup-failed',error:error.message};}
    if(results[suite].status!=='passed')break;
  }
  const passed=suites.every(suite=>results[suite].status==='passed');
  return {scope:suites.length===3?'full':'PARTIAL',status:passed?'passed':'failed',environment:environment.versions,results};
}
async function main(){
  const suites=selectSuites(process.argv.slice(2)),controller=new AbortController();
  for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>controller.abort());
  const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}),workingTree=spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});
  const source=revision.stdout?.trim()||'unknown',dirty=workingTree.stdout?.trim();
  console.log(`${suites.length===3?'Full':'PARTIAL'} verification: ${suites.join(', ')}; commit ${source}; ${dirty?'modified working tree (development evidence)':'clean working tree'}`);
  const report=await verify({suites,prepare:async selected=>{if(revision.status!==0||workingTree.status!==0)throw Error('Cannot establish Git commit/working-tree identity.');return preflight(selected);},signal:controller.signal,execute:async(suite,{npmCli},signal)=>{
    const start=Date.now(),commands=suite==='validate'?[['test']]:suite==='sql'?[['run','test:sql']]:[['run','test:browser'],['run','test:browser:smoke']];
    for(const args of commands){const result=await runCommand(process.execPath,[npmCli,...args],{timeoutMs:suite==='browser'?1200000:240000,signal});if(result.status!=='passed')return {...result,elapsedMs:Date.now()-start};}
    return {status:'passed',elapsedMs:Date.now()-start};
  }});
  report.source={commit:source,dirty:Boolean(dirty)};
  const output=process.env.TRIP_CHECK_OUTPUT||await mkdtemp(path.join(tmpdir(),'westbound-ci-'));await mkdir(output,{recursive:true});await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));
  const summary=`${report.scope} verification ${report.status}\nCommit: ${source}${dirty?' (modified development files)':''}\n${Object.entries(report.results).map(([name,result])=>`${name}: ${result.status}${result.elapsedMs===undefined?'':` (${(result.elapsedMs/1000).toFixed(1)}s)`}`).join('\n')}\n${report.error||''}\n`;
  console.log(summary);console.log('Summary:',output);if(process.env.GITHUB_STEP_SUMMARY)await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY,'```text\n'+summary+'```\n');
  if(report.status!=='passed')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
