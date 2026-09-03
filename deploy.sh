#!/usr/bin/env bash
# SomangPay 배포 스크립트 - 로컬 코드를 Oracle Cloud VPS로 반영한다.
# 사용법: ./deploy.sh           (백엔드+프론트엔드 전체 배포)
#         ./deploy.sh frontend  (프론트엔드만 배포 - 빠름, 컨테이너 재시작 없음)
#         ./deploy.sh backend   (백엔드만 배포 - 이미지 재빌드 + 컨테이너 재시작)
set -euo pipefail

SSH_KEY="$HOME/.ssh/somangpay-new"
SERVER="ubuntu@168.110.113.17"
REMOTE_DIR="~/somangpay"
DOMAIN="https://somangpay.duckdns.org"
TARGET="${1:-all}"

ssh_cmd() { ssh -i "$SSH_KEY" "$SERVER" "$@"; }

deploy_backend() {
  echo "==> backend 코드 동기화"
  rsync -az -e "ssh -i $SSH_KEY" \
    --exclude '__pycache__' --exclude '*.pyc' --exclude 'data' --exclude '*.db' \
    backend/ "$SERVER:$REMOTE_DIR/backend/"

  echo "==> docker-compose.yml 동기화"
  scp -i "$SSH_KEY" docker-compose.yml "$SERVER:$REMOTE_DIR/docker-compose.yml"

  echo "==> 이미지 재빌드 및 컨테이너 재시작 (몇 분 걸릴 수 있음)"
  ssh_cmd "cd $REMOTE_DIR && sudo docker compose build backend && sudo docker compose up -d db backend"
}

deploy_frontend() {
  echo "==> frontend 코드 동기화"
  rsync -az -e "ssh -i $SSH_KEY" \
    frontend/ "$SERVER:$REMOTE_DIR/frontend/"

  echo "==> nginx가 서빙하는 /var/www/somangpay 로 반영"
  ssh_cmd "sudo rsync -a --delete $REMOTE_DIR/frontend/ /var/www/somangpay/ \
    --exclude Dockerfile --exclude nginx.conf --exclude package.json \
    && sudo chown -R www-data:www-data /var/www/somangpay \
    && sudo find /var/www/somangpay -type d -exec chmod 755 {} \; \
    && sudo find /var/www/somangpay -type f -exec chmod 644 {} \;"

  # 개발/운영 판별용 플래그. 저장소에 커밋된 app-env.js 는 항상 development 라서
  # (개발 docker 가 frontend/ 를 그대로 서빙) 운영 서버에서는 여기서 production 으로 덮어쓴다.
  # 이 파일이 development 로 남으면 운영 사이트 아이콘에 디버그 뱃지가 뜬다(frontend/src/env-badge.js).
  echo "==> app-env.js 를 production 으로 표시"
  ssh_cmd "printf '%s\n' 'window.__APP_ENV__ = \"production\";' | sudo tee /var/www/somangpay/app-env.js >/dev/null \
    && sudo chown www-data:www-data /var/www/somangpay/app-env.js \
    && sudo chmod 644 /var/www/somangpay/app-env.js"
}

case "$TARGET" in
  backend) deploy_backend ;;
  frontend) deploy_frontend ;;
  all) deploy_backend; deploy_frontend ;;
  *) echo "usage: $0 [all|backend|frontend]"; exit 1 ;;
esac

echo "==> 헬스체크"
sleep 2
curl -s -o /dev/null -w "  site: %{http_code}\n" "$DOMAIN/"
curl -s -o /dev/null -w "  api : %{http_code}\n" "$DOMAIN/api/products"
echo "배포 완료: $DOMAIN"
