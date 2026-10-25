"""미완료 충전 안내 문자(#deposit-reminder).

회원 앞으로 매칭된 입금(BankTransaction.status == PENDING)을 24시간 넘게 "충전하기"로 확정하지
않으면 그 회원에게 문자를 한 번 보낸다. 문자에는
- 충전 완료하러 가는 링크(PUBLIC_BASE_URL/user - 안드로이드에서 회원 앱 PWA가 설치돼 있으면 그
  앱으로, 아니면 브라우저 웹페이지로 열린다. PWA 매니페스트 scope가 /user라서 따로 처리할 게 없다)
- 본인이 입금한 게 아니면 누르는 링크(/user?deny=<토큰> → 회원 앱이 확인 화면을 띄우고
  POST /api/deposits/deny/<토큰>으로 입금을 관리자 확인 대상(ERROR)으로 돌려놓는다)
가 들어간다.

main.py가 기동 시 띄운 루프가 CHECK_INTERVAL_SECONDS마다 send_due_reminders를 부른다. uvicorn
워커 4개가 각자 돌지만 reminder_sent_at을 "비어 있을 때만" 채우는 조건부 UPDATE로 한 건을 한
워커만 가져가므로 문자가 중복으로 나가지 않는다.
"""
import datetime
import hmac
import os
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app import models, security
from app.services import sms_outbox

REMIND_AFTER_HOURS = 24
# 배포 직후 아주 오래된 대기 건까지 한꺼번에 문자가 나가지 않게 - 이보다 오래된 건은 건너뛴다.
REMIND_MAX_AGE_DAYS = 7
CHECK_INTERVAL_SECONDS = 600
# 문자 속 링크 주소. 운영은 기본값, dev 서버는 .env에서 PUBLIC_BASE_URL로 덮어쓴다.
PUBLIC_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or "https://somangpay.duckdns.org").rstrip("/")


def deny_token(txn: models.BankTransaction) -> str:
    # 받는 회원 id까지 토큰에 넣는다 - "본인 아님"으로 처리하면 입금의 매칭 회원이 비워지는데,
    # 그 뒤에 같은 링크를 다시 눌러도 누구 링크였는지 알아야 "이미 처리됨"을 보여줄 수 있다.
    sig = security.short_signature(f"deny:{txn.id}:{txn.matched_user_id}")
    return f"{txn.id}-{txn.matched_user_id}-{sig}"


def resolve_deny_token(db: Session, token: str) -> Tuple[Optional[models.BankTransaction], Optional[int]]:
    """(입금 건, 링크를 받은 회원 id). 형식/서명이 틀리면 (None, None)."""
    try:
        txn_id_str, user_id_str, sig = (token or "").split("-", 2)
        txn_id, user_id = int(txn_id_str), int(user_id_str)
    except ValueError:
        return None, None
    expected = security.short_signature(f"deny:{txn_id}:{user_id}")
    if not hmac.compare_digest(expected, sig):
        return None, None
    txn = db.get(models.BankTransaction, txn_id)
    return (txn, user_id) if txn else (None, None)


def build_message(user: models.User, txn: models.BankTransaction) -> str:
    # 링크는 넣지 않는다(2026-10-25) - "링크 + 로그인/결제" 문자가 스미싱 형식과 같아서 사이트가
    # Google 세이프 브라우징에 "위험한 사이트"로 걸렸다(무료 duckdns 주소라 더 불리). 본인 입금이
    # 아니면 교회 사무실로 연락받아 관리자가 충전함에서 처리한다. deny_token/"본인 아님" API와
    # 회원 앱 /user?deny= 모달은 이미 나간 문자의 링크를 위해 남겨 둔다.
    return (
        f"[소망페이] {user.name}님, {txn.amount:,}원 입금이 확인됐는데 아직 충전 전이에요.\n"
        f"소망페이 앱에서 충전을 완료해 주세요.\n"
        f"본인이 입금한 게 아니라면 교회 사무실로 알려 주세요."
    )


def send_due_reminders(db: Session) -> int:
    now = datetime.datetime.utcnow()
    due_before = now - datetime.timedelta(hours=REMIND_AFTER_HOURS)
    too_old = now - datetime.timedelta(days=REMIND_MAX_AGE_DAYS)
    candidates = db.query(models.BankTransaction).filter(
        models.BankTransaction.status == "PENDING",
        models.BankTransaction.matched_user_id.isnot(None),
        models.BankTransaction.reminder_sent_at.is_(None),
        models.BankTransaction.created_at <= due_before,
        models.BankTransaction.created_at >= too_old,
    ).all()

    sent = 0
    for txn in candidates:
        user = db.get(models.User, txn.matched_user_id)
        # 활성 회원 중에서도 앱에 가입한(첫 로그인에서 비밀번호를 정한) 회원에게만 보낸다(#inactive) -
        # 가입 전 회원은 문자 속 링크/앱으로 충전을 마칠 수가 없다.
        if not user or user.status != "ACTIVE" or not user.password_set or not user.phone:
            continue
        claimed = db.query(models.BankTransaction).filter(
            models.BankTransaction.id == txn.id,
            models.BankTransaction.reminder_sent_at.is_(None),
        ).update({"reminder_sent_at": now}, synchronize_session=False)
        if not claimed:
            db.rollback()
            continue
        try:
            sms_outbox.enqueue_sms(db, user.phone, build_message(user, txn),
                                   source="deposit_reminder", user_id=user.id, commit=False)
        except ValueError:
            db.rollback()  # 번호가 이상하면 표시도 되돌려 둔다(관리자가 번호를 고치면 다음 주기에 다시)
            continue
        db.commit()
        sent += 1
    return sent
