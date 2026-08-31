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

# Admin Credit Manual Deduct (환불/오충전 정정 등 - amount는 양수만 받고 서버에서 차감)
class AdminDeductRequest(BaseModel):
    user_id: int
    amount: int = Field(gt=0)
    memo: Optional[str] = "관리자 직권 차감"

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
    this_week: List[KioskProductSales] = []
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
    # 실시간 온라인 여부(ws_manager 인메모리 연결)와, 오프라인일 때 보여줄 "마지막 접속"
    # 시각(#redesign, 관리자 키오스크 화면) - is_online은 DB 컬럼이 아니라 admin_list_kiosks가
    # 응답 조립 시점에 계산해서 채운다.
    is_online: bool = False
    last_seen_at: Optional[UTCDatetime] = None
    sales: KioskSalesSummary

# 키오스크별 결제 이력(영구 보존, 기간 제한 없이 커서 페이지네이션으로 지연 로드) - 키오스크
# 화면의 "최근 결제 내역" 패널과 관리자 키오스크 상세 화면이 공유하는 응답. HistoryItemResponse
# (회원 본인 이용내역)는 이미 "누구"인지 알고 있는 화면용이라 user_name/user_type이 없어서
# 재사용할 수 없다 - 여기서는 어느 회원이 결제했는지가 핵심 정보라 별도 스키마로 둔다.
class KioskPaymentHistoryItem(BaseModel):
    user_name: str
    user_type: str  # "시니어" | "일반"
    amount: int
    balance_after: Optional[int] = None
    product_details: Optional[str] = None
    event_time: UTCDatetime

class KioskPaymentHistoryPage(BaseModel):
    items: List[KioskPaymentHistoryItem]
    next_cursor: Optional[str] = None

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

# Deposit History (충전이 실제로 반영된 통합 이력)
class DepositHistoryResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    amount: int
    deposit_type: str
    transaction_id: Optional[str] = None
    memo: Optional[str]
    balance_after: Optional[int] = None
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

# ================= 이용내역 (계좌이체/결제/관리자충전 통합, 커서 페이지네이션) =================

class HistoryItemResponse(BaseModel):
    label: str  # "금액 충전" / "금액 차감" / "결제 성공" / "결제 실패" / "보류"
    badge_class: str  # "status-done" | "status-rejected" | "status-payment"
    # 카드 좌측 원형 아이콘/틴트를 고르는 값(#history-redesign) - label만으로는 계좌이체
    # 자동충전과 관리자 직권충전이 둘 다 "금액 충전"이라 구분이 안 돼 따로 뽑았다.
    # "payment" | "payment_failed" | "bank_charge" | "pending" | "admin_charge" | "admin_deduct"
    category: str
    amount: int  # 부호 있는 원래 금액값 (참고용 - 화면 표시는 amount_text/amount_class 사용)
    amount_text: str  # 화면에 그대로 넣을 문자열(부호/천단위 콤마 포함, 예: "+10,000원")
    amount_class: str  # "amount-positive" | "amount-negative" | "amount-neutral"
    balance_after: Optional[int] = None
    reason: str
    event_time: UTCDatetime  # 실제 반영 시각(계좌이체는 resolved_at, 그 외는 created_at)

class HistoryPageResponse(BaseModel):
    items: List[HistoryItemResponse]
    next_cursor: Optional[str] = None  # items가 비어있으면 None - 클라이언트는 이걸로 "더 없음" 판단

# ================= Web Push 구독 =================

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    # 관리자 쪽 항목별 on/off - 회원 구독 요청에는 안 실려오지만 스키마 기본값(True)으로 채워짐.
    # None(미전송)은 "값을 바꾸지 말라"는 의미 - 만료된 구독을 조용히 갱신만 할 때(재구독) 항목별
    # 설정을 함께 안 보내도 기존에 저장해둔 on/off가 덮어써지지 않게 하기 위함.
    notify_deposit_error: Optional[bool] = None
    notify_deposit_credited: Optional[bool] = None
    notify_payment: Optional[bool] = None

class PushSubscriptionDelete(BaseModel):
    endpoint: str

class PushResubscribe(BaseModel):
    # 서비스워커가 pushsubscriptionchange/주기적 갱신 시 로그인 세션 없이(앱이 꺼져있어도) 호출
    # 하므로 Bearer 토큰이 없다 - old_endpoint를 아는 것 자체를 소유 증명으로 삼는다.
    old_endpoint: str
    endpoint: str
    keys: PushSubscriptionKeys

class PushCategoriesUpdate(BaseModel):
    endpoint: str
    notify_deposit_error: bool = True
    notify_deposit_credited: bool = True
    notify_payment: bool = True

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
