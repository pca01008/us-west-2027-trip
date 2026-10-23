# 운영 안내서

초기 설정·재사용·검증·배포·DB 점검·장애 대응의 기준 문서입니다. 사용자 절차는 [사용자 안내서](USER_GUIDE_KO.md), 구현 원리는 [기술 설명서](PROJECT_GUIDE_KO.md)를 참고하세요. 명령은 별도 표시가 없으면 저장소 루트에서 실행합니다.

## 목차

- [최초 구축](#setup)
- [기존 프로젝트 업데이트](#updates)
- [다른 여행에 재사용](#new-trip)
- [로컬·CI 검증](#validation)
- [Git과 배포](#deployment)
- [DB 점검 설정과 운영](#db-health)
- [문제 해결](#troubleshooting)
- [백업과 자료 관리](#maintenance)

<a id="setup"></a>

## 최초 구축

1. 새 저장소가 필요하면 사용자 계정의 일반 PowerShell에서 만든다. elevated Windows sandbox에서 `git init`·`git clone`을 실행하지 않는다.
2. Supabase 프로젝트와 Authentication의 편집자 계정을 만든다.
3. `trip-config.js`의 프로젝트 URL·publishable key·여행 ID·편집자 이메일을 맞춘다. 다른 여행은 [재사용 설정](#new-trip)을 따른다.
4. SQL Editor에서 [supabase_setup.sql](../supabase_setup.sql) 전체를 실행한다.
5. [register_trip.sql](../register_trip.sql)의 여행 ID·이메일을 설정과 같게 바꿔 실행한다. 기존 여행 ID가 있으면 기존 데이터와 편집자 연결을 유지하므로 결과 메시지를 확인한다.
6. 여행 행·편집자 연결·Storage 버킷과 SQL 오류 유무를 확인한다. 초기 `content`가 빈 JSON이면 설정의 기본 화면이 표시되고 첫 저장부터 서버 공유본이 우선한다.
7. [검증](#validation) 후 [Pages 배포](#deployment)를 진행한다. 로그인·저장·사진·버전·다른 브라우저 동기화·오프라인 작업본을 확인한다.
8. DB 점검이 필요하면 [별도 점검 설정](#db-health)을 수행한다. 공통 SQL이나 Git push로 점검 함수·예약이 활성화되지는 않는다.

<a id="updates"></a>

## 기존 프로젝트 업데이트

- 변경된 SQL과 마이그레이션을 읽고 대상 프로젝트·보존해야 할 데이터·실행 결과를 확인한다. `drop table`, `delete`, `truncate` 같은 삭제 작업은 특히 검토한다.
- 이전 서버 구조를 사용하는 프로젝트는 웹앱 배포 전에 현재 `supabase_setup.sql`을 적용한다. 기존 일정을 유지하도록 작성되어 있지만 함수·권한·버킷 정책은 현재 정의로 바뀐다.
- JPEG 대체 업로드 도입 전 서버에는 [20260920_photo_jpeg_fallback.sql](../migrations/20260920_photo_jpeg_fallback.sql)을 앱 배포 전에 실행한다. 버킷 MIME과 업로드 정책을 바꾸며 여행 내용·사진·편집자 연결은 유지한다.
- DB 점검 표 변경은 별도 마이그레이션을, 점검 함수 변경은 Supabase 함수 배포를 수행한다. Git push만으로 적용되지 않는다.
- 기능·설정 변경과 같은 작업에서 담당 문서도 갱신한다. 기준 문서에 내용을 쓰고 다른 문서는 링크로 연결한다. 날짜가 있는 이력에는 당시 관측을 보존한다.

<a id="new-trip"></a>

## 다른 여행에 재사용

이 프로젝트는 화면과 기능을 담은 `index.html`과 여행별 데이터를 담은 `trip-config.js`를 분리한다. `index.html`에는 특정 여행의 날짜 탭이나 일정 원본이 들어 있지 않으므로, 새 여행에서는 원칙적으로 이 파일을 수정하지 않고 설정 파일만 교체한다.

### 재사용 순서

1. 사용자 계정의 일반 PowerShell에서 저장소를 복제하거나 새 저장소로 복사한다. elevated Windows sandbox에서 `git init`·`git clone`을 실행하지 않는다.
2. `trip-config.template.js`를 `trip-config.js`로 복사해 제목·기간·시간대·체크리스트·가계부·일정을 채운다.
3. 아래 식별값을 새로 정하고 Supabase 연결 설정과 편집자 이메일을 입력한다.
4. 새 Supabase 프로젝트는 [초기 구축](#setup)을, 기존 프로젝트는 아래 다중 여행 등록 절차를 따른다.
5. PWA 이름·설명과 HTML의 `apple-mobile-web-app-title`을 새 여행에 맞춘다. [배포 파일 확인](#deployment)을 따른다.
6. 아래 확인표와 [검증 절차](#validation)를 완료한 뒤 배포한다.

### 반드시 고유해야 하는 값

| 설정 | 의미 | 예시 |
|---|---|---|
| `tripId` | Supabase에서 여행 한 건을 구분하는 ID이자 사진 폴더 이름 | `japan-spring-2028` |
| `cacheNamespace` | 브라우저 캐시를 다른 여행과 분리하는 이름 | `japan_spring_2028` |
| `exportBaseName` | 내려받는 HTML 파일명 앞부분 | `Japan_Spring_2028` |

`tripId`에는 영문 소문자, 숫자, 하이픈만 사용한다. 기존 여행의 ID를 재사용하면 그 여행의 Supabase 저장본이 새 기본 일정을 덮어쓸 수 있다.

### 주요 설정값

- `tripStart`, `tripEnd`: 시간대 오프셋을 포함한 ISO 날짜·시간이다. 예: `2028-05-01T09:00:00+09:00`
- `clocks.home`, `clocks.destination`: 헤더의 두 시계와 자동 시차 계산에 사용한다. 시간대 이름은 IANA 형식을 쓴다. 예: `Asia/Seoul`, `Europe/Paris`
- `prep.items`: 처음 표시할 체크리스트다. 각 `id`는 파일 안에서 중복되지 않게 한다.
- `ledger.defaultExchangeRate`: 외화를 원화로 환산할 때의 초기 환율이다.
- `ledger.defaultBudgetKrw`: 원화 기준 초기 예산이다. 0이면 미설정 상태다.
- `ledger.categories`: 기본 가계부 카테고리다. `misc`와 `deleted` 항목은 반드시 유지한다.
- `days`: 날짜 탭과 일정 화면의 원본이다. 날짜는 `YYYY-MM-DD` 형식으로 과거에서 미래 순서로 입력한다. 여행 일수에는 고정 제한이 없다.

### 일정 한 건의 형태

```js
{
  time: '14:30',
  zone: 'LOCAL',
  title: '호텔 체크인',
  detail: '체크인 안내와 주소',
  warnings: ['늦은 체크인 여부 확인'],
  chip: 'HOTEL',
  map: {
    name: '호텔 이름',
    url: 'https://www.google.com/maps/...'
  },
  reference: {
    label: '호텔 상세 보기',
    url: 'https://example.com/hotel'
  },
  tourCosts: {
    title: '현장 비용',
    items: [
      { label: '입장료', amount: 'USD 20' }
    ],
    total: '합계 USD 20',
    note: '현장 결제'
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

`zone`, `warnings`, `chip`, `map`, `reference`, `tourCosts`, `photos`는 필요 없으면 생략할 수 있다. URL은 모두 `https://`로 시작해야 한다. 자유 HTML인 `extraHtml`은 지원하지 않는다. 기본 사진은 `assets/`에 넣고 경로를 설정한다. 웹 편집 화면에서 추가한 사진은 먼저 브라우저 초안에 압축 보관되고 최종 저장 시 Supabase Storage에 업로드된다.

### 같은 Supabase에서 여러 여행 운영하기

`supabase_setup.sql`은 공개 문서 표, 비공개 `trip_editors` 권한표, revision 기반 저장 함수, 버전 관리와 공용 사진 버킷을 만든다. 이전 SQL을 사용한 기존 프로젝트라면 먼저 [업데이트 절차](#updates)를 따른다. 이후에는 여행마다 `register_trip.sql`만 값을 바꿔 실행하면 된다. 각 여행은 서로 다른 `tripId`를 사용하므로 최신 저장본, 50개 버전, 사진 경로가 분리된다.

현재 `register_trip.sql`은 여행마다 편집자 한 명을 등록하며, 기존 여행 ID가 있으면 소유자를 자동 교체하지 않는다. 여러 편집자를 지원하려면 `trip_editors`의 키와 등록 절차를 명시적으로 확장해야 한다.

### 새 여행을 시작하기 전 확인

- 헤더 제목·기간·경로가 새 설정대로 보이는가
- 날짜 탭 개수와 순서가 `days`와 같은가
- 여행 전 PREP, 여행 중 해당 날짜, 여행 후 가계부가 선택되는가
- 두 지역 시계와 시차 방향이 맞는가
- 편집자 로그인, 저장, 버전 복원이 되는가
- 사진 업로드 경로가 새 `tripId/`로 시작하는가
- 오프라인 작업본을 다시 불러올 수 있는가
- `npm test`와 GitHub Actions 검증이 통과하는가

기존 미국 서부 여행은 `trip-config.js`를 그대로 두면 영향을 받지 않는다.

같은 Supabase 프로젝트는 기존 DB 점검을 공유할 수 있다. 다른 프로젝트는 SQL·함수·토큰·예약 작업을 새로 설정한다.

<a id="validation"></a>

## 로컬·CI 검증

패키지 최소 버전은 Node.js 22이고 전체 단위 검사는 CI와 같은 Node.js 24를 권장한다. 과거 Node.js 22의 HTTP 연결 종료 관측 차이는 [검증 기록](archive/2026-10-05-db-health-verification.md)에 남겨 두었다.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test`는 단위 회귀와 `scripts/check-project.mjs`의 설정·이미지 경로·HTML·SQL 구조 검사를 수행한다. npm이 PATH에 없으면 설치된 Node로 `node --test tests/*.test.mjs`와 `node scripts/check-project.mjs`를 실행할 수 있다.

### 저장·권한 SQL 실행 검사

`npm run test:sql`은 [SQL 실행 검사](../scripts/check-trip-sql.mjs)에서 실제 `supabase_setup.sql`과 `register_trip.sql`을 PostgreSQL에 적용한다. Node.js 24, `npm ci`, 별도로 실행한 로컬 테스트용 PostgreSQL 17이 필요하다. 예를 들어 Docker가 설치되어 있으면 다음처럼 일회용 서버를 실행한다.

```sh
docker run --rm --name trip-sql-test -e POSTGRES_PASSWORD=trip-sql-local-only -p 127.0.0.1:55439:5432 -d postgres:17
```

서버가 준비된 뒤 PowerShell에서 실행한다.

```powershell
$env:TRIP_SQL_TEST_URL='postgresql://postgres:trip-sql-local-only@127.0.0.1:55439/postgres'
npm run test:sql
# npm이 PATH에 없는 경우: node --test scripts/check-trip-sql.mjs
docker stop trip-sql-test
```

연결 계정은 DB·역할·publication을 만들 수 있는 테스트 서버의 관리자여야 한다. 스크립트는 loopback 주소만 허용하고 앱 설정이나 `DATABASE_URL`은 읽지 않는다. 신규 설치와 구버전 업그레이드를 각각 `public` 테이블·시퀀스 자동 권한 부여 환경과 명시적 권한만 있는 환경에서 실행한다. 매 경우 무작위 이름의 DB를 생성하고 종료 시 삭제한다. `anon`·`authenticated` 역할이 없으면 임시로 만들었다가 제거하며 기존 역할은 수정하지 않는다. 강제 종료로 정리가 중단되면 일회용 서버를 폐기한다. 운영 DB를 연결하거나 운영 서버를 로컬 포트로 전달해 실행하지 않는다.

검사 범위는 다음과 같다.

- RLS가 없는 대조 테이블의 실제 조회와 identity 시퀀스 권한으로 자동 권한 유무를 확인한 뒤, 두 환경에서 동일한 검사를 실행한다. 명시적 권한 환경은 2026-10-30 Supabase 변경에 따른 권한 누락을 검출한다.
- 익명·비편집자·다른 여행 편집자의 저장 및 비공개 버전 접근 차단, 직접 문서·버전·편집자 변경 차단.
- 정상 저장의 revision·내용·메타데이터, 충돌·잘못된 문서·용량 초과 시 문서와 이력 보존, UTF-8 직렬화 기준 4 MiB 경계.
- 별도 연결 두 개에서 실제 잠금 대기를 확인한 뒤 한 저장만 성공하고 다른 저장은 충돌하는지 검증.
- 여행별 최신 50개 버전 유지와 동일 시각의 정렬, 다른 여행 보존, 신규 등록·구버전 업그레이드·SQL 재실행 시 일정·버전·편집자 연결 보존.
- 사진 경로·여행별 INSERT 권한, 중복·덮어쓰기·삭제 제한, 버킷의 공개·용량·MIME 설정.

`auth.users`, `auth.uid()`와 Storage 테이블은 최소한의 [격리 fixture](../tests/fixtures/trip-sql-bootstrap.sql)다. 실제 JWT 검증, Storage HTTP 업로드·공개 다운로드·파일 크기 및 MIME 강제, Realtime 전달까지 검증하지는 않는다. 사진 덮어쓰기·삭제 검사는 테스트 DB에만 임시 조회 정책을 더해, 조회 불가 때문에 변경 차단이 통과하는 경우도 배제한다. 이 검사는 브라우저 모의 API 검사 및 [DB 상태 점검 SQL 검사](#db-health)와 별도로 실행한다.

### 브라우저와 CI 검사

브라우저 검사는 로컬 가상 API와 격리된 브라우저를 사용하며 외부 운영 요청을 차단한다. [공통 fixture](../scripts/browser-fixtures.mjs)가 실제 여행 설정·편집자 이메일·사진 대신 가상 일정·`example.test` 계정·생성 이미지를 제공한다. 실제 휴대폰 키보드·iPhone 사진 업로드·삼성 인터넷 강제 다크모드는 별도 실기기 검증 대상이다.

| 검사 | 명령·범위 |
|---|---|
| 전체 브라우저 | `node scripts/check-browsers.mjs`: 아래 12개, 하나라도 실패하면 실패 코드 |
| Daylight | `node scripts/check-daylight-browser.mjs`: 숙박 경계·중복·중요 항목·체크 대기/실패·메타데이터 왕복·실제 내보낸 파일의 동작과 너비·5개 반응형 너비 |
| 실패 진단 | `node scripts/check-diagnostics-browser.mjs`: 자식 프로세스에 실패를 주입해 실패 코드·시나리오·여러 탭의 PNG·콘솔/페이지/요청/HTTP 오류·trace ZIP 생성, 화면 캡처 실패 시 나머지 자료 보존, 시작 실패 및 성공 시 trace 폐기 확인 |
| 초안 | `node scripts/check-drafts-browser.mjs`: 탭·복제 탭·복구·보류·충돌·미리보기·로그아웃·저장 제한·가계부 입력 보존, PC·모바일에서 PREP 목록 저장 후 보류 초안 유지·새로고침 복구, 외부 로그아웃·중복 알림 후 재인증과 새 편집 진입 시 복구·삭제·보류, 앱 복귀·재연결 재조회와 Realtime 갱신 시 미추가 입력·초점·선택 범위 보존 및 삭제된 카테고리 대체·후속 추가 |
| 입력 | `node scripts/check-inputs-browser.mjs`: PC·모바일, 한글 조합·취소 불가능 입력·실행 취소·불러오기·내보내기 |
| 가계부 | `node scripts/check-ledger-browser.mjs`: PC·모바일에서 원화·달러 합계와 카테고리별 합계, 환율 변경, 반올림, 예산 미설정·잔액·초과, 빈 목록, 카테고리 삭제, 날짜·카테고리·검색 필터와 실제 CSV 다운로드 결과 |
| 가져오기 | `node scripts/check-imports-browser.mjs`: PC·모바일 실제 파일 입력으로 잘못된 파일 거부·기존 초안 보존, 위험 HTML·주소·중복 ID·비정상 숫자 정제, 구버전 내용·체크·ID 보존, 비교 중 revision 변경 시 재확인·취소·명시적 저장 |
| PREP | `node scripts/check-prep-browser.mjs`: 즉시 저장, 인증 취소·실패·재시도, 목록 편집과 다른 초안 보호 |
| 인증 SDK | `node scripts/check-auth-browser.mjs`: 실제 SDK의 로그인 실패·서버 503·비편집자 세션, 자동 토큰 갱신·갱신 토큰 만료, 다른 탭 로그아웃, 초안 보존·새로고침·재인증·복구 후 저장 |
| IndexedDB 장애 | `node scripts/check-storage-browser.mjs`: PC·모바일에서 DB 열기 실패·용량 초과·쓰기 중단·삭제 실패, 메모리 편집과 기존 초안 보존, 실패 안내·공유 저장·내보내기·재시도·새로고침 복구, 로그아웃·오프라인 저장 |
| 사진 | `node scripts/check-photos-browser.mjs`: 실제 변환·PNG 반환 대체·초안 저장 |
| 테마 | `node scripts/check-theme-browser.mjs`: 테마 선택·저장·내보내기 |
| PWA | `node scripts/check-pwa-browser.mjs`: 설치·캐시·오프라인·시간 제한 |

개별 브라우저 스크립트는 첫 인자로 Playwright 모듈의 절대 경로를 받을 수 있다. 설치된 Chrome을 사용하려면 PowerShell에서 `$env:PWA_BROWSER_CHANNEL='chrome'`을 설정한다. PWA·인증 SDK 검사는 앱과 같은 npm SDK를 로컬 파일로 제공하고 테스트 페이지의 URL·SRI만 대체하므로 CDN 연결 없이 실행된다.

인증 SDK 검사는 인증 함수를 대체하지 않고 로컬 HTTP API의 응답을 바꾼다. 가상 시계로 SDK의 자동 갱신과 액세스 토큰 만료 후 갱신 거부를 실행하고 `TOKEN_REFRESHED`·`SIGNED_OUT` 이벤트가 앱 세션과 편집 화면에 반영되는지 확인한다. 갱신된 토큰이 실제 저장 요청에 사용되는지도 검사한다. 외부 로그아웃은 앱 코드가 없는 별도 탭에서 SDK로 실행해 SDK 자체의 탭 간 이벤트 전달을 검증한다. 기존 초안 검사와 달리 인증 이벤트를 직접 호출하지 않는다. 운영 계정·실제 인증 서버·JWT 서명 검증·DB 권한·Realtime 전달 검사는 포함하지 않으며 HTTP 외부 요청과 WebSocket 연결을 차단한다.

가계부 검사는 오프라인 앱에 고정 데이터를 적용한 뒤 실제 화면과 다운로드 파일을 고정된 기대값과 비교한다. 합계는 합산 후 반올림하고 CSV 원화 환산액은 행마다 반올림하는 차이도 검사한다. CSV의 UTF-8 BOM, 쉼표·따옴표·줄바꿈·한글 보존과 `=`, `+`, `-`, `@`로 시작하는 셀의 작은따옴표 처리를 확인한다. 다운로드 파일은 `westbound-ledger-*` 임시 폴더에 남기며, Excel 등 스프레드시트 앱에서 파일을 여는 검사는 포함하지 않는다.

IndexedDB 장애 검사는 앱의 저장 함수를 교체하지 않는다. 브라우저 API 경계에서 열기 오류·동기 예외·`QuotaExceededError`를 주입하고, 실제 쓰기·삭제 요청이 성공한 뒤 트랜잭션을 중단해 커밋 전 롤백을 확인한다. 별도 IndexedDB 조회로 이전 기록 보존을 확인하고, 새로고침 후에는 성공적으로 저장된 내용만 복구되는지 검사한다. 실제 디스크를 채우거나 실기기의 저장소 회수 정책을 재현하는 검사는 아니다.

자동 로그아웃 회귀 검사는 `scripts/check-drafts-browser.mjs`에서 가상 시계로 29분 경고·30분 만료, 계속 사용·저장·명시적 폐기, 변경 없는 화면·보류 초안, 인증 확인·재접속 시 만료 처리를 확인한다. 로그아웃 상태의 새로고침에서 초안을 적용하지 않고 보관하며 재인증 후 복구하는지, PC·모바일에서 후속 편집의 복구·삭제·보류와 버전 미리보기 종료도 검사한다.

가져오기 검사는 [스키마 4 fixture](../tests/fixtures/import-v4.json)와 생성한 HTML 파일을 실제 `input[type=file]`에 넣는다. 다른 여행·온라인 파일·미지원/잘못된 버전·편집 데이터 누락·깨진 JSON 14종의 거부 시 화면, IndexedDB 초안, 서버 문서가 유지되는지 확인한다. 정제 검사는 스크립트·이벤트·위험 링크·이미지 `srcset` 요청 차단과 정상 링크·사진·일정 보존을 함께 검사한다. revision 검증에는 로컬 모의 API를 사용하며 실제 DB 동시성 검증을 대신하지 않는다.

사진 통신 회귀 검사는 `tests/photos.test.mjs`와 `scripts/check-drafts-browser.mjs`에 있다. 단위 검사는 인증 지연·본문 지연·중복 객체 응답을 확인한다. 브라우저 검사는 PC·모바일 화면의 로컬 모의 서버에서 HEAD·업로드·다운로드와 응답 본문을 멈추고, 제한 시간·취소 시 실제 연결 중단, 공유 저장 방지, 초안 보존, 작업 상태 해제와 재시도를 확인한다. 인쇄·공유용 사본의 시간 초과 시 온라인 주소 유지와 취소 시 다운로드 방지도 검사한다. 테스트에서만 제한 시간을 단축하며 운영 서버에는 요청하지 않는다.

GitHub Actions는 단위·정적 검사(Node.js 24), 저장·권한 SQL 검사(Node.js 24·PostgreSQL 17), 브라우저 검사(Node.js 22)를 별도 작업으로 실행한다. SQL 작업은 일회용 PostgreSQL 서비스와 잠금 파일의 의존성을 사용한다. 브라우저 작업은 잠금 파일과 Chromium을 설치하고 실패 시 `${runner.temp}/westbound-*/`를 `browser-diagnostics` 자료로 7일 보관한다. CSS 블록 재통합이 필요할 때만 `npm run styles:consolidate`를 실행한다.

[공통 진단 도구](../scripts/browser-diagnostics.mjs)는 실패를 잡으면 브라우저 종료 전에 각 열린 탭의 화면 PNG와 context별 `*-trace.zip`, `failure.json`을 OS 임시 폴더의 `westbound-<검사>-diagnostics-*`에 저장하고 경로를 출력한다. JSON에는 실패 시나리오·원래 오류·시나리오 진행 기록·최근 1,000개 콘솔/페이지/요청 실패/HTTP 4xx·5xx 이벤트가 들어간다. 의도적으로 주입한 통신 실패도 함께 기록되므로 오류 로그 자체가 검사 실패를 뜻하지는 않는다. 화면 캡처가 실패해도 다른 자료 저장을 계속하며 저장 오류도 JSON에 남긴다. 성공한 context의 trace는 폐기한다. 진단 자체 검사에서 의도적으로 만든 실패 자료는 `westbound-diagnostics-self-test-*`로 구분한다.

trace는 내려받은 뒤 `npx playwright show-trace "<trace.zip 경로>"`로 연다. DOM·통신 본문을 포함하므로 이 도구는 가상 데이터와 새 브라우저 context에서만 사용하며 운영 계정·개인 여행 파일을 연결하지 않는다. 브라우저 시작 실패는 화면·trace 없이 JSON을 남긴다. 프로세스 강제 종료나 전체 검사 제한 시간(묶음별 180초) 초과에는 종료 전 캡처를 보장하지 않는다. 배포 설정 등 문자열 검사는 유지하고, 진단 자료 생성과 주요 사용자 동작은 실제 실행 결과로 검증한다.

문서만 변경했을 때는 문서 경로·링크·배포 제외 설정과 관련 단위·정적 검사를 확인한다. UI·동작 변경에는 해당 브라우저 검사와 필요한 실기기 확인을 수행한다. 과거 검사 개수를 현재 통과 결과로 재사용하지 않는다.

<a id="deployment"></a>

## Git과 배포

WSL 또는 PowerShell 중 한 환경을 기준으로 변경 전후 `git status`와 `git diff`를 확인한다. `.gitattributes`는 LF를 유지한다. 사용자 변경을 덮어쓰지 않고 필요한 파일만 스테이징한다. Git 메타데이터는 보존하며 권한 오류 처리는 [AGENTS.md](../AGENTS.md)를 따른다.

```sh
git status --short --branch
git diff
npm test
git diff --check
```

검증 후 승인된 범위에서 변경 파일을 `git add`하고 커밋·푸시한다. 푸시 완료는 로컬 커밋만으로 판단하지 않고 추적 브랜치와 원격을 확인한다. 여행 내용 편집은 앱에서 저장한다.

GitHub Settings → Pages에서 `main` 브랜치와 루트(`/`)를 선택한다. `_config.yml`의 `docs` 제외는 안내서·이력의 HTML 배포를 막으며 저장소에서는 읽을 수 있다.

HTML·설정과 함께 `manifest.webmanifest`, `pwa.js`, `sw.js`, `icons/`, `assets/`를 배포한다. 설치 경로는 상대 경로로 유지한다. manifest의 `id`는 생략해 각 배포 경로의 `start_url`을 앱 식별자로 쓰며 `id: "./"`를 추가하지 않는다. 다른 여행은 manifest 이름·설명과 HTML의 `apple-mobile-web-app-title`을 변경한다.

캐시 목록·전략·아이콘·이미지를 바꾸면 `sw.js`의 `VERSION`을 올린다. SDK 버전 변경은 HTML의 고정 URL·SRI와 서비스 워커의 `SDK_URL`·`SDK_INTEGRITY`를 함께 갱신하고 검사한다. 새 서비스 워커는 기존 앱 창을 모두 닫은 후 활성화되며 편집 중인 창을 강제 새로고침하지 않는다. 아이콘 PNG는 `icons/icon.svg`와 같은 도형을 `scripts/generate-icons.ps1`로 생성한다.

<a id="db-health"></a>

## DB 점검 설정과 운영

아래 주기·주소는 저장소에 기록된 운영 설정이다. 현재 활성 상태는 cron-job.org와 Supabase에서 재확인한다. 2026-10-05 당시 운영 작업 ID는 `8582896`이며 배포·실제 예약 호출·이메일 수신 근거는 [당시 검증 기록](archive/2026-10-05-db-health-verification.md)에 있다.

외부 cron-job.org → Supabase Edge Function `trip-db-health` → `public.healthcheck`의 `id=1` 조회.

GitHub Pages는 정적 호스팅이므로 점검 API를 Supabase Edge Function에 배포한다. 평상시 한국 시각 **00:17, 06:17, 12:17, 18:17**에 한 번씩 실행한다. 실패하면 함수 안에서 1초 뒤 한 번 재시도한다. 각 조회는 응답 본문 읽기를 포함해 10초 제한이며, 최대 약 21초 뒤 503을 반환한다. 예약 호출은 30초 제한이다.

정상 응답은 `200 {"ok":true}`, 조회 실패·데이터 누락·설정 오류는 `503 {"ok":false}`다. 토큰 오류는 401, GET 외 요청은 405다. 응답은 캐시하지 않는다. 데이터베이스에는 비민감 점검 행 한 건만 읽으며, 일정·수정 시각·버전 이력을 변경하지 않는다. 쓰기, 로그인, 사진 업로드 전체를 점검하는 기능은 아니다.

### 1. 점검 테이블

Supabase 프로젝트 `xuzhcogshnjqtunkbsuo`가 일시정지됐다면 먼저 Resume 한다.

Dashboard → SQL Editor에서 [마이그레이션](../migrations/20261005_db_healthcheck.sql) 전체를 실행한다. 반복 실행해도 점검 행을 중복 생성하지 않는다. 익명 역할에는 `id` 조회만 허용하고 쓰기 권한을 제거하며 RLS를 켠다. 기존 `supabase_setup.sql`을 다시 실행할 필요는 없다. 새 프로젝트에도 이 마이그레이션은 별도로 실행한다.

### 2. 호출 토큰 준비

저장소에서 Node.js 22 이상으로 실행한다. 전체 단위 검증은 CI와 같은 Node.js 24를 권장한다.

```powershell
node scripts/prepare-db-health.mjs
```

앱의 공개 Supabase 설정을 읽고 암호학적 난수로 64자리 토큰을 만든다. 파일은 다음과 같다.

- `.secrets/db-health.env`: Edge Function의 `HEALTHCHECK_TOKEN`, `HEALTHCHECK_PUBLISHABLE_KEY`
- `.secrets/db-health-cron.env`: 예약 등록용 `SUPABASE_PROJECT_REF`, 같은 토큰, 비어 있는 `CRON_JOB_API_KEY`

두 파일은 Git에서 제외한다. 재실행하면 토큰을 유지하고 기존 파일을 덮어쓰지 않는다. 키 또는 토큰이 서로 다른 파일은 오류로 처리한다. 토큰이나 cron-job.org API 키를 채팅·소스·명령 인수에 붙여 넣지 않는다.

### 3. 함수 배포

Supabase CLI로 로그인한 환경에서 실행한다. CLI가 없다면 `npx supabase`를 사용할 수 있다.

```powershell
npx supabase@2.119.0 login
npx supabase@2.119.0 secrets set --env-file .secrets/db-health.env --project-ref xuzhcogshnjqtunkbsuo
npx supabase@2.119.0 functions deploy trip-db-health --project-ref xuzhcogshnjqtunkbsuo --use-api
```

`supabase/config.toml`의 `verify_jwt=false`는 예약 호출이 사용자 JWT를 보유하지 않기 위한 설정이다. 함수 자체가 `X-Healthcheck-Token`을 검증한다. DB에는 별도의 공개 publishable key만 사용하며 service-role/secret key는 받지 않는다. `SUPABASE_URL`은 배포 환경에서 자동 제공된다.

배포 주소:

```text
https://xuzhcogshnjqtunkbsuo.supabase.co/functions/v1/trip-db-health
```

`--use-api`는 Docker 없이 서버에서 함수 파일을 묶어 배포한다. Dashboard에서 직접 배포하는 경우 `index.ts`와 `handler.mjs` 두 파일을 올리고 JWT 검증 설정과 두 환경 변수를 같은 값으로 맞춘다.

CLI 2.119.0으로 로그인했다면 SQL Editor 대신 검증한 파일만 적용할 수도 있다. 다음 명령은 이 마이그레이션만 실행한다.

```powershell
npx supabase@2.119.0 db query --linked --project-ref xuzhcogshnjqtunkbsuo --file migrations/20261005_db_healthcheck.sql
```

### 4. cron-job.org 등록

`pca01008@gmail.com`으로 계정을 만들고 이메일 인증을 완료한다. 알림 주소는 cron-job.org 계정 이메일을 사용한다. API용 등록 시 Settings에서 만든 API 키를 로컬 `.secrets/db-health-cron.env`의 `CRON_JOB_API_KEY=` 뒤에 넣는다. 계정 비밀번호는 필요하지 않다.

설정 미리보기는 외부 요청 없이 실행되고 토큰도 숨긴다.

```powershell
node --env-file=.secrets/db-health-cron.env scripts/configure-db-health-cron.mjs
```

실제 등록:

```powershell
node --env-file=.secrets/db-health-cron.env scripts/configure-db-health-cron.mjs --apply
```

스크립트는 먼저 배포된 API가 200과 `ok:true`를 반환하는지 확인한다. 같은 제목·URL의 기존 작업을 재사용하며 중복 작업 또는 불완전한 목록을 받으면 등록을 중단한다. 새 작업은 비활성 상태로 만든 뒤 설정을 재조회·검증하고 활성화한다. 활성화 후에도 다시 조회하여 시간대·주기·토큰·알림 설정이 일치하는지 확인한다. API 전송 중 오류로 완료 여부가 불확실하면 Console에서 확인 후 재실행한다.

수동 등록도 가능하다. Console에서 아래 값을 설정하고, Test Run과 실행 이력을 확인한다.

| 설정 | 값 |
|---|---|
| URL | 위 함수 배포 주소 |
| 요청 | GET |
| 사용자 지정 헤더 | `X-Healthcheck-Token`: `.secrets/db-health.env`에 있는 토큰 |
| 시간대 | Asia/Seoul |
| 실행 | 매일 00:17, 06:17, 12:17, 18:17 |
| 제한시간 | 30초 |
| 리다이렉트 성공 처리 | 끔 |
| 응답 본문 저장 | 끔 |
| 실패 알림 | 켬, 실패 1회부터 |
| 복구 알림 | 켬 |
| 자동 비활성화 알림 | 켬 |
| 알림 채널 | 계정 이메일만 |

### 5. 검증

```powershell
node --test tests/db-health.test.mjs
node --test tests/*.test.mjs
node scripts/check-project.mjs
```

같은 함수 실행 환경인 Deno에서도 검사한다. Deno가 설치돼 있지 않으면 `npx deno` 또는 `pnpm dlx deno`로 실행할 수 있다.

```powershell
deno check supabase/functions/trip-db-health/index.ts
deno run --allow-net=127.0.0.1 scripts/check-db-health-deno.mjs
```

Deno HTTP 검증은 로컬 서버만 사용하여 인증, 실제 조회 요청, 데이터 누락, DB 오류, 응답 본문 시간 초과와 복구를 확인한다.

DB 권한까지 검증하려면 별도의 임시 검증 폴더에 `@electric-sql/pglite@0.5.8`을 설치하고 다음을 실행한다. 앱의 운영 의존성은 아니다.

```powershell
node scripts/check-db-health-sql.mjs '임시 검증 폴더/node_modules/@electric-sql/pglite/dist/index.js'
```

격리된 PostgreSQL에서 `public` 테이블 자동 권한 부여 유무를 대조 조회로 확인하고, 두 환경 모두에서 반복 마이그레이션, 한 행 제약, RLS, 익명 읽기, 쓰기·DDL 차단, 점검 행 누락 및 복구, 기존 여행 fixture 보존을 검사한다. 운영 DB를 수정하지 않는다.

운영 확인은 별도로 한다.

1. SQL 실행 후 점검 행이 한 건인지 확인한다.
2. `node --env-file=.secrets/db-health-cron.env scripts/check-db-health-live.mjs`로 올바른 토큰의 200, 토큰 누락·오류의 401, POST의 405와 캐시 금지를 확인한다.
3. cron-job.org Test Run으로 실행 이력의 200을 확인한다.
4. 알림 검증은 **별도의 임시 함수와 예약 작업**에서 한다. 예약 작업의 URL·헤더·주기는 고정하고 임시 함수의 응답만 실패에서 정상으로 전환하여 실패·복구 이메일을 확인한다. 예약 작업 자체를 편집하는 검증에서는 복구 실행과 이메일 알림 결과가 달라질 수 있으므로, 운영 장애가 복구되는 상황처럼 요청 대상의 응답만 바꾼다. 운영 DB나 정상 점검 함수를 고의로 중단하지 않는다. 검증 후 임시 작업을 비활성화하고 임시 함수·시험용 환경 변수는 제거한다.
5. 최소 한 번의 실제 예약 실행까지 이력에서 확인한다. API 등록 직후의 성공만으로 예약 실행이나 이메일 수신 완료를 주장하지 않는다.

### 운영 시 확인할 점

무료 Supabase의 일시정지 제외를 보장하는 수치는 공개돼 있지 않다. 하루 4회는 공식 안내의 "매일 몇 차례의 사용자 DB 요청"을 기준으로 제안한 주기다. 이미 정지된 프로젝트는 수동 재개해야 한다.

cron-job.org는 연속 실패가 누적되면 작업을 비활성화할 수 있다. 비활성화 알림을 받으면 프로젝트·함수·토큰을 확인하고 Console에서 다시 활성화한다. 이 구성은 호출 결과를 감시한다. 외부 예약 서비스 전체가 멈춰 호출 자체가 발생하지 않는 상황까지 감지하려면 별도의 미실행 감시 서비스를 추가해야 한다.

토큰을 바꿀 때는 Supabase Secret과 cron-job.org 헤더를 함께 갱신하고 Test Run을 실행한다. 프로젝트를 바꾸거나 앱의 공개 키를 교체하면 점검용 환경 변수도 갱신한다.

- [Supabase 프로젝트 일시정지](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase 함수 배포](https://supabase.com/docs/guides/functions/deploy)
- [Supabase 함수 환경 변수](https://supabase.com/docs/guides/functions/secrets)
- [cron-job.org API](https://docs.cron-job.org/rest-api.html)
- [cron-job.org 제한과 알림](https://cron-job.org/en/faq/)

### 실패 알림 대응

1. cron-job.org의 HTTP 상태·최근 성공 시각·활성 여부를 확인한다.
2. Supabase가 일시정지 상태면 수동 Resume 한다.
3. 401은 함수와 예약 헤더의 토큰, 503은 DB 연결·점검 행·권한·환경 변수를 확인한다.
4. 원인 해결 후 필요하면 예약을 활성화하고 다음 실제 예약 성공과 복구 이메일을 확인한다.

<a id="troubleshooting"></a>

## 문제 해결

| 증상 | 확인 순서 |
|---|---|
| push 후 화면이 그대로 | 저장소·브랜치 → Pages/Actions 배포 → 앱 창을 모두 닫고 다시 열기. 미저장 편집을 먼저 보존한다. |
| 기본 일정을 바꿨는데 예전 내용 표시 | 같은 `tripId`의 서버 공유본이 기본값보다 우선한다. 실제 일정 변경은 앱에서 저장한다. |
| 로그인 실패·반복 인증 | 편집자 계정·이메일·프로젝트 URL·키 → 30분 비활성 여부 → 사이트 저장소 차단 → 브라우저·시크릿 창·`file://`/HTTPS 차이 |
| 로그인되지만 저장 실패 | 여행 행·`trip_editors` 연결 → 저장 RPC·RLS 적용 → 네트워크·제한시간·revision 충돌. 불확실한 저장은 초안을 유지한다. |
| SQL 실행 후 UI가 그대로 | SQL은 서버 구조를 바꾼다. UI는 앱 코드 배포가 필요하다. |
| 사진 업로드·내보내기 실패 | 원본 20MB → 압축 결과 5MB → WebP/JPEG 변환 → 버킷 MIME·여행 경로별 INSERT 정책 → 로그인·네트워크. 사진 확인은 10초, 업로드·다운로드는 요청당 60초 제한이며 초안은 유지된다. 연결을 확인한 뒤 다시 시도한다. |
| 다른 사람에게 변경이 안 보임 | 실제 저장 여부 → 편집·초안·미리보기 상태 → Realtime → 새로고침 시 공유본 확인 |
| 버전 목록 없음 | 편집자 로그인·버전 표/정책·이전 저장 여부 |
| 오프라인 파일이 큼 | Base64 사진 포함으로 커질 수 있다. 기기 여유 공간과 사진 수를 확인한다. |
| 테마가 선택과 다름 | [테마 안내](USER_GUIDE_KO.md#화면-테마)의 삼성 인터넷 강제 다크모드·저장소 제한 확인 |
| DB 점검 실패 | 위 실패 알림 대응 절차 사용 |
| Windows/WSL에서 전체 파일 변경 | `.gitattributes`와 줄바꿈 확인. 실제 수정과 줄바꿈 차이를 구분하고 사용자 변경을 덮어쓰지 않는다. |

<a id="ui-concepts"></a>

## UI 초안 비교

다른 기기나 원격 환경에서는 [온라인 비교 화면](https://pca01008.github.io/us-west-2027-trip/ui-preview/)을 사용한다. `127.0.0.1`은 접속한 기기 자신의 주소이므로 원격 기기에서 개발 PC의 서버를 열 수 없다.

`docs/ui-concepts/index.html`을 브라우저에서 직접 열면 세 안의 데스크톱·모바일 미리보기와 클릭 가능한 초안을 비교할 수 있다. 로컬 서버를 사용할 때는 저장소 루트에서 실행한다.

```sh
node docs/ui-concepts/serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/docs/ui-concepts/index.html`을 연다. 서버는 로컬 컴퓨터에만 바인딩하며 종료는 실행 터미널의 Ctrl+C로 한다.

포트 변경은 `UI_PREVIEW_PORT` 환경 변수로 지정한다. 이번 앱 내 비교 화면은 `4174` 포트를 사용한다.

- 선택용 초안이며 운영 앱과 저장 데이터를 변경하지 않는다. 시각·체크 상태·지출은 예시다.
- `prepare-data.mjs`는 기본 설정에서 표시용 일정·목적지 시간대·기존 아이콘을 추출하고, 운영 `index.html`의 순수 시간표 계산 구간을 `timetable-core.js`로 생성한다. 실행은 `node docs/ui-concepts/prepare-data.mjs`이며 생성 파일은 직접 편집하지 않는다. 계정·API 설정은 초안 데이터에 포함하지 않고 실제 서버 공유본을 조회하지 않는다.
- A안은 준비 탭 이동, 항상 보이는 확인 사항, 그룹별 설정 버튼, 전체·1일 시간표를 검토한다. 설정 버튼은 연결 전 상태로 비활성화되어 있다. 시간표의 데이터는 기본 설정 스냅샷이며 실제 공유본이 아니다. 기존 운영 기능을 제거하거나 저장 정책을 바꾸는 결정은 포함하지 않는다.
- A안의 준비 탭 진입은 페이지 맨 위로 이동하고 제목에 포커스를 둔다. 가계부 카테고리는 PC에서 별도 열, 모바일에서는 항목 아래에 표시한다. 일정 보기 방식은 밑줄형 전환, 시간표 범위는 별도의 작은 선택 영역으로 구분한다.
- A안 일정의 숙소는 예시 숙박 기간에 해당하는 날짜에만 표시한다. 준비 화면에는 중요하면서 미완료인 예시 항목을 목록 순서대로 표시하며, 원본으로 이동하거나 중요 표시를 변경할 수 있다. 준비 화면의 고정 숙소 카드는 제거했다. B/C는 당시 비교 기록을 유지한다.
- `capture.mjs`는 Playwright Chromium으로 초안의 화면을 캡처하고 탐색·필터·체크 동작을 확인한다. 실행은 `node docs/ui-concepts/capture.mjs`이며 A안만 확인할 때는 끝에 `a`를 붙인다. A안은 설정, 시간표 전체·1일, 상세 열기·Esc 닫기·포커스 복원, 날짜 유지, 다른 시간대 분리와 원본 데이터 불변도 확인한다. 기존 [브라우저 검증](#validation)과 동일하게 Playwright 브라우저 설치가 필요하다. 별도 브라우저 캐시가 있으면 `PLAYWRIGHT_BROWSERS_PATH`를 해당 경로로 설정한다.
- 초안 원본과 검토 캡처는 `docs/` 아래에 두고 Pages 배포에서 제외한다. 온라인 비교 화면은 아래 명령으로 `ui-preview/`에 생성한다. 수정 후 필요한 화면을 다시 캡처하고 생성본을 갱신해 원본과 함께 커밋·push한다. `ui-preview/`에는 브라우저 파일 11개와 비교 이미지 6개만 복사하고, 기존 공용 숙소 이미지는 상대 경로로 참조한다. 서버 API 설정과 도우미 스크립트는 복사하지 않는다. `PRODUCT.md`도 개발용 제품 문서로 배포에서 제외한다.
- 판단 근거와 당시 확인 범위는 [2026-10-21 검토 기록](archive/2026-10-21-ui-concepts.md)에 있다. 선택 전에는 영구 디자인 시스템으로 취급하지 않는다.
- A안 후속 변경과 검증은 [10월 21일 개선 기록](archive/2026-10-21-daylight-refinement.md), [10월 22일 사용성 개선 기록](archive/2026-10-22-daylight-usability.md)을 참고한다.

```sh
node scripts/build-ui-preview.mjs
```

`main`의 Pages 배포가 완료되면 온라인 비교 화면에 반영된다. 운영 앱의 `index.html`과 서비스 워커는 초안 배포로 수정하지 않는다.

<a id="maintenance"></a>

<a id="daylight-rollout"></a>

## Daylight 후보 검토와 운영 전환

<a id="daylight-live"></a>

### 실제 데이터에 연결한 병행 앱

기존 루트 주소는 기존 화면을 유지하고 `/daylight/`에 온라인 Daylight를 배포한다. 두 앱은 같은 실제 공유본을 읽고 저장한다. 사용과 로그인·초안 분리 조건은 [사용자 안내서](USER_GUIDE_KO.md#shared-daylight), 저장 호환 처리는 [기술 설명서](PROJECT_GUIDE_KO.md)를 따른다. 루트 화면을 Daylight로 교체하는 전환은 별도다.

아래 생성·검사 스크립트는 `codex/daylight-implementation` 브랜치에서 실행한다. main에는 배포 산출물과 기존 앱 호환 패치를 게시한다.

- 후보 브랜치에서 `node scripts/build-daylight-live.mjs`를 실행한다. 생성한 `daylight/`는 직접 편집하지 않으며 후보 코드·설정·PWA·기본 이미지가 바뀌면 다시 생성한다. 소스 LF 해시는 생성 HTML의 `daylight-live-source` 메타에 기록된다.
- `node scripts/check-daylight-live-browser.mjs`는 기준 기존 코드에 호환 패치를 적용하여 두 화면의 공유 저장·중요 표시 보존·숙박 날짜 보존·동시 목록 충돌을 가상 서버로 검증한다. 실제 API에 쓰지 않는다. Git 기준 커밋 `22ecee3`이 필요하므로 브라우저 CI는 전체 이력을 가져온다.
- `node scripts/check-daylight-layout-browser.mjs`는 후보와 생성된 병행 앱을 합성 자료로 열어 320·360·390·520·540·620·621·768·1100·1280·1440px에서 일정·준비·가계부를 검사한다. 긴 한글·영문 지출명과 큰 금액을 넣어 행 내부 잘림·텍스트와 버튼 겹침·44px 터치 영역·입력 글자 크기·설정 메뉴 경계를 확인한다. Chromium의 모바일 터치 에뮬레이션이며 실제 휴대폰·삼성 인터넷 검증을 대신하지 않는다. 캡처 경로는 실행 결과에 출력하며 전체 브라우저 검사에도 포함된다.
- PowerShell에서 `$env:DAYLIGHT_LIVE='1'; node scripts/check-pwa-browser.mjs`로 `/trip/daylight/`의 설치 조건·오프라인 재열기·테마·온라인 갱신을 검증한다. 검사 후 `Remove-Item Env:DAYLIGHT_LIVE`로 해제한다.
- main 배포에는 생성한 `daylight/` 전체와 기존 루트의 메타데이터 호환 패치를 포함한다. `scripts/daylight-legacy-compat.mjs`의 `preserveDaylightMetadata(legacy,candidate)`로 다섯 함수만 옮기고 diff에서 기존 탐색·화면 유지 여부를 확인한다. 후보 루트 전체를 main으로 덮어쓰지 않는다.
- Pages 성공 뒤 두 공개 주소가 같은 최신 revision을 읽는지 확인한다. 실제 데이터 쓰기는 시험하지 않는다. 두 사용자의 기존 열린 창·설치 앱을 온라인에서 다시 열어 호환 패치를 적용한다. 되돌릴 때도 이 패치를 유지하고 여행 데이터는 과거본으로 덮어쓰지 않는다.
- 공개 읽기 검사: `node scripts/check-daylight-live-public.mjs`. 실제 문서 내용은 출력·저장하지 않고 revision·항목 수만 보고한다. GET·HEAD 외 요청을 차단하며 로그인 창까지만 확인한다.

검증 근거: [실제 데이터 병행 앱 기록](archive/2026-10-23-daylight-live.md).

후보 코드·계획·현재 검증 범위는 [2026-10-23 구현 기록](archive/2026-10-23-daylight-implementation.md)을 기준으로 한다. 운영 전환은 별도 승인 대상이며 후보 브랜치의 `index.html`을 승인 없이 main에 병합하지 않는다.

후속 비교·수정의 최신 로컬 근거는 [전환 준비 검토](archive/2026-10-23-daylight-readiness.md)를 따른다. 그 기록의 소스 해시와 공개 검토본을 구분한다. 로컬 생성물 갱신은 공개 배포나 후보 CI 성공을 뜻하지 않는다.

### 기존 버전과 같은 조건으로 비교

[기존 버전 단독 페이지](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-before.html)와 [Daylight 단독 페이지](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-after.html)를 각각 열면 비교 프레임 없이 브라우저 전체 너비로 사용할 수 있다. 휴대폰에서도 같은 HTTPS 주소로 연다. 탭 제목으로 버전을 구분하며 날짜·테마·체크·편집은 각각 독립적으로 조작한다. 두 페이지는 같은 Pages 도메인을 사용하지만 버전별 tripId·캐시·초안·오프라인 ID·테마 키를 분리한다. 직접 연 주소는 `standalone` 비교 공간을 사용하므로 같은 브라우저에서 다시 열면 해당 버전의 로컬 상태가 유지된다. 각 기기의 로컬 상태는 다른 기기에 공유되지 않는다.

단독 페이지도 동일한 예시 데이터이며 로그인·운영 서버 저장·동시 편집 서버는 연결하지 않는다. 일정 편집과 체크, 가계부, 파일 내보내기를 시험할 수 있다. 작업본의 저장은 파일 다운로드이며 운영 앱에 반영되지 않는다. 초기 예시로 다시 비교하려면 아래 비교 화면의 “새 예시로 시작”을 누르고 각 버전의 “새 탭” 링크를 연다. 공개본 식별·검증 근거는 [단독 페이지 공개 기록](archive/2026-10-23-daylight-standalone.md)을 따른다.

[1:1 비교 화면](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html)은 기존 운영 코드와 Daylight 후보를 같은 예시 일정·준비 목록·지출 3건으로 실행한다. 공통 설정에서 날짜·테마·여행 시점·일별 일정/시간표·390/768/1440px 너비를 선택한다. 나란히 또는 한 버전씩 볼 수 있고 각 화면을 새 탭으로 열 수 있다. 각 버전 안의 조작은 독립적이며 “두 화면 맞추기”는 공통 탐색 설정과 화면 상단을 다시 적용한다. 편집 중에는 앱의 기존 정책에 따라 시간표 전환이 제한될 수 있다.

“새 예시로 시작”은 두 버전을 새 비교 공간으로 연다. 각 버전·비교 세션은 고유 tripId·캐시/초안 DB·오프라인 ID를 쓰며 테마도 비교 전용 범위를 사용한다. 운영 계정·API·SDK·PWA는 연결하지 않는다. 로그인·공유 저장·충돌은 이 공개 비교본의 시험 범위가 아니다. 원본 커밋과 공통 fixture 해시는 비교 화면의 버전 정보와 `ui-preview/daylight-comparison.json`에 기록한다.

생성: `node scripts/build-daylight-comparison.mjs`. 기존 버전은 생성기의 명시된 기준 커밋에서, 후보는 현재 `index.html`에서 읽는다. 기준 버전을 바꿀 때는 baseline 커밋을 명시적으로 바꾸고 새 검증 기록을 남긴다. 공통 fixture와 오프라인 격리·초기 지출 주입 외에는 각 앱의 화면·기능 코드를 바꾸지 않는다. 앱 소스가 바뀌면 다시 생성한다. 생성 HTML을 직접 수정하지 않는다.

검사: `node scripts/check-daylight-comparison.mjs`. 실제 공개본 검사에는 마지막 인자로 비교 페이지 HTTPS 주소를 전달한다. 두 설정의 동등성·가계부 합계·체크 격리/초기화·공통 탐색·정확한 프레임 너비·외부 요청 부재를 확인한다. 캡처는 `docs/ui-concepts/previews/daylight-comparison/`에 남긴다. 로컬 수동 검토는 기존 `node docs/ui-concepts/serve.mjs`를 실행하고 `/ui-preview/daylight-compare.html`을 연다. 공통 제어가 프레임에 접근해야 하므로 비교 페이지는 `file://` 대신 로컬 서버나 공개 HTTPS에서 연다.

이 검사는 단독 페이지 두 개를 같은 브라우저의 별도 탭으로 직접 열어 프레임 부재·버전별 제목·현재 생성물 소스 해시·저장소 식별자·체크 저장과 재로딩·테마 및 탐색 독립성·390/1440px 전체 너비도 검증한다. 완료 순서가 바뀌는 준비 항목은 화면 순서 대신 `data-check-id`로 확인한다.

### 단일 후보 검토본

`node scripts/build-daylight-review.mjs`는 현재 후보 코드와 합성 여행 fixture로 `ui-preview/daylight-candidate.html`을 생성한다. 운영 계정·실제 여행 내용·외부 SDK·PWA 등록을 포함하지 않는다. 후보 소스 해시별 tripId·캐시 이름을 사용하고 오프라인 모드로 실행하므로 브라우저의 검토 초안과 운영 저장소가 분리된다. 검토본의 편집은 로컬에서만 저장되며 공유 저장·인증·충돌은 `node scripts/check-daylight-browser.mjs`와 기존 가상 API 검사로 확인한다. 생성물은 직접 편집하지 않는다.

원격 검토 시 `ui-preview/`의 초안·후보 파일만 별도로 공개할 수 있다. 운영 루트 파일 변경과 혼합하지 않으며 배포 파일 목록·Pages 완료·HTTPS 응답을 확인한다. 후보 배너의 기준 커밋·소스 SHA-256·fixture 버전으로 검토 대상을 식별한다. 원본 index가 바뀌면 후보 생성과 관련 검사를 다시 수행한다.

`node scripts/check-daylight-review.mjs`는 생성 파일을 실제로 열어 해시·저장소 분리·숙소·중요 체크 재로딩·외부 요청 부재를 검사한다. 공개 뒤에는 마지막 인자로 검토본 HTTPS 주소를 전달해 같은 검사를 실행한다. 소스 해시는 Git 줄바꿈과 일치하도록 LF로 정규화한다. 후보 CI는 PR 또는 기존 Validate 워크플로의 수동 실행으로 후보 브랜치를 지정하고, 공개 초안만 배포한 main의 CI와 구분한다.

운영 전환 전 두 사용자 모두 열린 구형 앱·설치 앱을 닫고 갱신한 뒤 접속한다. 각자의 미저장 초안은 먼저 공유 저장하거나 파일로 보관하고, 구형 작업본은 후보 앱으로 불러온 차이를 확인한 후 저장한다. 신규 중요 표시·숙박 기간을 저장한 뒤에는 구형 앱으로 편집하지 않는다. 코드 복귀가 필요하면 최신 데이터 백업과 신규 속성 보존이 가능한 호환 수정이 우선이다. 과거 백업으로 실제 지출·일정을 일괄 덮어쓰지 않는다. 이 절차를 수행할 수 없으면 운영 전환을 보류한다.

전환 실행 순서:

1. 검토한 후보의 소스 해시·커밋을 확정하고 해당 커밋의 Validate 단위·SQL·브라우저 결과를 확인한다. 이전 후보의 CI 결과로 대신하지 않는다.
2. 두 사용자 각자의 초안을 저장하거나 오프라인 작업본으로 보관하고, 최신 공유본의 revision과 사진 포함 백업을 확인한다. 저장하지 않은 다른 사용자의 초안은 서버 백업만으로 보관되지 않는다.
3. 운영 적용 승인 후 main에 반영하고 Pages 성공을 확인한다. SQL·서버 설정 변경은 이번 UI 전환에 필요하지 않다.
4. 두 사용자의 구형 브라우저 창·설치 앱을 모두 닫고 온라인에서 다시 연다. Daylight 주 메뉴·설정·최신 공유 내용·재연결 후 오프라인 열기를 확인한다. 이 확인 전에는 신규 중요 표시·숙박 기간을 저장하지 않는다.
5. 구형 작업본이 필요하면 Daylight의 불러오기 차이를 검토한 뒤 적용한다. 문제가 있으면 편집을 멈추고 최신 데이터 보존을 우선해 호환 수정 또는 복귀를 결정한다.

추가 검사: `node --test tests/daylight.test.mjs`와 `node scripts/check-daylight-browser.mjs`. 후자는 중요·대기·실패·숙박 경계·중복·실행 취소·왕복·실제 생성 HTML 재열기·5개 너비를 검사한다. 합성 자료의 캡처는 `docs/ui-concepts/previews/daylight-candidate/`에 남고 내보낸 HTML은 Git에서 제외한다. 전체 브라우저 실행 목록에도 등록되어 있다.

설정 메뉴는 추가로 320·360·390·620·621·768·1100·1440px에서 **열린 패널의 좌우 경계**와 내보내기 창의 키보드 진입·Esc·설정 버튼 포커스 복귀를 검사한다. 문서의 `scrollWidth`만으로는 왼쪽으로 잘리는 메뉴를 검출할 수 없다.

Windows 샌드박스에서 localhost가 `ERR_NETWORK_ACCESS_DENIED`로 거부되면 검사 실패와 앱 실패를 구분한다. 승인된 로컬 검사 실행 권한으로 재시도하고, 설치된 Chromium 캐시는 `PLAYWRIGHT_BROWSERS_PATH`로 지정한다. 권한·ACL을 임의로 바꾸지 않는다.

## 백업과 자료 관리

자료별 관리 위치는 [사용자 안내서의 자료 관리 원칙](USER_GUIDE_KO.md#planning-policy)을 따른다. 폴더 구성은 [디렉터리 구성 안내](DIRECTORY_PLAN_KO.md)를 참고한다.

- 중요한 여행 상태는 사진을 포함한 오프라인 작업본으로 내보낸다. Git은 서버 여행 데이터의 백업이 아니며 버전은 최근 50개만 남는다.
- 사진 정리는 현재 문서와 보관된 모든 버전에서 참조하지 않는 객체만 별도로 확인한다. 화면에서 사진 삭제와 Storage 파일 삭제는 다르다.
- 비밀번호·관리자 키·호출 토큰은 공개 소스에 넣지 않는다. `.secrets/`는 Git에서 제외한다.
- 여행 TXT 메모 3개는 기존 `.gitignore` 제외를 유지하고 로컬 원자료로 보존한다. 과거 요청을 현재 미완료 작업으로 간주하거나 공개 문서에 예약 정보를 복사하지 않는다.
- [검토 기록](archive/2026-10-16-review.md)의 재현·수정 결과는 과거 증거다. 새 문제가 생기면 현재 코드에서 확인하고 새 날짜·범위를 기록한다.

<a id="planning-transition"></a>

### 기존 계획 파일 정리

1. 계획 파일과 앱의 공유 저장본을 비교한다. 파일에만 있는 확정 내용은 앱에서 수정·저장하고, 서로 다른 내용은 현재 유효한 것으로 맞춘다. 앱이 이미 최신이면 옮길 작업은 없다.
2. 기존 `일정.md`는 후보 동선이나 과거 계획으로, `예산.csv`는 예상 비용 검토용으로 남길 수 있다. 파일에 용도와 기준 날짜를 표시하고, 최신 확정 일정·실제 지출은 앱에서 관리한다고 명시한다. 과거 자료를 삭제하거나 매번 앱과 동일하게 갱신할 필요는 없다.
3. 이후 조사·예약 근거는 해당 여행의 `planning`에 보관하고, 확정 내용은 앱에서 저장한다. `planning` 파일을 수정해도 앱에 자동 반영되지는 않는다.

이 운영 원칙을 적용하기 위해 DB 이전이나 폴더 개편을 할 필요는 없다. `trip-config.js`는 기본 설정과 초기 일정을 제공하며, 운영 중인 일정 변경은 앱에서 저장한다. 일정 변경 때마다 설정 파일 수정이나 Git 배포를 할 필요는 없다. 새 여행의 초기 설정은 [재사용 절차](#new-trip)를 따른다.
