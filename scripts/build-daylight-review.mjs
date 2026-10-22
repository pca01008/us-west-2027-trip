// Reproducible review artifact from the exact candidate, synthetic data only.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fixtureConfig,readBrowserFixture} from './browser-fixtures.mjs';
const root=new URL('../',import.meta.url);
let source=(await readFile(new URL('index.html',root),'utf8')).replaceAll('\r\n','\n');
const hash=createHash('sha256').update(source).digest('hex').slice(0,12);
const commit=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const config=structuredClone(fixtureConfig);
config.tripId='daylight-review-'+hash;config.cacheNamespace='daylight_review_'+hash;config.title='Daylight · 여행 검토';config.pageTitle='Daylight 기능 검토';config.prep.title='출발 전 준비';config.prep.heading='함께 확인할 목록';
config.prep.items[0].important=true;config.prep.items[3].important=true;
config.prep.items[0].text='여권과 여행 서류 확인';config.prep.items[3].text='숙소 체크인 안내 확인';
config.days[0].events[0].stayCheckout='2027-01-24';config.days[0].events[0].title='첫 도시 숙소';config.days[3].events[0].stayCheckout='2027-01-27';config.days[3].events[0].title='다음 도시 숙소';
const png=(await readBrowserFixture(new URL('assets/fixture.png',root))).toString('base64');
config.days.forEach(day=>day.events.forEach(event=>event.photos?.forEach(photo=>photo.src='data:image/png;base64,'+png)));
source=source.replace('data-offline="false"','data-offline="true" data-offline-id="'+hash+'"')
 .replace(/<script id="pwaRegistration"[^>]*><\/script>/,'')
 .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/,'')
 .replace(/<script id="tripConfigScript"[^>]*><\/script>/,'<script id="embeddedTripConfig">window.TRIP_CONFIG='+JSON.stringify(config).replaceAll('<','\\u003c')+';</script>')
 .replace(/<link[^>]*rel="(?:manifest|icon|apple-touch-icon)"[^>]*>/g,'')
 .replace('<head>','<head><meta name="robots" content="noindex,nofollow"><meta name="daylight-source" content="'+hash+'">')
 .replace('</header>','</header><div class="artifact-banner"><strong>기능 검토본 · 예시 데이터</strong><span>변경은 이 브라우저에만 보관됩니다. 공유 저장·로그인은 로컬 가상 API 검사로 검증합니다.</span><small>기준 '+commit+' · 후보 '+hash+' · fixture 1</small></div>');
await writeFile(new URL('ui-preview/daylight-candidate.html',root),source);
console.log(`Generated ui-preview/daylight-candidate.html (source ${hash}, base ${commit}, fixture 1). No production API, accounts or PWA registration.`);
