"""문자 발송 기기 끊김 알림(2026-11-21).

문자는 "이 기기에서 문자 발송"을 켠 관리자 APK만 보낼 수 있는데(services/sms_outbox.py), 그 기기가 꺼지거나
절전에 걸려도 아무도 몰라서 인증 문자가 안 나간 채로 하루가 지나간 적이 있다. 그래서 발송 기기가
OFFLINE_ALERT_AFTER_SECONDS 넘게 폴링(하트비트)하지 않으면 관리자 전원에게 한 번 알리고, 다시 연결되면
"다시 연결됨"을 한 번 알린다. 끊길 때마다 한 번씩만 - sms_sender_devices.offline_alerted_at으로 표시한다.

워커 4개가 같은 루프를 돌리므로 표시는 조건부 UPDATE(rowcount 1인 워커만 알림)로 건다.
발송을 일부러 끈 기기는 관리자 화면이 목록에서 지운다(DELETE /api/admin/sms/senders/{id}) - 지운 기기는
알림 대상이 아니다.
"""
import datetime
from typing import List, Tuple

from sqlalchemy.orm import Session

from app import models
from app.services import sms_outbox

CHECK_INTERVAL_SECONDS = 60
# 폴링은 20초마다, "연결됨" 판정은 90초. 와이파이가 잠깐 끊기는 정도로는 울리지 않게 5분.
OFFLINE_ALERT_AFTER_SECONDS = 5 * 60


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _name(dev: models.SmsSenderDevice) -> str:
    return dev.device_name or "관리자 앱"


def check(db: Session) -> List[Tuple[str, str]]:
    """알릴 (제목, 내용) 목록을 돌려준다. 표시는 여기서 커밋한다."""
    now = _now()
    devices = db.query(models.SmsSenderDevice).all()
    events: List[Tuple[str, str]] = []
    for dev in devices:
        others_online = [d for d in devices if d.device_id != dev.device_id and sms_outbox.sender_is_online(d)]
        silent_for = (now - dev.last_seen_at).total_seconds() if dev.last_seen_at else None
        if (silent_for is None or silent_for > OFFLINE_ALERT_AFTER_SECONDS) and dev.offline_alerted_at is None:
            claimed = db.query(models.SmsSenderDevice).filter(
                models.SmsSenderDevice.device_id == dev.device_id,
                models.SmsSenderDevice.offline_alerted_at.is_(None),
            ).update({"offline_alerted_at": now}, synchronize_session=False)
            db.commit()
            if claimed:
                body = f"{_name(dev)}이(가) 연결되지 않아요."
                if others_online:
                    body += f" 다른 발송 기기({', '.join(_name(d) for d in others_online)})로 계속 보내요."
                else:
                    body += " 지금은 인증 문자 등이 나가지 않아요. 기기 전원·인터넷과 관리자 앱을 확인해 주세요."
                events.append(("문자 발송 기기 연결 끊김", body))
        elif dev.offline_alerted_at is not None and sms_outbox.sender_is_online(dev):
            claimed = db.query(models.SmsSenderDevice).filter(
                models.SmsSenderDevice.device_id == dev.device_id,
                models.SmsSenderDevice.offline_alerted_at.isnot(None),
            ).update({"offline_alerted_at": None}, synchronize_session=False)
            db.commit()
            if claimed:
                events.append(("문자 발송 기기 다시 연결됨", f"{_name(dev)}이(가) 다시 연결돼 문자를 보낼 수 있어요."))
    return events
