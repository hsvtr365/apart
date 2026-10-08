# 햇빛마을20단지

- `front/`: Next.js + TypeScript + Tailwind + PostgreSQL + Prisma 앱
- `plan/`: 로컬 기획·UI·기술 문서 (Git 제외)
- `ex/`: 원본 HTML 시안과 디자인 변형

## 실행

Node.js 22.22 이상, npm, OCI에 접근 가능한 Tailscale 연결이 필요합니다.

```sh
cd front
# 처음 받은 PC에서만 실행하고 실제 접속 정보를 입력하세요.
cp .env.example .env
npm run serve
```

`serve`는 의존성 설치 → Prisma 생성 → 저장된 migration 적용 → production build → 서버 실행 순서입니다. 접속: http://localhost:3000
개발 중에는 최초 `npm run setup` 후 `npm run dev`를 사용합니다.

설정은 `front/.env`에만 둡니다. 시스템 환경변수를 등록할 필요가 없습니다. 실제 OCI DB는 Tailscale 주소의 프로젝트 전용 `village20`입니다. 기존 앱 DB는 사용하지 않습니다.

공개 저장소에는 실제 `.env`를 포함하지 않습니다. 기존 로컬 `.env`는 유지하며, 다른 PC에서는 `.env.example`을 `.env`로 복사한 뒤 DB 접속 정보와 카카오 키를 직접 입력합니다. 기획 폴더, 출력물, Playwright 실행 결과, 업로드 파일도 Git에서 제외합니다. 테스트 코드와 migration은 포함합니다.

다른 호스트에서 웹을 열 때 `front/.env`의 `APP_URL`을 사용자가 접속할 주소(예: 해당 웹 서버의 Tailscale IP와 포트)로 맞춥니다. 이는 로그인 콜백과 요청 출처 검증에 사용됩니다. DB 주소와 웹 주소는 서로 다릅니다.

카카오 앱 주접닷컴(1601282)의 기존 REST 키·클라이언트 시크릿·JavaScript 지도 키를 `.env`에 저장했습니다. 로컬 로그인/지도 주소는 `http://localhost:3000`, 실서비스 예정 주소는 `https://apart.jujeop.com`으로 등록했습니다. 로컬은 현재 `APP_URL`을 그대로 쓰고, 실서비스 배포 시 `.env`의 `APP_URL=https://apart.jujeop.com`으로 변경합니다. `SERVICE_URL`은 예정 도메인 기록용이며 자동 배포/DNS 설정을 하지 않습니다. 지도 키 변경 후에는 다시 빌드합니다.

일반 카카오 로그인으로 최초 로그인 시 앱 회원을 자동 생성합니다. 카카오 간편가입(카카오싱크)은 사업자 정보 심사·비즈니스 채널이 필요하여 사용하지 않습니다. UI 전체 체험은 `.env`에서 `DEMO_MODE=true`로 변경하고 재시작합니다. 데모 변경은 DB에 저장되지 않습니다.

기획·기술설계 문서는 로컬 `plan/` 폴더에서 관리합니다.
