import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

const [html, configSource, templateSource, sql] = await Promise.all([
  read('index.html'),
  read('trip-config.js'),
  read('trip-config.template.js'),
  read('supabase_setup.sql')
]);

function loadConfig(source, filename) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename });
  assert.ok(context.window.TRIP_CONFIG, `${filename}: TRIP_CONFIG가 없습니다.`);
  return context.window.TRIP_CONFIG;
}

const config = loadConfig(configSource, 'trip-config.js');
const template = loadConfig(templateSource, 'trip-config.template.js');

const appMatch = html.match(/<script id="tripAppV4">([\s\S]*?)<\/script>/);
assert.ok(appMatch, 'index.html: tripAppV4 스크립트를 찾지 못했습니다.');
new Function(appMatch[1]);

assert.match(config.tripId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
assert.equal(new Set(config.days.map(day => day.date)).size, config.days.length, '여행 날짜가 중복됩니다.');
assert.ok(config.days.length > 0, '여행 날짜가 없습니다.');
assert.ok(Date.parse(config.tripStart) < Date.parse(config.tripEnd), '여행 시작·종료 시간이 올바르지 않습니다.');
assert.equal(config.schemaVersion, template.schemaVersion, '현재 설정과 템플릿의 schemaVersion이 다릅니다.');

const ids = new Set();
for (const item of config.prep.items) {
  assert.ok(item.id && !ids.has(`check:${item.id}`), `체크리스트 ID가 없거나 중복됩니다: ${item.id}`);
  ids.add(`check:${item.id}`);
}
for (const item of config.ledger.categories) {
  assert.ok(item.id && !ids.has(`category:${item.id}`), `카테고리 ID가 없거나 중복됩니다: ${item.id}`);
  ids.add(`category:${item.id}`);
}
assert.ok(config.ledger.categories.some(item => item.id === 'misc'), 'misc 카테고리가 필요합니다.');
assert.ok(config.ledger.categories.some(item => item.id === 'deleted'), 'deleted 카테고리가 필요합니다.');
assert.equal(config.ledger.categories.find(item => item.id === 'misc')?.system, true, 'misc 카테고리는 system이어야 합니다.');
assert.equal(config.ledger.categories.find(item => item.id === 'deleted')?.system, true, 'deleted 카테고리는 system이어야 합니다.');
assert.ok(Number.isFinite(Number(config.ledger.defaultBudgetKrw)) && Number(config.ledger.defaultBudgetKrw) >= 0, '기본 예산은 0 이상이어야 합니다.');

for (let dayIndex = 0; dayIndex < config.days.length; dayIndex += 1) {
  const day = config.days[dayIndex];
  assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
  if (dayIndex > 0) {
    const before = Date.parse(`${config.days[dayIndex - 1].date}T00:00:00Z`);
    const current = Date.parse(`${day.date}T00:00:00Z`);
    assert.equal(current - before, 86_400_000, `여행 날짜가 연속적이지 않습니다: ${day.date}`);
  }
  for (const event of day.events || []) {
    assert.ok(event.title, `${day.date}: 일정 제목이 없습니다.`);
    assert.ok(!Object.hasOwn(event, 'extraHtml'), `${day.date}: extraHtml 대신 구조화된 reference 또는 tourCosts를 사용하세요.`);
    if (event.map) assert.match(event.map.url, /^https:\/\//, `${day.date}: 지도 링크는 HTTPS여야 합니다.`);
    if (event.reference) {
      assert.ok(event.reference.label, `${day.date}: 참고 링크 이름이 없습니다.`);
      assert.match(event.reference.url, /^https:\/\//, `${day.date}: 참고 링크는 HTTPS여야 합니다.`);
    }
    if (event.tourCosts) {
      assert.ok(Array.isArray(event.tourCosts.items) && event.tourCosts.items.length, `${day.date}: 현장 비용 항목이 없습니다.`);
      event.tourCosts.items.forEach(item => {
        assert.ok(item.label && item.amount, `${day.date}: 현장 비용에는 label과 amount가 필요합니다.`);
      });
    }
    for (const photo of event.photos || []) {
      for (const source of [photo.src, photo.fullUrl].filter(Boolean)) {
        if (/^(?:https?:|data:)/.test(source)) continue;
        await access(path.join(root, source), constants.R_OK);
      }
    }
  }
}

assert.match(sql, /save_trip_document/i, '저장 RPC가 없습니다.');
assert.match(html, /@supabase\/supabase-js@2\.112\.4/, 'Supabase SDK 버전이 고정되지 않았습니다.');
assert.match(html, /integrity="sha384-[^"]+"/, 'Supabase SDK 무결성 해시가 없습니다.');
assert.ok(!/<<<<<<<|=======|>>>>>>>/.test([html, configSource, templateSource, sql].join('\n')), '충돌 표식이 남아 있습니다.');

console.log(`검사 통과: ${config.days.length}일, ${config.days.reduce((sum, day) => sum + (day.events || []).length, 0)}개 일정, ${config.prep.items.length}개 체크 항목`);
