# Daylight 후보 구현과 검증

기록일: 2026-10-23 (Asia/Seoul). 구현 승인에 따라 `codex/daylight-implementation`에서 작업했다. 운영 전환과 실제 공유 데이터 변경은 별도 승인 대상이다. 구현 기준은 [계획](../DAYLIGHT_IMPLEMENTATION_PLAN_KO.md), 사용법은 [사용자 안내서](../USER_GUIDE_KO.md), 구조는 [기술 설명서](../PROJECT_GUIDE_KO.md), 검토·전환 절차는 [운영 안내서](../OPERATIONS_KO.md#daylight-rollout)를 따른다.

## 기준과 변경

- 시작 커밋: `22ecee3`. 기존 미커밋 README·PRODUCT 및 구현 계획·10월 22일 인계 문서를 보존했다.
- PC 왼쪽·모바일 하단 주 메뉴, 날짜 탐색, 설정 그룹, 세이지·흰 바탕·녹색 테마를 기존 앱에 통합했다.
- 원본 일정에 숙박 종료일을 지정한다. 체크인 포함·체크아웃 제외이며 중복 입력은 막고, 가져온 중복은 확인 대상으로 표시한다.
- 준비 항목의 중요 표시를 저장하고, 중요 미완료 항목만 파생 영역에 표시한다. 체크 저장 중·실패·재시도와 원본 이동을 연결했다.
- schemaVersion 5를 유지한다. 새 메타데이터는 정제·수집·적용·차이 비교·목록 patch·실행 취소·파일 내보내기에 포함한다. 파생 영역은 저장 HTML 밖에서 다시 생성한다.
- 일정·시간표·사진·가계부·인증·초안·충돌·버전·테마·PWA를 기존 구현과 연결했다. 새 DB·의존성은 없다.
- 실제 생성한 작업본과 읽기 전용 파일을 새 브라우저 문맥에서 열어 탐색·신규 메타데이터·외부 요청 부재를 검사했다. 읽기 전용 파일은 원본 일정에 숙박 종료일을 표시한다.
- 최종 파일 검토에서 읽기 전용 PC 화면의 빈 보조 열을 제거했다. 실제 내보낸 파일에서 전체 본문 너비를 단언하고 Daylight·테마·프로젝트 검사를 재실행해 통과했다.

## 검증 근거

Windows, Node.js 24.19.0, Playwright Chromium. 운영 API·실제 공유 데이터를 사용하지 않고 합성 fixture와 로컬 가상 API를 사용했다. npm이 PATH에 없어 대응 Node 명령을 실행했다. 아래 로컬 결과는 후보 작업 트리에서 수행한 검사다. 커밋·공개본 식별값과 CI는 아래에서 별도로 기록한다.

| 검사 | 결과·범위 |
|---|---|
| 시작점 단위 검사 | 기준 커밋 114개 통과 |
| 후보 단위 검사 | `node --test tests/*.test.mjs`: 117개 통과. 작성 중 기록의 링크 부재 1건은 문서 작성 후 전체 재실행으로 해결 확인 |
| `node scripts/check-project.mjs` | 11일·36개 일정·12개 준비 항목 통과 |
| 기존 전체 브라우저 실행 | 11개 중 10개 통과. PWA의 구형 숨겨진 탭 선택자를 새 탐색으로 교체한 뒤 독립 재실행 통과 |
| `node scripts/check-pwa-browser.mjs` | 루트와 하위 경로 설치·오프라인·재연결·테마·갱신 통과 |
| `node scripts/check-prep-browser.mjs` | PC·모바일·오프라인, 중요 표시만 저장할 때 원격 체크 보존·다른 초안 비공개·중요 표시 충돌 통과 |
| `node scripts/check-daylight-browser.mjs` | 390·1440에서 중요·체크 대기/실패·숙박 오류/경계/겹침·이력·메타데이터 왕복·읽기 전용/작업본 재실행 통과. 360·390·768·1280·1440 가로 넘침 없음 |
| 시각 검토 | PC·모바일 일정/준비/가계부 6장. 가계부 장식 제거·모바일 중요 영역 우선 배치·12px 보조 글자·승인 상태 문구 수정 후 검토 통과 |
| 최종 테마 재검사 | 밝게·어둡게·기기 설정·동기화·편집·대화상자·두 내보내기·인쇄·반응형 통과 |
| A 초안 검사 | `node docs/ui-concepts/capture.mjs a`: PC·모바일 탐색·숙박 경계·중요 완료/복원·설정·시간표·5개 너비 통과 |
| 생성 검토본 | `node scripts/check-daylight-review.mjs`: 후보 해시·고유 저장소·숙소·중요 체크 재로딩·외부 요청 0건 통과 |

캡처: [후보 화면과 결과](../ui-concepts/previews/daylight-candidate/). 기준점 브라우저 격리 실행의 인증·PWA는 복사본의 SDK 의존성 경로 누락 때문에 완주하지 못했다. 후보에서는 설치된 의존성으로 두 검사를 통과했다. 샌드박스 localhost 거부는 허용된 로컬 검사 실행으로 재시도했으며 ACL을 변경하지 않았다.

## 검토본과 남은 승인

`scripts/build-daylight-review.mjs`로 후보 소스에서 합성 여행 검토본을 생성한다. `ui-preview/daylight-candidate.html`은 고유 저장소 이름, 오프라인 모드, PWA·운영 SDK 제거로 격리한다. 소스 SHA-256·기준 커밋·fixture 버전은 검토본에 표시한다. 공개본은 로컬 편집을 제공하며 공유 저장·로그인·충돌의 근거는 같은 후보의 가상 API 검사다.

실제 휴대폰 키보드, Safari·삼성 인터넷 강제 다크모드, 두 사용자의 실제 계정·열린 구형 창 전환은 자동 검증 범위 밖이다. 구형 앱은 새 속성을 지울 수 있으므로 두 사용자의 초안 보관·앱 갱신 후 전환해야 한다. 복귀 때 실제 데이터를 과거 백업으로 덮어쓰지 않는다.

운영 루트 배포·실제 공유 데이터 변경은 하지 않았다. 공개 검토본과 후보 CI 확인을 완료했으며 운영 적용 승인이 남아 있다.

## 공개 검토본 식별과 배포

- [기능 통합 검토본](https://pca01008.github.io/us-west-2027-trip/ui-preview/daylight-candidate.html): 최종 구현 소스 `7ba5285`, 검토본 고정 커밋 `38380e5`, LF 정규화 index SHA-256 앞 12자리 `e6f6cd083791`, fixture 1. 최초 후보 `ffe3bfe`·`7a435a6` 이후 읽기 전용 폭을 수정했다.
- [A안 시각 초안](https://pca01008.github.io/us-west-2027-trip/ui-preview/a.html): 날짜별 예시 숙소와 중요 항목 반영. B/C 비교 기록은 유지했다.
- 공개 전용 커밋 `a799d5b`와 `86114f0`: 별도 작업 트리에서 `ui-preview/`의 6개 파일만 main에 반영하고 마지막 후보 HTML을 갱신했다. 운영 index·설정·PWA는 변경하지 않았다.
- [Pages 실행](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873106260): 성공. 공개 HTTPS에서 `check-daylight-review.mjs`를 실행하여 해시·격리·숙소·중요 체크 재로딩·외부 요청 0건 통과.
- 공개 운영 루트 응답은 `22ecee3:index.html`과 바이트 비교(LF 정규화)로 동일함을 확인했다. SHA-256 앞 12자리 `ae302c9f6d7c`.
- PR 생성은 연결 도구 403, 로컬 Git 인증 API 404로 완료하지 못했다. 권한 설정은 변경하지 않았다. [후보 브랜치 비교](https://github.com/pca01008/us-west-2027-trip/compare/main...codex/daylight-implementation)에서 검토할 수 있다.
- 최초 후보 `7a435a6`의 [수동 CI](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873250045)와 수정된 최종 후보 `38380e5`의 [수동 CI](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873569293) 모두 단위·SQL·브라우저 3개 작업이 성공했다. 최종 후보는 Node 24 단위 117개 및 SQL, Node 22 브라우저 전체 실행을 통과했다. main 공개 초안 CI와 구분해 후보 자체의 결과를 확인했다.
- [최종 Pages 빌드](https://github.com/pca01008/us-west-2027-trip/actions/runs/39873604560) `86114f0`은 성공했다. HTTPS에서 최종 소스 해시 `e6f6cd083791`과 검토본 동작을 다시 확인했다. [읽기 전용 PC 캡처](../ui-concepts/previews/daylight-candidate/1440-readonly.png)도 최종 폭 수정에 대응한다.
- 이후 마무리 커밋은 이 검증 기록·계획 완료 표시·캡처만 추가한다. 앱·검사 실행 코드·공개 검토본은 CI 후보 `38380e5`와 같다. 문서 링크·프로젝트 검사와 `git diff --check`를 별도로 통과했다.
- 일회성 예약 `daylight`는 삭제하여 재실행하지 않도록 정리했고, 공개용 임시 작업 트리는 복구 가능한 보관 상태로 전환했다.
