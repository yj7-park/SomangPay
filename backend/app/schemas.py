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

class UserProxyCreate(BaseModel):
    """관리자 대리 회원 등록. 동명이인은 관리자가 구분되는 이름(예: 홍길동B)을 직접 입력한다."""
    name: str
    phone: str
    user_type: str = "GENERAL" # GENERAL, SENIOR
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    initial_credit: int = Field(default=0, ge=0)

class UserStatusUpdate(BaseModel):
    status: str  # ACTIVE, SUSPENDED

class UserLoginRequest(BaseModel):
    phone: str
    password: str

class UserAdminUpdateInfo(BaseModel):
    """관리자가 회원 정보를 수정할 때 쓰는 스키마. new_password는 회원이 비밀번호를
    잊어버렸을 때 관리자가 초기화해주는 용도."""
    name: Optional[str] = None
    phone: Optional[str] = None
    user_type: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    new_password: Optional[str] = None

class UserPasswordChange(BaseModel):
    """회원 본인이 로그인 후 비밀번호를 변경할 때 쓰는 스키마."""
    new_password: str = Field(min_length=1)

class UserResponse(UserBase):
    id: int
    credit_balance: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserLoginResponse(UserResponse):
    token: str

# Admin Credit Manual Recharge (현금 직접 충전 - 계좌이체 매칭과 무관)
class AdminRechargeRequest(BaseModel):
    user_id: int
    amount: int = Field(gt=0)
    memo: Optional[str] = "관리자 직권 충전"

# NFC/QR Card Schemas
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

class NFCCardUpsert(BaseModel):
    """카드 등록/교체 공용 스키마. 이미 해당 회원의 같은 타입 카드가 있으면 교체된다."""
    user_id: int
    card_type: str = "NFC" # NFC, QR_CODE
    card_uid: str
    card_name: Optional[str] = None

class NFCCardResponse(BaseModel):
    id: int
    card_uid: str
    card_name: Optional[str]
    card_type: Optional[str] = "NFC"
    user_id: int
    user_name: Optional[str] = None
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

class PaymentTransactionResponse(BaseModel):
    id: int
    transaction_code: str
    user_id: int
    user_name: Optional[str] = None
    amount: int
    balance_after: int
    status: str
    product_details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Deposit History (충전이 실제로 반영된 통합 이력)
class DepositHistoryResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    amount: int
    deposit_type: str
    transaction_id: Optional[str] = None
    memo: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ================= 계좌이체 충전 신청 (Recharge Request) =================

class RechargeRequestCreate(BaseModel):
    amount: int = Field(gt=0)

class RechargeRequestResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    requested_amount: int
    status: str
    matched_bank_transaction_id: Optional[int] = None
    memo: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RechargeRequestResult(BaseModel):
    success: bool
    status: str  # MATCHED, PENDING
    message: str
    new_balance: Optional[int] = None

class RechargeApproveRequest(BaseModel):
    bank_transaction_id: Optional[int] = None

class RechargeRejectRequest(BaseModel):
    reason: Optional[str] = None

class ChargeGuideResponse(BaseModel):
    bank_name: str
    account_number: str
    account_holder: str
    depositor_name: str  # 이 회원이 입금 시 입력해야 할 고유 이름 (= User.name)

# ================= 은행거래 원장 (모킹 - 나중에 실제 NH API 연동) =================

class BankTransactionCreate(BaseModel):
    external_txn_id: str
    amount: int = Field(gt=0)
    depositor_name: str
    transaction_at: Optional[datetime] = None

class BankTransactionResponse(BaseModel):
    id: int
    external_txn_id: str
    transaction_at: datetime
    amount: int
    depositor_name: str
    status: str
    matched_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ================= 통계 요약 =================

class StatsPeriod(BaseModel):
    deposit_amount: int
    payment_amount: int
    payment_count: int

class StatsSummaryResponse(BaseModel):
    total_users: int
    total_balance: int
    unmatched_deposit_count: int
    pending_recharge_count: int
    today: StatsPeriod
    this_week: StatsPeriod
    this_month: StatsPeriod
