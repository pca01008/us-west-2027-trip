# 다른 여행에 재사용하는 방법

이 프로젝트는 화면과 기능을 담은 `index.html`과 여행별 데이터를 담은 `trip-config.js`를 분리한다. `index.html`에는 특정 여행의 날짜 탭이나 일정 원본이 들어 있지 않으므로, 새 여행에서는 원칙적으로 이 파일을 수정하지 않고 설정 파일만 교체한다.

## 가장 안전한 재사용 순서

1. 현재 저장소를 복제하거나 GitHub의 새 저장소로 복사한다.
2. `trip-config.template.js`를 복사해 `trip-config.js`를 교체한다.
3. `trip-config.js`의 제목, 날짜, 시간대, 체크리스트, 카테고리, 일정을 채운다.
4. 새 여행만의 `tripId`와 `cacheNamespace`를 정한다.
5. Supabase를 연결하려면 프로젝트 URL, publishable key, 편집자 이메일을 입력한다.
6. Supabase에서 편집자 계정을 만든다.
7. 새 Supabase 프로젝트라면 `supabase_setup.sql`을 먼저 실행한다.
8. `register_trip.sql`의 여행 ID와 이메일을 설정 파일과 같게 바꾼 뒤 실행한다.
9. 브라우저에서 화면과 편집·저장 기능을 확인한 다음 새 GitHub 저장소에 배포한다.

## 반드시 고유해야 하는 값

| 설정 | 의미 | 예시 |
|---|---|---|
| `tripId` | Supabase에서 여행 한 건을 구분하는 ID이자 사진 폴더 이름 | `japan-spring-2028` |
| `cacheNamespace` | 브라우저 캐시를 다른 여행과 분리하는 이름 | `japan_spring_2028` |
| `exportBaseName` | 내려받는 HTML 파일명 앞부분 | `Japan_Spring_2028` |

`tripId`에는 영문 소문자, 숫자, 하이픈만 사용한다. 기존 여행의 ID를 재사용하면 그 여행의 Supabase 저장본이 새 기본 일정을 덮어쓸 수 있다.

## 주요 설정값

- `tripStart`, `tripEnd`: 시간대 오프셋을 포함한 ISO 날짜·시간이다. 예: `2028-05-01T09:00:00+09:00`
- `clocks.home`, `clocks.destination`: 헤더의 두 시계와 자동 시차 계산에 사용한다. 시간대 이름은 IANA 형식을 쓴다. 예: `Asia/Seoul`, `Europe/Paris`
- `prep.items`: 처음 표시할 체크리스트다. 각 `id`는 파일 안에서 중복되지 않게 한다.
- `ledger.defaultExchangeRate`: 외화를 원화로 환산할 때의 초기 환율이다.
- `ledger.categories`: 기본 가계부 카테고리다. `misc`와 `deleted` 항목은 반드시 유지한다.
- `days`: 날짜 탭과 일정 화면의 원본이다. 날짜는 `YYYY-MM-DD` 형식으로 과거에서 미래 순서로 입력한다. 여행 일수에는 고정 제한이 없다.

## 일정 한 건의 형태

```js
{
  time: '14:30',
  zone: 'LOCAL',
  title: '호텔 체크인',
  detail: '예약번호와 주소',
  warnings: ['늦은 체크인 여부 확인'],
  chip: 'HOTEL',
  map: {
    name: '호텔 이름',
    url: 'https://www.google.com/maps/...'
  },
  photos: [
    {
      id: 'hotel-exterior',
      src: 'assets/hotel.webp',
      fullUrl: 'assets/hotel.webp',
      alt: '호텔 외관',
      caption: '호텔 외관'
    }
  ]
}
```

`zone`, `warnings`, `chip`, `map`, `photos`는 필요 없으면 생략할 수 있다. 기본 사진은 `assets/`에 넣고 경로를 설정한다. 웹 편집 화면에서 추가한 사진은 자동으로 Supabase Storage에 압축 저장된다.

## 같은 Supabase에서 여러 여행 운영하기

`supabase_setup.sql`은 표, 저장 함수, 버전 관리, 공용 사진 버킷을 한 번만 만든다. 다만 이 리팩터링 이전 SQL을 사용한 기존 프로젝트라면 다중 여행 사진 정책을 적용하기 위해 현재 `supabase_setup.sql`을 한 번 다시 실행한다. 이후에는 여행마다 `register_trip.sql`만 값을 바꿔 실행하면 된다. 각 여행은 서로 다른 `tripId`를 사용하므로 최신 저장본, 50개 버전, 사진 경로가 분리된다.

편집자가 여러 명이어야 한다면 현재의 여행당 편집자 1명 구조를 별도 권한표 기반으로 확장해야 한다. 현재 구조에서는 각 여행 행에 편집자 계정 하나가 연결된다.

## 새 여행을 시작하기 전 확인

- 헤더 제목·기간·경로가 새 설정대로 보이는가
- 날짜 탭 개수와 순서가 `days`와 같은가
- 여행 전 PREP, 여행 중 해당 날짜, 여행 후 가계부가 선택되는가
- 두 지역 시계와 시차 방향이 맞는가
- 편집자 로그인, 저장, 버전 복원이 되는가
- 사진 업로드 경로가 새 `tripId/`로 시작하는가
- 오프라인 작업본을 다시 불러올 수 있는가

기존 미국 서부 여행은 `trip-config.js`를 그대로 두면 영향을 받지 않는다.
