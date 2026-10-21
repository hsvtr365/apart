# OCI 사이트 내부 API 배포 요청

## 확인한 운영 상태 (2026-10-21)

- SSH는 `ssh -o HostName=100.92.167.33 oci-heartlink-db ...`만 사용했다.
- 운영 소스: `/home/ubuntu/app/apart/front`, 확인 커밋 `00d3999`.
- 사이트는 `127.0.0.1:28004`에서 실행 중이다.
- 배포 소스와 Prisma 스키마에서 `internal/bot`, `BotPublication`, `APP_BOT_SECRET`, `BOT_AUTHOR_ID` 구현을 찾지 못했다.
- `.env`에는 `APP_BOT_SECRET`, `BOT_AUTHOR_ID`가 설정되어 있지 않다. 실제 비밀값은 읽거나 출력하지 않았다.
- Mac이 자동 생성한 Tailscale SSH 터널 `127.0.0.1:28006 → OCI 127.0.0.1:28004`로 사이트에 도달한다. 인증 없는 봇 경로 POST는 HTTP 403이므로 정상 봇 API 계약 검증은 아직 불가능하다.
- 운영 코드·환경변수·DB·Nginx는 변경하지 않았다.

## 원래 Windows 작업에서 이어서 할 일

Windows의 `D:\soloproject\jujeop.com2\front`에 작성된 봇 내부 API·migration·테스트를 먼저 확인하고 재사용한다. 운영 버전을 무조건 덮어쓰지 말고 현재 변경분과 배포 차이를 확인해야 한다. 별도의 OCI 봇 프로세스나 Docker는 필요 없다. Mac이 대화·Gemma·카카오 송수신을 담당하며 OCI는 사이트 API만 제공한다.

1. `POST /api/internal/bot` 구현과 인증을 사이트에 배포할 수 있는 변경으로 준비한다. `Content-Type`으로 JSON 검색과 multipart 등록을 구분한다. 두 요청 모두 `Authorization: Bearer <APP_BOT_SECRET>`을 확인한다. 키가 없으면 비활성화하고, 임의의 일반 회원·관리자로 대체하지 않는다.
2. 사이트 `APP_BOT_SECRET`, 전용 봇 작성자 User의 `BOT_AUTHOR_ID`를 설정하고 Mac `.env.mac`의 `APP_BOT_SECRET`을 동일하게 맞춘다. 비밀값은 채팅·로그·Git으로 전달하지 않는다. 전용 작성자 계정 생성·선정은 운영자가 결정한다.
3. `BotPublication` migration을 준비하고 적용 절차를 검증한다. `requestKey`는 SHA-256 64자리이며 유일 인덱스로 보장한다. 같은 키 재요청은 최초 결과를 돌려주고, 게시물 생성과 키 기록을 하나의 DB 트랜잭션으로 처리한다. 동시 요청·커밋 후 응답 유실도 중복 게시물을 만들면 안 된다.
4. 이미지 검사는 기존 업로드 코드와 sharp 검증을 재사용한다. 최대 6장, 장당 8MiB, 합계 16MiB. MIME/실제 이미지 형식/픽셀 제한을 확인하고 이미지 중복 후보를 찾는다. 트랜잭션 실패 때 임시 업로드를 정리한다.
5. 검색과 중복 후보 응답 모두 `hidden=false`, `adminDeleted=false`, `userDeleted=false` 등 기존 공개 조회 조건을 지킨다. 비공개/삭제 게시물의 본문·링크를 중복 안내로 노출하지 않는다. 이미 생성된 글이 나중에 비공개/삭제돼도 같은 requestKey가 새 글을 만들면 안 된다.
6. 기존 공개 검색·일정·현장 제보 직렬화를 재사용한다. 예정 일정과 관측된 ARRIVED/GONE, 제보 시각과 발생 회차를 구분한다. 모델의 SQL이나 DB 직접 접속 기능은 추가하지 않는다.
7. Nginx의 공개 도메인에는 `/api/internal/` 차단을 유지/확인한다. Mac 접속은 SSH/Tailscale 터널로만 허용한다.

## Mac 클라이언트가 사용하는 계약

검색 요청은 JSON이다.

```json
{"query":"","category":"FOOD","date":"2026-10-21"}
```

category는 `FOOD`, `NOTICE`, `MARKET`, null이고 date는 실제 달력 날짜 또는 null이다. query/category/date만 전달한다. 응답 예시:

```json
{
  "today":"2026-10-21",
  "posts":[{
    "id":"실제 게시물 ID", "title":"먹거리", "body":"공개 내용", "category":"FOOD",
    "scheduleType":"ONCE", "startDate":"2026-10-21", "arrivalTime":"14:30",
    "presence":null, "observedAt":null, "lastPresenceReport":null
  }],
  "truncated":false
}
```

등록은 multipart의 `requestKey`, `post`(JSON 문자열), `files`(복수 파일), `forceDuplicate`(문자열 true/false)를 사용한다. `post`는 현재 배포본 `src/lib/validation.ts`의 `postSchema`와 맞춘다. Mac은 임의 authorId/hidden/imageUrl을 모델에서 받아 넘기지 않으며, 지도 필드는 null이다. NOTICE의 일정 필드는 기존 transform처럼 비운다. 실제 작업 일정은 body에 보존하고 게시 기간과 분리한다.

성공 응답은 `{"id":"게시물 ID"}`. 같은 사진의 공개 게시물 후보는 `{"id":"기존 ID","candidate":true}`. 후보 안내 자체는 게시물을 생성하지 않는다. 명시적인 사용자 확인 후 별도 requestKey와 `forceDuplicate=true`로 재등록한다. 입력 보완은 HTTP 400 `{"error":"사람이 이해할 수 있는 보완 질문"}`로 반환한다. 내부 오류·비밀값·SQL은 응답에 노출하지 않는다.

배포 준비가 끝나면 Mac에서 실제 DB 조회, 누락 질문 후 사진 등록, 등록된 링크 접근, 숨김/삭제 제외, 응답 유실 후 동일 키 재요청을 검증해야 한다. 현재 Mac에서는 실제 사이트 등록에 성공했다고 표시하지 않았다.
