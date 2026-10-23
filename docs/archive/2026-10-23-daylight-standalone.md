# 기존 버전·Daylight 단독 페이지 공개

2026-10-23. 독립적으로 열어 비교할 수 있는 공개 HTTPS 주소 요청에 따라, 기존 생성 HTML의 단독 실행을 검증하고 최신 후보를 공개했다.

## 주소와 범위

- [기존 버전](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-before.html)
- [Daylight](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-after.html)
- [공통 설정 비교 화면](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html)

앞의 두 주소는 iframe이나 부모 비교 화면 없이 전체 창 너비로 실행된다. 탭 제목은 각각 `기존 버전 · 여행 비교`, `Daylight · 여행 비교`다. 원본 앱과 후보의 기능을 유지하고 공통 합성 데이터·오프라인 실행·저장소 분리·버전 제목만 주입했다. 새 프레임워크·서버·별도 저장소는 만들지 않았다. 사용·초기화·저장 범위는 [운영 안내서](../OPERATIONS_KO.md#daylight-rollout)에서 관리한다.

## 공개 파일 식별

| 항목 | 값 |
|---|---|
| 기존 원본 | `22ecee3`, LF 정규화 index SHA-256 앞 12자리 `ae302c9f6d7c` |
| Daylight 원본 | 후보 작업 트리, 소스 SHA-256 앞 12자리 `746c729d28bb` |
| 공통 데이터 | fixture 2, `a2c796346162` |
| 공개 전용 커밋 | `e33942108a206043f8d462beb4e77052d992645d` |
| Pages 실행 | [39939571458](https://github.com/pca01008/us-west-2027-trip/actions/runs/39939571458) |

별도 작업 트리에서 `ui-preview/daylight-before.html`, `daylight-after.html`, `daylight-candidate.html`, `daylight-compare.html`, `daylight-comparison.json`만 main에 반영했다. Daylight에는 [이전 검토](2026-10-23-daylight-readiness.md)의 모바일 설정 메뉴·포커스 수정이 포함된다. 그 문서의 “미배포”는 당시 상태이며 이번에는 공개 검토 파일만 갱신했다. 운영 루트 앱으로의 전환은 하지 않았다.

## 검증

Windows·Node 24.19.0·Playwright Chromium. `build-daylight-comparison.mjs`로 재생성하고 `check-daylight-comparison.mjs`를 보강했다.

- 기존 비교 화면: 동일 여행 입력·지출 합계·편집 격리·초기화·공통 제어·정확한 프레임 너비 검사 통과.
- 단독 실행: 프레임 1개(자기 자신만), 버전별 제목과 소스 해시, 서로 다른 tripId·캐시·오프라인 ID·테마 범위 확인.
- 동일 브라우저의 두 탭에서 서로 다른 준비 항목을 체크한 후 각각 새로고침해 상태 격리·보존 확인.
- 한 버전의 테마·탭 이동이 다른 버전을 바꾸지 않음, 390/1440px 전체 너비, 외부 SDK·API·PWA·미디어 요청 0건 확인.
- 준비 목록은 완료 순서에 따라 DOM 순서가 달라지므로 항목 ID로 단언한다.

로컬 및 공개 HTTPS 검사 모두 통과했다. Pages 실행 `39939571458`은 success이며, 완료 후 공개 비교 URL을 인자로 같은 검사를 실행했다. 운영 루트 HTTPS 응답은 `22ecee3:index.html`과 LF 정규화 내용이 동일하고 해시도 `ae302c9f6d7c`로 확인했다. 공개 전용 작업 트리는 커밋 `e339421`, clean 상태, `origin/main` 추적과 ahead/behind 없음, 의도한 원격 저장소를 확인했다.

캡처: [기존 모바일](../ui-concepts/previews/daylight-comparison/standalone-before-390.png), [Daylight 모바일](../ui-concepts/previews/daylight-comparison/standalone-after-390.png), [기존 PC](../ui-concepts/previews/daylight-comparison/standalone-before-1440.png), [Daylight PC](../ui-concepts/previews/daylight-comparison/standalone-after-1440.png).

실제 계정 로그인·공유 저장·독립 백엔드 간 동기화는 예시 사이트의 제공 범위가 아니다. 공개 전용 main의 CI와 미커밋 후보 앱의 CI를 혼동하지 않는다. 이번 로컬 생성기·검사·문서 변경은 후보 작업 트리에 남아 있으며 기존 미커밋 작업을 보존했다.
