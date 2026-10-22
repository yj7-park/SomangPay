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
- 운영 서버는 `ubuntu@168.110.113.17`(`somangpay-a1`). Windows PC와 dev 서버 둘 다 `~/.ssh/config`에
  `Host somangpay` 별칭을 등록해 둬서 `ssh somangpay`로 바로 붙는다(키 `~/.ssh/somangpay-new`, 원본은
  dev 서버에도 있음). **Windows Git Bash엔 rsync가 없어** `deploy.sh`가 그대로는 안 돈다 - 2026-10-23엔
  같은 단계를 로컬→서버 전송만 `tar -czf - ... | ssh somangpay 'tar -xzf - -C ...'`로 바꿔 수동 실행했다
  (deploy.sh의 rsync도 `--delete` 없이 덮어쓰기라 결과 동일, 서버 쪽 명령은 원본 그대로).
- `deploy.sh`는 `~/.ssh/somangpay-new`로 실서버에 SSH/rsync하는 스크립트다. 실제
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

### 6. dev 전용 서버 (PWA/HTTPS 테스트용)

로컬 PC를 cloudflare 퀵터널로 노출하던 방식(URL이 `cloudflared` 재시작마다 바뀜, 홈
네트워크 포트포워딩 필요)을 버리고, **운영과 별도의 OCI 인스턴스**로 옮겼다
(2026-09-07).

- 인스턴스: `129.225.168.253`, `ssh -i ~/.ssh/somangpay-dev-oci ubuntu@...`. hostname
  `dev-somangpay`, 리전 `ap-osaka-1`(오사카, AD `UJmr:AP-OSAKA-1-AD-1`) - 인스턴스
  메타데이터로 확인함(2026-09-24). `VM.Standard.A1.Flex`, 2 OCPU/12GB, Ubuntu
  24.04는 운영(`somangpay-a1`)과 동일 조건이나, **리전 자체는 운영과 다르다**(운영은
  `ap-chuncheon-1`) - 예전엔 동일 리전으로 적혀 있었는데 오기였다. OCI Always Free
  A1 한도가 리전별인지 테넌시 홈 리전 기준인지는 이 정정에서 다시 확인 안 했으니,
  "운영과 한도를 같이 채워서 둘 다 무료"라는 이전 설명은 그대로 믿지 말 것.
- 도메인: `dev-somangpay.duckdns.org` - duckdns에만 등록, DDNS 자동갱신 스크립트는
  없다. **이 인스턴스를 재생성해서 IP가 바뀌면 duckdns.org에서 수동으로 IP를 다시
  지정해야 한다.**
- 아키텍처는 운영과 동일하게 **호스트 nginx + docker(db/backend만)** 조합이다 -
  `docker-compose.yml`의 `frontend`/`cloudflared` 서비스는 로컬 개발용이고 이 dev
  서버에서도 운영처럼 안 쓴다. 정적 프론트는 `/var/www/somangpay-dev`에 두고
  `/etc/nginx/sites-available/somangpay-dev`가 `/api`, `/ws`를 `127.0.0.1:8000`(docker
  backend)으로 프록시한다.
- 인증서는 운영과 동일하게 **certbot(snap, `--nginx`, HTTP-01)**로 발급 - dev도 80을
  열어뒀기 때문에 가능. 갱신은 `snap.certbot.renew.timer`가 자동으로 돈다.
- 방화벽(iptables + OCI 보안목록)은 **22/80/443만** 열려 있다. 운영은 8000(백엔드
  직결)도 열려 있는데(아마 설정 실수, 안 고침) dev는 의도적으로 막았다 - 백엔드는
  반드시 nginx `/api/` 프록시를 통해서만 접근 가능.
- `~/somangpay/.env`(dev 서버)의 `ADMIN_PIN`/`ADMIN_SECRET_KEY`/`VAPID_*`는 운영과
  **다른 값**으로 새로 생성해뒀다 - 세션/구독이 운영과 안 섞인다.
- `CHURCH_BANK_NAME`/`CHURCH_ACCOUNT_NUMBER`/`CHURCH_ACCOUNT_HOLDER`는 운영 실계좌
  대신 **더미값**(`테스트은행(dev)` 등)이다 - 테스트 서버 화면에 교회 실계좌가
  노출되지 않게. `docker-compose.yml`의 `${VAR}` 치환은 `.env`에 키가 아예 없으면
  **빈 문자열**로 들어가버려서(코드의 `os.getenv(..., 기본값)` 폴백이 안 먹음)
  반드시 더미값을 명시적으로 채워야 한다 - 비워두면 화면에 계좌 정보가 통째로 안
  보인다.
- `frontend/app-env.js`는 운영과 반대로 `'development'`를 **유지**한다 - DEV
  리본이 계속 보여야 운영과 착각하지 않는다. 반영은 `./deploy-dev.sh
  [all|frontend|backend]`로 (`deploy.sh`와 동일한 인터페이스, 대상 서버/도메인만
  다르고 `deploy_frontend`가 `app-env.js`를 `production`으로 덮어쓰지 않는 점만 다름).
- `android_kiosk/app/build.gradle`의 `devTargetHost` 기본값이 이 도메인을 가리키게
  바꿔뒀다 - 이제 debug APK 빌드 시 `-PdevTargetHost=` 오버라이드 없이 그냥
  `./gradlew assembleKioskDebug` 하면 됨.
- **이 저장소가 dev 인스턴스 자체에 체크아웃돼 있는 경우**(`hostname`이 `dev-somangpay`)엔
  `deploy-dev.sh`가 자기 자신에게 SSH하려다 실패한다(`~/.ssh/somangpay-dev-oci` 키가 이
  머신엔 없음, 스크립트 실행 권한도 없음). 그땐 스크립트의 `deploy_frontend` 원격 명령을
  로컬에서 그대로 돌린다: `sudo rsync -a --delete frontend/ /var/www/somangpay-dev/
  --exclude Dockerfile --exclude nginx.conf --exclude package.json` → chown/chmod →
  `app-env.js`를 `development`로 다시 쓰기(2026-10-15 확인).
- **SQLAlchemy 2.1 함정**(2026-10-15): `requirements.txt`가 `sqlalchemy>=2.0.0`로 상한 없이
  열려 있어서 백엔드 이미지를 새로 빌드하면 2.1.x가 깔리는데, 2.1부터 `postgresql://` URL의
  기본 드라이버가 psycopg2 → psycopg(v3)로 바뀌어 `ModuleNotFoundError: No module named
  'psycopg'`로 기동 실패한다(dev에서 재빌드하다 발견). `<2.1` 상한을 걸어 해결 - 올리려면
  `psycopg[binary]`를 추가하거나 URL을 `postgresql+psycopg2://`로 명시할 것. 운영
  (`deploy.sh backend`)도 이 상한이 들어간 뒤에 재빌드해야 안 죽는다 - 2026-10-22 운영 재빌드에서
  2.0.55로 정상 기동 확인.
- 참고로 이 작업 중 **운영 서버에 인증서 자동 갱신이 아예 안 걸려 있던 것**을
  발견해서 같이 고쳤다(2026-09-06) - `certbot`이 발급 당시엔 있었는데 이후 지워져서
  crontab/systemd timer/바이너리가 전부 없었다. snap certbot 재설치로
  `snap.certbot.renew.timer` 활성화, `certbot renew --dry-run` 성공 확인함
  (기존 인증서/`renewal` 설정은 그대로 이어받아서 재발급 없이 해결).

### 7. 회원 앱(user.html) 홈 - 잔액 카드 두 상태 (2026-10-15, #home-b)

- 홈은 잔액 카드(`#user-card-box`) + 이번 달 요약 + 최근 이용 3건. 충전 대기(PENDING 입금)가
  있으면 별도 카드를 띄우지 않고 **잔액 카드 자체**에 `.has-pending`을 걸어 초록 안내 +
  "충전하기"(위) / 남색 잔액 띠(아래)로 바꾼다(`user.js renderPendingDepositCard`). 홈 탭 초록
  점, QR 결제 화면 안내 한 줄도 같은 함수가 갱신한다.
- 카드 높이는 평소/대기/확인 세 상태 모두 `height: 11.5rem` 고정(사용자 요청 - 상태가 바뀌어도
  아래 목록이 안 밀리게). 대기 카드에 내용을 더 넣으려면 이 높이 안에 들어가는지 먼저 확인.
- 충전 확정은 **회원이 직접 누르는 수동 2단계 유지**가 사용자 결정이다(자동 확정 안 함). 대기
  건이 여러 개면 오래된 것부터 한 건씩.
- 입금 매칭 시 회원 푸시("입금이 확인됐어요")는 `main.py` 입금 등록 처리에 이미 있다 -
  `run_in_threadpool(send_push_to_user, ...)`처럼 함수 참조로 넘기는 호출이라
  `send_push_to_user(`로 grep하면 안 잡힌다.
- **함정**: `style.css`의 전역 button 규칙이 `white-space: nowrap !important`라 버튼 안 긴
  문구는 버튼에서 못 푼다. 안쪽 `<span>`에 `white-space: normal`을 명시해서 줄바꿈시킨다.
- 나머지 탭도 같은 원칙으로 정리(#pages-b): 충전 = 계좌번호 크게 + "계좌번호 복사" 버튼 +
  입금자명 독립 카드 + 한 줄짜리 3단계, QR 결제 = 카드 위에 붙이고 QR을 카드 가로폭에 꽉
  채움 + 아래 "결제 가능 잔액", 충전 대기 안내는 두 줄(안내/행동), 내 정보("마이 프로필"에서
  개명) = 이름+연락처 헤더, 목록 행, 비밀번호 입력칸은 행을 눌러야 펼침. 푸시/앱 버전 행은
  조건이 안 맞으면 JS가 행 단위로 숨기므로 보일 땐 인라인 display를 `""`로 비워야 한다
  (`"block"`이면 flex 행이 깨짐).
- 로그인 화면(#login-b): 오류는 알림 모달이 아니라 입력칸 아래 `#login-error` 한 줄
  (`showLoginError`/`clearLoginError`), 비밀번호 "보기" 토글, 로그인 버튼은 `--user-card-bg`
  남색. `.ig-login*`는 user.html 전용이라 instagram-theme.css에 있어도 다른 화면 영향 없음.
- 회원 앱 라이트 모드 본문 글자는 `#262626`(거의 검정) 대신 회색 섞인 차콜 `#383a45`
  (사용자 피드백 "너무 검은색"). `<body class="page-user">` 스코프로 `--text-main`만 덮어써서
  관리자/키오스크는 그대로(instagram-theme.css의 `body.page-user` 블록).
- UI 액센트 연보라(`--accent-cyan`)를 남색으로 바꿀지는 아직 결정 전(회원 앱만 먼저 → 관리자
  → 키오스크는 보류 쪽으로 검토안 제시). 이번 홈 변경은 회원 앱 전용 클래스와 새 토큰
  (`--user-pending-bg`/`--user-pending-ink`, instagram-theme.css `:root`)만 써서 다른 화면에
  영향 없음.
- 관리자 앱(admin.html)에도 같은 원칙 적용(2026-10-22, #admin-b): `<body class="page-admin">`로
  차콜 글자색 공유, 홈 = 회원 앱과 같은 잔액 카드 컴포넌트(`.user-card-widget` 재사용, 11.5rem 고정,
  "회원 N명의 보유 잔액") + 오늘/이번 달
  표(토글 없앰, `.admin-period-summary`) + 최근 입금 3건(`renderHomeRecentDeposits`, 평범한
  "완료" 배지는 뺌), 회원 목록/상세는 "일반"/"활성" 같은 기본값 배지를 숨기고 연락처를
  `formatPhoneDisplay`로 하이픈 표시, 회원 상세 잔액은 남색 카드 + 아래 충전/차감 버튼, PIN
  오류는 모달 대신 `#admin-pin-error` 한 줄, 인증 버튼은 남색(`.admin-pin-submit`). 처리 대기
  (대기+오류)는 별도 빨간 배너를 없애고 회원 앱 충전 대기처럼 **카드 자체를 대기 상태**로
  바꿔 위쪽에 "처리 대기 N건" + [충전함에서 처리하기], 아래 남색 띠에 총 보유 잔액/회원수를
  둔다(사용자 요청 "충전 처리랑 똑같이", `renderDashboard`). 색만 회원 앱 초록 대신 주황
  `--admin-pending-bg #c2410c`(사용자 요청). `buildDepositEvents(filter)`는
  인자를 안 주면 충전함 필터를 따른다.

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
- **WS 핸들러는 DB 세션을 소켓 수명 동안 쥐고 있으면 안 된다(2026-10-23 운영 장애)**: `ws_admin`/
  `ws_user`가 `Depends(get_db)`로 회원을 조회한 뒤 세션을 그대로 들고 있어서 "idle in transaction"으로
  `users` 읽기 잠금이 소켓 내내 남았다. 배포 때 먼저 뜬 워커에 관리자 태블릿이 재접속한 상태에서 늦게
  뜬 워커의 마이그레이션 `ALTER TABLE users ADD COLUMN IF NOT EXISTS`(컬럼이 있어도 ACCESS EXCLUSIVE를
  잡는다)가 그 뒤에서 기다렸고, 그 뒤로 **모든 `users` 조회가 줄을 서서 로그인/결제가 12분간 멈췄다**.
  `pg_terminate_backend`로 그 세션을 끊어 복구. 재발 방지: 두 핸들러가 인증 직후 `db.close()`,
  `_run_migration_step`은 postgres에서 `SET LOCAL lock_timeout = '3s'`(못 잡으면 그 단계만 건너뜀).
  진단: `docker exec somangpay-db psql ... -c "select pid,state,wait_event_type,now()-xact_start,
  left(query,90) from pg_stat_activity ..."`에서 `idle in transaction` + 뒤에 줄 선 `Lock relation`을 본다.

## 문자(SMS) 발송 대기열 (2026-10-22, #sms-outbox)

- 문자를 실제로 보낼 수 있는 건 **관리자 APK(안드로이드 SmsManager)뿐**이다. 웹/PWA 관리자 화면과
  백엔드는 DB 대기열(`sms_outbox` 테이블)에 넣기만 하고, 설정 탭에서 **"이 기기에서 문자 발송"을
  켠 관리자 APK**가 가져가 그 폰의 번호/요금제로 보낸다. 기본값은 꺼짐(켤 때 `SEND_SMS` 런타임 권한
  요청) - 관리자 APK가 여러 대여도 켠 기기만 참여한다.
- 백엔드에서 자동 발송을 붙일 땐 `app/services/sms_outbox.enqueue_sms(db, phone, body, source="system",
  user_id=...)` 한 줄. API: `POST /api/admin/sms`(user_id 또는 to_phone), `GET /api/admin/sms`,
  `GET /api/admin/sms/senders`, `POST /api/admin/sms/{id}/cancel|retry`, APK 전용
  `POST /api/admin/sms/claim`, `POST /api/admin/sms/{id}/result`.
- 흐름: QUEUED → (APK claim, `FOR UPDATE SKIP LOCKED`로 한 건은 한 기기만) SENDING → SENT/FAILED.
  결과 보고 없이 10분 넘게 SENDING이면 다음 claim 때 QUEUED로 되돌림(3회 넘으면 FAILED), 24시간
  아무 기기도 안 가져간 QUEUED는 만료(FAILED). 재시도는 새 행으로 다시 넣는다.
- APK(`SmsOutboxSender.java`)는 `AdminAlertService`(상시 포그라운드 서비스)가 20초마다 폴링하고,
  `notify_admins(["sms"])` 갱신 신호를 받으면 즉시 가져간다(WS가 워커 로컬이라 폴링이 기본).
  폴링이 곧 하트비트라 `sms_sender_devices.last_seen_at` 90초 이내면 "연결됨"으로 표시된다.
- 안드로이드는 짧은 시간에 많이 보내면(기본 30분 30건 안팎, 기기별 차이) 기기에 확인 팝업을 띄우고,
  통신사도 하루 발송량/스팸 제한이 있다 - 대량 단체문자 용도가 아니다.
- 이 서버(aarch64)엔 Android SDK가 없어 APK 빌드는 CI에서만 된다. 네이티브 코드 컴파일 확인은
  android.jar(platform-35) + okhttp/zxing/androidx 클래스 jar를 classpath로 `javac`만 돌려서 했다
  (BuildConfig/R은 스텁) - aapt/lint는 못 돌리니 CI 결과를 꼭 확인할 것.

### 문자를 쓰는 기능

- **첫 로그인 문자 인증(#activation)**: `users.password_set`이 False인 회원(직접 비밀번호를 정한 적
  없음 - 컬럼 추가 시점에 기본 1234가 아닌 회원만 True로 이전)은 로그인하면 403
  `{"code":"activation_required"}` → 회원 앱이 `/api/users/activation/request|status|verify|complete`
  로 6자리 인증번호(문자) → 비밀번호 설정(재확인) → 활성 + 자동 로그인. 유효시간 1분은 **문자가
  실제로 발송된 시각(sms.sent_at)부터** 잰다(APK 폴링 지연 보정). 1분 안 재요청은 같은 번호 재사용,
  하루 10번, 번호당 5번 틀리면 재발급. **켜진 발송 기기가 없으면 503으로 인증 자체를 못 하므로**
  운영에 발송 기기(관리자 APK) 하나는 항상 켜 둬야 미가입 회원이 로그인할 수 있다. 카드/키오스크
  결제는 `password_set`과 무관(`status`만 봄). 관리자 화면 발송 목록에선 인증번호를 가린다.
- **미완료 충전 안내(#deposit-reminder)**: 회원에게 매칭된 PENDING 입금이 24시간 넘게 확정 안 되면
  문자 1회(`bank_transactions.reminder_sent_at`, 7일 넘은 건은 제외). 기동 시 뜨는 루프가 10분마다
  `services/deposit_reminder.send_due_reminders` - 워커 4개가 같이 돌아도 조건부 UPDATE로 한 번만.
  문자 링크: 충전 `PUBLIC_BASE_URL/user`(설치된 PWA가 있으면 그 앱으로 열림), 본인 아님
  `/user?deny=<입금id>-<회원id>-<서명>` → 회원 앱 모달 → `POST /api/deposits/deny/<토큰>`이
  입금을 ERROR(매칭 해제, 메모 "회원이 본인 입금 아님으로 알림")로 돌리고 관리자에게 알림.
  `PUBLIC_BASE_URL`은 docker-compose 기본값이 운영 도메인, dev 서버 `.env`엔 dev 도메인을 넣어 뒀다.
  **활성(`status=ACTIVE`)이면서 가입한(`password_set`) 회원에게만** 보낸다(#inactive).

## 회원 상태: 활성 / 비활성 / 정지 (2026-10-22, #inactive)

- `users.status`는 `ACTIVE` / `INACTIVE` / `SUSPENDED`. **비활성(INACTIVE)**은 아직 서비스를 열어주지
  않은 회원(교적 명단으로 일괄 등록한 사람 등) - 회원 목록엔 회색 "비활성" 배지로 그대로 보이고,
  회원 상세 **이름 오른쪽 스위치**로 활성/비활성을 바꾼다. **정지(SUSPENDED)**는 분실 등으로 막은
  회원이라 목록에서 숨기고(개발자 메뉴의 정지 목록), 정보수정 모달의 "계정 정지/정지 해제"로만 바꾼다.
- 차단 쪽 코드는 전부 `status == "ACTIVE"`를 본다 - 그래서 비활성/정지는 똑같이 **로그인, 첫 로그인
  인증 문자, 결제(`/api/payments/pay`), 입금 자동 매칭(→ ERROR + 메모 "비활성 회원(이름) 입금 - 활성화
  후 처리"), 관리자 직권 충전/입금 지정, 모든 문자 발송**이 막힌다. 문자는 `enqueue_sms`가 받는 사람
  (user_id 또는 그 번호의 회원)을 검사하고, APK claim 때 한 번 더 걸러 대기 중 비활성으로 바뀐 건은
  FAILED로 버린다. 새 차단 경로를 만들 땐 `!= "SUSPENDED"`가 아니라 `== "ACTIVE"`로 검사할 것.
- **비활성 회원 입금 = `bank_transactions.status='INACTIVE'`**: 입금자명이 비활성 회원과 같으면
  오류(ERROR)가 아니라 INACTIVE로 매칭(matched_user_id는 채움)하고 **아무것도 안 한다** - 충전/관리자
  알림/안내 문자/회원 앱 내역 전부 없음, 상세 모달은 읽기 전용. 그 회원이 시스템을 안 쓰던 때 현장에서
  바로 쓴 입금이라 **나중에 활성화해도 되살리지 않는다**(사용자 결정). `deposit_matcher.park_inactive_deposits`
  가 미처리(PENDING/ERROR) 건을 INACTIVE로 옮기는데, 백엔드 기동 때(전체), 회원을 비활성으로 바꿀 때
  (그 회원), 명단 일괄 등록 때 돈다 - "본인 입금 아님"으로 돌아온 ERROR는 제외. 정지 회원 입금은 ERROR.
- **입금자명 매칭 규칙**(`deposit_matcher.find_depositor_match`/`name_matches`, admin.js
  `bestDepositCandidate`도 같은 기준): 회원 이름이 입금자명과 같거나 **입금자명 + 동명이인 꼬리 한 글자
  (A~Z)**인 회원이 상태와 상관없이 **딱 한 명**이면 그 회원(활성=PENDING, 비활성=INACTIVE, 정지=ERROR).
  홍길동과 홍길동B가 같이 있으면 ERROR로 두고 관리자가 지정한다. 숫자 꼬리(홍길동1)는 규칙 밖.
- **충전함**: 모든 필터가 시간순(최신 먼저) + KST 날짜 머리말(오늘/어제/날짜)로 묶음. 필터는
  전체/대기/오류/완료(CREDITED+CREDITED_MANUAL)/비활성, 기타(OTHER)는 전체에서만 보인다.
  입금 상세 모달(대기/오류만 처리 가능)은 하단 고정 줄에 처리 버튼 하나 + 닫기 - 회원이 선택돼 있으면
  "충전 처리", 아니면 "기타 처리". 메모 칸이 기타 처리 사유를 겸하고, 관리자가 안 건드렸으면 기본값이
  선택 상태를 따라간다("확인 후 처리" / "잘못된 입금"). 선택된 회원을 다시 누르면 해제.
- **나이/시니어**: 나이는 저장하지 않고 `users.birth_year`(= 등록한 해 - 그때 나이)로 두고 응답의
  `age`(computed)로 계산한다(`services/member_age.py`, 생년월일이 있으면 그쪽 우선). 시니어 기준은
  **70세 이상**(`SENIOR_AGE`) - 등록/수정 모달에서 생년월일·나이를 입력하면 구분을 자동으로 맞춰주지만,
  가격 계산은 여전히 저장된 `user_type`을 본다(해가 바뀌어 70세가 돼도 자동으로 바뀌지는 않음).
- 직분/소속은 `users.church_position` / `church_group`(참고용), 프로필 사진은 `user_photos` 테이블
  (목록 조회를 가볍게 하려고 분리) + `users.photo_updated_at`(NULL이면 사진 없음). 사진 API
  `GET /api/admin/users/{id}/photo`는 관리자 토큰이 필요해서 admin.js가 fetch → blob URL로 띄운다.
- **교적 명단 일괄 등록**: `python -m app.tools.import_members <dir> [--apply]`(backend 컨테이너 안,
  `--apply` 없으면 미리보기). `<dir>/members.jsonl` + `photos/`. 새 회원은 INACTIVE + 가입 전 + QR 발급,
  같은 번호 회원이 있으면 비어 있는 참고 정보만 보강(상태는 안 건드림), 같은 이름의 다른 회원은 건너뜀,
  명단 안에서 번호가 겹치면 뒤 사람은 번호 없이(username `noph-<이름>`). 다시 돌려도 안전.
  명단은 실제 교인 개인정보라 **저장소에 넣지 말고** 컨테이너 /tmp에 잠깐 복사해 쓰고 지운다.
  명단 원본은 지저스온 교회요람 > 직분자명단(802명)을 S25 Ultra에서 adb(uiautomator 덤프 + 화면
  캡처 크롭)로 긁어 왔다(2026-10-22, 기본 아바타 27장은 사진 없음으로 처리).

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
- `DEV_TARGET_URL`의 기본 호스트는 build.gradle의 `devTargetHost`에 박혀 있고, 지금은
  dev 전용 OCI 서버(`https://dev-somangpay.duckdns.org`, 위 6번)를 가리킨다 - 예전
  cloudflare 퀵터널처럼 재시작마다 바뀌지 않는다. 다른 서버로 붙여야 하면 파일 수정 없이
  `./gradlew assembleKioskDebug -PdevTargetHost=https://<다른-주소>`로 덮어쓴다.
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
