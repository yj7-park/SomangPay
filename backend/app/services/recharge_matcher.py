import datetime
from sqlalchemy.orm import Session
from app import models


def _apply_match(db: Session, txn: "models.BankTransaction", request: "models.RechargeRequest"):
    """확정된 매칭 한 쌍을 실제로 반영: 상태 갱신 + 크레딧 충전 + 통합 이력 기록."""
    user = db.query(models.User).filter(models.User.id == request.user_id).first()

    txn.status = "MATCHED"
    txn.matched_user_id = request.user_id
    txn.matched_recharge_request_id = request.id

    request.status = "MATCHED"
    request.matched_bank_transaction_id = txn.id
    request.resolved_at = datetime.datetime.utcnow()

    user.credit_balance += request.requested_amount

    db.add(models.DepositHistory(
        user_id=user.id,
        amount=request.requested_amount,
        deposit_type="BANK_TRANSFER",
        memo=f"계좌이체 충전 신청 자동 매칭 (입금자명: {txn.depositor_name})",
    ))
    db.commit()


def try_resolve_recharge_request(db: Session, request: "models.RechargeRequest") -> bool:
    """새로 들어온 충전 신청에 대해, 신청자의 고유 이름(입금자명) + 신청 금액과 일치하는
    미매칭 은행거래를 찾아 즉시 매칭을 시도한다. 매칭되면 True."""
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        return False

    txn = db.query(models.BankTransaction).filter(
        models.BankTransaction.status == "UNMATCHED",
        models.BankTransaction.depositor_name == user.name,
        models.BankTransaction.amount == request.requested_amount,
    ).order_by(models.BankTransaction.transaction_at.asc()).first()

    if not txn:
        return False

    _apply_match(db, txn, request)
    return True


def try_resolve_bank_transaction(db: Session, txn: "models.BankTransaction") -> bool:
    """새로 동기화된(또는 관리자가 입력한) 은행거래 건에 대해, 이미 대기 중인 충전 신청
    (PENDING) 중 입금자명 == 신청자 고유 이름, 금액이 일치하는 게 있으면 매칭을 시도한다.
    신청이 은행거래보다 먼저 들어온 경우를 처리하기 위한 반대 방향 매칭. 매칭되면 True."""
    pending_requests = db.query(models.RechargeRequest).filter(
        models.RechargeRequest.status == "PENDING",
        models.RechargeRequest.requested_amount == txn.amount,
    ).all()

    for request in pending_requests:
        user = db.query(models.User).filter(models.User.id == request.user_id).first()
        if user and user.name == txn.depositor_name:
            _apply_match(db, txn, request)
            return True

    return False
