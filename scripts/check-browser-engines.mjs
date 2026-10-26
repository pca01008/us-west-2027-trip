// Limit extra engines to critical input/dialog/draft/export paths.
import { runCommand } from './check-ci.mjs';
const controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
for(const engine of ['firefox','webkit']){
  console.log(`Browser compatibility: ${engine} input/dialog/export suite`);
  const env={...process.env,TRIP_BROWSER_ENGINE:engine};delete env.PWA_BROWSER_CHANNEL;
  const result=await runCommand(process.execPath,['scripts/check-inputs-browser.mjs'],{env,timeoutMs:180000,signal:controller.signal});
  if(result.status!=='passed'){process.exitCode=1;break;}
}
