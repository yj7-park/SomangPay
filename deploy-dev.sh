#!/usr/bin/env bash
# SomangPay dev 배포 스크립트 - 로컬 코드를 dev 전용 OCI 인스턴스로 반영한다.
# deploy.sh(운영)와 거의 동일하지만 대상 서버/도메인이 dev용이고, app-env.js를
# 'production'이 아니라 'development'로 유지해서 DEV 리본이 그대로 보이게 한다.
# 사용법: ./deploy-dev.sh           (백엔드+프론트엔드 전체 배포)
#         ./deploy-dev.sh frontend  (프론트엔드만 배포 - 빠름, 컨테이너 재시작 없음)
#         ./deploy-dev.sh backend   (백엔드만 배포 - 이미지 재빌드 + 컨테이너 재시작)
set -euo pipefail

SSH_KEY="$HOME/.ssh/somangpay-dev-oci"
SERVER="ubuntu@129.225.168.253"
REMOTE_DIR="~/somangpay"
DOMAIN="https://dev-somangpay.duckdns.org"
TARGET="${1:-all}"

ssh_cmd() { ssh -i "$SSH_KEY" "$SERVER" "$@"; }

deploy_backend() {
  echo "==> backend 코드 동기화"
  rsync -az -e "ssh -i $SSH_KEY" \
    --exclude '__pycache__' --exclude '*.pyc' --exclude 'data' --exclude '*.db' \
    backend/ "$SERVER:$REMOTE_DIR/backend/"

  echo "==> docker-compose.yml 동기화"
  scp -i "$SSH_KEY" docker-compose.yml "$SERVER:$REMOTE_DIR/docker-compose.yml"

  echo "==> 이미지 재빌드 및 컨테이너 재시작 (db+backend만 - frontend/cloudflared는 dev 서버에서 안 씀)"
  ssh_cmd "cd $REMOTE_DIR && sudo docker compose build backend && sudo docker compose up -d db backend"
}

deploy_frontend() {
  echo "==> frontend 코드 동기화"
  rsync -az -e "ssh -i $SSH_KEY" \
    frontend/ "$SERVER:$REMOTE_DIR/frontend/"

  echo "==> nginx가 서빙하는 /var/www/somangpay-dev 로 반영"
  ssh_cmd "sudo rsync -a --delete $REMOTE_DIR/frontend/ /var/www/somangpay-dev/ \
    --exclude Dockerfile --exclude nginx.conf --exclude package.json \
    && sudo chown -R www-data:www-data /var/www/somangpay-dev \
    && sudo find /var/www/somangpay-dev -type d -exec chmod 755 {} \; \
    && sudo find /var/www/somangpay-dev -type f -exec chmod 644 {} \;"

  # 운영 deploy.sh는 여기서 app-env.js를 'production'으로 덮어쓰지만, dev 서버는 반대로
  # 'development'로 유지해야 DEV 리본(frontend/src/env-badge.js)이 계속 보인다.
  echo "==> app-env.js 를 development 로 유지"
  ssh_cmd "printf '%s\n' 'window.__APP_ENV__ = \"development\";' | sudo tee /var/www/somangpay-dev/app-env.js >/dev/null \
    && sudo chown www-data:www-data /var/www/somangpay-dev/app-env.js \
    && sudo chmod 644 /var/www/somangpay-dev/app-env.js"
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
