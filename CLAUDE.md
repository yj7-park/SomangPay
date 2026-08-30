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
