from sqlalchemy.orm import Session
from app import models


def match_new_deposit(db: Session, txn: "models.BankTransaction") -> None:
    """새로 등록된 계좌 입금 건을 입금자명으로 등록 회원과 자동 매칭한다. 회원 이름은
    유일하므로(동명이인은 관리자가 구분 이름으로 등록) 정확히 일치하는 이름이 있으면 그
    회원에게 매칭해 PENDING으로, 없으면 ERROR로 남겨 관리자가 수동 처리하게 한다."""
    user = db.query(models.User).filter(models.User.name == txn.depositor_name).first()
    if user and user.status == "ACTIVE":
        txn.matched_user_id = user.id
        txn.status = "PENDING"
    else:
        # 비활성/정지 회원 입금은 충전 대기로 넘기지 않는다(#inactive) - 오류로 남겨 관리자가
        # 확인하게 하고, 활성화한 뒤 충전함에서 회원을 지정해 처리하면 된다.
        txn.status = "ERROR"
        if user:
            txn.resolution_memo = f"{'비활성' if user.status == 'INACTIVE' else '정지'} 회원({user.name}) 입금 - 활성화 후 처리"
