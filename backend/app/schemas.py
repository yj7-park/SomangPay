from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str
    name: str
    phone: Optional[str] = None
    role: str = "USER" # USER, ADMIN, MERCHANT
    user_type: str = "GENERAL" # GENERAL, SENIOR
    bank_name: Optional[str] = None
    account_number: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserSelfRegister(BaseModel):
    username: str
    name: str
    phone: Optional[str] = None
    user_type: str = "GENERAL" # GENERAL, SENIOR
    bank_name: Optional[str] = "NH농협"
    account_number: Optional[str] = None

class UserProxyCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    user_type: str = "GENERAL" # GENERAL, SENIOR
    bank_name: Optional[str] = "농협"
    account_number: Optional[str] = None
    initial_credit: int = Field(default=0, ge=0)

# 회원 선택 드롭다운 등 공개 노출용 최소 정보 (전화번호/계좌번호/잔액 등 PII 제외)
class UserPublicResponse(BaseModel):
    id: int
    username: str
    name: str
    user_type: str

    class Config:
        from_attributes = True

class UserStatusUpdate(BaseModel):
    status: str  # ACTIVE, SUSPENDED

class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserUpdateInfo(BaseModel):
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    new_password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    credit_balance: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Admin Credit Manual Recharge
class AdminRechargeRequest(BaseModel):
    user_id: int
    amount: int = Field(gt=0)
    memo: Optional[str] = "관리자 직권 충전"

# NFC Card Schemas
class NFCCardCreate(BaseModel):
    card_uid: str
    card_name: Optional[str] = "내 NFC 카드"
    user_id: int

class KioskDeviceSync(BaseModel):
    device_uuid: str
    device_name: Optional[str] = None
    merchant_id: Optional[int] = None
    assigned_products: Optional[List[int]] = None
    default_product_id: Optional[int] = None
    default_quantity: Optional[int] = 1
    allow_camera_reader_concurrent: Optional[bool] = False

class KioskDeviceResponse(BaseModel):
    id: int
    device_uuid: str
    device_name: Optional[str]
    merchant_id: Optional[int]
    assigned_products: Optional[List[int]]
    default_product_id: Optional[int] = None
    default_quantity: Optional[int] = 1
    allow_camera_reader_concurrent: Optional[bool] = False
    updated_at: datetime

    class Config:
        from_attributes = True

class NFCCardRegister(BaseModel):
    card_uid: str
    card_name: Optional[str] = None
    card_type: Optional[str] = "NFC" # NFC, QR_CODE
    user_id: int

class NFCCardResponse(BaseModel):
    id: int
    card_uid: str
    card_name: Optional[str]
    card_type: Optional[str] = "NFC"
    user_id: int
    user_name: Optional[str] = None
    is_active: bool
    issued_at: datetime

    class Config:
        from_attributes = True

# Product Schemas
class ProductCreate(BaseModel):
    name: str
    price_general: int
    price_senior: int
    merchant_id: Optional[int] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price_general: Optional[int] = None
    price_senior: Optional[int] = None

class ProductResponse(ProductCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

# Payment Schemas
class PaymentItem(BaseModel):
    product_id: int
    quantity: int

class PaymentRequest(BaseModel):
    card_uid: str
    merchant_id: Optional[int] = None
    device_uuid: Optional[str] = None
    items: List[PaymentItem] = []
    force_confirm: Optional[bool] = False # UC-08 30초 중복 결제 강제 승인 플래그

class PaymentResponse(BaseModel):
    transaction_code: Optional[str] = None
    user_name: Optional[str] = None
    user_type: Optional[str] = None
    total_amount: Optional[int] = 0
    balance_after: Optional[int] = 0
    status: str # SUCCESS, CONFIRM_REQUIRED, FAILED
    message: str
    created_at: Optional[datetime] = None

# Deposit History
class DepositHistoryResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    amount: int
    deposit_type: str
    source_account: Optional[str]
    transaction_id: Optional[str] = None
    memo: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
