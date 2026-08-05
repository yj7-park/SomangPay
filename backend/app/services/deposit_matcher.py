from sqlalchemy.orm import Session
from app import models

def process_bank_deposit(db: Session, source_account: str, amount: int, depositor_name: str = None):
    """
    농협 입금 통지를 회원 DB와 대조하여 자동 충전
    """
    user = None
    # 계좌번호 또는 입금자 정보 매칭
    user = db.query(models.User).filter(models.User.account_number == source_account).first()

    if not user and depositor_name:
        # 이름으로 매칭
        user = db.query(models.User).filter(models.User.name == depositor_name).first()

    if not user:
        return {
            "success": False,
            "message": f"입금 출처 계좌({source_account}) 또는 입금자명({depositor_name})과 일치하는 회원을 찾을 수 없습니다."
        }

    # 크레딧 충전 처리
    user.credit_balance += amount

    # 입금 내역 저장
    deposit = models.DepositHistory(
        user_id=user.id,
        amount=amount,
        deposit_type="NH_AUTO_MATCH",
        source_account=f"{source_account} ({depositor_name or '계좌입금'})",
        memo="NH농협 계좌 입금 자동 매칭 충전"
    )
    db.add(deposit)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "user_id": user.id,
        "user_name": user.name,
        "charged_amount": amount,
        "new_balance": user.credit_balance,
        "message": f"{user.name}님 계정에 {amount:,}원이 성공적으로 자동 충전되었습니다."
    }
