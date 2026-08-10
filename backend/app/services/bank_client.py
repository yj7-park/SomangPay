"""농협 계좌조회(오픈뱅킹) 연동 계층.

지금은 실제 API 자격증명이 없어 모킹 상태다 - 항상 빈 리스트를 반환한다. 그동안 입금
데이터는 관리자가 `POST /api/admin/bank-transactions`로 직접 입력해 대신한다(관리자
대시보드의 "입금 시뮬레이터"). 나중에 실제 NH 오픈뱅킹 API 키가 발급되면, 이 함수 내부만
실제 HTTP 호출로 교체하면 된다 - 호출부(main.py)는 이 함수의 반환 형태에만 의존한다.
"""
from typing import TypedDict


class RawBankTransaction(TypedDict):
    external_txn_id: str
    amount: int
    depositor_name: str
    transaction_at: str  # ISO 8601


def fetch_new_transactions() -> list[RawBankTransaction]:
    """교회 수신계좌의 신규 입금 내역을 조회한다. 모킹 구현이라 항상 빈 리스트."""
    return []
