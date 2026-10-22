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
- 2026-10-21 UI 검토는 선택용 초안 세 개가 범위이며, 운영 UI 변경은 선택 후 별도 진행한다.

## UI Direction and Open Decisions

여행 중 휴대폰 조회와 여행 전 PC 계획·예산 편집을 같은 비중으로 다룬다. **A · Daylight의 세이지·흰 바탕·녹색 강조**를 후보 앱에 적용한다. 기존 기능·목적을 유지하며 변경이 불가피하면 먼저 확인한다. 숙소는 선택 날짜와 연결하고, 준비 화면은 직접 중요 표시한 미완료 항목을 강조한다. 2026-10-23 예약 요청으로 구현은 승인되었으며 운영 전환은 별도 승인 대상이다. 범위는 [Daylight 구현 계획](docs/DAYLIGHT_IMPLEMENTATION_PLAN_KO.md), 검토 위치·검증은 [구현 기록](docs/archive/2026-10-23-daylight-implementation.md)을 따른다.
