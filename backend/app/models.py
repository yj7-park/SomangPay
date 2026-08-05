import datetime
import uuid
from sqlalchemy import Column, Integer, String, BigInteger, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), default="USER") # USER, ADMIN, MERCHANT
    user_type = Column(String(20), default="GENERAL") # GENERAL, SENIOR
    bank_name = Column(String(50), nullable=True) # 출처/환불 은행
    account_number = Column(String(50), nullable=True, index=True) # 충전 출처 계좌번호 (농협입금 매칭용)
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

    id = Column(Integer, primary_key=True, index=True)
    card_uid = Column(String(100), unique=True, index=True, nullable=False)
    card_name = Column(String(100), nullable=True)
    card_type = Column(String(20), default="NFC") # NFC, QR_CODE
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
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
    __tablename__ = "deposit_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    deposit_type = Column(String(30), nullable=False) # NH_AUTO_MATCH, VIRTUAL_ACCOUNT, ADMIN_MANUAL
    source_account = Column(String(100), nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    memo = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="deposits")

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
    product_details = Column(Text, nullable=True) # JSON String for items & quantities
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    status = Column(String(20), default="SUCCESS") # SUCCESS, FAILED
    failure_reason = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="payments")
