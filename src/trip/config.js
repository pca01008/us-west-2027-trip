/*
 * 여행별 설정 파일
 *
 * Editable trip settings. Initial events are in src/trip/days.js.
 * For a new trip, copy trip-config.template.js here and run npm run build.
 */
window.TRIP_CONFIG = {
  schemaVersion: 6,
  tripId: 'us-west-2027',
  cacheNamespace: 'uswest2027',
  locale: 'ko-KR',
  pageTitle: 'WESTBOUND 2027 · Las Vegas & LA',
  title: '미국 서부 여행',
  kicker: 'WESTBOUND · 2027',
  travelDatesLabel: '2027. 01. 21 - 01. 31',
  routeLabel: 'Las Vegas → Los Angeles',
  tripStart: '2027-01-21T21:00:00+09:00',
  tripEnd: '2027-01-31T05:10:00+09:00',
  progress: {
    before: '인천 출발까지',
    during: '여행 중',
    after: '2027. 01. 31 귀국 완료'
  },
  clocks: {
    home: { label: 'SEOUL', timeZone: 'Asia/Seoul' },
    destination: { label: 'US WEST / LAS VEGAS + LA', timeZone: 'America/Los_Angeles' },
    differenceLabel: '미국 서부',
    homeReferenceLabel: '한국'
  },
  exportBaseName: 'US_West_2027',
  editorEmail: 'pca01008@gmail.com',
  supabase: {
    url: 'https://xuzhcogshnjqtunkbsuo.supabase.co',
    publishableKey: 'sb_publishable_sRNvVZicFSgjcDph5KPJBQ_e8i-cxAp',
    mediaBucket: 'trip-media'
  },
  prep: {
    title: 'PREP',
    subtitle: '출발 전 체크리스트',
    heading: 'Departure checklist',
    items: [
      { id: 'check-passport', text: '여권·ESTA·항공권 확인' },
      { id: 'check-reservations', text: '렌터카·그랜드캐니언 투어 예약 확인' },
      { id: 'check-winter-gear', text: '겨울용 겉옷·트레킹화 준비' },
      { id: 'check-money', text: '해외 결제 카드와 달러 현금 준비' },
      { id: 'check-offline-info', text: '숙소 주소·예약번호 오프라인 저장' },
      { id: 'check-baggage', text: 'KE005 위탁 수하물 23kg 제한 재확인' },
      { id: 'check-tour-luggage', text: '투어 차량 캐리어 반입 불가 및 배낭만 가능 여부 재확인' },
      { id: 'check-alexis-storage', text: 'Alexis Park 체크아웃 전 짐 보관 가능 여부·인수 시간 확인' },
      { id: 'check-tour-fees', text: '투어 현장 비용 1인 $292와 불포함 식사 결제수단 준비' },
      { id: 'check-waldorf-late', text: '월도프 아스토리아에 투어 지연 가능성과 늦은 체크인 사전 통보' },
      { id: 'check-aa-terminal', text: 'AA421 출발·도착 터미널과 게이트 출발 전 재확인' },
      { id: 'check-rental-luggage', text: '에어비앤비 체크아웃 후 차량 안에 짐이 보이지 않게 보관' }
    ]
  },
  ledger: {
    currencies: { base: 'KRW', quote: 'USD' },
    defaultExchangeRate: 1450,
    defaultBudgetKrw: 0,
    categories: [
      { id: 'flight', name: '항공', icon: '✈️' },
      { id: 'hotel', name: '숙박', icon: '🏨' },
      { id: 'food', name: '식비', icon: '🍽️' },
      { id: 'cafe', name: '카페·간식', icon: '☕' },
      { id: 'transport', name: '교통·렌터카', icon: '🚗' },
      { id: 'fuel', name: '주유', icon: '⛽' },
      { id: 'parking', name: '주차', icon: '🅿️' },
      { id: 'ticket', name: '관광·티켓', icon: '🎟️' },
      { id: 'shopping', name: '쇼핑', icon: '🛍️' },
      { id: 'misc', name: '기타', icon: '📦', system: true },
      { id: 'deleted', name: '삭제된 카테고리', icon: '🗑️', system: true }
    ]
  },
// @include trip/days.js
};
