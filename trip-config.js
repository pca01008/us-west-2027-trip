/*
 * 여행별 설정 파일
 *
 * 새 여행을 만들 때에는 이 파일을 복사한 뒤 tripId, 제목, 기간,
 * 시간대, 체크리스트, days 배열과 Supabase 정보를 바꾸면 됩니다.
 * tripId는 영문 소문자, 숫자, 하이픈만 사용하세요.
 */
window.TRIP_CONFIG = {
  schemaVersion: 5,
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
  days: [
    {
      date: '2027-01-21',
      subtitle: '서울 → Las Vegas · Alexis Park',
      events: [
        { time: '21:00', zone: 'KST', title: '라스베이거스행 출국', detail: '인천공항 T2 · 대한항공 KE005', warnings: ['위탁 수하물은 1개당 23kg 제한을 출발 전 다시 확인합니다.'], chip: 'AIRPORT / T2' },
        { time: '15:10', zone: 'PST', title: '라스베이거스 공항 도착', detail: 'Harry Reid International Airport · Terminal 3', chip: 'ARRIVAL' },
        {
          time: '17:00', title: 'Alexis Park All Suite Resort 체크인', detail: '도착 후 객실 정리와 다음 날 투어 준비',
          warnings: ['추후 그랜드캐니언 투어를 당일치기로 변경하면 Main Street Station Casino Brewery Hotel로 숙소 변경 예정입니다.'],
          map: { name: 'Alexis Park Resort', url: 'https://www.google.com/maps/search/?api=1&query=Alexis%20Park%20All%20Suite%20Resort' },
          galleryClass: 'single-media',
          photos: [{ id: 'map-alexis-park', className: 'map-capture', src: 'assets/map-alexis-park.bb487c54e63d.webp', fullUrl: 'assets/map-alexis-park.bb487c54e63d.webp', alt: 'Alexis Park Resort 주변 지도', caption: 'Alexis Park 주변 지도' }],
          chip: 'HOTEL'
        },
        { time: '19:00', title: '저녁 식사', detail: '장소 미정 · 다음 날 이른 출발을 고려해 가볍게 식사' }
      ]
    },
    {
      date: '2027-01-22',
      subtitle: 'Grand Canyon tour · Day 1',
      events: [
        { time: '05:30', title: 'Alexis Park All Suite Resort 체크아웃', detail: '투어 픽업 전 체크아웃 및 짐 정리', warnings: ['투어 차량에 캐리어 보관이 불가능하면 호텔에 짐을 맡겨야 합니다. 출발 전에 보관 가능 여부와 인수 시간을 반드시 확인합니다.'] },
        {
          time: '06:00', title: '그랜드캐니언 1박 2일 투어 픽업', detail: '라스베이거스 출발 · 지정 픽업 장소와 배낭 중심 준비물 재확인',
          reference: { label: '투어 상품 상세 보기', url: 'https://experiences.myrealtrip.com/products/3147877' },
          tourCosts: {
            title: '현장 비용 · 1인 기준',
            items: [
              { label: '앤텔로프 캐니언 입장료', amount: '$81' },
              { label: '앤텔로프 인디언 가이드 팁', amount: '$3' },
              { label: '4개 공원·명소 입장료', amount: '$35' },
              { label: 'CUA Permit', amount: '$20' },
              { label: 'ADOT Permit', amount: '$10' },
              { label: '미국 비거주자 추가 입장료', amount: '$83' },
              { label: '가이드 팁 · 2일', amount: '$60' }
            ],
            total: '합계 $292 / 1인 + 불포함 식사',
            note: '불포함 식사: 1일차 아침·점심, 2일차 점심. 현장 비용과 운영 조건은 출발 전 다시 확인합니다.'
          }
        },
        { time: '오전', title: '자이언 캐니언', detail: '붉은 바위산과 와인딩 로드를 따라 자이언의 장대한 협곡 풍경을 감상합니다.' },
        { time: '점심', title: '자유 점심 식사', detail: '현지 아메리칸 레스토랑 또는 패스트푸드 · 투어 비용 불포함' },
        { time: '오후', title: '브라이스 캐니언', detail: '원형극장처럼 펼쳐진 수만 개의 후두 지형과 자연의 돌탑을 감상합니다.' },
        { time: '일몰', title: '홀스슈 벤드', detail: '콜로라도강이 만든 말발굽 모양의 거대한 곡선을 일몰 무렵 감상합니다.' },
        { time: '저녁', title: '별장 바비큐 파티', detail: '페이지 지역 별장에서 밥·된장찌개·삼겹살로 저녁 식사' },
        { time: '밤', title: '별 보기·불멍 후 별장 숙박', detail: '스모어와 불멍을 즐긴 뒤 개별 화장실이 있는 프라이빗 객실에서 1박' }
      ]
    },
    {
      date: '2027-01-23',
      subtitle: 'Grand Canyon tour · Day 2',
      events: [
        { time: '07:00', title: '아침 식사', detail: '가이드가 준비하는 라면 · 현지 상황에 따라 다른 메뉴로 대체 가능' },
        { time: '오전', title: '레이크 파월', detail: '붉은 사암 협곡과 푸른 호수가 맞닿는 풍경 감상' },
        { time: '오전', title: '로워 앤텔로프 캐니언', detail: '빛과 사암이 만든 협곡을 인디언 가이드와 함께 관람' },
        { time: '정오', title: '윈도우 아치스', detail: '투어 전용 뷰포인트에서 아치 지형과 풍경 촬영' },
        { time: '점심', title: '자유 점심 식사', detail: '피자·타코·버거·샌드위치 등 현지식 선택 · 투어 비용 불포함' },
        { time: '오후', title: '그랜드캐니언 사우스림', detail: 'Yavapai Point를 중심으로 그랜드캐니언의 광대한 전경 감상' },
        { time: '오후', title: '그랜드캐니언 이스트림', detail: 'Desert View Drive의 입체적인 협곡 풍경과 포토 스폿 방문' },
        { time: '귀로', title: '루트 66 · 셀리그먼', detail: '미국 로드트립의 클래식한 거리와 복고풍 풍경 감상' },
        { time: '19:30', title: '라스베이거스 도착 예정', detail: '픽업 호텔로 복귀 예정 · 교통과 투어 진행에 따라 도착이 늦어질 수 있음' },
        {
          time: '20:00', title: '월도프 아스토리아 라스베이거스 체크인', detail: '투어 종료 후 호텔 이동 및 체크인',
          warnings: ['투어 도착 지연 가능성이 있어 호텔에 늦은 체크인 예정임을 사전에 알립니다.'],
          map: { name: 'Waldorf Astoria Las Vegas', url: 'https://www.google.com/maps/search/?api=1&query=Waldorf%20Astoria%20Las%20Vegas' },
          galleryClass: 'single-media',
          photos: [{ id: 'map-waldorf-astoria', className: 'map-capture', src: 'assets/map-waldorf-astoria.40158ebf193c.webp', fullUrl: 'assets/map-waldorf-astoria.40158ebf193c.webp', alt: 'Waldorf Astoria Las Vegas 주변 지도', caption: 'Waldorf Astoria 주변 지도' }],
          chip: 'HOTEL'
        }
      ]
    },
    { date: '2027-01-24', subtitle: 'Las Vegas · open day', events: [{ time: '미정', title: '라스베이거스 자유 일정', detail: '추천 후보: 스트립 산책, 벨라지오 분수, 미술관, 쇼 관람', chip: 'TO BE DECIDED' }] },
    {
      date: '2027-01-25',
      subtitle: 'Las Vegas → Los Angeles · West Hollywood',
      events: [
        { time: '11:00', title: '월도프 아스토리아 체크아웃', detail: '짐 정리 후 LAS Terminal 1로 이동' },
        { time: '14:22', title: 'AA421 로스앤젤레스행 출발', detail: 'LAS Terminal 1 · American Airlines AA421 · Confirmation YAMFLF', warnings: ['출발 터미널은 Terminal 1 기준이며 게이트는 당일 항공편 정보에서 다시 확인합니다.'], chip: 'DOMESTIC FLIGHT' },
        { time: '15:40', title: 'LA 공항 도착', detail: 'American Airlines · LAX Terminal 4 예상', warnings: ['AA 체크인은 Terminal 4·5를 사용하며 실제 도착 게이트는 Terminal 4·5 또는 B일 수 있으므로 당일 확인합니다.'] },
        { time: '16:30', title: '렌터카 픽업', detail: '예약 시간 고정 · 수하물 수령과 셔틀 이동 시간을 고려하고 지연 시 업체에 연락' },
        {
          time: '17:30', title: 'West Hollywood Airbnb 체크인', detail: '6259 Del Valle Drive, West Hollywood, CA 90048',
          map: { name: 'West Hollywood Airbnb', url: 'https://www.google.com/maps/search/?api=1&query=6259%20Del%20Valle%20Drive%20West%20Hollywood%20CA%2090048' },
          galleryClass: 'lodging-gallery',
          photos: [
            { id: 'map-airbnb', className: 'map-capture', src: 'assets/map-airbnb.9f74cd61fac3.webp', fullUrl: 'assets/map-airbnb.9f74cd61fac3.webp', alt: 'West Hollywood Airbnb 주변 지도', caption: 'Airbnb 주변 지도' },
            { id: 'airbnb-exterior', src: 'assets/airbnb.webp', fullUrl: 'assets/airbnb.webp', alt: '웨스트 할리우드 Airbnb 숙소 외관', caption: '숙소 외관' }
          ],
          chip: 'AIRBNB'
        }
      ]
    },
    { date: '2027-01-26', subtitle: 'Los Angeles · open day', events: [{ time: '미정', title: 'LA 자유 일정', detail: '추천 후보: 산타모니카, 베니스 비치, 그리피스 천문대', chip: 'TO BE DECIDED' }] },
    { date: '2027-01-27', subtitle: 'Los Angeles · open day', events: [{ time: '미정', title: 'LA 자유 일정', detail: '추천 후보: 할리우드, 더 그로브, 파머스 마켓', chip: 'TO BE DECIDED' }] },
    { date: '2027-01-28', subtitle: 'Los Angeles · open day', events: [{ time: '미정', title: 'LA 자유 일정', detail: '추천 후보: 다운타운 LA, 게티 센터, 말리부', chip: 'TO BE DECIDED' }] },
    {
      date: '2027-01-29',
      subtitle: 'West Hollywood → LAX · departure',
      events: [
        { time: '11:00', title: 'Airbnb 체크아웃', detail: '숙소 정리 후 수하물을 차량에 싣고 이동', warnings: ['차량 안에 캐리어와 귀중품이 보이게 두지 않습니다. 가능하면 트렁크에 보관하고 장시간 주차를 피합니다.'] },
        { time: '20:00', title: '렌터카 반납', detail: '예약 시간 고정 · 연료와 차량 상태 확인 후 공항 터미널로 이동' },
        { time: '22:50', title: '인천행 출국', detail: 'LA 공항 Terminal B · 대한항공 KE012', chip: 'AIRPORT / TERMINAL B' }
      ]
    },
    { date: '2027-01-30', subtitle: 'In transit', events: [{ time: '종일', title: '귀국 비행 중', detail: '기내 휴식 · 한국 도착 준비' }] },
    { date: '2027-01-31', subtitle: 'Welcome home', events: [{ time: '05:10', zone: 'KST', title: '인천공항 도착', detail: '인천공항 T2 · 여행 종료', chip: 'ARRIVAL / T2' }] }
  ]
};
