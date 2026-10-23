// Pin both app sources; only the review wrapper, fixture and isolation are injected.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fixtureConfig,readBrowserFixture} from './browser-fixtures.mjs';
const root=new URL('../',import.meta.url);
const baseline='22ecee308d3019cf6303a3d464013ea7172e4d6c';
const candidate=execFileSync('git',['log','-1','--format=%H','--','index.html'],{cwd:root,encoding:'utf8'}).trim();
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
const config=structuredClone(fixtureConfig);
config.title='함께 떠나는 여행';config.pageTitle='여행 버전 비교';config.kicker='TRIP PLANNER';
config.prep.title='출발 전 준비';config.prep.subtitle='여행 전에 함께 확인해요';config.prep.heading='준비 목록';
config.prep.items.forEach((item,i)=>item.text=['여권과 여행 서류 확인','항공편과 수하물 확인','여행자 보험 준비','숙소 체크인 안내 확인','휴대폰 로밍 준비','충전기와 어댑터 챙기기','교통편 확인','비상 연락처 정리','날씨와 옷차림 확인','예약 일정 확인','개인 상비품 챙기기','출발 전 짐 확인'][i]);
config.prep.items[0].important=true;config.prep.items[3].important=true;
config.days[0].events[0].stayCheckout='2027-01-24';config.days[0].events[0].title='첫 도시 숙소';
config.days[3].events[0].stayCheckout='2027-01-27';config.days[3].events[0].title='다음 도시 숙소';
config.days.forEach(day=>day.events.forEach(event=>event.detail='두 버전에서 동일하게 사용하는 예시 일정입니다.'));
config.ledger.defaultBudgetKrw=1500000;
const png=(await readBrowserFixture(new URL('assets/fixture.png',root))).toString('base64');
config.days.forEach(day=>day.events.forEach(event=>event.photos?.forEach(photo=>photo.src='data:image/png;base64,'+png)));
config.supabase={url:'',publishableKey:'',mediaBucket:'comparison'};config.editorEmail='';
const expenses=[{id:'compare-1',name:'공항 이동',amount:45,currency:'USD',date:'2027-01-21',categoryId:'transport'},{id:'compare-2',name:'점심 식사',amount:32.5,currency:'USD',date:'2027-01-22',categoryId:'food'},{id:'compare-3',name:'여행 준비 물품',amount:28000,currency:'KRW',date:'2027-01-21',categoryId:'misc'}];
const fixtureHash=digest(JSON.stringify({config,expenses}));
const sources={before:execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6}).replaceAll('\r\n','\n'),after:(await readFile(new URL('index.html',root),'utf8')).replaceAll('\r\n','\n')};
const manifest={fixture:2,fixtureHash,baseline,candidate,beforeHash:digest(sources.before),afterHash:digest(sources.after)};
for(const [side,original] of Object.entries(sources)){
 const hash=digest(original),namespace=`daylight_compare_${fixtureHash}_${hash}_${side}`;
 const scoped={...config,pageTitle:(side==='before'?'기존 버전':'Daylight')+' · 여행 비교',tripId:namespace.replaceAll('_','-'),cacheNamespace:namespace};
 const setup=`window.TRIP_CONFIG=${JSON.stringify(scoped).replaceAll('<','\\u003c')};(()=>{const session=new URLSearchParams(location.search).get('session')||'standalone';const safe=/^[a-zA-Z0-9_-]{1,64}$/.test(session)?session:'standalone';window.TRIP_CONFIG.tripId+='-'+safe.toLowerCase().replaceAll('_','-');window.TRIP_CONFIG.cacheNamespace+='_'+safe;document.documentElement.dataset.offlineId=window.TRIP_CONFIG.tripId;})();`;
 const seam='setEditable(false);lastSavedState=normalizeState(captureState());';
 assert.equal(original.split(seam).length,2,'Seed seam must match once in '+side);
 let html=original.replace('data-offline="false"',`data-offline="true" data-theme-scope="/daylight-compare/${fixtureHash}/${side}/"`)
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
  .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/,'')
  .replace(/<script id="tripConfigScript"[^>]*><\/script>/,`<script id="embeddedTripConfig">${setup}</script>`)
  .replace(/<link[^>]*rel="(?:manifest|icon|apple-touch-icon)"[^>]*>/g,'')
  .replace('<head>',`<head><meta name="robots" content="noindex,nofollow"><meta name="comparison-source" content="${hash}"><meta name="comparison-fixture" content="${fixtureHash}">`)
  .replace(seam,`setEditable(false);expenses=${JSON.stringify(expenses)};renderLedger();lastSavedState=normalizeState(captureState());`)
  .replace('</header>',`</header><div class="artifact-banner"><strong>${side==='before'?'기존 버전':'Daylight'} · 비교용 예시</strong><span>편집은 이 비교본에만 보관됩니다.</span><small>${(side==='before'?baseline:candidate).slice(0,7)} · ${hash} · 예시 ${fixtureHash}</small></div>`);
 await writeFile(new URL(`ui-preview/daylight-${side}.html`,root),html);
}
for(const name of ['daylight-compare.html','daylight-compare.css','daylight-compare.js']){
 let content=await readFile(new URL('docs/ui-concepts/'+name,root),'utf8');
 if(name.endsWith('.html'))content=content.replace('<!-- COMPARISON_MANIFEST -->',`<script id="comparisonManifest" type="application/json">${JSON.stringify(manifest)}</script>`);
 await writeFile(new URL('ui-preview/'+name,root),content);
}
await writeFile(new URL('ui-preview/daylight-comparison.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log('Built comparison:',manifest);
