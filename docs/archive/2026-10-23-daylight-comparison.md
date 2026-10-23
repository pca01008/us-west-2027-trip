# 기존 버전과 Daylight 1:1 비교 환경

2026-10-23. 사용자의 기존 버전과 후보 비교 요청에 따라 구성했다. 이전에는 단일 후보와 A/B/C 시각 초안만 있었고, 기존 앱과 같은 조건을 적용한 비교 화면은 없었다.

## 비교 대상

| 대상 | 기준 | LF 정규화 index SHA-256 앞 12자리 |
|---|---|---|
| 기존 운영 버전 | `22ecee308d3019cf6303a3d464013ea7172e4d6c` | `ae302c9f6d7c` |
| Daylight 후보 | index 마지막 수정 커밋 `7ba5285b2d4cbb1fb4830265b7cb60527efa61d8` | `e6f6cd083791` |

공통 합성 fixture 2, 해시 `a2c796346162`. 일정·12개 준비 항목·예산·지출 3건을 양쪽에 동일하게 제공한다. 중요 표시·숙박 기간 입력값도 같지만 구형 앱에는 해당 파생 기능이 없으므로 후보에서만 표시된다. 사진은 합성 자리 표시다. 실제 여행 자료·운영 계정·서버 요청은 포함하지 않는다.

## 사용과 재현

[공개 비교 화면](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-compare.html). 같은 날짜·테마·여행 시점·일정 보기 방식·프레임 너비를 함께 적용하고 두 버전을 나란히 또는 번갈아 본다. 편집·체크는 양쪽에서 독립적으로 시험한다. 새 비교를 시작하면 양쪽이 원본 예시로 열린다. 조작·생성·검사 절차는 [운영 안내서](../OPERATIONS_KO.md#daylight-rollout)를 따른다.

각 HTML은 원본 소스에서 재현 가능하게 생성했다. SDK·PWA 제거와 고유 저장소 범위·동일 예시 지출 초기화만 주입했다. 운영 루트 index와 실제 공유본은 수정하지 않는다. 공개 저장·로그인·동시 편집 비교는 이 환경에 포함하지 않는다.

## 검증

Windows, Node 24.19.0, Playwright Chromium.

- `node scripts/build-daylight-comparison.mjs`: 고정 기존 커밋과 현재 후보 소스에서 두 HTML·공통 제어 페이지·manifest 생성.
- `node scripts/check-daylight-comparison.mjs`: 양쪽 설정 동등성·지출 3건과 합계·체크 격리·여행 시점 변경 후 보존·새 비교 초기화·날짜/테마/시간표 공통 전환·390/768/1440 실제 프레임 너비·단일/나란히 표시·외부 요청 0건 통과.
- 모바일 셸은 페이지 가로 넘침 없이 비교 영역만 가로 스크롤한다. 실제 프레임 너비를 줄이거나 확대·축소하지 않는다.
- [PC 비교 캡처](../ui-concepts/previews/daylight-comparison/side-by-side.png), [모바일 캡처](../ui-concepts/previews/daylight-comparison/mobile.png). 비교 셸의 시각 검토 결과 `ship`.
- 실제 계정·실기기·Safari 검사는 하지 않았다. 기존 후보 앱의 전체 회귀 근거는 [구현 기록](2026-10-23-daylight-implementation.md)에 있으며 이번 변경은 비교 도구와 생성물에 한정된다.

공개 배포 결과는 완료 후 아래에 추가한다.
