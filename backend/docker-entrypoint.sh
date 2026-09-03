#!/bin/sh
# Docker Desktop(Windows/WSL2)에서 부팅 직후 backend 컨테이너가 bind mount
# (./backend:/app)보다 먼저 뜨면 /app/app/main.py 가 아직 안 보여서 uvicorn 이
# "ModuleNotFoundError: No module named 'app'" 로 죽는다. restart: always 로도
# 복구가 느려 결국 수동 재시작하게 되므로, 마운트가 채워질 때까지 최대
# APP_MOUNT_WAIT 초(기본 60) 기다렸다가 실행한다.
#
# 이 스크립트는 이미지 레이어의 /usr/local/bin 에 있어 ./backend:/app 마운트에
# 가려지지 않는다(=/app 이 비어 있어도 스스로는 항상 존재).
# 리눅스 실서버에선 파일이 즉시 보이므로 첫 검사에서 통과 -> 무영향.
set -e

APP_MODULE_FILE="/app/app/main.py"
WAIT_SECONDS="${APP_MOUNT_WAIT:-60}"

i=0
while [ ! -f "$APP_MODULE_FILE" ]; do
    i=$((i + 1))
    if [ "$i" -gt "$WAIT_SECONDS" ]; then
        echo "[entrypoint] $APP_MODULE_FILE 가 ${WAIT_SECONDS}s 안에 안 나타남 - 그대로 진행" >&2
        break
    fi
    [ "$i" = 1 ] && echo "[entrypoint] bind mount 준비 대기 중 ($APP_MODULE_FILE)..." >&2
    sleep 1
done

exec "$@"
