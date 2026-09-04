# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code 세션이 지켜야 할 기본 절차를 담는다.

## 배포 절차

이 프로젝트는 배포 경로가 두 갈래로 나뉜다 - **APK는 GitHub Actions가 자동으로**,
**서버(프론트/백엔드)는 `deploy.sh`로 수동으로** 반영해야 한다. 둘을 헷갈리면 "빌드는
됐는데 실제 서비스에는 옛날 버전이 떠 있는" 상태가 된다.

### 1. APK (android_kiosk/**) 변경 시

1. `android_kiosk/**` 아래를 건드리는 커밋을 `main`에 push하면
   `.github/workflows/release-apk.yml`이 자동으로 트리거되어 kiosk/admin/user 3개
   플레이버를 release 빌드하고, GitHub Release(`build-<run_number>`)에 APK를 올린다.
2. **이 워크플로우는 스스로 `main`에 커밋을 다시 push한다** (`frontend/SomangPay{Kiosk,Admin,User}.apk`,
   `frontend/admin.html`의 다운로드 링크 버전, `frontend/version.json` 갱신 - 메시지에
   `[skip ci]`가 붙어 무한 재실행은 안 됨). 즉 push 직후 로컬 `main`은 곧바로 origin보다
   뒤처진다.
3. 그래서 이어서 뭔가 더 커밋하려면 먼저 `git fetch origin main` 후 rebase(또는 pull)해야
   push가 거부되지 않는다. (`git push`가 "fetch first"로 막히면 이 경우다.)
4. `gh run watch <run-id> --exit-status` (또는 `gh run list --workflow=release-apk.yml`)로
   빌드가 **완전히 끝나고 CI의 자체 커밋까지 push된 것**을 확인한 뒤에 로컬로
   `git fetch && git merge --ff-only origin/main`으로 그 커밋을 받아온다.

### 2. 서버(프론트/백엔드) 반영

- `git push`만으로는 실서버(`somangpay.duckdns.org`, Oracle Cloud VPS)에 **아무것도
  반영되지 않는다.** 반드시 `./deploy.sh [all|frontend|backend]`를 수동 실행해야 한다.
  - `frontend`: rsync + nginx 정적 파일 갱신 (빠름, 컨테이너 재시작 없음)
  - `backend`: docker 이미지 재빌드 + 컨테이너 재시작 (느림, 잠깐 다운타임 있음)
  - `all`: 위 둘 다
- **순서 주의**: android_kiosk 변경 후 `deploy.sh frontend`를 CI의 자체 커밋(위 1-2번)이
  push되기 *전에* 돌리면, 관리자 페이지 다운로드 링크가 옛 APK 바이너리를 계속 서빙한다.
  반드시 "push → CI 완료 대기 → CI 커밋 pull → `deploy.sh frontend`" 순서를 지킬 것.
- `deploy.sh`는 `~/.ssh/somangpay-oci.pem`으로 실서버에 SSH/rsync하는 스크립트다. 실제
  사용자에게 영향을 주는 프로덕션 액션이므로, 사용자가 명시적으로 배포를 요청한 게 아니라면
  임의로 실행하지 말고 먼저 확인받는다. `main`으로의 `git push`도 마찬가지 - 실제 APK
  릴리스를 만드는 행위이므로 동일하게 취급한다.

### 3. 커밋 위생

- 이 저장소에는 로컬에서 빌드/실행만 해도 더러워지는 추적 대상 파일들이 있다:
  `android_kiosk/.gradle/buildOutputCleanup/buildOutputCleanup.lock`,
  `backend/app/__pycache__/*.pyc` 등. 작업과 무관하면 커밋에 절대 섞지 않는다.
- `git add -A`/`git add .` 대신 관련 파일 경로를 명시해서 스테이징한다. 커밋 전
  `git status --short`로 의도한 파일만 올라갔는지 확인한다.

### 4. 프론트 캐시버스팅 쿼리 (`?v=`) 와 "웹 버전" 표시

- `kiosk.html` / `admin.html` / `user.html` 은 `src/style.css?v=YYYYMMDD_HHMM`,
  `src/<page>.js?v=YYYYMMDD_HHMM` 형태로 정적 에셋을 로드한다. 링크된 에셋을
  고쳤으면 **그 에셋을 로드하는 HTML 의 `?v=` 를 반드시 올려야** 브라우저 / PWA /
  nginx 가 옛 파일을 계속 안 물고 새로 받는다. 안 올리면 "배포는 됐는데 화면은 옛날"
  이 된다.
- `style.css` 는 세 페이지가 공유하지만 `?v=` 는 페이지마다 따로다. 동작이 바뀐
  페이지의 쿼리만 올리면 된다(예: kiosk 전용 CSS 변경이면 `kiosk.html` 만).
- **함정 - 설정 "앱 정보" 카드의 "웹 버전"**: `hydrateKioskWebVersionText` /
  `hydrateAdminWebVersionText` 가 보여주는 값은 `style.css?v=` 가 아니라
  **`<page>.js?v=` 쿼리**를 읽는다. 그래서 CSS 만 고치고 `style.css?v=` 만 올리면,
  기기에서 새 CSS 를 받아도 "웹 버전"은 옛날 값 그대로라 업데이트 반영 여부를
  확인할 수 없다. **CSS-only 변경이어도 `<page>.js?v=` 를 같은 값으로 같이 올려라**
  (kiosk.js/admin.js 코드는 안 건드려도 됨). 그래야 화면의 "웹 버전"이 신뢰할 수
  있는 신호가 된다.
- PWA(디버그 PWA 포함)는 서비스워커(`sw.js`, network-first)가 옛 셸을 붙들고 있을
  수 있다. 기기에서 **설정 → 앱 정보 → ⟳ 새로고침**(`triggerAppVersionRefresh()`)
  또는 PWA 완전 종료 후 재실행으로 강제로 새로 받는다.

### 5. kiosk 모바일(<=767px) 메뉴 목록 스크롤 레이아웃

- **"최초 세로 로드 시 하단 잘림, 회전하면 정상"의 근본 원인은
  `.kiosk-wrapper { height: 100vh }`**(하드 100vh). 모바일에서 100vh는 주소창
  숨은 "최대" 뷰포트라 첫 렌더 때 실제 보이는 영역보다 커서 wrapper 하단이 화면
  밖으로 나간다. `height: 100dvh` 를 한 줄 더 얹어서 실제 보이는 높이를 쓰게 한다
  (파일 내 다른 `.kiosk-wrapper` 규칙들은 이미 `min-height: 100dvh` 폴백이 있는데
  이 규칙만 빠져 있었다). 비슷한 "회전해야 고쳐짐" 증상은 대부분 뷰포트 단위 문제다.
- 메뉴 리스트 스크롤은 `.kiosk-body` > `.kiosk-menu-section` >
  `#kiosk-menu-content-wrap` > `#kiosk-menu-grid` 를 **전부
  `display:flex; flex-direction:column; flex:1 1 auto; min-height:0` 로만 잇는
  순수 flex 체인**으로 하고, 맨 안쪽 `#kiosk-menu-grid` 에만 `overflow-y:auto`.
  `height:100%` 는 쓰지 말 것 - 부모가 definite 여야 하는데 flex/데이터 로드로
  늦게 정해지면 첫 렌더에서 안 잡힌다. `position:absolute + inset` 으로 래퍼 높이를
  확정하는 방식도 시도했으나, containing block(섹션) 높이가 flex 로 늦게 정해지면
  똑같이 첫 렌더에서 stale 해지는 타이밍 버그가 있어 폐기했다.
- `#kiosk-menu-content-wrap` 인라인 `style="display:block; height:100%"` 는
  모바일 미디어쿼리에서 `height:auto !important` + flex 로 덮어쓴다.
- 섹션 인라인 `overflow:hidden` 은 유지한다 - QR 카메라 오버레이
  (`#kiosk-camera-viewport-container`, `position:absolute; inset:0`)가 스크롤에
  안 딸려가게 하려는 것. 섹션 자체를 스크롤 컨테이너로 바꾸지 말 것.
- 스크롤 컨테이너 `padding-bottom` 은 일부 안드로이드 WebView 에서 `scrollHeight` 에
  안 잡혀 마지막 카드가 잘려 보인다. 아래 여백은 마지막 카드 `margin-bottom` 으로 준다.
- 메뉴 카드 2행 배치(이름 위 / 가격 아래 / 수량 오른쪽)는 `renderKioskProducts` 가
  이름+가격을 `.menu-card-info` 로 감싸고, 데스크톱/태블릿은
  `.menu-grid .menu-card .menu-card-info { display: contents }` 로 래퍼를 없애
  기존 한 줄 배치를 유지한다. 빈 카트 안내는 `.cart-item cart-item--empty` 로
  담긴 항목과 같은 행 크기 + 가운데 정렬.

## 실시간(WebSocket) / 키오스크 온라인 판정

- 백엔드는 `uvicorn --workers 4`로 뜨는데(`backend/Dockerfile`), `ws_manager.ConnectionManager`
  는 **프로세스 로컬 인메모리**다(Redis 같은 브로커 없음). 그래서 어떤 워커에 붙은 WS
  소켓은 다른 워커에서 안 보이고, `notify_admins` / `send_to_kiosk` / `broadcast_kiosks`
  는 **같은 워커에 붙은 클라이언트에게만** 닿는다. WS 기반 상태를 "지금 켜져 있나?"
  판정에 직접 쓰면 안 된다(워커 4개면 4번에 1번만 맞음).
- **키오스크 온라인 여부**는 그래서 `KioskDevice.last_seen_at`(naive UTC) **신선도**로
  본다(`main.py`의 `_kiosk_is_online_at`, `KIOSK_ONLINE_TTL_SECONDS = WS_PING_INTERVAL*3
  = 60초`). `_ws_keepalive_loop`의 `on_tick`이 **포그라운드일 때만** 20초마다
  `last_seen_at`을 갱신한다.
- 키오스크 화면(모바일 PWA 포함)이 백그라운드로 가면 `kiosk.js`가 WS로
  `{"type":"visibility","hidden":true}`를 보내고, 서버(`ws_kiosk`)는 하트비트를 멈추고
  `_expire_kiosk_last_seen`으로 `last_seen_at`을 TTL 밖으로 밀어 **즉시 오프라인**으로
  표기되게 한다. 포그라운드 복귀 시 `{hidden:false}` + 재연결로 되살아난다.
  `ws-client.js`는 이걸 위해 `send()`와 `onOpen` 콜백을 노출한다.
- 무거운 `GET /api/admin/kiosks`(단말기당 매출 집계 쿼리 4개)와 분리해서, 온라인 점만
  갱신하는 경량 `GET /api/admin/kiosks/status`가 있다. `admin.js`의 30초 폴링과 "stats"
  실시간 갱신은 키오스크 탭을 실제로 보고 있을 때가 아니면 이 경량 쪽만 쓴다.
- 매출 집계는 `payment_transactions(kiosk_device_id, status, created_at)` +
  `payment_transaction_items(payment_transaction_id)` 인덱스에 의존한다(`database.py`
  마이그레이션). 없으면 목록이 5~10초씩 걸린다.
- **아직 안 고친 것**: 라이브 메뉴 갱신(`send_to_kiosk`/`broadcast_kiosks`)은 여전히
  워커 로컬이라 다중 워커에서 일부 키오스크에 신호가 안 갈 수 있다. 근본 해결은
  매니저에 Redis pub/sub.

## 개발/운영 환경 구분 (디버그 뱃지)

개발 서버에서 뜨는 아이콘에는 빨간 "DEV" 리본이 붙어 운영과 눈으로 구분된다.
판별 기준은 도메인이 아니라 **`frontend/app-env.js`** 한 파일이다.

- `frontend/app-env.js`는 저장소에 `window.__APP_ENV__ = 'development'`로 커밋돼 있다.
  개발 docker는 `frontend/`를 volume 마운트로 그대로 서빙하므로 항상 개발로 뜬다.
- `deploy.sh`의 `deploy_frontend()`가 실서버의 `/var/www/somangpay/app-env.js`를
  `'production'`으로 덮어쓴다. 즉 "운영"은 *deploy.sh를 거쳤다*는 사실로만 정의되고
  코드 어디에도 도메인 문자열이 없다.
- `frontend/src/env-badge.js`가 `<head>`에서 이 값을 읽어, 개발일 때만 favicon /
  apple-touch-icon / `<link rel=manifest>` / `logo-mark*.svg`의 href 확장자 앞에
  `-debug`를 끼워넣어 뱃지 버전(`*-debug.{ico,png,svg,json}`)으로 교체하고 `<title>`에
  `[DEV]`를 붙인다. kiosk/user/admin/index 네 페이지 모두 `app-env.js` → `env-badge.js`
  순서로 로드한다.
- 뱃지 붙은 에셋은 `frontend/icons/*-debug.png`, `frontend/*-debug.ico`,
  `frontend/manifest*-debug.json` 등으로 미리 커밋돼 있다. 원본 아이콘/매니페스트를
  바꾸면 `python3 frontend/tools/gen-debug-icons.py`로 `-debug` 세트(+ 안드로이드
  `ic_debug_ribbon.png`)를 다시 만든다.
- **주의**: 실서버 nginx가 `/app-env.js`를 강하게 캐시하면 첫 배포 후 한동안 옛
  development 값이 남아 운영 사이트에 뱃지가 보일 수 있다. 그럴 땐 실서버 nginx에
  `/app-env.js` no-cache 규칙을 추가한다(이 저장소 `frontend/nginx.conf`는 개발
  docker용이라 실서버엔 반영 안 됨).

### 디버그 APK

`android_kiosk`에 `debug` 빌드타입이 있다(`./gradlew assembleKioskDebug` 등).

- `applicationId`에 `.debug` 접미사가 붙어(`com.somangpay.kiosk.debug`) 기기에 운영
  APK와 나란히 설치된다. `versionName`엔 `-dev` 접미사.
- 런처 아이콘은 `app/src/debug/res/` 오버레이가 각 플레이버 마크 위에 빨간 DEV 리본
  (`ic_debug_ribbon.png`)을 얹어 운영 빌드와 구분한다(어댑티브 아이콘 foreground 교체).
- WebView가 붙는 URL은 `AppConfig.TARGET_URL`이 `BuildConfig.DEBUG`로 고른다 -
  release는 `TARGET_URL`(운영), debug는 `DEV_TARGET_URL`(개발 서버). 코드에서
  `BuildConfig.TARGET_URL`을 직접 쓰지 말고 `AppConfig.TARGET_URL`을 쓸 것.
- `DEV_TARGET_URL`의 기본 호스트는 build.gradle의 `devTargetHost`에 박혀 있는데,
  이건 cloudflare 퀵터널(`*.trycloudflare.com`) 주소라 `cloudflared` 재시작 때마다
  바뀐다. 바뀌면 파일 수정 없이
  `./gradlew assembleKioskDebug -PdevTargetHost=https://<새-서브도메인>.trycloudflare.com`
  로 덮어쓴다.
- CI(`release-apk.yml`)는 `assemble*Release`만 돌리므로 debug 빌드타입/오버레이의
  영향을 받지 않는다.

## CLAUDE.md 유지보수

- 작업하다가 알게 된 중요한 내용(반복될 만한 절차, 헷갈리기 쉬운 함정, 프로젝트 고유
  규칙 등)은 그때그때 이 파일에 업데이트한다. 세션이 끝나면 휘발되는 대화 맥락에만
  남겨두지 않는다.
- 이 파일에 이미 적힌 내용이 실제와 달라졌다면(절차가 바뀌었거나 더 이상 유효하지
  않은 경우) 발견 즉시 최신 상태로 반영한다.
- 이 파일에서 잘못된 내용(오류)을 발견하면 임의로 고치지 말고, 사용자에게 알리고
  허락을 받은 뒤에 수정한다.

## 완료/중단/질문 시 알림

작업이 끝났을 때, 진행 중 막혀서 사용자의 판단/입력이 필요할 때, 또는 질문이 생겼을 때는
**항상 `PushNotification` 도구로 알린다.** 이 도구는 터미널(PC) 알림과 모바일 push를
자동으로 함께 처리하므로 PC/앱 환경을 따로 분기할 필요는 없다 - 그냥 매번 호출하면 된다.
Stop 훅으로는 이 동작을 대신할 수 없으니(에이전트가 직접 도구를 호출해야 함), 세션 내내
지켜야 할 기본 동작으로 취급한다. 아주 짧은 작업이었다는 이유로 생략하지 않는다.
