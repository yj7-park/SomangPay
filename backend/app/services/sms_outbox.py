"""문자(SMS) 발송 대기열 - models.SmsOutbox 참고.

발송 주체는 관리자 APK(안드로이드 SmsManager)뿐이라, 웹/PWA/백엔드는 enqueue_sms로 행을 넣기만
하고 APK가 claim_messages로 가져가 보낸 뒤 report_result로 결과를 남긴다. 발송 기기가 여러 대여도
claim은 행 잠금(FOR UPDATE SKIP LOCKED)으로 한 건을 한 기기만 가져가므로 같은 문자가 두 번 나가지
않는다.

백엔드 코드에서 자동 발송을 붙일 땐:
    from app.services.sms_outbox import enqueue_sms
    enqueue_sms(db, user.phone, "본문", source="system", user_id=user.id)
(커밋까지 한다. APK는 20초마다 폴링하므로 최대 그만큼 늦게 나갈 수 있다.)
"""
import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models
from app.phone_utils import normalize_phone

# APK가 가져간 뒤(SENDING) 이 시간 안에 결과 보고가 없으면 기기가 죽은 것으로 보고 되돌린다.
# APK는 한 번에 최대 5건을 가져가고 건마다 통신사 결과를 최대 60초 기다리므로 그보다 넉넉하게.
SMS_CLAIM_STALE_SECONDS = 600
# 이 횟수만큼 가져갔는데도 결과가 없으면 더 이상 재시도하지 않고 FAILED.
SMS_MAX_ATTEMPTS = 3
# 발송 기기가 하루 넘게 안 가져간 문자는 뒤늦게 나가면 오히려 혼란스러워 만료(FAILED) 처리.
SMS_QUEUE_EXPIRE_HOURS = 24
# 발송 기기 "온라인" 판정 - APK 폴링 주기(20초)의 몇 배.
SMS_SENDER_ONLINE_TTL_SECONDS = 90
SMS_BODY_MAX_LEN = 1000


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def validate_phone(raw: str) -> str:
    phone = normalize_phone(raw or "")
    if not phone or not (9 <= len(phone) <= 12) or not phone.startswith("0"):
        raise ValueError("받는 번호가 올바르지 않습니다.")
    return phone


def enqueue_sms(
    db: Session,
    to_phone: str,
    body: str,
    source: str = "system",
    user_id: Optional[int] = None,
    admin_id: Optional[int] = None,
    commit: bool = True,
) -> models.SmsOutbox:
    """발송 대기열에 문자 한 건을 넣는다. 번호/본문이 잘못됐으면 ValueError."""
    phone = validate_phone(to_phone)
    text = (body or "").strip()
    if not text:
        raise ValueError("보낼 내용을 입력하세요.")
    if len(text) > SMS_BODY_MAX_LEN:
        raise ValueError(f"내용은 {SMS_BODY_MAX_LEN}자 이내로 입력하세요.")

    row = models.SmsOutbox(
        to_phone=phone,
        body=text,
        status="QUEUED",
        source=source,
        user_id=user_id,
        requested_by_admin_id=admin_id,
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    return row


def _housekeep(db: Session) -> None:
    """멈춘 SENDING은 되돌리거나 실패 처리, 너무 오래된 QUEUED는 만료."""
    now = _now()
    stale_before = now - datetime.timedelta(seconds=SMS_CLAIM_STALE_SECONDS)
    stale = db.query(models.SmsOutbox).filter(
        models.SmsOutbox.status == "SENDING",
        models.SmsOutbox.claimed_at < stale_before,
    ).all()
    for row in stale:
        if row.attempts >= SMS_MAX_ATTEMPTS:
            row.status = "FAILED"
            row.error = "발송 기기에서 결과 보고가 없어 중단함"
        else:
            row.status = "QUEUED"
            row.sender_device_id = None

    expire_before = now - datetime.timedelta(hours=SMS_QUEUE_EXPIRE_HOURS)
    db.query(models.SmsOutbox).filter(
        models.SmsOutbox.status == "QUEUED",
        models.SmsOutbox.created_at < expire_before,
    ).update({"status": "FAILED", "error": f"{SMS_QUEUE_EXPIRE_HOURS}시간 동안 발송 기기가 가져가지 않아 만료됨"},
             synchronize_session=False)


def touch_sender(db: Session, device_id: str, device_name: Optional[str]) -> None:
    dev = db.get(models.SmsSenderDevice, device_id)
    if not dev:
        dev = models.SmsSenderDevice(device_id=device_id)
        db.add(dev)
    if device_name:
        dev.device_name = device_name[:100]
    dev.last_seen_at = _now()


def claim_messages(db: Session, device_id: str, device_name: Optional[str], limit: int = 5) -> List[models.SmsOutbox]:
    """발송 기기가 보낼 문자를 가져간다(QUEUED → SENDING). 같은 행을 두 기기가 동시에 못 가져가게
    postgres에선 FOR UPDATE SKIP LOCKED로 잠근다(SQLite는 잠금 절이 무시되지만 테스트 전용)."""
    touch_sender(db, device_id, device_name)
    _housekeep(db)
    db.flush()

    rows = (
        db.query(models.SmsOutbox)
        .filter(models.SmsOutbox.status == "QUEUED")
        .order_by(models.SmsOutbox.id)
        .limit(max(1, min(limit, 20)))
        .with_for_update(skip_locked=True)
        .all()
    )
    now = _now()
    for row in rows:
        row.status = "SENDING"
        row.sender_device_id = device_id
        row.claimed_at = now
        row.attempts = (row.attempts or 0) + 1
        row.error = None
    db.commit()
    return rows


def report_result(db: Session, sms_id: int, device_id: str, success: bool, error: Optional[str]) -> models.SmsOutbox:
    row = db.get(models.SmsOutbox, sms_id)
    if not row:
        raise LookupError("문자를 찾을 수 없습니다.")
    # 이미 다른 기기로 넘어갔거나(멈춤 판정 후 재할당) 취소된 건의 늦은 보고는 무시한다.
    if row.status != "SENDING" or row.sender_device_id != device_id:
        return row
    if success:
        row.status = "SENT"
        row.sent_at = _now()
        row.error = None
    else:
        row.status = "FAILED"
        row.error = (error or "전송 실패")[:300]
    db.commit()
    db.refresh(row)
    return row


def sender_is_online(dev: models.SmsSenderDevice) -> bool:
    if not dev.last_seen_at:
        return False
    return (_now() - dev.last_seen_at).total_seconds() <= SMS_SENDER_ONLINE_TTL_SECONDS
