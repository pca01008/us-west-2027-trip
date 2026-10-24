# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

여행 참가자 두 명. 두 사람이 사용하는 앱이라는 제약은 [AGENTS.md](AGENTS.md)를 따른다.

## Product Purpose

미국 서부 여행의 일정, 준비 사항, 지출, 사진을 함께 확인하고 관리한다. 제품 개요와 문서 탐색은 [README.md](README.md)를 기준으로 한다.

## Capabilities and Constraints

실제 사용·저장·복구 동작은 [사용자 안내서](docs/USER_GUIDE_KO.md), 구현은 [기술 설명서](docs/PROJECT_GUIDE_KO.md), 실행과 배포는 [운영 안내서](docs/OPERATIONS_KO.md)가 기준이다. 이 파일은 그 내용을 중복 정의하지 않는다.

## Product Principles

- 두 사람의 실제 사용에 비례하는 복잡도를 유지한다.
- 간결한 화면 문구와 데이터 무결성을 우선한다.
- 기존 화면의 일관성을 유지하며 실제로 필요한 탐색·입력 흐름을 개선한다.

## UI Direction and Open Decisions

2026-10-24 결정으로 **Daylight 추가 개발·운영 전환을 보류**하고 기존 앱을 개선한다. 여행 중 휴대폰 조회와 여행 전 PC 계획·지출 편집을 같은 비중으로 다루며, 기존 네이비·코럴 색상과 카드 형태를 유지한다. 하단 일정·준비·가계부 탐색, 가계부 단순화, 경비 추가 버튼 정리와 **B안 테마 버튼·펼침 메뉴**를 확정했다. 범위·동작·시각 참고·검증 기준은 [기존 버전 UI 수정 계획](docs/LEGACY_UI_REFINEMENT_PLAN_KO.md)을 따른다. 기존 앱 개선본을 별도 브랜치에서 구현했다. 배포 여부와 실행 검증은 [구현 기록](docs/archive/2026-10-24-legacy-ui-refinement.md)을 따른다.

[Daylight 구현 계획](docs/DAYLIGHT_IMPLEMENTATION_PLAN_KO.md)과 [구현 기록](docs/archive/2026-10-23-daylight-implementation.md)은 보류한 후보의 이력으로 보존한다.
