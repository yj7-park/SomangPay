from sqlalchemy.orm import Session
from app import models


def match_new_deposit(db: Session, txn: "models.BankTransaction") -> None:
    """새로 등록된 계좌 입금 건을 입금자명으로 등록 회원과 자동 매칭한다. 회원 이름은
    유일하므로(동명이인은 관리자가 구분 이름으로 등록) 정확히 일치하는 이름이 있으면 그
    회원에게 매칭해 PENDING으로, 없으면 ERROR로 남겨 관리자가 수동 처리하게 한다."""
    user = db.query(models.User).filter(models.User.name == txn.depositor_name).first()
    if user:
        txn.matched_user_id = user.id
        txn.status = "PENDING"
    else:
        txn.status = "ERROR"
