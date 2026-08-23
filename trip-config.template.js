/*
 * 새 여행용 설정 템플릿
 *
 * 이 파일을 trip-config.js로 복사한 뒤 값을 채우세요.
 * tripId는 다른 여행과 겹치지 않는 영문 소문자·숫자·하이픈 조합을 사용합니다.
 */
window.TRIP_CONFIG = {
  schemaVersion: 4,
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
    defaultExchangeRate: 10,
    categories: [
      { id: 'flight', name: '항공', icon: '✈️' },
      { id: 'hotel', name: '숙박', icon: '🏨' },
      { id: 'food', name: '식비', icon: '🍽️' },
      { id: 'transport', name: '교통', icon: '🚗' },
      { id: 'misc', name: '기타', icon: '📦' },
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
