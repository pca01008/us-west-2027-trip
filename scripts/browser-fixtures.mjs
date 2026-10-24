// Never serve personal trip configuration or photos to recorded test contexts.
import { readFile } from 'node:fs/promises';

export const fixtureConfig = {
  schemaVersion: 6, tripId: 'browser-fixture', cacheNamespace: 'browser_fixture',
  locale: 'ko-KR', pageTitle: 'Browser fixture', title: '테스트 여행', kicker: 'TEST TRIP',
  travelDatesLabel: '2027. 01. 21 - 01. 31', routeLabel: '테스트 도시 A → B',
  tripStart: '2027-01-21T21:00:00+09:00', tripEnd: '2027-01-31T05:10:00+09:00',
  progress: { before: '출발 전', during: '여행 중', after: '완료' },
  clocks: { home: { label: 'HOME', timeZone: 'Asia/Seoul' }, destination: { label: 'DESTINATION', timeZone: 'America/Los_Angeles' }, differenceLabel: '목적지', homeReferenceLabel: '출발지' },
  exportBaseName: 'Browser_Fixture', editorEmail: 'editor@example.test',
  supabase: { url: 'http://127.0.0.1:1', publishableKey: 'fixture-key', mediaBucket: 'trip-media' },
  prep: { title: 'PREP', subtitle: '테스트 체크리스트', heading: 'Fixture checklist', items: Array.from({ length: 12 }, (_, i) => ({ id: `fixture-check-${i}`, text: `준비 항목 ${i + 1}` })) },
  ledger: { defaultExchangeRate: 1450, defaultBudgetKrw: 0, categories: [
    { id: 'food', name: '식비', icon: '🍽️' }, { id: 'transport', name: '교통', icon: '🚗' },
    { id: 'misc', name: '기타', icon: '📦', system: true }, { id: 'deleted', name: '삭제된 카테고리', icon: '🗑️', system: true }
  ] },
  days: Array.from({ length: 11 }, (_, day) => ({
    date: `2027-01-${21 + day}`, subtitle: `테스트 일정 ${day + 1}`,
    // Day 3 must scroll; day 11 stays short for long-to-short tab regressions.
    events: Array.from({ length: day === 2 ? 10 : day === 0 ? 4 : 2 }, (_, event) => ({
      time: `${String(8 + event).padStart(2, '0')}:00`, title: `일정 ${day + 1}-${event + 1}`,
      detail: '자동 검사에 사용하는 가상 일정입니다.',
      ...(day === 0 && event === 2 ? { photos: [{ id: 'fixture-photo', src: 'assets/fixture.png', alt: '가상 사진', caption: '테스트 사진' }] } : {})
    }))
  }))
};
// A generated 1x1 PNG, not an image from the user's assets directory.
const fixtureImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=', 'base64');
export async function readBrowserFixture(url) {
  if (url.pathname.endsWith('/trip-config.js')) return Buffer.from(`window.TRIP_CONFIG=${JSON.stringify(fixtureConfig)};`);
  if (url.pathname.includes('/assets/')) return fixtureImage;
  return readFile(url);
}

export async function selectTripTab(page, id, mobile = false) {
  const activate = locator => mobile ? locator.tap() : locator.click();
  if (/^d\d+$/.test(id)) {
    await activate(page.locator('#nav-schedule'));
    await activate(page.locator('.tabs label[for="' + id + '"]'));
  } else await activate(page.locator('[data-section="' + id + '"]'));
}
export async function selectTheme(page, value) {
  await page.locator('#themeToggle').click();
  await page.locator('input[name="themePreference"][value="' + value + '"]').check();
  // Selecting the active radio closes the menu too.
  if (await page.locator('#themeMenu').isVisible()) await page.locator('input[name="themePreference"]:checked').click();
}
