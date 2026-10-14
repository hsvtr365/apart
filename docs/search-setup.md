# 검색 노출 설정

대표 주소는 `https://apart.jujeop.com`이다. 다른 서비스가 사용하는 `www`와 루트 도메인의 DNS·리디렉션은 변경하지 않는다.

## 프로그램

- 서버에서 홈·피드·분류·게시글의 초기 데이터를 조회해 기존 UI를 HTML로 렌더링한다. 클라이언트의 새로고침·지도·댓글 동작은 유지한다.
- 사용자별 초기 데이터는 React의 요청 내 캐시만 사용한다. HTML을 CDN에서 공용 캐시하지 않는다.
- 게시글 상세는 JavaScript 없이도 열린 dialog로 본문을 제공하고, hydration 후 기존 모달로 전환한다.
- 경로별 title·description·canonical·Open Graph·Twitter 메타정보를 생성한다. `/home`은 `/`, `/feed/all`은 `/feed`로 308 이동한다.
- 없는 글·잘못된 경로는 일반 브라우저와 검색봇 모두 404로 반환한다. 숨김·관리자 삭제 글은 작성자/관리자만 열람하고 noindex한다. 사용자 삭제 글은 열람할 수 없다.
- 내 정보·제보·개별 지도 선택 URL은 noindex한다. 데모 모드 전체는 noindex한다.
- `/sitemap.xml`은 공개 페이지와 공개 게시글, 실제 수정 시각을 동적으로 제공한다. 글의 숨김·삭제가 다음 요청에 반영된다. 50,000 URL에 도달하기 전에 사이트맵 분할이 필요하다.
- `/robots.txt`는 검색봇의 공개 페이지 접근을 허용하고 사이트맵을 안내한다. noindex 페이지의 크롤링은 차단하지 않는다.

## 소유권 확인 및 운영

`front/.env`의 `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`에 각 서비스가 발급한 메타태그의 content 값을 넣고 재빌드·재시작한다. 전체 메타태그를 넣지 않는다.

Google Search Console URL 접두어 속성, 네이버 서치어드바이저, Bing Webmaster Tools에 정확한 대표 주소를 등록하고 `https://apart.jujeop.com/sitemap.xml`을 제출한다. HTML 태그 인증은 이후에도 유지한다.

Cloudflare의 Search/AI 검색봇 정책과 WAF를 별도로 확인한다. 원본 robots.txt가 Cloudflare 규칙과 합쳐질 수 있으므로 외부 응답을 검사한다. ChatGPT 검색용 OAI-SearchBot과 학습용 GPTBot의 정책은 독립적이다. 모든 AI 봇의 일괄 차단 해제는 필요하지 않다.

## 검증

`cd front`에서 `npm test`, `npm run build`, `npm run test:api` 실행. 마지막 명령은 별도 임시 DB를 만들고 정상/오류 페이지, SSR 본문, 검색봇별 HTTP 상태, 비공개 글 분리, robots 및 사이트맵을 검증한 뒤 임시 DB를 삭제한다. 운영 DB에는 테스트 데이터를 쓰지 않는다.

배포 후 외부 주소에서도 본문·메타태그·404·robots·사이트맵을 확인한다. 검색 서비스 등록 및 제출은 색인 생성이나 순위를 보장하지 않는다.
