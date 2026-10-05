# DB 조회 점검과 실패 알림

외부 cron-job.org → Supabase Edge Function `trip-db-health` → `public.healthcheck`의 `id=1` 조회.

GitHub Pages는 정적 호스팅이므로 점검 API를 Supabase Edge Function에 배포한다. 평상시 한국 시각 **00:17, 06:17, 12:17, 18:17**에 한 번씩 실행한다. 실패하면 함수 안에서 1초 뒤 한 번 재시도한다. 각 조회는 응답 본문 읽기를 포함해 10초 제한이며, 최대 약 21초 뒤 503을 반환한다. 예약 호출은 30초 제한이다.

정상 응답은 `200 {"ok":true}`, 조회 실패·데이터 누락·설정 오류는 `503 {"ok":false}`다. 토큰 오류는 401, GET 외 요청은 405다. 응답은 캐시하지 않는다. 데이터베이스에는 비민감 점검 행 한 건만 읽으며, 일정·수정 시각·버전 이력을 변경하지 않는다. 쓰기, 로그인, 사진 업로드 전체를 점검하는 기능은 아니다.

## 1. 점검 테이블

Supabase 프로젝트 `xuzhcogshnjqtunkbsuo`가 일시정지됐다면 먼저 Resume 한다.

Dashboard → SQL Editor에서 [마이그레이션](./migrations/20261005_db_healthcheck.sql) 전체를 실행한다. 반복 실행해도 점검 행을 중복 생성하지 않는다. 익명 역할에는 `id` 조회만 허용하고 쓰기 권한을 제거하며 RLS를 켠다. 기존 `supabase_setup.sql`을 다시 실행할 필요는 없다. 새 프로젝트에도 이 마이그레이션은 별도로 실행한다.

## 2. 호출 토큰 준비

저장소에서 Node.js 22 이상으로 실행한다.

```powershell
node scripts/prepare-db-health.mjs
```

앱의 공개 Supabase 설정을 읽고 암호학적 난수로 64자리 토큰을 만든다. 파일은 다음과 같다.

- `.secrets/db-health.env`: Edge Function의 `HEALTHCHECK_TOKEN`, `HEALTHCHECK_PUBLISHABLE_KEY`
- `.secrets/db-health-cron.env`: 예약 등록용 `SUPABASE_PROJECT_REF`, 같은 토큰, 비어 있는 `CRON_JOB_API_KEY`

두 파일은 Git에서 제외한다. 재실행하면 토큰을 유지하고 기존 파일을 덮어쓰지 않는다. 키 또는 토큰이 서로 다른 파일은 오류로 처리한다. 토큰이나 cron-job.org API 키를 채팅·소스·명령 인수에 붙여 넣지 않는다.

## 3. 함수 배포

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

## 4. cron-job.org 등록

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

## 5. 검증

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

격리된 PostgreSQL에서 반복 마이그레이션, 한 행 제약, RLS, 익명 읽기, 쓰기·DDL 차단, 점검 행 누락 및 복구, 기존 여행 fixture 보존을 검사한다. 운영 DB를 수정하지 않는다.

운영 확인은 별도로 한다.

1. SQL 실행 후 점검 행이 한 건인지 확인한다.
2. `node --env-file=.secrets/db-health-cron.env scripts/check-db-health-live.mjs`로 올바른 토큰의 200, 토큰 누락·오류의 401, POST의 405와 캐시 금지를 확인한다.
3. cron-job.org Test Run으로 실행 이력의 200을 확인한다.
4. 알림 검증은 **별도의 임시 함수와 예약 작업**에서 한다. 예약 작업의 URL·헤더·주기는 고정하고 임시 함수의 응답만 실패에서 정상으로 전환하여 실패·복구 이메일을 확인한다. 예약 작업 자체를 편집하는 검증에서는 복구 실행과 이메일 알림 결과가 달라질 수 있으므로, 운영 장애가 복구되는 상황처럼 요청 대상의 응답만 바꾼다. 운영 DB나 정상 점검 함수를 고의로 중단하지 않는다. 검증 후 임시 작업을 비활성화하고 임시 함수·시험용 환경 변수는 제거한다.
5. 최소 한 번의 실제 예약 실행까지 이력에서 확인한다. API 등록 직후의 성공만으로 예약 실행이나 이메일 수신 완료를 주장하지 않는다.

## 운영 시 확인할 점

무료 Supabase의 일시정지 제외를 보장하는 수치는 공개돼 있지 않다. 하루 4회는 공식 안내의 "매일 몇 차례의 사용자 DB 요청"을 기준으로 제안한 주기다. 이미 정지된 프로젝트는 수동 재개해야 한다.

cron-job.org는 연속 실패가 누적되면 작업을 비활성화할 수 있다. 비활성화 알림을 받으면 프로젝트·함수·토큰을 확인하고 Console에서 다시 활성화한다. 이 구성은 호출 결과를 감시한다. 외부 예약 서비스 전체가 멈춰 호출 자체가 발생하지 않는 상황까지 감지하려면 별도의 미실행 감시 서비스를 추가해야 한다.

토큰을 바꿀 때는 Supabase Secret과 cron-job.org 헤더를 함께 갱신하고 Test Run을 실행한다. 프로젝트를 바꾸거나 앱의 공개 키를 교체하면 점검용 환경 변수도 갱신한다.

- [Supabase 프로젝트 일시정지](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase 함수 배포](https://supabase.com/docs/guides/functions/deploy)
- [Supabase 함수 환경 변수](https://supabase.com/docs/guides/functions/secrets)
- [cron-job.org API](https://docs.cron-job.org/rest-api.html)
- [cron-job.org 제한과 알림](https://cron-job.org/en/faq/)
