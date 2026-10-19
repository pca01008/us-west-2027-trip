# 여행 자료와 웹사이트 디렉터리 구성 안내

2026-10-19에 채택한 소규모 운영 원칙에 맞춘 폴더 안내다. 기존 구성안의 계획 원본 우선 수정 방식과 `src/data/public` 개편 제안을 대체한다. 이 문서 갱신으로 폴더를 이동하거나 여행 데이터를 이전한 것은 아니다.

자료별 관리 기준은 [사용자 안내서](USER_GUIDE_KO.md#planning-policy), 기존 자료 정리와 백업은 [운영 안내서](OPERATIONS_KO.md#maintenance)에서 관리한다.

## 현재 상위 구조

```text
D:\Workspace\travel\
├─ planning\
│  ├─ 2027-us-west\
│  └─ 2027-bali\
└─ website\
   ├─ index.html
   ├─ trip-config.js
   ├─ trip-config.template.js
   ├─ assets\
   └─ docs\
```

주요 경로만 표시했다. `planning`의 여행 폴더가 있다고 해서 해당 여행의 앱이나 서버 등록이 완료되었다는 뜻은 아니다.

## planning 폴더

여행별 조사·후보·예약 근거·결정 이유를 보관한다. 필요한 자료만 추가하고 기존 파일 이름을 유지해도 된다.

| 파일·폴더 예시 | 용도 |
|---|---|
| `여행개요.md` | 기간·인원·선호·제약 조건 |
| `일정.md` | 후보 동선 또는 기준 날짜가 있는 과거 계획 |
| `예산.csv` | 예상 비용과 후보별 비용 비교 |
| `결정사항.md` | 선택하거나 변경한 이유 |
| `조사자료/` | 숙소·교통·관광지 후보, 출처, 확인 날짜 |
| `예약자료/` | 예약 확인서와 관련 문서 |

위 목록은 선택적인 예시이며 필수 파일 목록이 아니다. 확정 사항·후보·미확인 정보를 구분하고, 가격·운영시간·예약 조건에는 출처와 확인 날짜를 남긴다. 기존 일정·예산 파일의 정리는 [전환 절차](OPERATIONS_KO.md#planning-transition)를 따른다.

## website 폴더

현재 `index.html`과 `trip-config.js` 구성을 유지한다. 주요 파일의 역할은 [README](../README.md#주요-파일), 저장 구조는 [기술 설명서](PROJECT_GUIDE_KO.md)를 참고한다.

`planning` 파일을 직접 읽거나 자동 동기화하는 기능은 없다. 현재 운영 방식에 `src/data/public` 분리나 여행 선택 화면은 필요하지 않다. 다른 여행을 앱으로 운영할 때는 [재사용 절차](OPERATIONS_KO.md#new-trip)를 따른다.

## 프로젝트 연결과 보관

| 연결 폴더 | 작업 목적 |
|---|---|
| `travel\website` | 웹사이트 개발·유지보수 |
| `travel\planning\2027-us-west` | 미국 서부 여행 조사·후보 비교·예약 근거 정리 |
| `travel\planning\2027-bali` | 발리 여행 조사·후보 비교·예약 근거 정리 |

필요한 폴더를 작업 프로젝트로 연결하고, 각 폴더의 `AGENTS.md`가 있으면 해당 규칙을 따른다. 확정 내용을 앱에 반영하는 기준은 [자료 관리 원칙](USER_GUIDE_KO.md#planning-policy)을 따른다.

`website`는 기존 독립 Git 저장소로 유지한다. `planning`은 필요에 따라 별도 저장소나 파일 백업으로 보관하며, 상위 `travel` 전체를 하나의 저장소로 묶을 필요는 없다. Git·배포와 백업 절차는 [운영 안내서](OPERATIONS_KO.md)를 참고한다.
