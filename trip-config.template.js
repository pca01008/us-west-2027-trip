/*
 * Copy to src/trip/config.js, fill settings, then run npm run build.
 * Use a new tripId/cacheNamespace for a new currency pair. Never relabel an
 * existing trip's expenses. Schema 7 stamps base/quote codes in every document.
 */
window.TRIP_CONFIG = {
  schemaVersion: 7,
  tripId: 'sample-trip-2028',
  cacheNamespace: 'sample_trip_2028',
  locale: 'ko-KR',
  pageTitle: 'SAMPLE TRIP 2028',
  title: '새 여행',
  kicker: 'JOURNEY · 2028',
  travelDatesLabel: '2028. 05. 01 - 05. 03',
  routeLabel: 'Seoul → Tokyo',
  tripStart: '2028-05-01T09:00:00+09:00',
  tripEnd: '2028-05-03T21:00:00+09:00',
  progress: {
    before: '출발까지',
    during: '여행 중',
    after: '여행 완료'
  },
  clocks: {
    home: { label: 'SEOUL', timeZone: 'Asia/Seoul' },
    destination: { label: 'TOKYO', timeZone: 'Asia/Tokyo' },
    differenceLabel: '도쿄',
    homeReferenceLabel: '한국'
  },
  exportBaseName: 'Sample_Trip_2028',
  editorEmail: 'editor@example.com',
  supabase: {
    url: '',
    publishableKey: '',
    mediaBucket: 'trip-media'
  },
  prep: {
    title: 'PREP',
    subtitle: '출발 전 체크리스트',
    heading: 'Departure checklist',
    items: [
      { id: 'check-passport', text: '여권과 항공권 확인' },
      { id: 'check-reservation', text: '숙소 예약 확인' }
    ]
  },
  ledger: {
    currencies: { base: 'KRW', quote: 'JPY' },
    // Base currency per one quote unit: 1 JPY = 10 KRW (example only).
    defaultExchangeRate: 10,
    defaultBudgetKrw: 0,
    categories: [
      { id: 'flight', name: '항공', icon: '✈️' },
      { id: 'hotel', name: '숙박', icon: '🏨' },
      { id: 'food', name: '식비', icon: '🍽️' },
      { id: 'transport', name: '교통', icon: '🚗' },
      { id: 'misc', name: '기타', icon: '📦', system: true },
      { id: 'deleted', name: '삭제된 카테고리', icon: '🗑️', system: true }
    ]
  },
  days: [
    {
      date: '2028-05-01',
      subtitle: 'Seoul → Tokyo',
      events: [
        {
          time: '09:00',
          zone: 'KST',
          title: '출국',
          detail: '공항과 항공편 정보를 입력하세요.',
          warnings: ['출발 터미널을 다시 확인하세요.'],
          chip: 'FLIGHT'
        },
        {
          time: '15:00',
          title: '숙소 체크인',
          detail: '숙소 주소를 입력하세요.',
          map: {
            name: '숙소',
            url: 'https://www.google.com/maps'
          },
          reference: {
            label: '숙소 상세 보기',
            url: 'https://example.com/reservation'
          },
          tourCosts: {
            title: '현장 비용',
            items: [{ label: '입장료', amount: 'JPY 2,000' }],
            total: '합계 JPY 2,000',
            note: '현장 결제 여부를 확인하세요.'
          }
        }
      ]
    },
    {
      date: '2028-05-02',
      subtitle: 'Tokyo · open day',
      events: [
        { time: '미정', title: '자유 일정', detail: '세부 일정을 입력하세요.' }
      ]
    },
    {
      date: '2028-05-03',
      subtitle: 'Tokyo → Seoul',
      events: [
        { time: '21:00', zone: 'KST', title: '귀국', detail: '도착 공항 정보를 입력하세요.' }
      ]
    }
  ]
};
