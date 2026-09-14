import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const calculations = html.split('// Timetable calculations are pure:')[1]?.split('// End of pure timetable calculations.')[0];
assert.ok(calculations, '시간표 계산 함수를 찾을 수 없습니다.');
const context = vm.createContext({});
vm.runInContext(calculations.slice(calculations.indexOf('function parseTimetableTime')), context);
const { parseTimetableTime: parse, layoutTimetableEvents: layout, timetableWindow: windowRange } = context;
const plain = value => JSON.parse(JSON.stringify(value));
const { scheduleTimeValue: timeValue } = context;

test('시간 설정은 종료를 선택적으로 입력하고 미정 표기를 유지한다', () => {
  assert.deepEqual(plain(timeValue({ start: '9:05' })), { time: '09:05', overnight: false });
  assert.deepEqual(plain(timeValue({ start: '09:00', end: '11:30' })), { time: '09:00~11:30', overnight: false });
  assert.equal(timeValue({}).time, '미정');
  assert.equal(timeValue({ mode: 'label', label: ' 오후 ' }).time, '오후');
  assert.equal(timeValue({ mode: 'label', label: '' }).time, '미정');
  assert.equal(timeValue({ mode: 'label', label: '일몰 무렵' }).time, '일몰 무렵');
});

test('시간 설정은 잘못된 시각과 종료만 입력한 경우를 거부한다', () => {
  assert.equal(timeValue({ end: '11:00' }).field, 'start');
  for (const start of ['24:00', '12:60', '오후', '9', '09:00~10:00']) assert.equal(timeValue({ start }).field, 'start', start);
  for (const end of ['09:00', '24:01', '25:00', '10', '10:00~11:00']) assert.equal(timeValue({ start: '09:00', end }).field, 'end', end);
});

test('다음 날 종료와 자정 표기는 시간표 파서로 손실 없이 전달된다', () => {
  for (const end of ['01:30', '00:00', '24:00']) {
    const value = timeValue({ start: '23:00', end });
    assert.equal(value.overnight, true);
    assert.ok(parse(value.time).end >= 1440);
  }
  assert.equal(parse(timeValue({ start: '00:00', end: '24:00' }).time).end, 1440);
});

test('시작 시각만 있는 일정에 종료 시각을 만들어 넣지 않는다', () => {
  assert.deepEqual(plain(parse('05:30')), { start: 330, end: null });
  assert.deepEqual(plain(parse('9:05')), { start: 545, end: null });
  for (const time of ['미정', '오전', '점심', '오후', '종일', '일몰', '', '24:00', '09:65', '99:00', '09:00 예정', '09:00~미정']) {
    assert.equal(parse(time), null, time);
  }
});

test('명시된 시간 구간과 자정을 넘기는 일정을 구분한다', () => {
  for (const time of ['09:00~11:30', '09:00 - 11:30', '09:00–11:30', '09:00부터 11:30까지']) {
    assert.deepEqual(plain(parse(time)), { start: 540, end: 690 });
  }
  assert.deepEqual(plain(parse('23:00~01:30')), { start: 1380, end: 1530 });
  assert.deepEqual(plain(parse('22:00~24:00')), { start: 1320, end: 1440 });
  assert.equal(parse('09:00~09:00'), null);
  assert.equal(parse('09:00~24:10'), null);
});

test('겹치는 일정은 다른 열에, 맞닿는 일정은 같은 열에 배치한다', () => {
  const input = [{ id: 'a', start: 540, end: 720 }, { id: 'b', start: 600, end: 660 }, { id: 'c', start: 720, end: 780 }];
  const snapshot = JSON.stringify(input);
  const result = layout(input);
  assert.notEqual(result[0].lane, result[1].lane);
  assert.equal(result[0].lanes, 2);
  assert.equal(result[0].conflict, true);
  assert.equal(result[2].lanes, 1);
  assert.equal(result[2].conflict, false);
  assert.equal(JSON.stringify(input), snapshot, '보기 계산은 원본을 바꾸지 않아야 합니다.');
});

test('가까운 시작 시각도 읽을 수 있게 분리하되 실제 충돌로 단정하지 않는다', () => {
  const result = layout([{ start: 330, end: null }, { start: 360, end: null }, { start: 600, end: null }]);
  assert.notEqual(result[0].lane, result[1].lane);
  assert.ok(result.every(item => item.end === null && !item.conflict));
  assert.equal(result[2].lanes, 1);
  assert.equal(layout([]).length, 0);
});

test('압축한 시간축에서도 가까운 일정이 가려지지 않고 종료 시각은 보존된다', () => {
  const input = [{ start: 600, end: null }, { start: 630, end: null }, { start: 720, end: 780 }];
  const original = JSON.stringify(input);
  const compact = layout(input, { pixelsPerHour: 20, minHeight: 20 });
  assert.notEqual(compact[0].lane, compact[1].lane);
  assert.equal(compact[2].lanes, 1);
  assert.equal(compact[0].end, null);
  assert.equal(compact[2].end, 780);
  assert.equal(JSON.stringify(input), original);
});

test('여행 시작·마지막·짧은 여행에서도 표시 범위가 벗어나지 않는다', () => {
  assert.deepEqual(plain(windowRange(11, -1, '1')), { start: 0, count: 1, end: 1 });
  assert.deepEqual(plain(windowRange(11, 11, '1')), { start: 10, count: 1, end: 11 });
  assert.deepEqual(plain(windowRange(1, 1, '1')), { start: 0, count: 1, end: 1 });
  assert.deepEqual(plain(windowRange(2, 1, 'all')), { start: 0, count: 2, end: 2 });
  assert.deepEqual(plain(windowRange(11, 7, 'all')), { start: 0, count: 11, end: 11 });
  assert.deepEqual(plain(windowRange(11, 10, '1')), { start: 10, count: 1, end: 11 });
});
