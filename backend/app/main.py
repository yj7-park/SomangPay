import datetime
import hmac
import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Body, Header, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas, security
from app.database import engine, get_db, init_db
from app.phone_utils import normalize_phone
from app.services.recharge_matcher import try_resolve_recharge_request, try_resolve_bank_transaction
from app.ws_manager import manager, notify_admins, notify_user

app = FastAPI(
    title="SomangPay API Server",
    description="소망페이 (SomangPay) NFC 충전 및 무인 결제 백엔드 API",
    version="1.0.0"
)

# CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHURCH_BANK_NAME = os.getenv("CHURCH_BANK_NAME", "NH농협")
CHURCH_ACCOUNT_NUMBER = os.getenv("CHURCH_ACCOUNT_NUMBER", "302-1234-5678-01")
CHURCH_ACCOUNT_HOLDER = os.getenv("CHURCH_ACCOUNT_HOLDER", "소망교회")

KST = datetime.timezone(datetime.timedelta(hours=9))


def _kst_period_starts_utc():
    """오늘/이번주/이번달의 KST 자정 경계를 구해 naive UTC로 변환한다 (DB에는
    datetime.utcnow() naive UTC로 저장돼 있어 KST 변환 없이 끊으면 최대 9시간 어긋난다)."""
    now_kst = datetime.datetime.now(KST)
    today_start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start_kst = today_start_kst - datetime.timedelta(days=now_kst.weekday())
    month_start_kst = today_start_kst.replace(day=1)

    def to_naive_utc(dt_kst):
        return dt_kst.astimezone(datetime.timezone.utc).replace(tzinfo=None)

    return {
        "today": to_naive_utc(today_start_kst),
        "this_week": to_naive_utc(week_start_kst),
        "this_month": to_naive_utc(month_start_kst),
    }


def require_admin_auth(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> "models.User":
    """관리자 전용 라우트에 붙이는 의존성. /api/admin/verify-pin(또는 verify-auth)에서
    발급한 서명 토큰을 'Authorization: Bearer <token>' 헤더로 검증한다."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="관리자 인증이 필요합니다.")

    token = authorization[len("Bearer "):]
    admin_id = security.verify_admin_token(token)
    if not admin_id:
        raise HTTPException(status_code=401, detail="관리자 세션이 만료되었거나 유효하지 않습니다. 다시 인증해 주세요.")

    admin = db.query(models.User).filter(
        models.User.id == admin_id,
        models.User.role == "ADMIN",
        models.User.status == "ACTIVE",
    ).first()
    if not admin:
        raise HTTPException(status_code=401, detail="관리자 권한이 없습니다.")
    return admin


def require_user_auth(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> "models.User":
    """회원 자기 서비스 라우트(잔액 조회, 충전 신청 등)에 붙이는 의존성. 로그인 시 발급한
    회원 토큰을 검증한다. 매 요청마다 status == ACTIVE를 재확인하므로, 관리자가 회원을
    정지시키면 만료 전이라도 즉시 무력화된다."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    token = authorization[len("Bearer "):]
    user_id = security.verify_user_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.")

    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.status == "ACTIVE",
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="유효하지 않은 회원입니다.")
    return user


# 초기 시드 데이터 구축
@app.on_event("startup")
def startup_db_seed():
    init_db()
    db = next(get_db())
    # Admin 계정 생성
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin = models.User(
            username="admin",
            name="시스템 관리자",
            role="ADMIN",
            user_type="GENERAL",
            credit_balance=0
        )
        db.add(admin)

    # 시니어 시범 회원 생성
    senior = db.query(models.User).filter(models.User.name == "김순자 어르신").first()
    if not senior:
        senior_phone = normalize_phone("010-1234-5678")
        senior = models.User(
            username=senior_phone,
            name="김순자 어르신",
            phone=senior_phone,
            role="USER",
            user_type="SENIOR",
            credit_balance=30000
        )
        db.add(senior)
        db.commit()
        db.refresh(senior)
        # NFC 카드 등록
        card1 = models.NFCCard(
            card_uid="CARD_SENIOR_01",
            card_name="김순자 어르신 실물 NFC 카드",
            user_id=senior.id
        )
        db.add(card1)

    # 어린이/일반 회원 생성
    child = db.query(models.User).filter(models.User.name == "이동민 어린이").first()
    if not child:
        child_phone = normalize_phone("010-9876-5432")
        child = models.User(
            username=child_phone,
            name="이동민 어린이",
            phone=child_phone,
            role="USER",
            user_type="GENERAL",
            credit_balance=15000
        )
        db.add(child)
        db.commit()
        db.refresh(child)
        # NFC 카드 등록
        card2 = models.NFCCard(
            card_uid="CARD_CHILD_01",
            card_name="이동민 어린이 스마트폰 NFC",
            user_id=child.id
        )
        db.add(card2)

    # 기본 메뉴/상품 등록
    if db.query(models.Product).count() == 0:
        products = [
            models.Product(name="식권", price_general=2000, price_senior=1000),
            models.Product(name="라면", price_general=2000, price_senior=2000),
            models.Product(name="아이스크림", price_general=600, price_senior=600),
            models.Product(name="특별 간식 세트", price_general=3500, price_senior=2500),
        ]
        db.add_all(products)

    db.commit()

@app.get("/")
def read_root():
    return {"message": "SomangPay API Server is Running Successfully!"}

# ================= 회원 인증 & 자기 서비스 APIs =================

@app.post("/api/users/login", response_model=schemas.UserLoginResponse)
def user_login(req: schemas.UserLoginRequest, db: Session = Depends(get_db)):
    """회원 로그인 API. ID는 전화번호(하이픈 유무 무관)."""
    phone = normalize_phone(req.phone)
    user = db.query(models.User).filter(models.User.phone == phone).first()

    if not user:
        raise HTTPException(status_code=400, detail="존재하지 않는 전화번호입니다.")

    # 비밀번호 검증 (기본값 1234 또는 설정한 비밀번호). 레거시 평문 해시는 검증 성공 시
    # 그 자리에서 PBKDF2 해시로 자동 승급시켜 저장한다(migrate-on-login).
    stored_pass = user.password_hash or "1234"
    if not security.verify_password(req.password, stored_pass):
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다. (초기 비밀번호: 1234)")
    if security.needs_rehash(stored_pass):
        user.password_hash = security.hash_password(req.password)
        db.commit()

    if user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="비활성화되거나 정지된 회원 계정입니다.")

    token = security.create_user_token(user.id)
    return schemas.UserLoginResponse(
        id=user.id, username=user.username, name=user.name, phone=user.phone,
        role=user.role, user_type=user.user_type, bank_name=user.bank_name,
        account_number=user.account_number, credit_balance=user.credit_balance,
        status=user.status, created_at=user.created_at, token=token,
    )

@app.get("/api/users/me", response_model=schemas.UserResponse)
def get_my_info(user: models.User = Depends(require_user_auth)):
    """로그인한 본인 정보 + 잔액 조회."""
    return user

@app.put("/api/users/me/password")
def change_my_password(
    req: schemas.UserPasswordChange,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """회원 본인이 로그인 후 비밀번호를 변경."""
    user.password_hash = security.hash_password(req.new_password)
    db.commit()
    return {"success": True, "message": "비밀번호가 변경되었습니다."}

# ================= 관리자 - 회원 CRUD =================

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    """전체 회원 목록(전화번호/계좌번호/잔액 등 PII 포함) - 관리자 전용."""
    return db.query(models.User).all()

@app.get("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
def admin_get_user_detail(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/admin/register-user", response_model=schemas.UserResponse)
async def admin_register_user(
    req: schemas.UserProxyCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자 대리 회원 등록 API. 이름은 유일해야 하며, 동명이인이면 관리자가 구분되는
    이름(예: 홍길동B)을 직접 입력해야 한다. 전화번호가 로그인 ID가 된다."""
    if db.query(models.User).filter(models.User.name == req.name).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이름입니다. 동명이인이라면 구분되는 이름(예: 홍길동B)을 입력해주세요.")

    phone = normalize_phone(req.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="전화번호를 입력해주세요.")
    if db.query(models.User).filter(models.User.phone == phone).first():
        raise HTTPException(status_code=400, detail="이미 등록된 전화번호입니다.")

    new_user = models.User(
        username=phone,
        name=req.name,
        phone=phone,
        user_type=req.user_type,
        bank_name=req.bank_name,
        account_number=req.account_number,
        credit_balance=req.initial_credit,
        password_hash=security.hash_password("1234"),
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 사용 중인 이름 또는 전화번호입니다.")
    db.refresh(new_user)

    if req.initial_credit > 0:
        db.add(models.DepositHistory(
            user_id=new_user.id,
            amount=req.initial_credit,
            deposit_type="ADMIN_MANUAL",
            memo="신규 등록 관리자 직권 초기 충전",
            admin_id=admin.id,
        ))
        db.commit()

    await notify_admins(["users", "stats"])
    return new_user

@app.put("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
async def admin_update_user(
    user_id: int,
    req: schemas.UserAdminUpdateInfo,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """관리자가 회원 정보(이름/전화번호/구분/계좌/비밀번호 초기화)를 수정."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    if req.name is not None and req.name != user.name:
        if db.query(models.User).filter(models.User.name == req.name, models.User.id != user_id).first():
            raise HTTPException(status_code=400, detail="이미 사용 중인 이름입니다. 동명이인이라면 구분되는 이름(예: 홍길동B)을 입력해주세요.")
        user.name = req.name
    if req.phone is not None:
        phone = normalize_phone(req.phone)
        if db.query(models.User).filter(models.User.phone == phone, models.User.id != user_id).first():
            raise HTTPException(status_code=400, detail="이미 등록된 전화번호입니다.")
        user.phone = phone
    if req.user_type is not None:
        user.user_type = req.user_type
    if req.bank_name is not None:
        user.bank_name = req.bank_name
    if req.account_number is not None:
        user.account_number = req.account_number
    if req.new_password:
        user.password_hash = security.hash_password(req.new_password)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 사용 중인 이름 또는 전화번호입니다.")
    db.refresh(user)
    await notify_admins(["users"])
    await notify_user(user.id, ["me"])
    return user

@app.post("/api/admin/recharge-credit")
async def admin_recharge_credit(
    req: schemas.AdminRechargeRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자 수동 직권 크레딧 충전 API (현금 직접 충전 등, 계좌이체 매칭과 무관). amount는
    스키마에서 0 초과만 허용(직권 충전으로 위장한 잔액 차감/무한 충전을 막기 위함)."""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    user.credit_balance += req.amount
    db.add(models.DepositHistory(
        user_id=user.id,
        amount=req.amount,
        deposit_type="ADMIN_MANUAL",
        memo=req.memo or "관리자 직권 충전",
        admin_id=admin.id,
    ))
    db.commit()
    db.refresh(user)

    await notify_admins(["users", "stats", "deposits"])
    await notify_user(user.id, ["me"])
    return {
        "success": True,
        "message": f"{user.name}님에게 {req.amount:,}원이 충전되었습니다.",
        "new_balance": user.credit_balance
    }

@app.post("/api/admin/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    req: schemas.UserStatusUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """회원 정지/재활성화. 카드/휴대폰 분실 등으로 결제 자체를 즉시 막아야 할 때 사용."""
    if req.status not in ("ACTIVE", "SUSPENDED"):
        raise HTTPException(status_code=400, detail="status는 ACTIVE 또는 SUSPENDED만 가능합니다.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    user.status = req.status
    db.commit()
    await notify_admins(["users"])
    await notify_user(user.id, ["me"])
    return {"success": True, "message": f"{user.name}님의 상태가 {req.status}로 변경되었습니다.", "status": user.status}

# ================= NFC/QR 카드 APIs (관리자 전용) =================

@app.get("/api/admin/cards", response_model=List[schemas.NFCCardResponse])
def get_nfc_cards(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    cards = db.query(models.NFCCard).all()
    result = []
    for c in cards:
        res = schemas.NFCCardResponse.from_orm(c)
        owner = db.query(models.User).filter(models.User.id == c.user_id).first()
        res.user_name = owner.name if owner else "Unknown"
        result.append(res)
    return result

@app.get("/api/cards/user/{user_id}", response_model=List[schemas.NFCCardResponse])
def get_user_cards(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    """특정 회원에게 등록된 NFC/QR 카드 목록 조회 (최대 2개: NFC 1 + QR 1)."""
    return db.query(models.NFCCard).filter(models.NFCCard.user_id == user_id).all()

@app.put("/api/admin/cards", response_model=schemas.NFCCardResponse)
async def upsert_nfc_card(
    req: schemas.NFCCardUpsert,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """NFC/QR 카드 등록·교체. 회원당 타입별 최대 1개 - 이미 있으면 UID를 교체하고,
    없으면 새로 발급한다. 태그된 UID가 이미 다른 회원 소유였다면 이 회원에게 재할당한다."""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원입니다.")
    if req.card_type not in ("NFC", "QR_CODE"):
        raise HTTPException(status_code=400, detail="card_type은 NFC 또는 QR_CODE만 가능합니다.")

    default_name = f"{user.name}의 {'교인증 QR 코드' if req.card_type == 'QR_CODE' else '실물 NFC 카드'}"

    # 이 UID를 다른 회원/다른 타입으로 이미 쓰고 있었다면 그 행은 제거(재할당).
    # 그 카드를 참조하던 결제 이력은 카드 참조만 해제하고 보존한다.
    existing_by_uid = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid).first()
    if existing_by_uid and not (existing_by_uid.user_id == req.user_id and existing_by_uid.card_type == req.card_type):
        db.query(models.PaymentTransaction).filter(models.PaymentTransaction.card_id == existing_by_uid.id).update({"card_id": None})
        db.delete(existing_by_uid)
        db.flush()

    target = db.query(models.NFCCard).filter(
        models.NFCCard.user_id == req.user_id,
        models.NFCCard.card_type == req.card_type,
    ).first()

    if target:
        target.card_uid = req.card_uid
        target.card_name = req.card_name or default_name
        target.issued_at = datetime.datetime.utcnow()
    else:
        target = models.NFCCard(
            card_uid=req.card_uid,
            card_name=req.card_name or default_name,
            card_type=req.card_type,
            user_id=req.user_id,
        )
        db.add(target)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="이미 사용 중인 카드 코드입니다.")
    db.refresh(target)

    res = schemas.NFCCardResponse.from_orm(target)
    res.user_name = user.name
    await notify_admins(["cards"])
    return res

@app.delete("/api/admin/cards/{card_id}")
async def delete_nfc_card(
    card_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """카드 삭제. 결제 이력(PaymentTransaction)은 보존하되 카드 참조만 해제한다."""
    card = db.query(models.NFCCard).filter(models.NFCCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")

    db.query(models.PaymentTransaction).filter(models.PaymentTransaction.card_id == card_id).update({"card_id": None})
    db.delete(card)
    db.commit()
    await notify_admins(["cards"])
    return {"success": True, "message": "카드가 삭제되었습니다."}

# ================= PRODUCTS (MENU) APIs =================

@app.get("/api/products", response_model=List[schemas.ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).filter(models.Product.is_active == True).all()

@app.post("/api/products", response_model=schemas.ProductResponse)
def create_product(req: schemas.ProductCreate, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    product = models.Product(
        name=req.name,
        price_general=req.price_general,
        price_senior=req.price_senior,
        merchant_id=req.merchant_id
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/api/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, req: schemas.ProductUpdate, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    product = db.query(models.Product).filter(models.Product.id == product_id, models.Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if req.name is not None:
        product.name = req.name
    if req.price_general is not None:
        product.price_general = req.price_general
    if req.price_senior is not None:
        product.price_senior = req.price_senior
    db.commit()
    db.refresh(product)
    return product

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    return {"success": True, "message": "Product soft deleted successfully"}

class AdminAuthVerifyRequest(schemas.BaseModel):
    pin: Optional[str] = None
    card_uid: Optional[str] = None

@app.post("/api/admin/verify-pin")
@app.post("/api/admin/verify-auth")
def verify_admin_auth(req: AdminAuthVerifyRequest, request: Request, db: Session = Depends(get_db)):
    """UC-07: 관리자 보안 인증 API (PIN 코드 또는 관리자 NFC/QR 식별자 다중 매체 인증).
    성공 시 서명된 세션 토큰을 발급한다 - 이 토큰 없이는 관리자 전용 API를 호출할 수 없다
    (require_admin_auth 참고). IP당 5분에 5회로 PIN 시도 횟수를 제한해 브루트포스를 억제한다."""
    client_ip = request.client.host if request.client else "unknown"
    if not security.register_pin_attempt(client_ip):
        raise HTTPException(status_code=429, detail="PIN 시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.")

    if req.pin and hmac.compare_digest(req.pin, security.ADMIN_PIN):
        security.clear_pin_attempts(client_ip)
        admin_user = db.query(models.User).filter(models.User.role == "ADMIN").first()
        token = security.create_admin_token(admin_user.id if admin_user else 0)
        return {"success": True, "message": "관리자 PIN 인증이 승인되었습니다.", "auth_type": "PIN", "token": token}

    if req.card_uid:
        card = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid).first()
        if card:
            user = db.query(models.User).filter(models.User.id == card.user_id).first()
            if user and user.role == "ADMIN" and user.status == "ACTIVE":
                security.clear_pin_attempts(client_ip)
                token = security.create_admin_token(user.id)
                return {
                    "success": True,
                    "message": f"관리자({user.name}) 식별자 인증이 완료되었습니다.",
                    "admin_name": user.name,
                    "auth_type": "CARD_QR",
                    "token": token
                }

    raise HTTPException(status_code=401, detail="인증 실패: 관리자 PIN이 올바르지 않거나 권한이 없는 식별자입니다.")

# ================= UNMANNED KIOSK PAYMENT API =================

@app.post("/api/payments/pay", response_model=schemas.PaymentResponse)
async def process_nfc_payment(req: schemas.PaymentRequest, db: Session = Depends(get_db)):
    """UC-01 & UC-08: 무인 단말기 듀얼 결제 승인 및 기본 결제 30초 중복 결제 방지 API"""
    # 1. NFC 카드/교인증 QR 고유 식별자로 회원 계정 조회
    card = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid).first()

    if not card:
        raise HTTPException(
            status_code=400,
            detail=f"등록되지 않은 식별자입니다. (Code: {req.card_uid})"
        )

    user = db.query(models.User).filter(models.User.id == card.user_id).first()
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="유효하지 않은 회원입니다.")

    # 2. 동적 가맹점(Merchant) 및 기본 결제 설정(Default Quick Pay) 맵핑
    merchant_id = req.merchant_id
    kiosk_dev = None
    if req.device_uuid:
        kiosk_dev = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == req.device_uuid).first()
        if kiosk_dev and kiosk_dev.merchant_id:
            merchant_id = kiosk_dev.merchant_id

    # 메뉴 미선택(req.items가 비어있음) 시 기본 결제 설정 적용
    effective_items = req.items or []

    if not effective_items:
        if kiosk_dev and kiosk_dev.default_product_id:
            effective_items = [schemas.PaymentItem(
                product_id=kiosk_dev.default_product_id,
                quantity=kiosk_dev.default_quantity or 1
            )]
        else:
            raise HTTPException(status_code=400, detail="메뉴를 먼저 선택해 주세요. 이 단말기에는 기본 결제 설정이 없습니다.")

    # UC-08: 30초 이내 동일 회원 중복 결제 방지 체크.
    # 프론트엔드(kiosk.js)가 화면 로드 시 기본 메뉴를 장바구니에 미리 채워두기 때문에
    # req.items가 비어서 오는 경우가 사실상 없다 - "기본 결제 적용 여부"로 이 체크를
    # 게이트하면 메뉴를 직접 선택한 일반적인 태깅에서는 절대 트리거되지 않는다.
    # 메뉴 선택 여부와 무관하게, 짧은 시간 내 반복 태깅 자체를 감지해야 한다.
    if not req.force_confirm:
        # 최근 30초 이내에 동일 회원의 SUCCESS 결제 트랜잭션 검사
        thirty_seconds_ago = datetime.datetime.utcnow() - datetime.timedelta(seconds=30)
        recent_tx = db.query(models.PaymentTransaction).filter(
            models.PaymentTransaction.user_id == user.id,
            models.PaymentTransaction.status == "SUCCESS",
            models.PaymentTransaction.created_at >= thirty_seconds_ago
        ).first()

        if recent_tx:
            # 30초 이내 재결제 감지 ➔ 추가 결제 하시겠습니까? 모달 요구 응답
            return schemas.PaymentResponse(
                user_name=user.name,
                status="CONFIRM_REQUIRED",
                message="추가 결제 하시겠습니까?",
                total_amount=0,
                balance_after=user.credit_balance
            )

    merchant = None
    if merchant_id:
        merchant = db.query(models.Merchant).filter(models.Merchant.id == merchant_id).first()
    if not merchant:
        merchant = db.query(models.Merchant).first()
    if not merchant:
        merchant = models.Merchant(
            merchant_name="소망 복지 결제 무인 가맹점",
            biz_number="123-45-67890"
        )
        db.add(merchant)
        db.commit()
        db.refresh(merchant)

    merchant_id = merchant.id

    user = db.query(models.User).filter(models.User.id == card.user_id).first()
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="유효하지 않은 회원입니다.")

    # 2. 선택한 메뉴 및 수량 계산 (시니어/일반 자동 할인가 적용)
    total_amount = 0
    item_summaries = []

    for item in effective_items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product or not product.is_active:
            continue

        # 회원 유형에 따라 가격 결정 (SENIOR vs GENERAL)
        unit_price = product.price_senior if user.user_type == "SENIOR" else product.price_general
        item_total = unit_price * item.quantity
        total_amount += item_total
        item_summaries.append(f"{product.name} x{item.quantity} ({unit_price:,}원)")

    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="메뉴를 먼저 선택해 주세요.")

    # 3. 잔액 검증
    if user.credit_balance < total_amount:
        # 실패 트랜잭션 기록
        tx_failed = models.PaymentTransaction(
            user_id=user.id,
            card_id=card.id,
            merchant_id=merchant_id,
            product_details=", ".join(item_summaries),
            amount=total_amount,
            balance_after=user.credit_balance,
            status="FAILED",
            failure_reason="잔액 부족"
        )
        db.add(tx_failed)
        db.commit()
        raise HTTPException(status_code=400, detail=f"잔액이 부족합니다. (필요: {total_amount:,}원, 잔액: {user.credit_balance:,}원)")

    # 4. 크레딧 차감
    user.credit_balance -= total_amount

    # 5. 성공 트랜잭션 기록
    tx_success = models.PaymentTransaction(
        user_id=user.id,
        card_id=card.id,
        merchant_id=req.merchant_id,
        product_details=", ".join(item_summaries),
        amount=total_amount,
        balance_after=user.credit_balance,
        status="SUCCESS"
    )
    db.add(tx_success)
    db.commit()
    db.refresh(tx_success)

    # 결제로 잔액이 바뀌었으므로 관리자 대시보드와 결제한 회원 본인 화면을 갱신
    await notify_admins(["users", "stats"])
    await notify_user(user.id, ["me"])

    user_type_label = "시니어" if user.user_type == "SENIOR" else "일반"

    return schemas.PaymentResponse(
        transaction_code=tx_success.transaction_code,
        user_name=user.name,
        user_type=user_type_label,
        total_amount=total_amount,
        balance_after=user.credit_balance,
        status="SUCCESS",
        message="결제되었습니다.",
        created_at=tx_success.created_at
    )

@app.get("/api/payments", response_model=List[schemas.PaymentTransactionResponse])
def get_payment_transactions(
    user_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """결제 내역 조회 (관리자 전용) - 통계 및 회원 상세 화면에서 사용."""
    query = db.query(models.PaymentTransaction)
    if user_id is not None:
        query = query.filter(models.PaymentTransaction.user_id == user_id)
    txs = query.order_by(models.PaymentTransaction.id.desc()).offset(offset).limit(min(limit, 200)).all()

    result = []
    for tx in txs:
        res = schemas.PaymentTransactionResponse.from_orm(tx)
        user = db.query(models.User).filter(models.User.id == tx.user_id).first()
        res.user_name = user.name if user else "Unknown"
        result.append(res)
    return result

# ================= TOSS & KAKAOPAY DEEPLINK APIS =================

class DeeplinkRequest(schemas.BaseModel):
    user_id: int
    amount: int = schemas.Field(gt=0)
    provider: str  # TOSS, KAKAOPAY

@app.post("/api/payments/deeplink")
def create_pay_deeplink(req: DeeplinkRequest, db: Session = Depends(get_db)):
    """
    토스 / 카카오페이 1초 간편 송금 트리거 딥링크 생성 API
    """
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    target_acc = CHURCH_ACCOUNT_NUMBER
    memo = f"소망페이_{user.name}"

    if req.provider.upper() == "TOSS":
        # 토스 앱 송금 딥링크 (supertoss://send)
        deeplink = f"supertoss://send?bank={CHURCH_BANK_NAME}&account={target_acc}&amount={req.amount}&msg={memo}"
        fallback_web = f"https://toss.me/somangpay/{req.amount}"
        app_name = "토스 (Toss)"
    elif req.provider.upper() == "KAKAOPAY":
        # 카카오페이 송금 딥링크 (kakaotalk://kakaopay)
        deeplink = f"kakaotalk://kakaopay/money/to/qr?amount={req.amount}"
        fallback_web = f"https://qr.kakaopay.com/somangpay?amount={req.amount}"
        app_name = "카카오페이 (KakaoPay)"
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 결제 수단입니다.")

    return {
        "success": True,
        "provider": req.provider,
        "app_name": app_name,
        "amount": req.amount,
        "user_name": user.name,
        "deeplink_url": deeplink,
        "fallback_url": fallback_web,
        "message": f"{app_name} 앱으로 이동합니다. 송금을 승인하시면 즉시 크레딧이 충전됩니다."
    }

@app.post("/api/payments/deeplink-confirm")
def confirm_deeplink_payment(req: DeeplinkRequest, db: Session = Depends(get_db)):
    """
    토스/카카오페이 송금 승인 후 소망페이 크레딧 즉시 자동 충전 API
    """
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    user.credit_balance += req.amount

    db.add(models.DepositHistory(
        user_id=user.id,
        amount=req.amount,
        deposit_type=f"{req.provider.upper()}_DEEPLINK",
        memo=f"{req.provider.upper()} 앱 딥링크 간편 충전 완료"
    ))
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"🎉 {req.provider} 송금이 완료되어 {user.name}님 계정에 {req.amount:,}원이 1초 만에 자동 충전되었습니다!",
        "new_balance": user.credit_balance
    }

# ================= 계좌이체 충전 신청 (회원) =================

@app.get("/api/settings/charge-guide", response_model=schemas.ChargeGuideResponse)
def get_charge_guide(user: models.User = Depends(require_user_auth)):
    """충전 안내: 교회 수신계좌 + 본인이 입금 시 입력해야 할 고유 입금자명(= 본인 이름)."""
    return schemas.ChargeGuideResponse(
        bank_name=CHURCH_BANK_NAME,
        account_number=CHURCH_ACCOUNT_NUMBER,
        account_holder=CHURCH_ACCOUNT_HOLDER,
        depositor_name=user.name,
    )

@app.post("/api/recharge-requests", response_model=schemas.RechargeRequestResult)
async def create_recharge_request(
    req: schemas.RechargeRequestCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """회원이 계좌이체 입금 후 제출하는 충전 신청. 신청 즉시 은행거래 원장과 매칭을 시도한다."""
    recharge_req = models.RechargeRequest(user_id=user.id, requested_amount=req.amount)
    db.add(recharge_req)
    db.commit()
    db.refresh(recharge_req)

    matched = try_resolve_recharge_request(db, recharge_req)
    if matched:
        db.refresh(user)
        await notify_admins(["stats", "deposits", "recharge_queue"])
        await notify_user(user.id, ["me"])
        return schemas.RechargeRequestResult(
            success=True, status="MATCHED",
            message=f"입금이 확인되어 {req.amount:,}원이 즉시 충전되었습니다.",
            new_balance=user.credit_balance,
        )

    await notify_admins(["recharge_queue", "stats"])
    return schemas.RechargeRequestResult(
        success=True, status="PENDING",
        message="아직 입금 내역이 확인되지 않았습니다. 확인되는 대로 자동으로 충전되며, 관리자가 확인 후 처리할 수도 있습니다.",
    )

@app.get("/api/recharge-requests/me", response_model=List[schemas.RechargeRequestResponse])
def get_my_recharge_requests(db: Session = Depends(get_db), user: models.User = Depends(require_user_auth)):
    reqs = db.query(models.RechargeRequest).filter(
        models.RechargeRequest.user_id == user.id
    ).order_by(models.RechargeRequest.id.desc()).all()
    result = []
    for r in reqs:
        res = schemas.RechargeRequestResponse.from_orm(r)
        res.user_name = user.name
        result.append(res)
    return result

# ================= 관리자 - 은행거래 원장 & 충전 신청 큐 =================

@app.post("/api/admin/bank-transactions", response_model=schemas.BankTransactionResponse)
async def admin_add_bank_transaction(
    req: schemas.BankTransactionCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """은행 계좌조회로 확인된(지금은 관리자가 직접 입력하는 모킹) 입금 건을 등록한다.
    등록 즉시 대기 중인 충전 신청과 매칭을 시도한다."""
    if db.query(models.BankTransaction).filter(models.BankTransaction.external_txn_id == req.external_txn_id).first():
        raise HTTPException(status_code=400, detail="이미 등록된 거래번호입니다.")

    txn = models.BankTransaction(
        external_txn_id=req.external_txn_id,
        amount=req.amount,
        depositor_name=req.depositor_name,
        transaction_at=req.transaction_at or datetime.datetime.utcnow(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    matched = try_resolve_bank_transaction(db, txn)
    db.refresh(txn)

    if matched:
        await notify_admins(["recharge_queue", "deposits", "stats"])
        await notify_user(txn.matched_user_id, ["me"])
    else:
        await notify_admins(["stats"])
    return txn

@app.get("/api/admin/bank-transactions", response_model=List[schemas.BankTransactionResponse])
def admin_list_bank_transactions(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    query = db.query(models.BankTransaction)
    if status:
        query = query.filter(models.BankTransaction.status == status)
    return query.order_by(models.BankTransaction.id.desc()).all()

@app.delete("/api/admin/bank-transactions/{txn_id}")
async def admin_delete_bank_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """미배정(UNMATCHED) 은행거래 삭제 - 테스트/오입력 건을 정리하는 용도.
    이미 회원과 매칭되어 충전까지 반영된 건은 잔액과 얽혀 있어 삭제를 막는다."""
    txn = db.query(models.BankTransaction).filter(models.BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="은행거래를 찾을 수 없습니다.")
    if txn.status != "UNMATCHED":
        raise HTTPException(status_code=400, detail="이미 매칭된 거래는 삭제할 수 없습니다.")

    db.delete(txn)
    db.commit()
    await notify_admins(["stats", "deposits"])
    return {"success": True, "message": "은행거래를 삭제했습니다."}

@app.get("/api/admin/recharge-requests", response_model=List[schemas.RechargeRequestResponse])
def admin_list_recharge_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    query = db.query(models.RechargeRequest)
    if status:
        query = query.filter(models.RechargeRequest.status == status)
    reqs = query.order_by(models.RechargeRequest.id.desc()).all()
    result = []
    for r in reqs:
        res = schemas.RechargeRequestResponse.from_orm(r)
        u = db.query(models.User).filter(models.User.id == r.user_id).first()
        res.user_name = u.name if u else "Unknown"
        result.append(res)
    return result

@app.post("/api/admin/recharge-requests/{request_id}/approve")
async def admin_approve_recharge_request(
    request_id: int,
    req: schemas.RechargeApproveRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """미해결 충전 신청을 관리자가 승인. 특정 은행거래에 연결하거나(bank_transaction_id 제공
    시), 없으면 신뢰 기반으로 바로 승인 충전한다."""
    recharge_req = db.query(models.RechargeRequest).filter(models.RechargeRequest.id == request_id).first()
    if not recharge_req:
        raise HTTPException(status_code=404, detail="충전 신청을 찾을 수 없습니다.")
    if recharge_req.status != "PENDING":
        raise HTTPException(status_code=400, detail="이미 처리된 신청입니다.")

    user = db.query(models.User).filter(models.User.id == recharge_req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    if req.bank_transaction_id:
        txn = db.query(models.BankTransaction).filter(
            models.BankTransaction.id == req.bank_transaction_id,
            models.BankTransaction.status == "UNMATCHED",
        ).first()
        if not txn:
            raise HTTPException(status_code=400, detail="유효하지 않거나 이미 매칭된 은행거래입니다.")
        txn.status = "MATCHED"
        txn.matched_user_id = user.id
        txn.matched_recharge_request_id = recharge_req.id
        memo = f"관리자 수동 승인 (은행거래 #{txn.id} 연결)"
    else:
        memo = "관리자 수동 승인 (연결된 은행거래 없음)"

    recharge_req.status = "MATCHED"
    recharge_req.matched_bank_transaction_id = req.bank_transaction_id
    recharge_req.admin_id = admin.id
    recharge_req.resolved_at = datetime.datetime.utcnow()

    user.credit_balance += recharge_req.requested_amount
    db.add(models.DepositHistory(
        user_id=user.id,
        amount=recharge_req.requested_amount,
        deposit_type="BANK_TRANSFER",
        memo=memo,
        admin_id=admin.id,
    ))
    db.commit()
    db.refresh(user)

    await notify_admins(["recharge_queue", "stats", "deposits", "users"])
    await notify_user(user.id, ["me"])
    return {
        "success": True,
        "message": f"{user.name}님의 충전 신청이 승인되어 {recharge_req.requested_amount:,}원이 충전되었습니다.",
        "new_balance": user.credit_balance,
    }

@app.post("/api/admin/recharge-requests/{request_id}/reject")
async def admin_reject_recharge_request(
    request_id: int,
    req: schemas.RechargeRejectRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    recharge_req = db.query(models.RechargeRequest).filter(models.RechargeRequest.id == request_id).first()
    if not recharge_req:
        raise HTTPException(status_code=404, detail="충전 신청을 찾을 수 없습니다.")
    if recharge_req.status != "PENDING":
        raise HTTPException(status_code=400, detail="이미 처리된 신청입니다.")

    recharge_req.status = "REJECTED"
    recharge_req.admin_id = admin.id
    recharge_req.memo = req.reason or "관리자 반려"
    recharge_req.resolved_at = datetime.datetime.utcnow()
    db.commit()
    await notify_admins(["recharge_queue"])
    return {"success": True, "message": "충전 신청을 반려했습니다."}

@app.get("/api/histories/deposits", response_model=List[schemas.DepositHistoryResponse])
def get_deposit_histories(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    """실제로 크레딧이 반영된 충전 이력 (통합 원장)."""
    histories = db.query(models.DepositHistory).order_by(models.DepositHistory.id.desc()).all()
    result = []
    for h in histories:
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        res = schemas.DepositHistoryResponse.from_orm(h)
        res.user_name = user.name if user else "Unknown"
        result.append(res)
    return result

# ================= 관리자 - 통계 요약 =================

@app.get("/api/admin/stats/summary", response_model=schemas.StatsSummaryResponse)
def get_stats_summary(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    from sqlalchemy import func

    total_users = db.query(models.User).filter(models.User.role == "USER").count()
    total_balance = db.query(func.coalesce(func.sum(models.User.credit_balance), 0)).filter(models.User.role == "USER").scalar()
    unmatched_deposit_count = db.query(models.BankTransaction).filter(models.BankTransaction.status == "UNMATCHED").count()
    pending_recharge_count = db.query(models.RechargeRequest).filter(models.RechargeRequest.status == "PENDING").count()

    period_starts = _kst_period_starts_utc()

    def period_stats(start_utc):
        deposit_amount = db.query(func.coalesce(func.sum(models.DepositHistory.amount), 0)).filter(
            models.DepositHistory.created_at >= start_utc
        ).scalar()
        payment_amount, payment_count = db.query(
            func.coalesce(func.sum(models.PaymentTransaction.amount), 0),
            func.count(models.PaymentTransaction.id),
        ).filter(
            models.PaymentTransaction.status == "SUCCESS",
            models.PaymentTransaction.created_at >= start_utc,
        ).first()
        return schemas.StatsPeriod(deposit_amount=deposit_amount, payment_amount=payment_amount, payment_count=payment_count)

    return schemas.StatsSummaryResponse(
        total_users=total_users,
        total_balance=total_balance,
        unmatched_deposit_count=unmatched_deposit_count,
        pending_recharge_count=pending_recharge_count,
        today=period_stats(period_starts["today"]),
        this_week=period_stats(period_starts["this_week"]),
        this_month=period_stats(period_starts["this_month"]),
    )

# ================= 실시간 알림 (WebSocket) =================
# 브라우저 WebSocket API는 커스텀 헤더를 못 보내므로, 기존 Bearer 토큰을 쿼리 파라미터로
# 받아 기존 verify_admin_token/verify_user_token으로 그대로 검증한다.

@app.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    admin_id = security.verify_admin_token(token)
    admin = db.query(models.User).filter(
        models.User.id == admin_id, models.User.role == "ADMIN", models.User.status == "ACTIVE",
    ).first() if admin_id else None
    if not admin:
        await websocket.close(code=1008)
        return

    await manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()  # 연결 유지 목적, 내용은 사용하지 않음
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)

@app.websocket("/ws/user")
async def ws_user(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    user_id = security.verify_user_token(token)
    user = db.query(models.User).filter(
        models.User.id == user_id, models.User.status == "ACTIVE",
    ).first() if user_id else None
    if not user:
        await websocket.close(code=1008)
        return

    await manager.connect_user(user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(user.id, websocket)

# ================= KIOSK DEVICE PERSISTENCE APIS =================

import json

@app.post("/api/kiosk/device/sync")
def sync_kiosk_device(req: dict = Body(...), db: Session = Depends(get_db)):
    """단말기 접속 시 UUID 자동 프로비저닝 및 가맹점/기본결제 설정 동기화 API"""
    device_uuid = req.get("device_uuid")
    device_name = req.get("device_name")
    merchant_id_val = req.get("merchant_id")
    assigned_products = req.get("assigned_products")
    def_prod_id = req.get("default_product_id")
    def_qty = req.get("default_quantity", 1) or 1
    allow_camera_concurrent = req.get("allow_camera_reader_concurrent", False)

    device = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == device_uuid).first()

    # 기본 가맹점 획득
    default_merchant = db.query(models.Merchant).first()
    if not default_merchant:
        default_merchant = models.Merchant(
            merchant_name="소망 복지 결제 무인 가맹점",
            biz_number="123-45-67890"
        )
        db.add(default_merchant)
        db.commit()
        db.refresh(default_merchant)

    m_id = merchant_id_val or default_merchant.id
    assigned_json = json.dumps(assigned_products) if assigned_products is not None else None

    if not device:
        # 신규 키오스크 단말기 자동 등록 (Auto Provisioning)
        device = models.KioskDevice(
            device_uuid=device_uuid,
            device_name=device_name or f"단말기-{device_uuid[:8]}",
            merchant_id=m_id,
            assigned_products=assigned_json,
            default_product_id=def_prod_id,
            default_quantity=def_qty,
            allow_camera_reader_concurrent=allow_camera_concurrent
        )
        db.add(device)
    else:
        # 기존 단말기 설정 갱신
        device.merchant_id = m_id
        if device_name:
            device.device_name = device_name
        if assigned_json is not None:
            device.assigned_products = assigned_json
        if def_prod_id is not None:
            device.default_product_id = def_prod_id
        if def_qty is not None:
            device.default_quantity = def_qty
        device.allow_camera_reader_concurrent = allow_camera_concurrent

    db.commit()
    db.refresh(device)

    assigned_list = json.loads(device.assigned_products) if device.assigned_products else []
    return {
        "id": device.id,
        "device_uuid": device.device_uuid,
        "device_name": device.device_name,
        "merchant_id": device.merchant_id,
        "assigned_products": assigned_list,
        "default_product_id": device.default_product_id,
        "default_quantity": device.default_quantity,
        "allow_camera_reader_concurrent": device.allow_camera_reader_concurrent,
        "updated_at": device.updated_at
    }

@app.get("/api/kiosk/device/{device_uuid}")
def get_kiosk_device(device_uuid: str, db: Session = Depends(get_db)):
    """단말기 고유 UUID로 이전 설정 복원 API"""
    device = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == device_uuid).first()
    if not device:
        return {
            "device_uuid": device_uuid,
            "device_name": "무인 결제 단말기",
            "assigned_products": [],
            "default_product_id": None,
            "default_quantity": 1,
            "allow_camera_reader_concurrent": False
        }

    assigned_list = json.loads(device.assigned_products) if device.assigned_products else []
    return {
        "device_uuid": device.device_uuid,
        "device_name": device.device_name,
        "assigned_products": assigned_list,
        "default_product_id": device.default_product_id,
        "default_quantity": device.default_quantity,
        "allow_camera_reader_concurrent": device.allow_camera_reader_concurrent,
        "updated_at": device.updated_at
    }
