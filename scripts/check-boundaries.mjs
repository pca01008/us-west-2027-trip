// The full browser run is attempt one; keep both further attempts visible.
import { runCommand } from './check-ci.mjs';
const controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
for(let attempt=process.argv.includes('--after-full')?2:1;attempt<=3;attempt++){
  console.log(`Boundary stability attempt ${attempt}/3 (no retries)`);
  const result=await runCommand(process.execPath,['scripts/check-browsers.mjs','--only=inputs,drafts'],{timeoutMs:500000,signal:controller.signal});
  if(result.status!=='passed'){process.exitCode=1;break;}
}
