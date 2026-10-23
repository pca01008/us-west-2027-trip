# Daylight 실제 데이터 병행 앱 — 2026-10-23

작업은 10월 23일 시작했으며 최종 공개 검증은 한국 시간 10월 24일에 완료했다.

사용자 승인 범위: Daylight도 기존 앱과 같은 실제 데이터를 사용하는 완성본으로 만들고 별도 공개 HTTPS 주소로 제공한다. 기존 루트 화면의 Daylight 전환은 포함하지 않는다.

## 구현

- 공개 경로: 기존 앱 `/us-west-2027-trip/`, Daylight `/us-west-2027-trip/daylight/`.
- 후보 소스 `5c68244`의 `index.html`, LF SHA-256 앞 12자리 `746c729d28bb`에서 생성했다. 온라인 인증·공유 저장·사진·파일·PWA 동작을 유지했다.
- 실제 tripId·편집자·Supabase·사진 버킷은 동일하고 로컬 캐시 이름만 `_daylight`로 분리한다. 인증 세션은 같은 출처에서 공유한다.
- 기존 루트는 다섯 함수의 메타데이터 처리만 변경하여 체크리스트 중요 표시를 보존하고 충돌·가져오기 차이에 반영한다. 저장된 숙박 종료일도 유지한다. 이미 열린 구형 창은 닫고 다시 열어야 한다.
- SQL·권한·서버 데이터는 변경하지 않는다. 테스트는 합성 데이터만 저장한다. 실제 여행 데이터 사본은 저장소에 추가하지 않는다.

## 로컬 검증

Windows, Node 24.19.0, Playwright 1.62.1 Chromium에서 실행했다.

- `node scripts/check-daylight-live-browser.mjs`: 통과. 실제 연결 설정 일치, 생성 소스 해시, 로컬 저장소 분리, 양쪽 저장 왕복, 중요·숙박 속성 보존, 동시 목록 충돌, 가져오기 차이 검사.
- `DAYLIGHT_LIVE=1 node scripts/check-pwa-browser.mjs`: 통과. `/trip/daylight/` 설치 조건, 모바일 탐색, 오프라인 재열기, 테마 유지, SDK 부재 처리, 온라인 갱신.
- `node scripts/check-project.mjs`: 통과.
- `node --test tests/*.test.mjs`: 최종 후보 117/117 통과. 초기 실행의 샌드박스 로컬 HTTP 접근 실패와 작성 중 문서 링크 누락을 해결한 뒤 전체를 다시 실행했다. main 기반 배포본은 114개 중 문서 링크 한 건이 실패하여 참조 기록을 포함한 뒤 해당 18개 프로젝트 검사를 모두 통과했다. 서버 CI 결과는 별도 확인한다.

## 공개 배포와 읽기 검증

- 배포 코드: `66aa08f` (`feat: publish connected Daylight alongside legacy app`). [Pages 실행 39973609984](https://github.com/pca01008/us-west-2027-trip/actions/runs/39973609984) 성공.
- [배포 코드 Validate 실행 39973610191](https://github.com/pca01008/us-west-2027-trip/actions/runs/39973610191): 10월 24일 00:00 KST 확인 시 단위·SQL 성공, 브라우저 작업은 Chromium 설치 단계 진행 중. 로컬 통과와 원격 브라우저 CI 완료를 구분한다.
- `node scripts/check-daylight-live-public.mjs`: 공개 두 주소 모두 revision 27, 체크 17개, 지출 8건. 메모리에서 공유 문서 해시가 동일함을 확인하고 내용은 기록하지 않았다. 쓰기 요청은 차단했으며 실제 데이터 쓰기 0건이다.
- 기존 앱 탐색 유지, Daylight 탐색 표시, 390px 가로 넘침 없음, 로그인 창 표시, 브라우저 런타임 오류 없음.
- 동일한 익명 브라우저에서 기존 앱과 Daylight의 서비스 워커 범위가 각각 루트와 `/daylight/`임을 확인했다. 온라인 읽기 후 연결을 끊고 양쪽을 다시 열어도 각 화면과 체크 17개를 독립적으로 복구했다.
- 실제 계정 비밀번호를 사용한 로그인·서버 쓰기 및 실제 휴대폰 설치는 이 자동 검증에 포함하지 않는다. 저장·충돌·오프라인 검증은 앞의 합성 데이터 테스트 결과다.
