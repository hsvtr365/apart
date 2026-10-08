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

`serve`는 의존성 설치 → Prisma 생성 → 저장된 migration 적용 → production build → 서버 실행 순서입니다. 접속: http://localhost:28004
개발 중에는 최초 `npm run setup` 후 `npm run dev`를 사용합니다.

설정은 `front/.env`에만 둡니다. 시스템 환경변수를 등록할 필요가 없습니다. 실제 OCI DB는 Tailscale 주소의 프로젝트 전용 `village20`입니다. 기존 앱 DB는 사용하지 않습니다.

공개 저장소에는 실제 `.env`를 포함하지 않습니다. 기존 로컬 `.env`는 유지하며, 다른 PC에서는 `.env.example`을 `.env`로 복사한 뒤 DB 접속 정보와 카카오 키를 직접 입력합니다. 기획 폴더, 출력물, Playwright 실행 결과, 업로드 파일도 Git에서 제외합니다. 테스트 코드와 migration은 포함합니다.

다른 호스트에서 웹을 열 때 `front/.env`의 `APP_URL`을 사용자가 접속할 주소(예: 해당 웹 서버의 Tailscale IP와 포트)로 맞춥니다. 이는 로그인 콜백과 요청 출처 검증에 사용됩니다. DB 주소와 웹 주소는 서로 다릅니다.

카카오 앱 주접닷컴(1601282)의 기존 REST 키·클라이언트 시크릿·JavaScript 지도 키를 `.env`에 저장했습니다. 로컬 로그인/지도 주소는 `http://localhost:28004`, 실서비스 예정 주소는 `https://apart.jujeop.com`으로 등록했습니다. 로컬은 현재 `APP_URL`을 그대로 쓰고, 실서비스 배포 시 `.env`의 `APP_URL=https://apart.jujeop.com`으로 변경합니다. `SERVICE_URL`은 예정 도메인 기록용이며 자동 배포/DNS 설정을 하지 않습니다. 지도 키 변경 후에는 다시 빌드합니다.

일반 카카오 로그인으로 최초 로그인 시 앱 회원을 자동 생성합니다. 카카오 간편가입(카카오싱크)은 사업자 정보 심사·비즈니스 채널이 필요하여 사용하지 않습니다. UI 전체 체험은 `.env`에서 `DEMO_MODE=true`로 변경하고 재시작합니다. 데모 변경은 DB에 저장되지 않습니다.

기획·기술설계 문서는 로컬 `plan/` 폴더에서 관리합니다.

## PM2 배포

서버 경로: `/home/ubuntu/app/apart`, 프로세스: `apart`, 포트: `28004` (서버는 127.0.0.1에만 바인딩).

- 최초 시작: `bash pm2_start.sh` (설치·migration·빌드·PM2 시작)
- 최신 반영: `bash pm2_reload.sh` (main fast-forward pull 후 설치·migration·빌드·재시작)
- 정지: `bash pm2_stop.sh`
- Windows 로컬: 같은 이름의 `.ps1` 스크립트 (PM2 설치 필요)
- Windows에서 OCI 반영: `./pm2_deploy.ps1` (SSH 별칭 ubuntu)

먼저 변경을 main에 커밋·푸시한 뒤 반영 스크립트를 실행합니다. 자동 파일 감시가 아니라 스크립트 실행 시 최신 버전을 반영하는 방식입니다. 최초 서버 .env는 별도로 전달하고 APP_URL=https://apart.jujeop.com으로 설정합니다. pull로 .env·업로드 파일은 덮어쓰지 않습니다. Linux Node.js 22.22 이상 및 PM2가 필요합니다. PM2 재부팅 자동 시작은 서버에서 pm2 startup과 pm2 save로 설정합니다. Windows PM2 재부팅 자동 시작은 별도 구성 대상입니다.

Nginx 설정 원본은 deploy/apart.nginx.conf입니다. 인증서 파일이 발급된 뒤 적용하며 Certbot 자동 갱신 시 Nginx reload hook을 사용합니다. 웹 포트는 Nginx를 통해서만 외부에 공개합니다. 재빌드와 프로세스 재시작 중 잠깐 응답이 중단될 수 있습니다.
