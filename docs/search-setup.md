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

## SEO·AEO 콘텐츠 보강

- `/about`에 지역·서비스 범위, 일정과 현장 확인의 차이, 제보 방법, 자주 묻는 질문과 기관 원문 확인처를 제공한다. 홈과 피드에서 연결하고 사이트맵에 포함한다.
- 분류별 제목·설명을 실제 화면에 표시하고 게시글까지 이어지는 경로 링크를 제공한다.
- 공개 페이지에 WebSite·WebPage/CollectionPage/AboutPage·BreadcrumbList, 공개 게시글에 DiscussionForumPosting JSON-LD를 서버 렌더링한다. 게시글의 실제 본문·작성자 닉네임·작성/수정일·실제 이미지만 사용한다. 계정 ID와 동 정보는 구조화 데이터에 넣지 않는다.
- 게시글 작성/수정 시각을 화면과 Open Graph에도 제공한다. 색인 가능한 페이지에 `max-image-preview:large`, `max-snippet:-1`을 제공한다.
- 숨김·삭제·개인 페이지와 데모는 구조화 데이터 대상에서 제외한다. 사용자 본문의 `<`를 JSON-LD에서 이스케이프해 script 종료 태그 삽입을 막는다.
- 별도 AI 전용 파일, 허구의 기관·평점·행사 정보, 노출용 중복 페이지는 만들지 않는다. 실제 방문 일정·현장 확인·원문 출처를 지속적으로 보완하는 것이 운영 과제다.
- 근거: [Google AI 검색 안내](https://developers.google.com/search/docs/appearance/ai-features), [게시판 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum), [경로 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb). 구조화 데이터는 검색엔진의 이해를 돕지만 노출과 순위를 보장하지 않는다.

## 소유권 확인 및 운영 설정

`front/.env`의 `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`에 각 서비스가 발급한 메타태그의 content 값을 넣고 재빌드·재시작한다. 전체 메타태그를 넣지 않는다.

Google Search Console URL 접두어 속성, 네이버 서치어드바이저, Bing Webmaster Tools에 정확한 대표 주소를 등록하고 `https://apart.jujeop.com/sitemap.xml`을 제출한다. HTML 태그 인증은 이후에도 유지한다.

Cloudflare의 Search/AI 검색봇 정책과 WAF를 별도로 확인한다. 원본 robots.txt가 Cloudflare 규칙과 합쳐질 수 있으므로 외부 응답을 검사한다. ChatGPT 검색용 OAI-SearchBot과 학습용 GPTBot의 정책은 독립적이다. 모든 AI 봇의 일괄 차단 해제는 필요하지 않다.

Cloudflare Cache Rule `jujeop.com SEO files - bypass edge cache`는 `jujeop.com` 영역으로 프록시되는 모든 호스트에서 경로가 `/robots.txt` 또는 `/sitemap.xml`인 요청만 캐시하지 않는다. 검색 제어 파일의 배포 변경을 Cloudflare 캐시 지연 없이 반영하기 위한 규칙이다. HTML과 다른 경로의 캐시 정책은 바꾸지 않는다.

## 검증

`cd front`에서 `npm test`, `npm run build`, `npm run test:api` 실행. 마지막 명령은 별도 임시 DB를 만들고 정상/오류 페이지, SSR 본문, 검색봇별 HTTP 상태, 비공개 글 분리, robots 및 사이트맵을 검증한 뒤 임시 DB를 삭제한다. 운영 DB에는 테스트 데이터를 쓰지 않는다.

배포 후 외부 주소에서도 본문·메타태그·404·robots·사이트맵을 확인한다. 검색 서비스 등록 및 제출은 색인 생성이나 순위를 보장하지 않는다.

## 2026-10-14 적용 결과

- `787b349`를 main에 반영하고 OCI의 apart 프로세스에 배포했다.
- Google·네이버·Bing 모두 HTML 메타태그로 소유권 확인을 완료하고 사이트맵을 제출했다. 인증값은 운영 `.env`에 보관한다.
- Google: 사이트맵 처리 완료, 발견된 페이지 21개. 네이버: 제출 목록 등록 확인. Bing: Submitted / Processing 확인.
- 단위 테스트 22개, production build, 임시 DB/API 통합 검증 통과. 외부 HTTPS에서도 본문 HTML·canonical·noindex·404·robots·21 URL 사이트맵을 확인했다.
- 실제 브라우저에서 상세 진입·모달 전환·닫기·분류 전환을 확인했고 확인 구간의 클라이언트 오류는 없었다.
- 처음에는 Cloudflare 관리자 정책을 변경하지 않았다. `jujeop.com` 영역을 공유하는 다른 호스트에 영향을 줄 수 있고, 외부 robots.txt와 Google의 실제 사이트맵 수집이 정상임을 확인했기 때문이다.
- 후속 점검에서 Cloudflare의 Search·Agent·Training 정책은 모두 Allow, Bot Fight Mode와 AI Labyrinth는 꺼짐, Custom WAF 규칙은 0개였다. `apart.jujeop.com`의 최근 AI 크롤러 요청 66건 중 58건은 성공, 8건은 404였으며 차단 응답은 없었다. robots.txt는 200이고 Cloudflare 진단에서 robots·사이트맵·AI 크롤러 규칙은 통과했다.
- Cloudflare Cache Rule `apart SEO files - bypass edge cache`를 처음 활성화하고, 후속 요청에 따라 `jujeop.com SEO files - bypass edge cache`로 이름과 범위를 변경했다. 현재 조건은 `http.request.uri.path in {"/robots.txt" "/sitemap.xml"}`이며 `jujeop.com` 영역의 모든 프록시 호스트에 적용된다. 검색봇 허용 정책은 이미 목표 상태라 변경하지 않았다.
- 외부에서 루트·`www`·`apart`의 robots.txt가 모두 200 및 `cf-cache-status: DYNAMIC`임을 확인했다. `apart`의 사이트맵도 200 및 DYNAMIC이다. 루트와 `www`의 사이트맵은 원본 서비스가 404를 반환하므로 해당 서비스에서 별도로 생성해야 한다.
- 후속 SEO·AEO 보강 `70ea010`을 운영 서버에 배포했다. 단위 테스트 24개, production build, 임시 DB/API 통합 검증을 통과했다. 외부 HTTPS에서 홈·안내·분류·실제 게시글의 JSON-LD와 검색 미리보기 지시자, 없는 게시글의 404, 22개 URL 사이트맵을 확인했다. 브라우저에서 안내 → 분류 → 상세 이동과 작성/수정일 표시를 확인했으며 확인 구간의 콘솔 오류는 없었다. 검색엔진의 재수집·색인 및 리치 결과 채택 여부는 별도다.
