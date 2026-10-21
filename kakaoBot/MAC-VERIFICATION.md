> 이 문서는 이전 Mac→OCI 봇 중계 단계의 기록입니다. 현재 실행 구조는 README.md와 INTEGRATION-VERIFICATION.md를 따릅니다. OCI 봇 프로세스와 28005 터널은 더 이상 사용하지 않습니다.

# Mac 중계기 검증 — 2026-10-21

## 확인한 설정

| 항목 | 값 |
| --- | --- |
| 작업 폴더 | `/Users/suji/app/kakaoBot` |
| 카카오톡 | `/Applications/KakaoTalk.app` |
| 테스트방 | `테스트오카방` |
| 방 ID | `18497328562223036` (문자열) |
| 로그인 사용자 ID | `162909104` (문자열) |
| 테스트 참여자 ID | `6101118734436341752` (Mac 계정과 다름) |
| 실행 파일 | `vendor/kakaocli/.build/release/kakaocli` |
| 기준 커밋 | `2ec590165d96e029fad4aa9621db451ec907f01b` + 로컬 패치 |
| Mac 설정 | `.env.mac` (0600) |
| 수신함 | `data/mac/mac-inbox.sqlite` (0600, 상위 폴더 0700) |

`doctor --json`: Accessibility / Full Disk Access 허용, DB 복호화 정상, 카카오톡 `loggedIn`. 비밀번호를 저장하지 않았으므로 로그아웃 후에는 공식 앱에서 다시 로그인해야 한다. 이 세션의 실행 주체는 `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app`이다. 실행 주체를 Terminal 또는 LaunchAgent로 바꾸면 그 주체에서 권한을 재진단해야 한다. TCC DB 수정이나 권한 우회는 하지 않았다.

`~/.kakaocli/policy.json`은 위 방 하나만 허용하며 `strictMode=true`, `denyByDefault=true`다. 전송은 방 ID 인자와 정책 검증을 사용한다. 중계기는 매 송신 전에 정책을 다시 확인하고, kakaocli도 정책 파일이 없거나 잘못되면 전송을 거부하도록 수정했다.

## 실기 검증 결과

- 다른 참여자 텍스트 메시지 `3956172355145748481` 수신 성공. 요청 문구 일치 확인. 자기 발신 제외 확인.
- 테스트 송신 후 같은 방 DB에서 자기 발신 메시지 `3956173295227914241` 확인.
- 테스트방 창을 닫은 상태에서 자동 열기와 송신 성공. 이후 해당 창을 재사용하는 송신도 확인.
- 실제 사진·텍스트를 Mac의 임시 HTTP 서버 `/events`로 전달하고, 테스트 답변을 원래 방에 전송해 DB 기록으로 확인. 임시 서버는 임의의 loopback 포트를 사용했고 종료했다. **OCI와의 왕복 검증은 아니다.**
- 테스트 이벤트의 영속 수신함 상태는 `done` 2건, `ignored` 1건이며 본문은 제거됐다. 테스트 이벤트가 운영 시작 시 다시 송신되지 않는다.
- 요약 증거: `data/mac/verification.json`. 본문·Base64·CDN 서명·비밀값은 들어 있지 않다.

### 사진 원본

검증한 사진 ID: `3956165960946077697`, 종류 `2`.

`attachment`에는 원본 URL, 별도의 썸네일 URL, 리소스 키, MIME, 크기, 해상도가 있었다. `supplement`, `extra`, `localFilePath`는 비어 있었고 `message`는 사진 표시용 텍스트였다. 카카오톡 컨테이너에서 해당 샘플의 파일명·바이트 크기에 대응하는 로컬 파일을 찾지 못했다. 개인 대화 내용을 검색하지 않았다.

`attachment.url`의 카카오 CDN 원본을 검증 후 수신했다. 썸네일은 원본과 경로가 같아도 변환 쿼리가 붙으므로 사용하지 않는다.

| 항목 | 검증값 |
| --- | --- |
| MIME | `image/jpeg` |
| 원본 바이트 | `2685388` |
| 회전 적용 해상도 | `3000 × 4000` |
| 인코딩 해상도 | `4000 × 3000` (`sips`로 별도 확인) |
| SHA-256 | `a59ad5fbc8b3f543f869b2ac5079bca7ef695370600655f736360799187c9bb7` |

EXIF 회전과 JPEG 뒤의 삼성 SEFT 부가정보를 보존한다. 원본을 재인코딩하지 않고 그대로 Base64로 전달하며 HTTP 수신 후에도 바이트 수와 SHA-256이 일치했다. 확인용 원본 파일은 `media/18497328562223036/3956165960946077697.jpg` (0600)이다.

허용 CDN은 `https://talk.kakaocdn.net/dna/...` 하나이며 `credential`, `expires`, `signature`가 있는 원본 쿼리만 허용한다. attachment 리소스 키와 경로 대응을 확인한다. 리다이렉트, 변환 쿼리, 사설/loopback DNS 주소와 임의 URL을 거부한다. 검증한 DNS 응답으로 연결 주소를 고정하고 TLS의 호스트 인증을 유지한다.

DB에 로컬 경로가 있으면 카카오톡 컨테이너의 `Data/tmp` 또는 `Data/Library/Caches/Items` 아래 이미지 파일만 읽는다. 심볼릭 링크와 범위 이탈, 일반 파일이 아닌 항목, 이미지 확장자·크기·형식·해상도 불일치를 거부한다. 최대 6장, 장당 8MiB, 합계 16MiB를 검사한다. 사진 묶음(type=27)은 실제 스키마를 검증하기 전까지 차단하며 단일 사진(type=2)을 한 장씩 보내는 흐름이 검증 범위다.

## 수정 파일과 자동 검증

- `src/mac-bridge.mjs`: 방별 커서·수신함, OCI 요청, 중복 제외, 조건부 송신 선점, 불명확 상태의 재전송 금지, 로그 축소.
- `src/mac-source.mjs`: 허용 방으로 한정한 DB 조회, 문자열 ID 보존, 정책 확인, 같은 방 DB를 통한 송신 확인.
- `src/mac-media.mjs`: 원본 수신·파일 경로·URL·크기·이미지 형식·해상도 검증.
- `src/http.mjs`: 호출자가 지정한 취소 신호 유지.
- `tests/mac-bridge.test.mjs`: 정밀도·허용 범위·중복·동시 송신·불명확 상태·HTTP 입력 계약·이미지 검증 테스트.
- `.env.mac.example`, `.env.mac`, `.env.example`, `.gitignore`, `package.json`, `README.md`: Mac 설정 및 실행 문서.
- `vendor/kakaocli`: 오픈채팅 이름 조회와 type=4 처리, AXButton 채팅 탭 지원, 정확하고 유일한 방 이름 선택, 창 재사용, 키/더블클릭 이벤트, 입력 검증, 정책 로딩 실패 시 차단. 재적용용 패치는 `deploy/kakaocli-mac-bridge.patch`에 보관했다.

`npm test`: 15개 통과. `npm run bridge:check`: 통과. `swift build -c release`: 성공. 이 Mac의 Command Line Tools 환경에는 XCTest 모듈이 없어 `swift test`는 실행하지 못했다(`no such module 'XCTest'`). 이를 위해 전체 Xcode를 설치하지 않았다.

## 남은 OCI 연결

| 항목 | 값 / 상태 |
| --- | --- |
| SSH 별칭 | `oci-heartlink-db` (등록된 사용자·개인키 재사용) |
| Mac → OCI 주소 | 반드시 `100.92.167.33` |
| SSH 접속 | 성공, 원격 호스트명 `instance-20260309-1050` |
| OCI 봇 수신 주소 | `127.0.0.1:28005` — 현재 리스너 없음 |
| Mac HTTP 주소 | `http://127.0.0.1:28005` |
| SSH 터널 | `deploy/mac-tunnel.sh`로 loopback 바인딩 성공 |
| 터널 경유 HTTP | 원격 `Connection refused`; OCI 봇이 실행되지 않은 상태 |
| 공유 비밀값 | Mac `.env.mac`에 신규 생성. OCI의 `BRIDGE_SECRET`을 동일하게 맞춰야 함 |
| OCI 방·발신자 설정 | 위 `ALLOWED_ROOM_IDS`, `BOT_SENDER_ID`와 동일하게 설정 필요 |

OCI에 봇 코드를 배치하고 공유 비밀값을 맞춘 뒤 `127.0.0.1:28005`에서 실행해야 실제 분석·DB 답변·게시물 등록을 검증할 수 있다. OCI 서비스나 다른 프로젝트는 변경하지 않았다.

연결 준비 후 Mac에서 각각 실행한다.

```sh
cd /Users/suji/app/kakaoBot
sh deploy/mac-tunnel.sh
```

```sh
cd /Users/suji/app/kakaoBot
npm run bridge:check
npm run bridge:mac
```

검증용 터널·임시 HTTP 서버는 종료했다. 중계기와 LaunchAgent 자동 시작은 현재 실행/등록하지 않았다. `bridge:check`의 성공은 OCI 서버 실행이나 비밀값 동기화 성공을 뜻하지 않는다.
