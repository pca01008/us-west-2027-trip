# US West 2027 Trip

2027년 1월 21일~31일 라스베이거스와 로스앤젤레스 여행을 위한 공유 일정 페이지입니다.

## 구성

- `index.html`: 여행 일정, 체크리스트, 경비를 확인·편집하는 단일 페이지
- `supabase_setup.sql`: 실시간 공유와 편집 권한을 위한 Supabase 데이터베이스 설정
- `.gitattributes`: Windows와 WSL 환경의 줄바꿈을 LF로 통일하는 규칙

## 사용 방법

`index.html`을 브라우저로 열면 일정을 볼 수 있습니다. 누구나 열람할 수 있으며, 편집은 설정된 Supabase 편집자 계정으로 로그인한 경우에만 가능합니다.

## Supabase 초기 설정

1. Supabase Authentication에서 편집자 이메일 계정을 생성합니다.
2. SQL Editor에서 `supabase_setup.sql` 전체를 실행합니다.
3. `index.html`에 설정된 Supabase 프로젝트 URL과 publishable key를 확인합니다.

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
