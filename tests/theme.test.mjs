import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="tripThemeBootstrap">([\s\S]*?)<\/script>/)[1];

function app({ stored = null, dark = false, unavailable = false, quota = false, scope, url = 'https://example.com/trip/' } = {}) {
  const root = { dataset: scope ? { themeScope: scope } : {} };
  const meta = { content: '' }, chrome = { content: '' }, select = { value: '', id: 'themeSelect' }, status = {};
  const events = {}, windowEvents = {}, writes = [], reads = [];
  const storage = {
    getItem(key) { reads.push(key); if (unavailable) throw Error('blocked'); return stored; },
    setItem(key, value) { if (unavailable || quota) throw Error('blocked'); writes.push([key, value]); }
  };
  const media = { matches: dark, addEventListener(type, fn) { this.change = fn; } };
  const document = {
    documentElement: root,
    querySelector(selector) { return selector.includes('color-scheme') ? meta : chrome; },
    getElementById(id) { return id === 'themeSelect' ? select : status; },
    addEventListener(type, fn) { events[type] = fn; }
  };
  vm.runInNewContext(script, { document, URL, location: { href: url }, localStorage: storage,
    window: { matchMedia() { return media; }, addEventListener(type, fn) { windowEvents[type] = fn; } } });
  return { root, meta, chrome, select, status, reads, writes,
    choose(value) { select.value = value; events.change({ target: select }); },
    system(value) { media.matches = value; media.change(); },
    sync(value, key = reads[0], storageArea = storage) { windowEvents.storage({ key, newValue: value, storageArea }); },
    ready() { events.DOMContentLoaded(); },
    controlsReady() { events['trip-theme-controls-ready'](); },
    unrelated() { events.change({ target: { id: 'expenseAmount', value: 'dark' } }); }
  };
}

test('첫 실행은 시스템이 어두워도 밝게, CSS 로드 전에 적용한다', () => {
  const a = app({ dark: true });
  assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.meta.content, 'only light');
  assert.ok(html.indexOf('id="tripThemeBootstrap"') < html.indexOf('<style'));
  assert.deepEqual(a.writes, []);
});

test('저장된 명시적 선택은 복원하며 시스템 변경에 흔들리지 않는다', () => {
  const a = app({ stored: 'dark' }); a.controlsReady();
  assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(a.select.value, 'dark');
  assert.ok(html.indexOf('id="tripThemeControls"') < html.indexOf('id="tripConfigScript"'), 'Controls synchronize before config or SDK can block parsing');
  assert.equal(a.meta.content, 'dark');
  assert.equal(a.chrome.content, '#101923');
  a.system(false); assert.equal(a.root.dataset.theme, 'dark');
  a.choose('light'); a.system(true);
  assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.chrome.content, '#142b3d');
});

test('기기 설정 선택은 시스템 변경을 따르며 선택 자체는 system으로 유지한다', () => {
  const a = app({ stored: 'system', dark: true });
  assert.equal(a.root.dataset.theme, 'dark');
  a.system(false); assert.equal(a.root.dataset.theme, 'light');
  a.system(true); assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(a.select.value, 'system');
  assert.deepEqual(a.writes, []);
});

test('선택은 배포 디렉터리별 저장소 한 곳에만 쓰고 다른 입력을 무시한다', () => {
  const a = app({ url: 'https://example.com/trip/index.html?previewDate=2027-01-22' });
  a.choose('dark'); a.unrelated();
  assert.deepEqual(a.writes, [['westbound:theme:/trip/', 'dark']]);
  assert.notEqual(app({ url: 'https://example.com/another-trip/' }).reads[0], a.reads[0]);
  assert.doesNotMatch(script, /supabase|fetch\(|indexedDB|captureState|recordHistory|TRIP_CONFIG/);
});

test('저장소 읽기·쓰기 실패와 잘못된 값은 앱을 중단하지 않는다', () => {
  const a = app({ unavailable: true }); a.choose('dark');
  assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(a.status.hidden, false);
  assert.match(a.status.textContent, /이번 실행/);
  const b = app({ quota: true }); b.choose('system');
  assert.equal(b.status.hidden, false);
  for (const stored of ['broken', 'constructor', '', null]) assert.equal(app({ stored }).root.dataset.theme, 'light');
});

test('다른 탭의 설정 변경·삭제만 반영하고 다시 저장하지 않는다', () => {
  const a = app(); a.sync('dark');
  assert.equal(a.root.dataset.theme, 'dark');
  a.sync('light', 'unrelated'); assert.equal(a.root.dataset.theme, 'dark');
  a.sync('light', a.reads[0], {}); assert.equal(a.root.dataset.theme, 'dark');
  a.sync(null); assert.equal(a.root.dataset.theme, 'light');
  a.choose('dark'); a.sync(null, null); assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.writes.length, 1);
});

test('오프라인 작업본은 원래 배포 경로를 사용하며 인쇄에는 dark 토큰을 쓰지 않는다', () => {
  const a = app({ scope: '/trip/', url: 'file:///downloads/EDITABLE.html', stored: 'dark' });
  assert.equal(a.reads[0], 'westbound:theme:/trip/');
  assert.equal(a.root.dataset.theme, 'dark');
  assert.match(html, /@media screen\{\s*:root\[data-theme="dark"\]/);
  assert.match(html, /function setArtifactBanner\(root,type\)\{resetArtifactTheme\(root,type\)/);
  assert.match(html, /root\.removeAttribute\('data-theme-preference'\)/);
  assert.match(html, /if\(type==='readonly'\)root.querySelectorAll\('\.theme-toolbar,#tripThemeBootstrap'\)/);
});

test('테마의 본문·보조 글자·버튼·경고·링크 색은 대비 4.5:1 이상이다', () => {
  const luminance = color => {
    const rgb = color.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const pairs = [['e6edf5', '192532'], ['b0bfd0', '243344'], ['291d1c', 'f39887'], ['f3d39d', '3f3525'], ['a7d3f0', '21394a'], ['ffffff', '304c6c'], ['ffffff', 'a93f35'], ['5f6e82', 'edf2f8']];
  for (const [fg, bg] of pairs) {
    const a = luminance(fg), b = luminance(bg);
    assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${fg} on ${bg}`);
  }
});
