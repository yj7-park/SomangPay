import datetime
import uuid
from sqlalchemy import Column, Integer, String, BigInteger, Boolean, Date, DateTime, ForeignKey, Text, Enum, UniqueConstraint, LargeBinary
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
    # 생년월일 - 있으면 회원 유형(시니어/일반)을 만 나이로 자동 판정한다(services/member_age.py).
    # 예전엔 나이만 아는 회원용 birth_year(출생연도)도 있었는데, 교인 명단에 생년월일이 생겨서 뺐다.
    birth_date = Column(Date, nullable=True)
    church_position = Column(String(20), nullable=True) # 직분(집사/권사/장로 ...) - 참고용
    church_group = Column(String(100), nullable=True) # 소속(공동체/교구/순) - 참고용
    bank_name = Column(String(50), nullable=True) # 관리자 참고용 메모 - 입금 매칭에는 미사용(매칭은 입금자명 기준)
    account_number = Column(String(50), nullable=True) # 관리자 참고용 메모 - 입금 매칭에는 미사용(매칭은 입금자명 기준)
    credit_balance = Column(Integer, default=0, nullable=False)
    password_hash = Column(String(200), default="1234", nullable=True) # 기본 비밀번호 1234
    # ACTIVE / INACTIVE / SUSPENDED. INACTIVE(비활성)는 아직 서비스를 열어주지 않은 회원 -
    # 회원 목록에는 그대로 보이지만 로그인/결제/입금 처리/문자 발송이 전부 막힌다(관리자가
    # 회원 상세에서 토글). SUSPENDED(정지)는 분실 등으로 막은 회원이라 목록에서도 숨긴다.
    # 막는 쪽 코드는 전부 `status == "ACTIVE"`로 검사하므로 두 상태가 똑같이 차단된다.
    status = Column(String(20), default="ACTIVE")
    # 회원이 직접 비밀번호를 정했는지(#activation). False면 앱 로그인 전에 문자 인증번호 →
    # 비밀번호 설정을 먼저 거친다(앱 계정 "미활성"). 카드/키오스크 결제와는 무관 - status만 본다.
    password_set = Column(Boolean, default=False, nullable=False)
    # 프로필 사진을 마지막으로 바꾼 시각 - NULL이면 사진 없음. 이미지 자체는 회원 목록 조회가
    # 무거워지지 않게 user_photos에 따로 두고, 이 값은 사진 URL 캐시버스팅(?v=)에도 쓴다.
    photo_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    cards = relationship("NFCCard", back_populates="owner")
    deposits = relationship("DepositHistory", foreign_keys="[DepositHistory.user_id]", back_populates="user")
    payments = relationship("PaymentTransaction", back_populates="user")

class UserPhoto(Base):
    """회원 프로필 사진(관리자 화면 표시용). users와 1:1 - 목록 조회 때 바이너리를 안 끌고
    오도록 별도 테이블로 뺐다."""
    __tablename__ = "user_photos"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    content_type = Column(String(50), nullable=False, default="image/png")
    image = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

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
    amount = Column(Integer, nullable=False) # 차감(ADMIN_MANUAL_DEDUCT)은 음수로 저장
    deposit_type = Column(String(30), nullable=False) # ADMIN_MANUAL, ADMIN_MANUAL_DEDUCT, BANK_TRANSFER (과거 데이터에 TOSS_DEEPLINK/KAKAOPAY_DEEPLINK가 남아 있을 수 있음)
    transaction_id = Column(String(100), nullable=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    memo = Column(String(200), nullable=True)
    balance_after = Column(Integer, nullable=True) # 반영 시점의 회원 잔액 스냅샷(#19 이력 카드 우하단 표시용)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="deposits")

class BankTransaction(Base):
    """농협 계좌조회로 가져온(지금은 모킹) 원본 입금 원장. 실제 API 연동 전까지는
    관리자가 POST /api/admin/bank-transactions로 직접 입력한다(또는 SMS/RCS 자동감지).

    등록 즉시 입금자명으로 등록 회원과 자동 매칭을 시도한다(deposit_matcher.match_new_deposit).
    상태: PENDING(회원 자동매칭됨, 회원이 앱에서 선택해 충전 대기) / ERROR(입금자명이 등록
    회원과 매칭 안 됨, 관리자만 조회 가능) / CREDITED(회원 본인이 선택해 충전 완료) /
    CREDITED_MANUAL(관리자가 회원을 지정해 대신 충전 완료) / OTHER(관리자가 사유를 남기고
    충전 대상 아님으로 종결, 크레딧 미반영) / INACTIVE(비활성 회원과 매칭 - 그 회원이 아직
    시스템을 안 쓰던 때의 입금이라 아무 처리도 안 하고 그대로 둔다, 활성화해도 되살리지 않음)."""
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    external_txn_id = Column(String(100), unique=True, index=True, nullable=False) # 은행 거래고유번호 (재조회 dedup 키)
    transaction_at = Column(DateTime, default=datetime.datetime.utcnow)
    amount = Column(Integer, nullable=False)
    depositor_name = Column(String(50), nullable=False) # 통장에 찍히는 입금자명 원문
    status = Column(String(20), default="PENDING")
    matched_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True) # CREDITED_MANUAL/OTHER 처리한 관리자
    balance_after = Column(Integer, nullable=True) # 충전 반영 시점의 회원 잔액 (CREDITED/CREDITED_MANUAL만 채워짐)
    resolution_memo = Column(String(200), nullable=True) # OTHER 처리 사유, 또는 관리자 처리 메모
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reminder_sent_at = Column(DateTime, nullable=True) # 미완료 충전 안내 문자 보낸 시각(services/deposit_reminder.py, 건당 1회)

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
    is_active = Column(Boolean, default=False, nullable=False) # 관리자 PIN으로 등록 완료된 단말기만 True - 미등록 단말기는 결제 등 모든 기능 차단
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    # 키오스크 하트비트(naive UTC). ws_kiosk가 연결 시점 + WS_PING_INTERVAL마다 갱신한다.
    # "지금 온라인인지"는 이 값의 신선도로 판단한다(main.py의 _kiosk_is_online,
    # KIOSK_ONLINE_TTL_SECONDS) - uvicorn 워커가 여러 개라 프로세스 로컬인
    # manager.kiosk_sockets로는 워커마다 답이 달라지기 때문. 오프라인일 때 "n분 전 접속"
    # 표시에도 같은 값을 쓴다.
    last_seen_at = Column(DateTime, nullable=True)

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

class PushSubscription(Base):
    """회원/관리자 기기의 Web Push 구독 정보 (기기/브라우저별로 별도 행 - 다중 기기 허용).
    notify_* 플래그는 관리자 쪽 항목별 on/off용 - 회원 쪽 발송(send_push_to_user)은
    카테고리 구분 없이 항상 보내므로 회원 구독 행에서는 사실상 안 쓰이고 기본값(True)로 남는다."""
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(Text, unique=True, nullable=False)
    p256dh = Column(String(200), nullable=False)
    auth = Column(String(100), nullable=False)
    notify_deposit_error = Column(Boolean, default=True, nullable=False)  # 미매칭 입금 발생(관리자 확인 필요)
    notify_deposit_credited = Column(Boolean, default=True, nullable=False)  # 회원 셀프클레임으로 충전 반영됨
    notify_payment = Column(Boolean, default=True, nullable=False)  # 키오스크 결제 발생
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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

class SmsOutbox(Base):
    """문자(SMS) 발송 대기열. 관리자 웹/PWA나 백엔드 코드는 여기에 행을 넣기만 하고(services/
    sms_outbox.enqueue_sms), 실제 발송은 "이 기기에서 문자 발송"을 켠 관리자 APK가 주기적으로
    POST /api/admin/sms/claim으로 가져가서 그 폰의 요금제/번호로 보낸 뒤 결과를 보고한다.
    웹/PWA에는 문자를 보낼 방법이 없고, WS는 워커 로컬이라 신호가 안 닿을 수 있어 DB를 경유한다.

    상태: QUEUED(대기) → SENDING(어느 기기가 가져감) → SENT(통신사 전송 성공) / FAILED(전송 실패 또는
    만료). CANCELED(관리자가 대기 중 취소). SENDING에서 결과 보고 없이 오래 멈춰 있으면(기기가 꺼짐
    등) 다음 claim 때 QUEUED로 되돌리거나 시도 횟수 초과 시 FAILED로 정리한다(sms_outbox.py)."""
    __tablename__ = "sms_outbox"

    id = Column(Integer, primary_key=True, index=True)
    to_phone = Column(String(20), nullable=False)  # 숫자만(normalize_phone)
    body = Column(Text, nullable=False)
    status = Column(String(20), default="QUEUED", nullable=False, index=True)
    source = Column(String(30), default="admin", nullable=False)  # admin(관리자 화면) / system(백엔드 자동) 등
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 받는 회원(회원 대상일 때만)
    requested_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender_device_id = Column(String(100), nullable=True)  # 가져간 APK 기기 식별자
    attempts = Column(Integer, default=0, nullable=False)
    error = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    claimed_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)

class SmsSenderDevice(Base):
    """문자 발송을 켠 관리자 APK 기기 - claim 폴링마다 last_seen_at을 갱신한다. 관리자 화면에서
    "지금 문자가 실제로 나갈 수 있는지(발송 기기가 살아 있는지)"를 보여주는 용도."""
    __tablename__ = "sms_sender_devices"

    device_id = Column(String(100), primary_key=True)
    device_name = Column(String(100), nullable=True)
    last_seen_at = Column(DateTime, nullable=True)

class UserActivationCode(Base):
    """앱 계정 활성화용 문자 인증번호(#activation). 비밀번호를 아직 안 정한 회원이 로그인을 시도하면
    6자리 번호를 만들어 문자 대기열(SmsOutbox)로 보낸다. 번호는 해시만 저장하고, 유효시간(1분)은
    문자가 실제로 발송된 시각(sms.sent_at)부터 잰다 - 발송 기기 폴링 지연만큼 손해 보지 않게."""
    __tablename__ = "user_activation_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code_hash = Column(String(200), nullable=False)
    sms_id = Column(Integer, ForeignKey("sms_outbox.id"), nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
