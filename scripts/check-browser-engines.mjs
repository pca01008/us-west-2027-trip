// Limit extra engines to critical input/dialog/draft/export paths.
import { runCommand } from './check-ci.mjs';
const controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
engines: for(const engine of ['firefox','webkit'])for(const group of ['navigation','dialogs','editing']){
  console.log(`Browser compatibility: ${engine} / ${group}`);
  const env={...process.env,TRIP_BROWSER_ENGINE:engine};delete env.PWA_BROWSER_CHANNEL;
  const result=await runCommand(process.execPath,['scripts/check-inputs-browser.mjs','--functional','--group='+group],{env,timeoutMs:180000,signal:controller.signal});
  console.log(`${engine} / ${group}: ${result.status}; ${(result.elapsedMs/1000).toFixed(1)}s / 180s`);
  if(result.elapsedMs>=135000)console.warn(`Timing warning: ${engine} / ${group} used >=75% of its deadline.`);
  if(result.status!=='passed'){process.exitCode=1;break engines;}
}
if(!process.exitCode)console.log('All 6 extra-engine input groups passed.');
