import datetime
import uuid
from sqlalchemy import Column, Integer, String, BigInteger, Boolean, Date, DateTime, ForeignKey, Text, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(50), unique=True, nullable=False) # 동명이인은 관리자가 등록 시 구분 이름(예: 홍길동B)을 직접 입력 - 계좌이체 입금자명 매칭에도 그대로 쓰이므로 유일해야 함
    phone = Column(String(20), unique=True, nullable=True, index=True) # 로그인 ID (하이픈 없는 숫자로 정규화해서 저장)
    role = Column(String(20), default="USER") # USER, ADMIN, MERCHANT
    user_type = Column(String(20), default="GENERAL") # GENERAL, SENIOR
    birth_date = Column(Date, nullable=True) # 선택 입력 - 시니어 할인 등 참고용, 로그인/매칭에는 미사용
    bank_name = Column(String(50), nullable=True) # 관리자 참고용 메모 - 입금 매칭에는 미사용(매칭은 입금자명 기준)
    account_number = Column(String(50), nullable=True) # 관리자 참고용 메모 - 입금 매칭에는 미사용(매칭은 입금자명 기준)
    credit_balance = Column(Integer, default=0, nullable=False)
    password_hash = Column(String(200), default="1234", nullable=True) # 기본 비밀번호 1234
    status = Column(String(20), default="ACTIVE") # ACTIVE, SUSPENDED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    cards = relationship("NFCCard", back_populates="owner")
    deposits = relationship("DepositHistory", foreign_keys="[DepositHistory.user_id]", back_populates="user")
    payments = relationship("PaymentTransaction", back_populates="user")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=True)
    name = Column(String(100), nullable=False)
    price_general = Column(Integer, nullable=False)
    price_senior = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class NFCCard(Base):
    __tablename__ = "nfc_cards"
    __table_args__ = (
        # 회원당 카드타입(NFC/QR_CODE)별 최대 1개 - 행이 존재하면 곧 활성 카드다.
        UniqueConstraint("user_id", "card_type", name="uq_nfc_cards_user_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    card_uid = Column(String(100), unique=True, index=True, nullable=False)
    card_name = Column(String(100), nullable=True)
    card_type = Column(String(20), default="NFC") # NFC, QR_CODE
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issued_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="cards")

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    merchant_name = Column(String(100), nullable=False)
    biz_number = Column(String(50), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # 점주 계정
    address = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    kiosk_devices = relationship("KioskDevice", back_populates="merchant")

class DepositHistory(Base):
    """실제로 크레딧이 반영된 충전 건의 통합 이력 원장 (충전 경로 불문)."""
    __tablename__ = "deposit_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    deposit_type = Column(String(30), nullable=False) # ADMIN_MANUAL, BANK_TRANSFER (과거 데이터에 TOSS_DEEPLINK/KAKAOPAY_DEEPLINK가 남아 있을 수 있음)
    transaction_id = Column(String(100), nullable=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    memo = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="deposits")

class BankTransaction(Base):
    """농협 계좌조회로 가져온(지금은 모킹) 원본 입금 원장. 실제 API 연동 전까지는
    관리자가 POST /api/admin/bank-transactions로 직접 입력한다(또는 SMS/RCS 자동감지).

    등록 즉시 입금자명으로 등록 회원과 자동 매칭을 시도한다(deposit_matcher.match_new_deposit).
    상태: PENDING(회원 자동매칭됨, 회원이 앱에서 선택해 충전 대기) / ERROR(입금자명이 등록
    회원과 매칭 안 됨, 관리자만 조회 가능) / CREDITED(회원 본인이 선택해 충전 완료) /
    CREDITED_MANUAL(관리자가 회원을 지정해 대신 충전 완료) / OTHER(관리자가 사유를 남기고
    충전 대상 아님으로 종결, 크레딧 미반영)."""
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    external_txn_id = Column(String(100), unique=True, index=True, nullable=False) # 은행 거래고유번호 (재조회 dedup 키)
    transaction_at = Column(DateTime, default=datetime.datetime.utcnow)
    amount = Column(Integer, nullable=False)
    depositor_name = Column(String(50), nullable=False) # 통장에 찍히는 입금자명 원문
    status = Column(String(20), default="PENDING")
    matched_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True) # CREDITED_MANUAL/OTHER 처리한 관리자
    resolution_memo = Column(String(200), nullable=True) # OTHER 처리 사유, 또는 관리자 처리 메모
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    matched_user = relationship("User", foreign_keys=[matched_user_id])

class KioskDevice(Base):
    __tablename__ = "kiosk_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_uuid = Column(String(100), unique=True, index=True, nullable=False)
    device_name = Column(String(100), nullable=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=True)
    assigned_products = Column(Text, nullable=True) # JSON String list of product IDs
    default_product_id = Column(Integer, nullable=True) # 기본 결제 상품 ID
    default_quantity = Column(Integer, default=1) # 기본 결제 수량
    allow_camera_reader_concurrent = Column(Boolean, default=False) # 외부 리더 사용 시 카메라와 동시 사용 허용 여부
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    merchant = relationship("Merchant", back_populates="kiosk_devices")

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_code = Column(String(100), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    card_id = Column(Integer, ForeignKey("nfc_cards.id"), nullable=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=True)
    kiosk_device_id = Column(Integer, ForeignKey("kiosk_devices.id"), nullable=True) # 어느 단말기에서 결제됐는지 - 키오스크별 메뉴 매출 집계에 사용
    product_details = Column(Text, nullable=True) # 사람이 읽는 요약 텍스트(예: "김밥 x2 (3,000원)") - 집계는 PaymentLineItem을 사용
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    status = Column(String(20), default="SUCCESS") # SUCCESS, FAILED
    failure_reason = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="payments")

class PaymentLineItem(Base):
    """결제 1건에 포함된 메뉴별 상세 - 메뉴별/키오스크별 매출 집계용 (product_details는 텍스트 요약이라 집계 불가).
    이 테이블 도입 이전 결제 건에는 라인아이템이 없으므로, 집계는 이후 결제부터만 반영된다."""
    __tablename__ = "payment_transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    payment_transaction_id = Column(Integer, ForeignKey("payment_transactions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_name = Column(String(100), nullable=False) # 결제 시점 이름 스냅샷 (이후 메뉴명이 바뀌어도 이력은 보존)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Integer, nullable=False)
    subtotal = Column(Integer, nullable=False)
