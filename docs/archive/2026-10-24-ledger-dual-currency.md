# 원화·달러 가계부 구현 기록

작성일: 2026-10-24 (Asia/Seoul). `codex/legacy-ui-refinement` 작업의 최초 로컬 검증, 후속 CI, 운영 적용·공개 확인을 시점별로 구분한다. 최초 로컬 검증에서는 운영 서버의 지출 데이터를 조회하거나 변경하지 않았다. 계획은 [원화·달러 동시 입력](../LEDGER_DUAL_CURRENCY_PLAN_KO.md), 최종 사용법·구조·배포 절차는 [사용자 안내](../USER_GUIDE_KO.md#가계부), [기술 설명](../PROJECT_GUIDE_KO.md#ledger-timetable), [운영 안내](../OPERATIONS_KO.md#ledger-schema-6)를 따른다.

## 변경

- 스키마 6: 원화·달러 확정값, 직접 입력 출처, 계산에 사용한 환율을 보존한다. 하나만 입력하면 자동 계산하며 두 직접 입력값은 그대로 사용한다.
- 계산은 BigInt 십진 분수로 원·센트 단위 양수 사사오입한다. 직접 입력 정밀도·범위·문자열을 검증하고 오류와 자동 안내를 입력에 연결한다.
- 추가된 지출은 환율 변경 후에도 고정한다. 두 통화 합계·카테고리 합계·CSV·비교·초안·작업본·인쇄본을 새 필드로 통일한다.
- 구형 문서별 환율로 한 번 전환하며 소수 원본을 보존한다. 최초 전환 원본을 브라우저에 보관하고 이전 환산 합계와의 차이를 안내한다. 인증 후 초안 복구 중 미추가 입력도 보존한다.
- 기존 앱·Daylight는 미래 스키마에서 쓰기를 차단한다. 손상된 새 금액도 읽기 오류로 처리하며 기존 IndexedDB 초안을 덮어쓰거나 삭제하지 않는다.
- `supabase_setup.sql` 및 `migrations/20261024_ledger_schema_guard.sql`에 동일한 RPC 하향 저장 방지를 추가했다. 권한과 revision 검사를 유지한다.
- 기존 날짜가 있는 시각 증거를 보존하기 위해 탐색 브라우저 검사의 스크린샷 출력을 임시 진단 폴더로 변경했다. 기존 기록·이미지는 수정하지 않았다.

## 검증

검사는 가상 여행 데이터와 localhost 모의 서버만 사용한다. 실제 운영 저장·실제 휴대폰·Excel 앱 검증은 포함하지 않는다. 이 환경에는 `npm` 실행 파일이 없어 package.json과 같은 Node 명령으로 검사한다. 브라우저의 localhost 접근과 HTTP 단위 검사는 샌드박스 밖 실행이 필요했다.

- 계산·검증·구형 전환·재정규화·손상 거부·증분 SQL 동일성 단위 검사 통과.
- PC·모바일 실제 입력: 원화만/달러만/둘 다, 같은 자동값 재입력, 삭제 전환, 자동 0, 정밀도·범위 오류, 환율 고정, 수정·취소, 오래된 수정 거부, 원격 갱신의 값·출처·커서 보존 통과.
- CSV: 고정 합계·카테고리·순서·삭제·빈 목록과 BOM/CRLF/한글/따옴표/줄바꿈/수식 접두 보호 통과. 두 통화 작업본의 재열기와 인쇄 사본의 금액·자동 안내 일치 통과.
- 별도 `check-ledger-compat-browser.mjs`: 기존 앱 미래 스키마, Daylight 스키마 6, 손상된 스키마 6 초안을 각각 읽어 쓰기·삭제·저장 차단과 원본 초안 보존 통과.
- 320·390·1440px 화면과 밝은/어두운 테마 검토. PC 추가 버튼 카드 경계와 모바일 금액/버튼 배치를 조정했다. 자동 디자인 검사에는 기존 CSS 전체의 정적 대비 경고가 있어 무경고 판정으로 보고하지 않는다.

최종 전체 결과:

| 명령 | 결과 |
|---|---|
| `node --test tests/*.test.mjs` | 120개 통과, 실패·생략 0 |
| `node scripts/check-project.mjs` | 통과: 11일·36개 일정·12개 체크 항목 |
| `node scripts/check-browsers.mjs` | diagnostics, drafts, storage, inputs, imports, ledger, ledger-compat, prep, auth, photos, theme, navigation, pwa — 13개 검사 모두 통과 |
| `git diff --check` | 통과 |
| `node --test scripts/check-trip-sql.mjs` | 실행 전제 미충족: 아래 참조 |

브라우저 실행은 설치된 Chromium과 `PLAYWRIGHT_BROWSERS_PATH=C:/Users/이승종/AppData/Local/ms-playwright`를 사용했다. 별도 서버 배포 없이 localhost에서 검증했다. 최종 가계부 캡처·내보내기는 임시 `westbound-ledger-Uk82M3`, 테마/탐색 캡처는 `westbound-navigation-chromium-diagnostics-6Ry9Ze`에 생성됐다. 밝은 테마 오류 상태와 어두운 테마의 PC·320px 결과를 직접 확인했다.

## 최초 로컬 검증 당시 남은 조건

`node --test scripts/check-trip-sql.mjs`는 `TRIP_SQL_TEST_URL` 미설정으로 실행 시작 단계에서 중단됐다. 로컬 PostgreSQL 서비스/실행 파일도 확인되지 않았다. 실제 DB의 권한·revision·하향 저장 거부 결과를 확인했다고 주장하지 않는다. 폐기 가능한 로컬 DB에서 SQL 검사를 통과시킨 뒤 서버 migration을 먼저 적용하고 앱을 배포해야 한다.

운영 migration·배포·구형 운영 탭 저장 거부는 미실행이다. Git 커밋·푸시도 하지 않았다.

## 후속 배포 전 검증

구현은 `eb12e00`으로 커밋하여 `origin/codex/legacy-ui-refinement`에 푸시했다. PR 없이 기존 GitHub Actions의 `Validate`를 작업 브랜치에서 수동 실행했다. 운영 DB와 배포 브랜치는 변경하지 않았다.

[최초 CI 실행 #39](https://github.com/pca01008/us-west-2027-trip/actions/runs/40097751940)에서 PostgreSQL 17의 실제 저장 검사가 실패했다. PL/pgSQL 변수 `current_schema`가 PostgreSQL 내장 이름으로 해석되어 `numeric < name` 비교 오류를 일으켰다. 설치 SQL과 증분 마이그레이션의 변수 이름을 `stored_schema_version`, `incoming_schema_version`으로 바꿨다. 기존 SQL 검사의 정상 저장·권한·revision·구버전 저장 거부 시나리오로 재검증한다.

수정 커밋은 `114ed04`이다. [수정본 CI 실행 #40](https://github.com/pca01008/us-west-2027-trip/actions/runs/40097976140)에서 `validate`, `sql`, `browser` 작업이 모두 성공했다. PostgreSQL 17 SQL 검사 24개, 단위 검사 120개와 프로젝트 검사, 브라우저 검사 13개가 통과했다. SQL 검사는 신규 설치·구버전 업그레이드, 자동·명시적 권한 환경, 정상 저장·동시 저장 충돌·스키마 6의 구형 저장 거부와 변환 복원을 포함한다. 로컬 단위 검사도 120개 통과했다.

운영 DB 적용·배포는 아직 완료되지 않았다. 운영 DB에는 검증한 증분 마이그레이션을 먼저 적용한다. 현재 `main`은 `f03e727`이며 `git push --dry-run origin HEAD:main`으로 수정본의 fast-forward 반영 경로를 확인했다. 실제 `main` 푸시와 Pages 배포는 운영 DB 적용 결과 확인 후 진행한다.

## 운영 적용 및 공개 확인

2026-10-24 사용자가 운영 SQL 적용 완료를 확인했다. 운영 서버의 함수 정의를 직접 조회한 결과와 구분한다. 이후 `2b71ccb`를 `origin/main`에 fast-forward 반영했다. [Pages 실행](https://github.com/pca01008/us-west-2027-trip/actions/runs/40100061664)의 build·deploy 작업이 성공했다. [배포 브랜치 Validate](https://github.com/pca01008/us-west-2027-trip/actions/runs/40100061797)도 단위 120개·프로젝트 검사, SQL 24개, 브라우저 13개 검사가 모두 성공했다.

공개 URL의 `index.html`, `trip-config.js`, `daylight/index.html`이 모두 HTTP 200이며, LF로 정규화한 내용이 배포 커밋과 일치했다.

| 파일 | LF 정규화 SHA-256 |
|---|---|
| `index.html` | `7ca47c5e2c727aa4a9d63593bf705ce748defb301a8a5a9a3e47c01915ea8163` |
| `trip-config.js` | `1201c65323a8e9f568063b4b4cead7a6ab4f78f3dfc4f8d453a17ed04c6ec15a` |
| `daylight/index.html` | `b59362ef1cdeef77cade0ec902fbb3f91b9c68ff87180bbcd96bbdcd3f7a6436` |

격리된 Chromium에서 공개 루트 앱을 열어 공유 문서 GET 200, 클라이언트 스키마 6, 1440px·390px의 원화·달러 입력란 표시와 가로 넘침 없음을 확인했다. JavaScript 오류와 쓰기 요청은 0건이었다. 검사에서 GET·HEAD·OPTIONS만 허용했고 로그인이나 실제 저장은 수행하지 않았다. 운영 데이터 본문·사진·화면 캡처는 검증 출력에 남기지 않았다. 이 확인은 실제 기기의 설치 앱 갱신·운영 저장 검증을 대신하지 않는다.

로컬에 내보낸 작업본을 보존하고 공개 저장소에 포함하지 않도록 루트 `*_EDITABLE_*.html`을 `.gitignore`에서 제외했다. 실제 운영 문서는 사용자의 다음 정상 저장 시 스키마 6으로 전환될 수 있다.

배포 확인 뒤의 후속 커밋은 README·계획 상태·이 검증 기록만 갱신하며 앱과 SQL은 변경하지 않는다.
