// 이 저장소의 frontend/ 는 개발 docker(volume 마운트)가 그대로 서빙하므로 커밋 상태는 항상 개발이다.
// 운영 서버에서는 deploy.sh 의 deploy_frontend() 가 이 파일을 production 으로 덮어쓴다.
// env-badge.js 가 이 값을 읽어 개발 환경일 때만 favicon/PWA 아이콘을 디버그 뱃지 버전으로 교체한다.
window.__APP_ENV__ = 'development';
