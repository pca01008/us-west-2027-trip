import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),site=path.resolve(process.argv[2]||'_site');
for(const name of ['index.html','trip-config.js','sw.js','pwa.js','manifest.webmanifest','assets/PretendardVariable-1.3.9.woff2','icons/icon-192.png','daylight/index.html'])assert.deepEqual(await readFile(path.join(site,name)),await readFile(path.join(root,name)),`Published asset differs: ${name}`);
const forbidden=new Set(['docs','src','scripts','tests','node_modules','vendor','migrations','supabase','AGENTS.md','PRODUCT.md','package.json','package-lock.json','trip-config.template.js','supabase_setup.sql','register_trip.sql']);
async function inspect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink()&&!forbidden.has(entry.name)&&!entry.name.startsWith('.')&&!entry.name.endsWith('.log'),`Unexpected publication: ${path.join(dir,entry.name)}`);if(entry.isDirectory())await inspect(path.join(dir,entry.name));}}
await inspect(site);
console.log('Pages artifact: required asset bytes match; authoring/test/private paths excluded.');
