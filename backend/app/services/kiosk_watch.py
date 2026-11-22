"""키오스크 연결 끊김/복구 알림(2026-11-22).

온라인 판정은 main.py와 같은 kiosk_devices.last_seen_at 신선도(포그라운드일 때 20초마다 갱신, 백그라운드로
가면 즉시 만료). 등록 완료(is_active)된 키오스크만 본다.

핑퐁 방지:
1. 끊긴 지 OFFLINE_ALERT_AFTER_SECONDS(5분)가 지나야 "끊김"으로 본다 - 와이파이 순단, 앱 재시작,
   잠깐 백그라운드는 아예 안 울린다.
2. "다시 연결됨"은 "끊김"을 실제로 보낸 경우에만 보낸다(짝 맞추기).
3. 키오스크마다 마지막 알림 뒤 COOLDOWN_SECONDS(30분) 안에는 새 "끊김"을 보내지 않고 미뤄 둔다(pending).
   그 사이 다시 붙으면 조용히 지우고, 쿨다운이 끝났는데도 여전히 끊겨 있으면 그때 보낸다
   → 계속 들락날락하는 기기는 30분에 한 쌍 이하로만 울리고, 진짜로 죽은 기기는 늦어도 30분 안에 알린다.
4. 처음 표시할 때 이미 BACKLOG_SECONDS(1시간) 넘게 조용했던 기기(배포 시점에 이미 꺼져 있던 기기,
   안 쓰는 옛 키오스크)는 알리지 않는다(skipped) - 다시 연결돼도 조용히 지운다.

상태 = kiosk_devices.offline_marked_at(끊김으로 본 시각) + offline_alert('pending'|'sent'|'skipped')
+ status_alerted_at(마지막으로 알린 시각, 쿨다운용). 워커 4개가 같은 루프를 돌리므로 전이는 전부
조건부 UPDATE(rowcount 1인 워커만 알림)로 건다.
"""
import datetime
from typing import Callable, List, Tuple

from sqlalchemy.orm import Session

from app import models

OFFLINE_ALERT_AFTER_SECONDS = 5 * 60
COOLDOWN_SECONDS = 30 * 60
BACKLOG_SECONDS = 60 * 60


def _name(k: models.KioskDevice) -> str:
    return k.device_name or f"키오스크 {k.id}"


def _minutes(seconds: float) -> int:
    return max(1, int(seconds // 60))


def _claim(db: Session, kiosk_id: int, where: dict, values: dict) -> bool:
    q = db.query(models.KioskDevice).filter(models.KioskDevice.id == kiosk_id)
    for col, val in where.items():
        c = getattr(models.KioskDevice, col)
        q = q.filter(c.is_(None) if val is None else c == val)
    n = q.update(values, synchronize_session=False)
    db.commit()
    return n == 1


def check(db: Session, is_online: Callable[[object], bool]) -> List[Tuple[str, str, int]]:
    """알릴 (제목, 내용, 키오스크 id) 목록."""
    now = datetime.datetime.utcnow()
    events: List[Tuple[str, str, int]] = []
    kiosks = db.query(models.KioskDevice).filter(models.KioskDevice.is_active == True).all()  # noqa: E712
    for k in kiosks:
        # _claim의 commit이 k를 만료시켜 다시 읽으면 바뀐 값이 나오므로 필요한 값은 먼저 꺼내 둔다.
        name, kid, marked, alert, alerted_at = _name(k), k.id, k.offline_marked_at, k.offline_alert, k.status_alerted_at
        online = is_online(k.last_seen_at)
        silent = (now - k.last_seen_at).total_seconds() if k.last_seen_at else None

        if marked is None:
            if online or (silent is not None and silent <= OFFLINE_ALERT_AFTER_SECONDS):
                continue
            state = "skipped" if (silent is None or silent > BACKLOG_SECONDS) else "pending"
            if not _claim(db, kid, {"offline_marked_at": None}, {"offline_marked_at": now, "offline_alert": state}):
                continue
            marked, alert = now, state
            # pending이면 아래에서 쿨다운을 보고 바로 보낼지 정한다.

        if online:
            if _claim(db, kid, {"offline_marked_at": marked},
                      {"offline_marked_at": None, "offline_alert": None,
                       **({"status_alerted_at": now} if alert == "sent" else {})}):
                if alert == "sent":
                    down = (now - marked).total_seconds() + OFFLINE_ALERT_AFTER_SECONDS
                    events.append(("키오스크 다시 연결됨",
                                   f"{name}이(가) 다시 연결됐어요(약 {_minutes(down)}분 끊김).", kid))
            continue

        if alert == "pending":
            if alerted_at and (now - alerted_at).total_seconds() < COOLDOWN_SECONDS:
                continue
            if _claim(db, kid, {"offline_marked_at": marked, "offline_alert": "pending"},
                      {"offline_alert": "sent", "status_alerted_at": now}):
                mins = _minutes(silent) if silent is not None else None
                events.append(("키오스크 연결 끊김",
                               f"{name}이(가) {mins}분째 연결되지 않아요. 전원·인터넷과 키오스크 화면이 켜져 있는지 확인해 주세요.",
                               kid))
    return events
