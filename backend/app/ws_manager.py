from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """관리자 소켓 전체와 회원별 소켓(다중 탭 허용)을 관리하는 인메모리 매니저.
    단일 백엔드 프로세스(현재 docker-compose 구성)를 전제로 하며, 워커가 여러 개로 늘어나면
    Redis pub/sub 같은 별도 브로커가 필요해진다."""

    def __init__(self):
        self.admin_sockets: Set[WebSocket] = set()
        self.user_sockets: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect_admin(self, ws: WebSocket):
        await ws.accept()
        self.admin_sockets.add(ws)

    def disconnect_admin(self, ws: WebSocket):
        self.admin_sockets.discard(ws)

    async def connect_user(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.user_sockets[user_id].add(ws)

    def disconnect_user(self, user_id: int, ws: WebSocket):
        sockets = self.user_sockets.get(user_id)
        if not sockets:
            return
        sockets.discard(ws)
        if not sockets:
            del self.user_sockets[user_id]

    async def broadcast_admins(self, event: dict):
        dead = []
        for ws in self.admin_sockets:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.admin_sockets.discard(ws)

    async def send_to_user(self, user_id: int, event: dict):
        sockets = self.user_sockets.get(user_id)
        if not sockets:
            return
        dead = []
        for ws in sockets:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            sockets.discard(ws)


manager = ConnectionManager()


async def notify_admins(scopes: list):
    """관리자 전원에게 "이 범위들이 바뀌었으니 다시 불러와" 신호만 보낸다.
    실제 데이터는 기존 REST 엔드포인트를 그대로 재호출해서 가져온다."""
    await manager.broadcast_admins({"type": "refresh", "scopes": scopes})


async def notify_user(user_id: int, scopes: list):
    """특정 회원(연결돼 있는 모든 탭/기기)에게만 갱신 신호를 보낸다."""
    await manager.send_to_user(user_id, {"type": "refresh", "scopes": scopes})
