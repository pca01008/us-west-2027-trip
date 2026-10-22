# US West 2027 Trip

2027년 1월 21일~31일 라스베이거스와 로스앤젤레스 여행을 위한 공유 일정 웹앱입니다.
일정·PREP 체크리스트·가계부·사진을 확인하고, 지정된 편집자 계정으로 수정합니다.

## 문서 길잡이

| 하고 싶은 일 | 기준 문서 |
|---|---|
| 일정·시간표·PREP·가계부 사용, 초안 복구, 설치·내보내기 | [사용자 안내서](docs/USER_GUIDE_KO.md) |
| 앱 구조, 데이터·저장·권한·SQL 원리 이해 | [기술 설명서](docs/PROJECT_GUIDE_KO.md) |
| 초기 구축, 다른 여행 추가, 테스트·배포, DB 점검·장애 대응 | [운영 안내서](docs/OPERATIONS_KO.md) |
| 여행 조사 자료와 웹사이트 폴더 구분 | [디렉터리 구성 안내](docs/DIRECTORY_PLAN_KO.md) |
| 과거 DB 점검 배포·알림 검증 근거 확인 | [2026-10-05 검증 기록](docs/archive/2026-10-05-db-health-verification.md) |
| 초안·복원 버그의 발견·수정·검증 경위 확인 | [2026-10-16 검토 기록](docs/archive/2026-10-16-review.md) |
| 2026-10-18 검토 당시 발견 사항과 인계 기록 | [2026-10-18 검토 및 인계](docs/archive/2026-10-18-review-handoff.md) |
| 2026-10-19 테스트 실행 결과와 보강 제안 | [2026-10-19 테스트 검토](docs/archive/2026-10-19-test-review.md) |
| 에이전트 작업 규칙 확인 | [AGENTS.md](AGENTS.md) |
| UI 개편 후보 3안 비교 | [온라인 비교 화면](https://pca01008.github.io/us-west-2027-trip/ui-preview/) · [로컬 원본](docs/ui-concepts/index.html) · [검토 기록](docs/archive/2026-10-21-ui-concepts.md) · [실행·배포 방법](docs/OPERATIONS_KO.md#ui-concepts) |
| 선택한 A안(Daylight) 개선 검토 | [개선 초안](docs/ui-concepts/a.html) · [기존 인계](docs/archive/2026-10-21-daylight-handoff.md) · [1차 개선](docs/archive/2026-10-21-daylight-refinement.md) · [사용성 개선](docs/archive/2026-10-22-daylight-usability.md) |

사용법은 사용자 안내서, 구현 원리는 기술 설명서, 실행 절차는 운영 안내서에서 관리합니다.
이력 문서는 해당 날짜의 관측 기록이며 현재 운영 상태를 보증하지 않습니다.

## 구조와 저장 위치

```text
앱 코드: 로컬 파일 → GitHub → GitHub Pages → 브라우저
여행 내용: 브라우저 ↔ Supabase Database / Auth / Storage / Realtime
미저장 초안: 현재 브라우저의 IndexedDB
```

- `index.html`은 공통 화면·기능을, `trip-config.js`는 여행별 기본 설정과 일정을 제공합니다.
- 페이지를 열면 같은 `tripId`의 Supabase 저장본이 기본 일정보다 우선합니다.
- Git push는 코드 배포 경로이고, 앱의 저장은 여행 데이터 반영 경로입니다.
- SQL과 Edge Function, 외부 예약 작업은 Git push로 자동 적용되지 않습니다.

## 주요 파일

| 파일·폴더 | 역할 |
|---|---|
| `index.html` | 일정·PREP·가계부 웹앱 |
| `trip-config.js`, `trip-config.template.js` | 현재 여행 설정과 새 여행용 예시 |
| `supabase_setup.sql`, `register_trip.sql` | 공통 서버 구조와 여행·편집자 등록 |
| `migrations/`, `supabase/` | DB 변경과 점검 함수 |
| `pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` | 홈 화면 앱과 캐시 |
| `assets/` | 숙소 사진·지도 캡처 |
| `scripts/`, `tests/`, `.github/workflows/validate.yml` | 자동 검증 |
| `test.html`, `test2.html` | 여행 진행 중·종료 후 헤더 미리보기 |

## 시작하기

여행 참가자는 배포된 HTTPS 주소에서 이용합니다. 로그인 없이 열람할 수 있고 편집에는 지정 계정이 필요합니다.
처음 사용하는 기능은 [사용자 안내서](docs/USER_GUIDE_KO.md)를 참고하세요.

개발자는 현재 단위 검사 CI와 같은 Node.js 24를 권장합니다. 패키지의 최소 요구 버전은 22입니다.

```sh
npm ci
npm test
```

브라우저 검사:

```sh
npx playwright install chromium
npm run test:browser
```

검사 범위와 개별 명령은 [운영 안내서의 검증 절차](docs/OPERATIONS_KO.md#validation)에 있습니다.
로컬 `index.html`을 열어 화면을 확인할 수 있으며, PWA 설치·서비스 워커 확인에는 HTTPS 또는 localhost가 필요합니다.

## 구축과 배포

새 환경은 [초기 구축](docs/OPERATIONS_KO.md#setup), 기존 서버 변경은 [업데이트](docs/OPERATIONS_KO.md#updates), 다른 여행은 [재사용](docs/OPERATIONS_KO.md#new-trip) 절차를 따릅니다.
GitHub Pages는 `main` 브랜치 루트를 사용하며 `docs/`는 Pages 빌드에서 제외합니다.

현재 여행 내용의 변경은 앱에서 저장합니다. 설정 파일의 기본 일정만 바꾸면 이미 저장된 공유 일정은 바뀌지 않습니다.
확정 일정·준비물·실제 지출은 앱에서, 조사·후보·예약 근거는 `planning`에서 관리합니다. 자세한 기준은 [자료 관리 원칙](docs/USER_GUIDE_KO.md#planning-policy)을 참고하세요.
공개 키는 브라우저 설정에 사용하지만 비밀번호·service role 키·호출 토큰은 저장소에 넣지 않습니다.
