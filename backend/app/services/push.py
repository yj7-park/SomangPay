import json
import os

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from app import models

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@somangpay.local")

# 관리자 항목별 on/off 카테고리 → 필터링할 PushSubscription 컬럼
ADMIN_CATEGORY_COLUMNS = {
    "deposit_error": models.PushSubscription.notify_deposit_error,
    "deposit_credited": models.PushSubscription.notify_deposit_credited,
    "payment": models.PushSubscription.notify_payment,
}


def _dispatch(db: Session, subs: list, title: str, body: str, url: str) -> None:
    """호출부가 이미 커밋한 본 트랜잭션에는 절대 영향을 주지 않도록, 개별 발송 실패는 로그만
    남기고 삼킨다. 구독이 만료/해지된 경우(404/410)는 그 자리에서 정리한다."""
    if not subs or not VAPID_PRIVATE_KEY:
        return

    payload = json.dumps({"title": title, "body": body, "url": url})
    stale = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            status_code = e.response.status_code if e.response is not None else None
            if status_code in (404, 410):
                stale.append(sub)
            else:
                print(f"Push send failed (sub id={sub.id}): {e}")
        except Exception as e:
            print(f"Push send failed (sub id={sub.id}): {e}")

    if stale:
        for sub in stale:
            db.delete(sub)
        db.commit()


def send_push_to_user(db: Session, user_id: int, title: str, body: str, url: str = "/user") -> None:
    """회원의 모든 구독 기기에 푸시를 보낸다. 카테고리 구분 없이 항상 발송."""
    subs = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).all()
    _dispatch(db, subs, title, body, url)


def send_push_to_admins(db: Session, title: str, body: str, url: str = "/admin", category: str = None) -> None:
    """관리자(role=ADMIN) 전원의 구독 기기에 푸시를 보낸다. category가 주어지면 해당
    항목을 꺼둔 구독 기기에는 보내지 않는다(관리자 설정 화면의 항목별 on/off)."""
    query = db.query(models.PushSubscription).join(
        models.User, models.PushSubscription.user_id == models.User.id
    ).filter(models.User.role == "ADMIN")
    if category in ADMIN_CATEGORY_COLUMNS:
        query = query.filter(ADMIN_CATEGORY_COLUMNS[category] == True)  # noqa: E712
    subs = query.all()
    _dispatch(db, subs, title, body, url)
