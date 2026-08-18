from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, PlainSerializer
from datetime import datetime, date, timezone

# DB의 시각 컬럼은 전부 datetime.utcnow() 기준 naive UTC라, 그대로 JSON으로 내보내면
# 타임존 표기가 없는 "2026-08-13T04:27:22" 같은 문자열이 된다. 프론트엔드의 new Date(...)는
# 오프셋이 없는 ISO 문자열을 "로컬 시각"으로 해석해버려서, 실제로는 UTC인 값을 그대로
# 한국 시각인 것처럼 표시하는 버그가 생긴다(9시간 차이 - 관리자 대시보드에서 확인됨).
# naive datetime을 UTC로 간주해 응답 시에만 'Z' 오프셋을 붙여서, 프론트엔드가 항상
# 올바르게 로컬(한국) 시간으로 변환해 표시하도록 한다. DB/내부 로직에는 영향 없음
# (when_used="json" - JSON 직렬화 시에만 적용).
def _serialize_utc_datetime(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

UTCDatetime = Annotated[datetime, PlainSerializer(_serialize_utc_datetime, return_type=str, when_used="json")]

# User Schemas
class UserBase(BaseModel):
    username: str
    name: str
    phone: Optional[str] = None
    role: str = "USER" # USER, ADMIN, MERCHANT
    user_type: str = "GENERAL" # GENERAL, SENIOR
    birth_date: Optional[date] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None

class UserProxyCreate(BaseModel):
    """관리자 대리 회원 등록. 동명이인은 관리자가 구분되는 이름(예: 홍길동B)을 직접 입력한다."""
    name: str
    phone: str
    user_type: str = "GENERAL" # GENERAL, SENIOR
    birth_date: Optional[date] = None
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
    잊어버렸을 때 관리자가 초기화해주는 용도. birth_date는 다른 필드와 달리 선택 항목
    자체가 값이라 None도 유효한 "지움" 의미이므로(주석 있는 admin_update_user 참고),
    다른 필드처럼 "생략하면 안 바꿈"이 아니라 항상 그대로 반영한다."""
    name: Optional[str] = None
    phone: Optional[str] = None
    user_type: Optional[str] = None
    birth_date: Optional[date] = None
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
    created_at: UTCDatetime

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
    updated_at: UTCDatetime

    class Config:
        from_attributes = True

# ================= 관리자 - 키오스크 관리 =================

class KioskProductSales(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    quantity: int
    amount: int

class KioskSalesSummary(BaseModel):
    today: List[KioskProductSales] = []
    this_month: List[KioskProductSales] = []
    all_time: List[KioskProductSales] = []

class AdminKioskResponse(BaseModel):
    id: int
    device_uuid: str
    device_name: Optional[str] = None
    merchant_id: Optional[int] = None
    merchant_name: Optional[str] = None
    assigned_products: List[int] = []
    default_product_id: Optional[int] = None
    default_quantity: Optional[int] = 1
    updated_at: UTCDatetime
    sales: KioskSalesSummary

class KioskUpdateRequest(BaseModel):
    device_name: Optional[str] = None
    assigned_products: Optional[List[int]] = None
    default_product_id: Optional[int] = None
    default_quantity: Optional[int] = None

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
    issued_at: UTCDatetime

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
    created_at: Optional[UTCDatetime] = None

class PaymentTransactionResponse(BaseModel):
    id: int
    transaction_code: str
    user_id: int
    user_name: Optional[str] = None
    amount: int
    balance_after: int
    status: str
    failure_reason: Optional[str] = None
    product_details: Optional[str] = None
    kiosk_name: Optional[str] = None
    created_at: UTCDatetime

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
    created_at: UTCDatetime

    class Config:
        from_attributes = True

# ================= 계좌이체 충전 (회원이 확인된 입금 건을 선택해서 충전) =================

class DepositClaimResult(BaseModel):
    success: bool
    message: str
    new_balance: Optional[int] = None

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
    transaction_at: UTCDatetime
    amount: int
    depositor_name: str
    status: str  # PENDING, ERROR, CREDITED, CREDITED_MANUAL, OTHER
    matched_user_id: Optional[int] = None
    matched_user_name: Optional[str] = None
    balance_after: Optional[int] = None
    resolution_memo: Optional[str] = None
    resolved_by_admin_id: Optional[int] = None
    resolved_by_admin_name: Optional[str] = None
    resolved_at: Optional[UTCDatetime] = None
    created_at: UTCDatetime

    class Config:
        from_attributes = True

class BankTransactionAdminResolve(BaseModel):
    """관리자가 대기/오류 상태 입금 건에 회원을 지정해 대신 충전 완료 처리."""
    user_id: int
    memo: Optional[str] = None

class BankTransactionAdminOther(BaseModel):
    """관리자가 대기/오류 상태 입금 건을 충전 대상이 아닌 것으로 사유와 함께 종결."""
    reason: str = Field(min_length=1)

# ================= 통계 요약 =================

class StatsPeriod(BaseModel):
    deposit_amount: int
    payment_amount: int
    payment_count: int

class StatsSummaryResponse(BaseModel):
    total_users: int
    total_balance: int
    users_with_balance: int
    pending_deposit_count: int
    error_deposit_count: int
    today: StatsPeriod
    this_week: StatsPeriod
    this_month: StatsPeriod
