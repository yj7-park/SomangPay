from typing import Optional

from sqlalchemy.orm import Session
from app import models

# 회원 본인이 "본인 입금 아님"으로 돌려보낸 건(main.DEPOSIT_DENY_MEMO_PREFIX)은 비활성 분류에서 뺀다 -
# 그건 그 회원 입금이 아니라는 뜻이라 오류로 남아 관리자가 봐야 한다.
_DENY_MEMO_PREFIX = "회원이 본인 입금 아님"
# 예전(비활성 입금 상태가 생기기 전) 자동 매칭이 남긴 메모 - 비활성 분류로 옮길 때 지운다.
_LEGACY_INACTIVE_MEMO_PREFIX = "비활성 회원("


def match_new_deposit(db: Session, txn: "models.BankTransaction") -> None:
    """새로 등록된 계좌 입금 건을 입금자명으로 등록 회원과 자동 매칭한다. 회원 이름은
    유일하므로(동명이인은 관리자가 구분 이름으로 등록) 정확히 일치하는 이름이 있으면 그
    회원에게 매칭해 PENDING으로, 없으면 ERROR로 남겨 관리자가 수동 처리하게 한다.

    비활성(INACTIVE) 회원과 일치하면 INACTIVE(#inactive) - 아직 이 시스템을 안 쓰는 회원이
    현장에서 바로 쓰려고 낸 입금이라 충전하지도, 오류로 알리지도 않고 그대로 둔다(나중에
    활성화해도 되살리지 않음). 정지(SUSPENDED) 회원은 지금처럼 ERROR로 관리자가 확인한다."""
    user = db.query(models.User).filter(models.User.name == txn.depositor_name).first()
    if user and user.status == "ACTIVE":
        txn.matched_user_id = user.id
        txn.status = "PENDING"
    elif user and user.status == "INACTIVE":
        txn.matched_user_id = user.id
        txn.status = "INACTIVE"
    else:
        txn.status = "ERROR"
        if user:
            txn.resolution_memo = f"정지 회원({user.name}) 입금 - 확인 필요"


def park_inactive_deposits(db: Session, user: Optional["models.User"] = None) -> int:
    """비활성 회원과 매칭되는 미처리(PENDING/ERROR) 입금을 INACTIVE로 옮긴다(#inactive).
    user를 주면 그 회원 것만, 없으면 비활성 회원 전체(기동 시 한 번 - 교적 명단을 넣기 전에
    들어와 오류로 쌓여 있던 입금 정리). 회원을 비활성으로 바꿀 때도 부른다. 다시 돌려도 안전.
    커밋은 호출한 쪽이 한다. 옮긴 건수를 돌려준다."""
    db.flush()  # SessionLocal은 autoflush=False - 방금 바꾼 user.status가 아래 조회에 보이게
    q = db.query(models.User).filter(models.User.status == "INACTIVE")
    if user is not None:
        q = q.filter(models.User.id == user.id)
    inactive = q.all()
    if not inactive:
        return 0
    by_id = {u.id: u for u in inactive}
    by_name = {u.name: u for u in inactive}

    moved = 0
    txns = db.query(models.BankTransaction).filter(models.BankTransaction.status.in_(["PENDING", "ERROR"])).all()
    for t in txns:
        memo = t.resolution_memo or ""
        if memo.startswith(_DENY_MEMO_PREFIX):
            continue
        owner = by_id.get(t.matched_user_id) if t.matched_user_id else by_name.get(t.depositor_name)
        if owner is None:
            continue
        t.status = "INACTIVE"
        t.matched_user_id = owner.id
        if memo.startswith(_LEGACY_INACTIVE_MEMO_PREFIX):
            t.resolution_memo = None
        moved += 1
    return moved
