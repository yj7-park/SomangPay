import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas


def _bank_items(db: Session, user_id: int, before: Optional[datetime.datetime], limit: int) -> List[schemas.HistoryItemResponse]:
    """계좌이체 입금 - 실제 반영 시각(resolved_at) 기준. PENDING/ERROR는 아직 회원 잔액에
    영향이 없거나(PENDING) 매칭된 회원이 없어(ERROR) 이용내역 대상이 아니다.
    resolved_at 컬럼 도입 이전의 오래된 CREDITED 행은 이 값이 NULL이라, created_at으로
    대체해서 취급한다(COALESCE) - 안 그러면 NULL이 DESC 정렬에서 맨 앞으로 튀거나
    (Postgres 기본 NULLS FIRST), 커서 필터에 걸려 다음 페이지에서 영영 누락된다."""
    event_col = func.coalesce(models.BankTransaction.resolved_at, models.BankTransaction.created_at)
    q = db.query(models.BankTransaction).filter(
        models.BankTransaction.matched_user_id == user_id,
        models.BankTransaction.status.in_(["CREDITED", "CREDITED_MANUAL", "OTHER"]),
    )
    if before is not None:
        q = q.filter(event_col < before)
    rows = q.order_by(event_col.desc()).limit(limit).all()

    items = []
    for t in rows:
        if t.status == "OTHER":
            label, badge_class, category = "보류", "status-rejected", "pending"
            amount_text, amount_class = f"{t.amount:,}원", "amount-neutral"
            reason = t.resolution_memo or "처리 보류(관리자 문의)"
        else:
            label, badge_class, category = "금액 충전", "status-done", "bank_charge"
            amount_text, amount_class = f"+{t.amount:,}원", "amount-positive"
            reason = "본인 확인 후 충전" if t.status == "CREDITED" else (t.resolution_memo or "관리자가 대신 충전 처리")
        items.append(schemas.HistoryItemResponse(
            label=label, badge_class=badge_class, category=category, amount=t.amount,
            amount_text=amount_text, amount_class=amount_class,
            balance_after=t.balance_after, reason=reason, event_time=t.resolved_at or t.created_at,
        ))
    return items


def _admin_deposit_items(db: Session, user_id: int, before: Optional[datetime.datetime], limit: int) -> List[schemas.HistoryItemResponse]:
    """관리자 직권 충전/차감 - 계좌이체(BANK_TRANSFER)는 _bank_items가 이미 다루므로 제외."""
    q = db.query(models.DepositHistory).filter(
        models.DepositHistory.user_id == user_id,
        models.DepositHistory.deposit_type != "BANK_TRANSFER",
    )
    if before is not None:
        q = q.filter(models.DepositHistory.created_at < before)
    rows = q.order_by(models.DepositHistory.created_at.desc()).limit(limit).all()

    items = []
    for h in rows:
        is_deduct = h.deposit_type == "ADMIN_MANUAL_DEDUCT"
        label = "금액 차감" if is_deduct else "금액 충전"
        badge_class = "status-rejected" if is_deduct else "status-done"
        category = "admin_deduct" if is_deduct else "admin_charge"
        amount_class = "amount-negative" if is_deduct else "amount-positive"
        sign = "" if h.amount < 0 else "+"
        reason = h.memo or ("관리자 직권 차감" if is_deduct else "관리자 직권 충전")
        items.append(schemas.HistoryItemResponse(
            label=label, badge_class=badge_class, category=category, amount=h.amount,
            amount_text=f"{sign}{h.amount:,}원", amount_class=amount_class,
            balance_after=h.balance_after, reason=reason, event_time=h.created_at,
        ))
    return items


def _payment_items(db: Session, user_id: int, before: Optional[datetime.datetime], limit: int) -> List[schemas.HistoryItemResponse]:
    q = db.query(models.PaymentTransaction).filter(models.PaymentTransaction.user_id == user_id)
    if before is not None:
        q = q.filter(models.PaymentTransaction.created_at < before)
    rows = q.order_by(models.PaymentTransaction.created_at.desc()).limit(limit).all()

    items = []
    for p in rows:
        is_failed = p.status == "FAILED"
        label = "결제 실패" if is_failed else "결제 성공"
        badge_class = "status-rejected" if is_failed else "status-payment"
        category = "payment_failed" if is_failed else "payment"
        amount_class = "amount-neutral" if is_failed else "amount-negative"
        if is_failed:
            reason = p.failure_reason or "결제 실패"
        else:
            kiosk_name = None
            if p.kiosk_device_id:
                kiosk = db.query(models.KioskDevice).filter(models.KioskDevice.id == p.kiosk_device_id).first()
                kiosk_name = kiosk.device_name if kiosk else None
            reason = " · ".join(filter(None, [kiosk_name, p.product_details])) or "-"
        items.append(schemas.HistoryItemResponse(
            label=label, badge_class=badge_class, category=category, amount=-p.amount,
            amount_text=f"-{p.amount:,}원", amount_class=amount_class,
            balance_after=p.balance_after, reason=reason, event_time=p.created_at,
        ))
    return items


def get_kiosk_payment_history_page(
    db: Session, kiosk_device_id: int, before: Optional[datetime.datetime], limit: int = 20
) -> schemas.KioskPaymentHistoryPage:
    """단말기 화면의 '최근 결제 내역' 패널(kiosk.js)과 관리자 키오스크 상세 화면이 함께 쓰는
    커서 페이지네이션. get_history_page와 마찬가지로 조회 범위에 임의의 기간 제한을 두지 않고
    스크롤할 때만 다음 페이지를 불러온다(지연 로드) - 결제 성공 건만 대상으로 한다(화면에
    실패 시도를 노출하지 않는 기존 동작 유지). PaymentTransaction 자체는 지우지 않고 영구
    보존하므로 매출 집계(_kiosk_sales_for)에는 영향이 없다."""
    q = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.kiosk_device_id == kiosk_device_id,
        models.PaymentTransaction.status == "SUCCESS",
    )
    if before is not None:
        q = q.filter(models.PaymentTransaction.created_at < before)
    rows = q.order_by(models.PaymentTransaction.created_at.desc()).limit(limit).all()

    items = []
    for p in rows:
        user = db.query(models.User).filter(models.User.id == p.user_id).first()
        items.append(schemas.KioskPaymentHistoryItem(
            user_name=user.name if user else "탈퇴한 회원",
            user_type="시니어" if (user and user.user_type == "SENIOR") else "일반",
            amount=p.amount,
            balance_after=p.balance_after,
            product_details=p.product_details,
            event_time=p.created_at,
        ))

    next_cursor = items[-1].event_time.isoformat() if items else None
    return schemas.KioskPaymentHistoryPage(items=items, next_cursor=next_cursor)


def get_history_page(db: Session, user_id: int, before: Optional[datetime.datetime], limit: int = 20) -> schemas.HistoryPageResponse:
    """계좌이체/결제/관리자충전 3개 소스를 시간순으로 병합한 커서 페이지네이션.
    매 호출마다 세 소스 전부를 "before 이전" 조건으로 다시 조회해 각각 최대 limit개씩 가져온 뒤
    합쳐서 최신순 정렬 후 상위 limit개만 반환한다 - 이러면 특정 소스에 항목이 몰려서 이번
    페이지에서 밀린 것도 다음 페이지에서 자연스럽게 다시 조회되어 누락되지 않는다."""
    candidates = (
        _bank_items(db, user_id, before, limit)
        + _admin_deposit_items(db, user_id, before, limit)
        + _payment_items(db, user_id, before, limit)
    )
    candidates.sort(key=lambda i: i.event_time, reverse=True)
    page = candidates[:limit]

    next_cursor = page[-1].event_time.isoformat() if page else None
    return schemas.HistoryPageResponse(items=page, next_cursor=next_cursor)
