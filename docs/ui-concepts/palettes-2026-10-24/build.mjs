// Isolated color proposals, rendered from the current local app. No cloud access.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', here);
await mkdir(new URL('images/', here), { recursive: true });
const sandbox = { window: {} };
vm.runInNewContext(await readFile(new URL('trip-config.js', root), 'utf8'), sandbox);
const config = JSON.parse(JSON.stringify(sandbox.window.TRIP_CONFIG));
config.supabase = {};
config.editorEmail = 'preview@example.test';
config.cacheNamespace = 'palette_preview_only';
const source = (await readFile(new URL('index.html', root), 'utf8'))
  .replace(/<script id="pwaRegistration"[^>]*><\/script>/, '')
  .replace(/<script src="[^\"]*supabase[^\"]*"[^>]*><\/script>/, '');

export const palettes = [
  { id: 'a', title: '네이비 · 코랄', en: 'Navy & Coral', description: '익숙한 네이비에 따뜻한 코랄. 또렷하고 활기 있는 여행 플래너.',
    header: '#17324D', headerEnd: '#2B5067', accent: '#B34738', accentHover: '#94382D', glow: '#F2B090',
    canvas: '#F6F3EF', paper: '#FFFEFC', surface: '#FBF9F6', alt: '#EFECE7', selected: '#E9E4DD',
    ink: '#253344', muted: '#646B74', line: '#DEDCD6', strong: '#BABEBF', link: '#2A5F7B',
    dark: { canvas: '#131E2A', paper: '#1C2B3B', surface: '#223346', alt: '#283C50', selected: '#334A60', ink: '#EBF0F6', muted: '#B4C2D2', line: '#405369', accent: '#F0A38D', hover: '#FFC2AC', on: '#2D201C', navy: '#DAE7F4' } },
  { id: 'b', title: '포레스트 · 샌드', en: 'Forest & Sand', description: '짙은 숲색과 부드러운 모래색. 오래 보기 편안한 차분한 분위기.',
    header: '#183E36', headerEnd: '#345C4D', accent: '#2D6754', accentHover: '#214F40', glow: '#DFC498',
    canvas: '#F1F4EE', paper: '#FEFFFA', surface: '#F7F9F3', alt: '#E9EFE4', selected: '#DEE8D9',
    ink: '#243B32', muted: '#5E6E63', line: '#D6DFD0', strong: '#AFBEAA', link: '#346352',
    dark: { canvas: '#14221D', paper: '#1D3027', surface: '#263B30', alt: '#2D4538', selected: '#375343', ink: '#E9F1E8', muted: '#B5C8B7', line: '#455D4C', accent: '#AECFB1', hover: '#CEE7CC', on: '#17281D', navy: '#DBE9D9' } },
  { id: 'c', title: '플럼 · 로즈', en: 'Plum & Rose', description: '깊은 자두색에 말린 장미빛. 부드럽고 정돈된 여행 다이어리.',
    header: '#49344E', headerEnd: '#705168', accent: '#A33F65', accentHover: '#873252', glow: '#EAB4C7',
    canvas: '#F8F2F5', paper: '#FFFCFE', surface: '#FCF7FA', alt: '#F0E7ED', selected: '#EBDCE6',
    ink: '#3C2F3C', muted: '#756273', line: '#E3D5DF', strong: '#C5ACBE', link: '#79506D',
    dark: { canvas: '#251D28', paper: '#332838', surface: '#403044', alt: '#49384E', selected: '#594360', ink: '#F4EAF1', muted: '#CDB8C9', line: '#66506C', accent: '#E9AAC3', hover: '#FFD0E1', on: '#321D2B', navy: '#EFDEED' } }
];
await writeFile(new URL('palettes.json', here), JSON.stringify(palettes, null, 2) + '\n');
const tokens = p => {
  const d = p.dark;
  return `:root{--navy:${p.header};--navy-soft:${p.headerEnd};--solid:${p.header};--cream:${p.canvas};--paper:${p.paper};--surface:${p.surface};--surface-alt:${p.alt};--surface-hover:${p.selected};--surface-selected:${p.selected};--ink:${p.ink};--muted:${p.muted};--placeholder:${p.muted};--line:${p.line};--line-strong:${p.strong};--accent:${p.accent};--accent-hover:${p.accentHover};--blue:${p.accent};--blue-dark:${p.accentHover};--on-accent:#fff;--on-solid:#fff;--focus:${p.accent};--link:${p.link};--link-bg:${p.surface};--link-icon:${p.selected};--link-line:${p.strong};--edit-bg:${p.surface};--track:${p.line};--proposal-header:${p.header};--proposal-header-end:${p.headerEnd};--proposal-glow:${p.glow};--shadow-sm:0 8px 24px color-mix(in srgb,${p.header} 6%,transparent);--shadow-lg:0 22px 60px color-mix(in srgb,${p.header} 10%,transparent)}
  :root[data-theme="dark"]{--cream:${d.canvas};--paper:${d.paper};--surface:${d.surface};--surface-alt:${d.alt};--surface-hover:${d.selected};--surface-selected:${d.selected};--ink:${d.ink};--navy:${d.navy};--muted:${d.muted};--placeholder:${d.muted};--line:${d.line};--line-strong:${d.muted};--accent:${d.accent};--accent-hover:${d.hover};--blue:${d.accent};--blue-dark:${d.hover};--solid:${d.selected};--on-solid:#fff;--on-accent:${d.on};--focus:${d.accent};--link:${d.accent};--link-bg:${d.alt};--link-icon:${d.selected};--link-line:${d.line};--edit-bg:${d.alt};--track:${d.line};--shadow-sm:0 8px 24px #0002;--shadow-lg:0 22px 60px #0003}
  html,body{background:var(--cream)}
  header{background:linear-gradient(145deg,var(--proposal-header),var(--proposal-header-end))}
  header:before{background:radial-gradient(circle,color-mix(in srgb,var(--proposal-glow) 18%,transparent),transparent 69%)}
  header:after{background:color-mix(in srgb,var(--proposal-glow) 20%,transparent)}
  .hero-kicker{color:var(--proposal-glow)}
  .hero-meta-card small,.world-clock small,.world-clock span,.time-gap,.trip-progress-head span{color:color-mix(in srgb,var(--proposal-glow) 28%,#fff)}
  .world-clocks,.trip-progress{background:color-mix(in srgb,var(--proposal-header) 72%,#000)}
  .trip-progress-track i{background:var(--proposal-glow);box-shadow:none}
  .money-total{background:var(--proposal-header)}
  .money-total:nth-child(2){background:var(--proposal-header-end)}
  .money-total small{color:color-mix(in srgb,var(--proposal-glow) 28%,#fff)}
  .timeline-row .dot{background:var(--accent);box-shadow:0 0 0 4px var(--cream)}
  .timeline-row>.time,.day-head h2,.expense .expense-amount,.checklist input{color:var(--navy);accent-color:var(--accent)}
  .day-head h2 span{color:var(--muted)}
  .tabs label.is-active{box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 18%,transparent)}
  ::selection{background:var(--accent);color:var(--on-accent)}
  input,textarea{caret-color:var(--accent)}
  :focus-visible{outline:3px solid var(--focus);outline-offset:3px}
  *{scrollbar-color:var(--line-strong) var(--paper)}
  .palette-preview-note{margin:14px 18px;color:var(--muted);font-size:12px;line-height:1.5}
  .schedule-view-switch button[disabled]{cursor:default}
  .day-radio{visibility:hidden}
  `;
};
await writeFile(new URL('palettes.css', here), palettes.map(p => `/* ${p.en} */\n` + tokens(p).replaceAll(':root', `:root[data-palette="${p.id}"]`).trimEnd()).join('\n\n') + '\n');
const previewScript = `
(()=>{
const root=document.documentElement;
let day='d1';
function view(id){
 if(/^d\\d+$/.test(id))day=id;
 document.querySelectorAll('main .panel.day').forEach(p=>{const active=p.id==='panel-'+id;p.classList.toggle('is-active',active);p.setAttribute('aria-hidden',String(!active))});
 document.querySelectorAll('.tabs label[for]').forEach(l=>{const active=l.htmlFor===id;l.classList.toggle('is-active',active);l.setAttribute('aria-selected',String(active));l.tabIndex=active?0:-1});
 document.querySelectorAll('.day-radio').forEach(r=>r.checked=r.id===id);
 document.querySelectorAll('.bottom-nav button').forEach(b=>{if(b.dataset.section===(/^d/.test(id)?'schedule':id))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.querySelector('.tabs').hidden=!/^d\\d+$/.test(id);
 document.querySelector('#scheduleViewSwitch').hidden=!/^d\\d+$/.test(id);
 document.querySelector('#editBtn').lastChild.textContent=id==='prep'?'목록 편집':id==='money'?'가계부 설정':'편집 시작';
 scrollTo({top:0,behavior:'instant'});
}
function theme(t){root.dataset.theme=t;document.querySelectorAll('[name=themePreference]').forEach(r=>r.checked=r.value===t)}
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>view(b.dataset.section==='schedule'?day:b.dataset.section));
document.querySelectorAll('.tabs label[for]').forEach(l=>{l.onclick=e=>{e.preventDefault();view(l.htmlFor)};l.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();view(l.htmlFor)}}});
const toggle=document.querySelector('#themeToggle'),menu=document.querySelector('#themeMenu');
toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden))};
document.querySelectorAll('[name=themePreference]').forEach(r=>r.onchange=()=>{theme(r.value==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):r.value);menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});
document.addEventListener('click',e=>{if(!e.target.closest('.theme-choice')){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});
addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='palette-preview')return;if(e.data.view)view(e.data.view);if(e.data.theme)theme(e.data.theme)});
const params=new URLSearchParams(location.search);view(params.get('view')||'d1');theme(params.get('theme')||'light');
})();`;

const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://palette.local') return route.abort();
  const relative = url.pathname.slice(1) || 'index.html';
  try {
    if(relative==='index.html')return route.fulfill({body:source,contentType:'text/html; charset=utf-8'});
    if(relative==='trip-config.js')return route.fulfill({body:'window.TRIP_CONFIG='+JSON.stringify(config),contentType:'text/javascript'});
    if(!/^(assets\/[\w.-]+|icons\/[\w.-]+|docs\/ui-concepts\/palettes-2026-10-24\/[\w./-]+)$/.test(relative)||relative.includes('..')||relative.endsWith('.mjs'))return route.abort();
    const body=await readFile(new URL(relative,root));
    const ext=relative.split('.').pop();
    await route.fulfill({body,contentType:{html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',png:'image/png',webp:'image/webp',woff2:'font/woff2',svg:'image/svg+xml'}[ext]||'application/octet-stream'});
  } catch { await route.abort(); }
});
try {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://palette.local/index.html');
  await page.waitForFunction(() => !document.body.classList.contains('hydrating'));
  await page.locator('#nav-schedule').click();
  await page.locator('.tabs label[for="d1"]').click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('images/current-desktop.png', here)) });
  const snapshot = await page.evaluate(() => {
    const doc=document.documentElement.cloneNode(true);
    doc.querySelectorAll('script,link[rel=manifest],meta[name=apple-mobile-web-app-capable],#appLoading').forEach(e=>e.remove());
    const base=document.createElement('base');base.href='../../../';doc.querySelector('head').prepend(base);
    doc.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
    doc.querySelectorAll('button,input,select,textarea').forEach(e=>{
      if(!e.closest('.bottom-nav,.tabs,.theme-choice')){e.setAttribute('aria-disabled','true');e.setAttribute('title','컬러 목업');}
    });
    doc.querySelectorAll('a').forEach(e=>{e.removeAttribute('href');e.removeAttribute('target')});
    doc.querySelector('#status').textContent='컬러 목업';
    const note=document.createElement('p');note.className='palette-preview-note';note.textContent='컬러 목업 · 일정은 로컬 설정 예시이며 최신 공유 데이터와 다를 수 있습니다.';doc.querySelector('main').append(note);
    doc.querySelector('#totalKrw').textContent='₩2,480,000';doc.querySelector('#totalUsd').textContent='$1,320.00';
    const ledgerNote=document.createElement('p');ledgerNote.className='palette-preview-note';ledgerNote.textContent='금액은 컬러 비교를 위한 예시입니다.';doc.querySelector('.money-totals').after(ledgerNote);
    return '<!doctype html>\n'+doc.outerHTML;
  });
  for (const p of palettes) {
    await writeFile(new URL(p.id+'.html',here),snapshot.replace('<html ',`<html data-palette="${p.id}" `)
      .replace('</head>','<link rel="stylesheet" href="docs/ui-concepts/palettes-2026-10-24/palettes.css"></head>')
      .replace('</body>',`<script>${previewScript}</script></body>`));
    for(const [device,width,height] of [['mobile',390,1050],['desktop',1440,1100]]) {
      await page.setViewportSize({width,height});
      await page.goto('http://palette.local/docs/ui-concepts/palettes-2026-10-24/'+p.id+'.html');
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${p.id} ${device} overflow`);
      await page.screenshot({path:fileURLToPath(new URL(`images/${p.id}-${device}.png`,here))});
      await page.locator('#tab-prep').click();
      assert.equal(await page.locator('#panel-prep').getAttribute('aria-hidden'),'false');
      await page.locator('#tab-money').click();
      assert.equal(await page.locator('#panel-money').getAttribute('aria-hidden'),'false');
      await page.screenshot({path:fileURLToPath(new URL(`images/${p.id}-${device}-ledger.png`,here))});
      await page.locator('#themeToggle').click();
      await page.locator('[name=themePreference][value=dark]').check();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
      await page.screenshot({path:fileURLToPath(new URL(`images/${p.id}-${device}-dark.png`,here))});
    }
  }
  await page.setViewportSize({width:1440,height:1360});
  await page.goto('http://palette.local/docs/ui-concepts/palettes-2026-10-24/index.html?capture=1');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('iframe').first().waitFor();
  await Promise.all(page.frames().filter(f=>f!==page.mainFrame()).map(f=>f.evaluate(()=>document.fonts.ready)));
  await page.screenshot({path:fileURLToPath(new URL('images/comparison.png',here)),fullPage:true});
  await page.locator('[data-theme-choice="dark"]').click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).every(f=>f.contentDocument.documentElement.dataset.theme==='dark'));
  await page.screenshot({path:fileURLToPath(new URL('images/comparison-dark.png',here)),fullPage:true});
  await page.locator('[data-view="money"]').click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('iframe')).every(f=>f.contentDocument.querySelector('#panel-money').getAttribute('aria-hidden')==='false'));
  await page.locator('[data-device="desktop"]').click();
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:1100});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`comparison ${width}px overflow`);
  }
  const luminance=hex=>{const parts=hex.replace('#','').match(/../g).map(p=>parseInt(p,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const checks=palettes.map(p=>({id:p.id,light:{body:contrast(p.ink,p.paper),secondary:contrast(p.muted,p.alt),action:contrast('#ffffff',p.accent)},dark:{body:contrast(p.dark.ink,p.dark.paper),secondary:contrast(p.dark.muted,p.dark.alt),action:contrast(p.dark.on,p.dark.accent)}}));
  for(const p of checks)for(const pairs of [p.light,p.dark])for(const ratio of Object.values(pairs))assert.ok(ratio>=4.5,`${p.id} token text contrast ${ratio}`);
  await writeFile(new URL('contrast.json',here),JSON.stringify(checks,null,2)+'\n');
  assert.deepEqual(errors,[]);
  console.log('Generated 3 isolated palettes; navigation, synchronized gallery controls, themes, 320–1440px comparison overflow and primary text token contrast passed.');
} finally { await browser.close(); }
