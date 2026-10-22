import re
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session
from app import models

# 회원 본인이 "본인 입금 아님"으로 돌려보낸 건(main.DEPOSIT_DENY_MEMO_PREFIX)은 비활성 분류에서 뺀다 -
# 그건 그 회원 입금이 아니라는 뜻이라 오류로 남아 관리자가 봐야 한다.
_DENY_MEMO_PREFIX = "회원이 본인 입금 아님"
# 예전(비활성 입금 상태가 생기기 전) 자동 매칭이 남긴 메모 - 비활성 분류로 옮길 때 지운다.
_LEGACY_INACTIVE_MEMO_PREFIX = "비활성 회원("


_SUFFIX = re.compile(r"[A-Z]")


def name_matches(member_name: str, depositor_name: str) -> bool:
    """입금자명과 회원 이름이 같은 사람으로 볼 만한지 - 이름이 그대로 같거나, 회원 이름이 입금자명 +
    동명이인 구분 꼬리 한 글자(A~Z, 예: 홍길동B)일 때. 은행 입금자명엔 그 꼬리가 없다."""
    m = (member_name or "").strip()
    d = (depositor_name or "").strip()
    if not m or not d:
        return False
    return m == d or (len(m) == len(d) + 1 and m.startswith(d) and bool(_SUFFIX.fullmatch(m[-1])))


def find_depositor_match(db: Session, depositor_name: str) -> Optional["models.User"]:
    """이름 규칙(name_matches)에 맞는 회원이 상태와 상관없이 딱 한 명이면 그 회원, 아니면 None.
    홍길동과 홍길동B가 둘 다 있으면 누구 입금인지 모르니 매칭하지 않는다(관리자가 직접 지정)."""
    d = (depositor_name or "").strip()
    if not d:
        return None
    # 후보만 좁히는 1차 필터(이름 그대로 또는 한 글자 더) - 꼬리가 A~Z인지는 name_matches가 본다.
    like = d.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "_"
    rows = db.query(models.User).filter(
        or_(models.User.name == d, models.User.name.like(like, escape="!"))
    ).all()
    hits = [u for u in rows if name_matches(u.name, d)]
    return hits[0] if len(hits) == 1 else None


def match_new_deposit(db: Session, txn: "models.BankTransaction") -> None:
    """새로 등록된 계좌 입금 건을 입금자명으로 등록 회원과 자동 매칭한다(find_depositor_match -
    이름 그대로 또는 꼬리 A~Z가 붙은 회원이 딱 한 명일 때). 활성 회원이면 PENDING(회원이 앱에서
    확정), 없거나 여러 명이면 ERROR로 남겨 관리자가 처리한다.

    비활성(INACTIVE) 회원이면 INACTIVE(#inactive) - 아직 이 시스템을 안 쓰는 회원이
    현장에서 바로 쓰려고 낸 입금이라 충전하지도, 오류로 알리지도 않고 그대로 둔다(나중에
    활성화해도 되살리지 않음). 정지(SUSPENDED) 회원은 ERROR로 관리자가 확인한다."""
    user = find_depositor_match(db, txn.depositor_name)
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
    # 매칭 안 된 입금은 이름 규칙으로 찾되, 후보는 상태와 상관없이 전체 회원에서 센다 - 활성
    # 홍길동과 비활성 홍길동B가 같이 있으면 누구 입금인지 모르니 건드리지 않는다.
    all_users = db.query(models.User.id, models.User.name).all()

    def unique_owner(depositor_name: str) -> Optional["models.User"]:
        hits = [uid for uid, name in all_users if name_matches(name, depositor_name)]
        return by_id.get(hits[0]) if len(hits) == 1 else None

    moved = 0
    txns = db.query(models.BankTransaction).filter(models.BankTransaction.status.in_(["PENDING", "ERROR"])).all()
    for t in txns:
        memo = t.resolution_memo or ""
        if memo.startswith(_DENY_MEMO_PREFIX):
            continue
        owner = by_id.get(t.matched_user_id) if t.matched_user_id else unique_owner(t.depositor_name)
        if owner is None:
            continue
        t.status = "INACTIVE"
        t.matched_user_id = owner.id
        if memo.startswith(_LEGACY_INACTIVE_MEMO_PREFIX):
            t.resolution_memo = None
        moved += 1
    return moved
