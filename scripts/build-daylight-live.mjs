// Build the connected app alongside the existing root app. No database writes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),out=new URL('daylight/',root);
const source=(await readFile(new URL('index.html',root),'utf8')).replaceAll('\r\n','\n');
assert.ok(source.includes('function initializeDaylight()'),'Build from the Daylight candidate checkout');
assert.ok(source.includes('data-offline="false"'),'Live app must keep online mode');
await mkdir(out,{recursive:true});
const hash=createHash('sha256').update(source).digest('hex').slice(0,12);
const html=source.replace('<head>','<head><meta name="daylight-live-source" content="'+hash+'">')
 .replace('</header>','</header><div class="artifact-banner"><strong>Daylight</strong><span>기존 앱과 같은 여행입니다. 저장한 내용은 두 앱에 함께 반영됩니다.</span></div>');
await writeFile(new URL('index.html',out),html);
const config=(await readFile(new URL('trip-config.js',root),'utf8'))+
 '\n// Separate local drafts; keep the actual shared trip, account and media bucket.\n'+
 'window.TRIP_CONFIG.cacheNamespace += "_daylight";\n'+
 'window.TRIP_CONFIG.pageTitle = "Daylight · " + window.TRIP_CONFIG.pageTitle;\n';
await writeFile(new URL('trip-config.js',out),config);
for(const file of ['pwa.js','sw.js'])await cp(new URL(file,root),new URL(file,out));
for(const directory of ['assets/','icons/'])await cp(new URL(directory,root),new URL(directory,out),{recursive:true});
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
manifest.name='Daylight · '+manifest.name;manifest.short_name='Daylight 여행';manifest.background_color='#f6faf8';manifest.theme_color='#177666';
await writeFile(new URL('manifest.webmanifest',out),JSON.stringify(manifest,null,2)+'\n');
console.log('Built connected Daylight at daylight/; source '+hash+'. No database writes.');
