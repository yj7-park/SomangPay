import asyncio
import json
import logging
import select
import threading
import time
from collections import defaultdict
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """관리자 소켓 전체와 회원별 소켓(다중 탭 허용)을 관리하는 인메모리 매니저.
    워커(프로세스)마다 따로 있어서 자기 워커에 붙은 소켓만 안다 - 워커 간 전달은 아래
    Postgres LISTEN/NOTIFY 버스(_publish / start_ws_bus)가 맡는다."""

    def __init__(self):
        self.admin_sockets: Set[WebSocket] = set()
        self.user_sockets: Dict[int, Set[WebSocket]] = defaultdict(set)
        self.kiosk_sockets: Dict[str, Set[WebSocket]] = defaultdict(set)

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

    async def connect_kiosk(self, device_uuid: str, ws: WebSocket):
        await ws.accept()
        self.kiosk_sockets[device_uuid].add(ws)

    def disconnect_kiosk(self, device_uuid: str, ws: WebSocket):
        sockets = self.kiosk_sockets.get(device_uuid)
        if not sockets:
            return
        sockets.discard(ws)
        if not sockets:
            del self.kiosk_sockets[device_uuid]

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

    async def send_to_kiosk(self, device_uuid: str, event: dict):
        sockets = self.kiosk_sockets.get(device_uuid)
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

    async def broadcast_kiosks(self, event: dict):
        for device_uuid, sockets in list(self.kiosk_sockets.items()):
            dead = []
            for ws in sockets:
                try:
                    await ws.send_json(event)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                sockets.discard(ws)


manager = ConnectionManager()


# ============ 워커 간 전달 버스 (Postgres LISTEN/NOTIFY, 2026-11-08) ============
# uvicorn이 워커 4개로 떠서 각 워커의 manager는 자기한테 붙은 소켓만 안다. 예전엔 요청을 처리한
# 워커가 자기 소켓에만 보내서, 메뉴 추가/삭제 같은 갱신 신호가 키오스크 4대 중 1대 꼴로만 닿았다
# (dev에서 키오스크 소켓 12개 중 1개만 받는 것 재현). 이제 notify_* 는 pg_notify로 이벤트를 올리고,
# 워커마다 하나씩 도는 리스너 스레드가 받아서 자기 워커의 소켓에 전달한다(보낸 워커 자신도 리스너로
# 받으므로 직접 보내지 않는다 - 중복 방지). Redis 같은 브로커를 따로 띄우지 않으려고 이미 있는
# Postgres를 쓴다. 리스너 연결은 autocommit이라 트랜잭션/잠금을 쥐지 않는다(CLAUDE.md WS 장애 참고).
# Postgres가 아니거나(로컬 sqlite) 이 워커 리스너가 아직 안 붙었으면 자기 워커에 직접 보낸다.
WS_BUS_CHANNEL = "somangpay_ws"
_PG_NOTIFY_MAX_BYTES = 7500  # NOTIFY payload 한도 8000바이트 - 넘으면 로컬 전달만
_bus_loop: Optional[asyncio.AbstractEventLoop] = None
_bus_listening = False


async def _deliver_local(target: str, key, event: dict):
    if target == "admins":
        await manager.broadcast_admins(event)
    elif target == "user":
        await manager.send_to_user(int(key), event)
    elif target == "kiosk":
        await manager.send_to_kiosk(str(key), event)
    elif target == "kiosks":
        await manager.broadcast_kiosks(event)


def _bus_db_url() -> Optional[str]:
    from app.database import DB_URL
    return DB_URL if DB_URL.startswith("postgresql") else None


def _pg_notify(payload: str):
    from sqlalchemy import text
    from app.database import engine
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_notify(:ch, :payload)"), {"ch": WS_BUS_CHANNEL, "payload": payload})
        conn.commit()


async def _publish(target: str, event: dict, key=None):
    payload = json.dumps({"t": target, "k": key, "e": event}, ensure_ascii=False)
    published = False
    if _bus_db_url() and len(payload.encode("utf-8")) <= _PG_NOTIFY_MAX_BYTES:
        try:
            await asyncio.to_thread(_pg_notify, payload)
            published = True
        except Exception as e:
            logger.warning("ws bus publish failed, delivering locally only: %s", e)
    if not published or not _bus_listening:
        await _deliver_local(target, key, event)


def _listen_forever(db_url: str):
    global _bus_listening
    import psycopg2
    import psycopg2.extensions
    while True:
        conn = None
        try:
            conn = psycopg2.connect(db_url)
            conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            with conn.cursor() as cur:
                cur.execute(f"LISTEN {WS_BUS_CHANNEL};")
            _bus_listening = True
            logger.info("ws bus listener connected")
            while True:
                if select.select([conn], [], [], 30) == ([], [], []):
                    with conn.cursor() as cur:  # 30초 조용하면 연결이 살아 있는지 확인
                        cur.execute("SELECT 1")
                    continue
                conn.poll()
                while conn.notifies:
                    note = conn.notifies.pop(0)
                    try:
                        msg = json.loads(note.payload)
                        asyncio.run_coroutine_threadsafe(
                            _deliver_local(msg["t"], msg.get("k"), msg["e"]), _bus_loop)
                    except Exception as e:
                        logger.warning("ws bus bad message: %s", e)
        except Exception as e:
            logger.warning("ws bus listener error, reconnecting in 3s: %s", e)
        finally:
            _bus_listening = False
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
        time.sleep(3)


def start_ws_bus():
    """워커 기동 시(main.py startup) 한 번 - 이 워커의 이벤트 루프를 잡아두고 리스너 스레드를 띄운다."""
    global _bus_loop
    db_url = _bus_db_url()
    if not db_url or _bus_loop is not None:
        return
    _bus_loop = asyncio.get_running_loop()
    threading.Thread(target=_listen_forever, args=(db_url,), name="ws-bus-listener", daemon=True).start()


async def notify_admins(scopes: list):
    """관리자 전원에게 "이 범위들이 바뀌었으니 다시 불러와" 신호만 보낸다.
    실제 데이터는 기존 REST 엔드포인트를 그대로 재호출해서 가져온다."""
    await _publish("admins", {"type": "refresh", "scopes": scopes})


async def notify_admins_alert(title: str, body: str, category: str = None, entity_id: int = None):
    """관리자 전원에게 사람이 읽을 수 있는 알림 문구를 WS로도 보낸다 - send_push_to_admins()
    (Web Push)와 항상 같이 호출된다. 브라우저/PWA의 ws-client.js는 "refresh" 타입만 처리하고
    이 "alert" 타입은 무시하므로 웹 쪽 동작에는 영향이 없다 - 이건 안드로이드 WebView가 Web
    Push를 지원하지 않아 웹푸시를 받을 수 없는 관리자 APK(AdminAlertService)가 대신 구독하는
    경로다(admin.html 상단 주석 참고 - WebView는 PushManager 자체가 없음).
    entity_id는 category별로 가리키는 대상이 다르다 - "payment"는 User.id, "deposit_credited"/
    "deposit_error"는 BankTransaction.id. AdminAlertService가 알림 탭 시 해당 화면으로 바로
    이동시키는 딥링크에 쓰인다(admin.js의 checkNativeNotificationDeepLink 참고)."""
    await _publish("admins", {
        "type": "alert", "title": title, "body": body, "category": category, "entity_id": entity_id,
    })


async def notify_user(user_id: int, scopes: list):
    """특정 회원(연결돼 있는 모든 탭/기기)에게만 갱신 신호를 보낸다."""
    await _publish("user", {"type": "refresh", "scopes": scopes}, key=user_id)


async def notify_kiosk(device_uuid: str, scopes: list):
    """특정 키오스크 1대(연결된 모든 탭)에게만 갱신 신호를 보낸다."""
    await _publish("kiosk", {"type": "refresh", "scopes": scopes}, key=device_uuid)


async def notify_all_kiosks(scopes: list):
    """연결된 모든 키오스크에게 갱신 신호를 보낸다 - 상품 카탈로그처럼 모든 단말에
    공통 영향을 주는 변경용."""
    await _publish("kiosks", {"type": "refresh", "scopes": scopes})
