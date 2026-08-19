# US West 2027 Trip

2027년 1월 21일~31일 라스베이거스와 로스앤젤레스 여행을 위한 공유 일정 페이지입니다.

## 구성

- `index.html`: 여행 일정, 체크리스트, 경비를 확인·편집하는 단일 페이지
- `supabase_setup.sql`: 실시간 공유와 편집 권한을 위한 Supabase 데이터베이스 설정
- `.gitattributes`: Windows와 WSL 환경의 줄바꿈을 LF로 통일하는 규칙

## 사용 방법

`index.html`을 브라우저로 열면 일정을 볼 수 있습니다. 누구나 열람할 수 있으며, 편집은 설정된 Supabase 편집자 계정으로 로그인한 경우에만 가능합니다.

- 편집 내용은 초안으로 유지되며, 확인 후 `저장`해야 공개 페이지에 반영됩니다.
- 편집 중에는 실행 취소와 다시 실행을 사용할 수 있습니다.
- 로그인 세션은 편집 종료 후에도 유지됩니다. 마지막 활동 후 30분이 지나면 자동 로그아웃되며, 1분 전 경고에 응답하지 않으면 초안이 폐기됩니다.
- 체크리스트 항목은 편집 모드에서 추가·수정·삭제할 수 있습니다.
- 가계부는 보기 모드에서도 날짜·항목·금액·통화를 입력할 수 있습니다. 추가·삭제 시 유효한 편집자 세션을 확인하며, 변경한 경비도 `저장`하기 전까지는 공개되지 않습니다.
- 가계부 합계는 원화와 USD를 환산하지 않고 각각 표시합니다.
- 저장본은 최근 50개까지 보관되며 `버전 관리`에서 미리보기와 복원이 가능합니다.
- `HTML 내보내기`는 Supabase와 연결되지 않는 독립적인 정적 백업 파일을 만듭니다.

## Supabase 초기 설정

1. Supabase Authentication에서 편집자 이메일 계정을 생성합니다.
2. SQL Editor에서 `supabase_setup.sql` 전체를 실행합니다.
3. `index.html`에 설정된 Supabase 프로젝트 URL과 publishable key를 확인합니다.

버전 관리 기능을 추가하기 전에 이미 SQL을 실행했다면, 변경된 `supabase_setup.sql` 전체를 다시 실행해야 합니다. 스크립트는 기존 일정 데이터를 유지하면서 버전 테이블과 저장 함수를 추가합니다.

publishable key는 정적 웹페이지에 포함해도 되지만, service role key나 편집자 비밀번호는 저장소에 올리지 않습니다.

## Git 작업 흐름

WSL 또는 PowerShell 중 한 환경을 기준으로 작업하고, 변경 전후에 상태를 확인합니다.

```bash
git status
git add index.html supabase_setup.sql README.md .gitattributes
git commit -m "Update travel planner"
git push origin main
```

여행 일정의 실시간 편집 내용은 Supabase에 저장됩니다. GitHub push는 HTML·SQL 등 소스 코드를 갱신할 때만 필요합니다.

## 배포

GitHub 저장소의 **Settings → Pages**에서 `main` 브랜치와 루트(`/`)를 배포 대상으로 설정합니다. 배포 후 생성되는 GitHub Pages 주소로 일정을 공유할 수 있습니다.
