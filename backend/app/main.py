import datetime
import random
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import engine, get_db, init_db
from app.services.deposit_matcher import process_bank_deposit

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
    senior = db.query(models.User).filter(models.User.username == "senior01").first()
    if not senior:
        senior = models.User(
            username="senior01",
            name="김순자 어르신",
            phone="010-1234-5678",
            role="USER",
            user_type="SENIOR",
            bank_name="NH농협",
            account_number="302-1234-5678-01",
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
    child = db.query(models.User).filter(models.User.username == "child01").first()
    if not child:
        child = models.User(
            username="child01",
            name="이동민 어린이",
            phone="010-9876-5432",
            role="USER",
            user_type="GENERAL",
            bank_name="NH농협",
            account_number="302-9876-5432-02",
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

# ================= USER & ADMIN APIs =================

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.get("/api/users/{user_id}", response_model=schemas.UserResponse)
def get_user_detail(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/users/register", response_model=schemas.UserResponse)
def self_register_user(req: schemas.UserSelfRegister, db: Session = Depends(get_db)):
    """일반 사용자 스스로 모바일 웹에서 회원가입하는 API"""
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    new_user = models.User(
        username=req.username,
        name=req.name,
        phone=req.phone,
        user_type=req.user_type,
        bank_name=req.bank_name or "NH농협",
        account_number=req.account_number,
        credit_balance=0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/users/login", response_model=schemas.UserResponse)
def user_login(req: schemas.UserLoginRequest, db: Session = Depends(get_db)):
    """회원 아이디 & 비밀번호/PIN 로그인 인증 API (휴대폰 번호/이름/하이픈 유무 무관 다중 매칭)"""
    input_str = req.username.strip()
    clean_str = input_str.replace("-", "").replace(" ", "")

    # 1. username, phone, name 또는 clean_phone 중 매칭되는 회원 검색
    all_users = db.query(models.User).all()
    user = None
    for u in all_users:
        u_phone_clean = (u.phone or "").replace("-", "").replace(" ", "")
        u_username_clean = (u.username or "").replace("-", "").replace(" ", "")
        
        if (u.username == input_str or 
            u.phone == input_str or 
            u.name == input_str or
            u_phone_clean == clean_str or
            u_username_clean == clean_str):
            user = u
            break

    if not user:
        raise HTTPException(status_code=400, detail="존재하지 않는 회원 아이디 또는 전화번호입니다.")
    
    # 비밀번호 검증 (기본값 1234 또는 설정한 비밀번호)
    user_pass = user.password_hash or "1234"
    if user_pass != req.password:
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다. (기본 비밀번호: 1234)")

    if user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="비활성화되거나 정지된 회원 계정입니다.")

    return user

@app.put("/api/users/{user_id}/info", response_model=schemas.UserResponse)
def update_user_info(user_id: int, req: schemas.UserUpdateInfo, db: Session = Depends(get_db)):
    """회원 정보 (연락처, 정산 계좌, 비밀번호) 수정 API"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    if req.phone is not None:
        user.phone = req.phone
    if req.bank_name is not None:
        user.bank_name = req.bank_name
    if req.account_number is not None:
        user.account_number = req.account_number
    if req.new_password:
        user.password_hash = req.new_password

    db.commit()
    db.refresh(user)
    return user


@app.post("/api/admin/register-user", response_model=schemas.UserResponse)
def admin_register_user(req: schemas.UserProxyCreate, db: Session = Depends(get_db)):
    """관리자 대리 회원 등록 API (어린이, 노인 등)"""
    username = f"user_{random.randint(1000, 9999)}"

    new_user = models.User(
        username=username,
        name=req.name,
        phone=req.phone,
        user_type=req.user_type,
        bank_name=req.bank_name or "NH농협",
        account_number=req.account_number,
        credit_balance=req.initial_credit
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if req.initial_credit > 0:
        deposit = models.DepositHistory(
            user_id=new_user.id,
            amount=req.initial_credit,
            deposit_type="ADMIN_MANUAL",
            memo="신규 등록 관리자 직권 초기 충전"
        )
        db.add(deposit)
        db.commit()

    return new_user

@app.post("/api/admin/recharge-credit")
def admin_recharge_credit(req: schemas.AdminRechargeRequest, db: Session = Depends(get_db)):
    """관리자 수동 직권 크레딧 충전 API"""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    user.credit_balance += req.amount
    deposit = models.DepositHistory(
        user_id=user.id,
        amount=req.amount,
        deposit_type="ADMIN_MANUAL",
        memo=req.memo or "관리자 직권 충전"
    )
    db.add(deposit)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"{user.name}님에게 {req.amount:,}원이 충전되었습니다.",
        "new_balance": user.credit_balance
    }

# ================= NFC CARD APIs =================

@app.get("/api/cards", response_model=List[schemas.NFCCardResponse])
def get_nfc_cards(db: Session = Depends(get_db)):
    return db.query(models.NFCCard).all()

@app.post("/api/cards/register", response_model=schemas.NFCCardResponse)
def register_nfc_card(req: schemas.NFCCardRegister, db: Session = Depends(get_db)):
    """NFC 카드/태그 신규 등록 및 사용자 1:1 매핑 (기존 카드 재할당 지원)"""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원입니다.")

    existing_card = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid).first()
    if existing_card:
        # 기존 카드 재할당 / 업데이트
        existing_card.user_id = req.user_id
        existing_card.card_name = req.card_name or f"{user.name}의 {req.card_type or '실물 NFC'} 카드"
        existing_card.card_type = req.card_type or "NFC"
        existing_card.is_active = True
        db.commit()
        db.refresh(existing_card)
        return existing_card

    new_card = models.NFCCard(
        card_uid=req.card_uid,
        card_name=req.card_name or f"{user.name}의 {req.card_type or '실물 NFC'} 카드",
        card_type=req.card_type or "NFC",
        user_id=req.user_id,
        is_active=True
    )
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card

@app.get("/api/cards/user/{user_id}", response_model=list[schemas.NFCCardResponse])
def get_user_cards(user_id: int, db: Session = Depends(get_db)):
    """특정 회원의 등록된 실물 NFC 카드 목록 조회"""
    return db.query(models.NFCCard).filter(models.NFCCard.user_id == user_id, models.NFCCard.is_active == True).all()

# ================= PRODUCTS (MENU) APIs =================

@app.get("/api/products", response_model=List[schemas.ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).filter(models.Product.is_active == True).all()

@app.post("/api/products", response_model=schemas.ProductResponse)
def create_product(req: schemas.ProductCreate, db: Session = Depends(get_db)):
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
def update_product(product_id: int, req: schemas.ProductUpdate, db: Session = Depends(get_db)):
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
def delete_product(product_id: int, db: Session = Depends(get_db)):
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
def verify_admin_auth(req: AdminAuthVerifyRequest, db: Session = Depends(get_db)):
    """UC-07: 관리자 보안 인증 API (PIN 코드 또는 관리자 NFC/QR 식별자 다중 매체 인증)"""
    if req.pin and req.pin == "1234":
        return {"success": True, "message": "관리자 PIN 인증이 승인되었습니다.", "auth_type": "PIN"}

    if req.card_uid:
        card = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid, models.NFCCard.is_active == True).first()
        if card:
            user = db.query(models.User).filter(models.User.id == card.user_id).first()
            if user and user.role == "ADMIN" and user.status == "ACTIVE":
                return {
                    "success": True,
                    "message": f"관리자({user.name}) 식별자 인증이 완료되었습니다.",
                    "admin_name": user.name,
                    "auth_type": "CARD_QR"
                }

    raise HTTPException(status_code=401, detail="인증 실패: 관리자 PIN이 올바르지 않거나 권한이 없는 식별자입니다.")

# ================= UNMANNED KIOSK PAYMENT API =================

@app.post("/api/payments/pay", response_model=schemas.PaymentResponse)
def process_nfc_payment(req: schemas.PaymentRequest, db: Session = Depends(get_db)):
    """UC-01 & UC-08: 무인 단말기 듀얼 결제 승인 및 기본 결제 30초 중복 결제 방지 API"""
    # 1. NFC 카드/교인증 QR 고유 식별자로 회원 계정 조회
    card = db.query(models.NFCCard).filter(models.NFCCard.card_uid == req.card_uid, models.NFCCard.is_active == True).first()

    if not card:
        raise HTTPException(
            status_code=400,
            detail=f"등록되지 않았거나 비활성화된 식별자입니다. (Code: {req.card_uid})"
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

# ================= TOSS & KAKAOPAY DEEPLINK APIS =================

class DeeplinkRequest(schemas.BaseModel):
    user_id: int
    amount: int
    provider: str  # TOSS, KAKAOPAY

@app.post("/api/payments/deeplink")
def create_pay_deeplink(req: DeeplinkRequest, db: Session = Depends(get_db)):
    """
    토스 / 카카오페이 1초 간편 송금 트리거 딥링크 생성 API
    """
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    target_acc = user.account_number or "302-1234-5678-01"
    memo = f"소망페이_{user.name}"

    if req.provider.upper() == "TOSS":
        # 토스 앱 송금 딥링크 (supertoss://send)
        deeplink = f"supertoss://send?bank=NH농협&account={target_acc}&amount={req.amount}&msg={memo}"
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

    deposit = models.DepositHistory(
        user_id=user.id,
        amount=req.amount,
        deposit_type=f"{req.provider.upper()}_DEEPLINK",
        source_account=f"{req.provider.upper()} 간편송금",
        memo=f"{req.provider.upper()} 앱 딥링크 간편 충전 완료"
    )
    db.add(deposit)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"🎉 {req.provider} 송금이 완료되어 {user.name}님 계정에 {req.amount:,}원이 1초 만에 자동 충전되었습니다!",
        "new_balance": user.credit_balance
    }

class NHWebhookPayload(schemas.BaseModel):
    source_account: str
    amount: int
    depositor_name: Optional[str] = None
    transaction_id: Optional[str] = None

@app.post("/api/nhbank/webhook")
def nhbank_deposit_webhook(payload: NHWebhookPayload, db: Session = Depends(get_db)):
    """
    NH농협 / PG사 실시간 입금 알림 Webhook API
    외부 농협 서버가 입금 발생 시 이 엔드포인트로 JSON 전달
    """
    result = process_bank_deposit(
        db=db,
        source_account=payload.source_account,
        amount=payload.amount,
        depositor_name=payload.depositor_name
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/nhbank/mock-deposit")
def mock_nhbank_deposit(payload: NHWebhookPayload, db: Session = Depends(get_db)):
    """NH농협 계좌 입금 발생 시뮬레이션 API (자동 충전 매칭 엔진 구동)"""
    result = process_bank_deposit(
        db=db,
        source_account=payload.source_account,
        amount=payload.amount,
        depositor_name=payload.depositor_name
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/histories/deposits", response_model=List[schemas.DepositHistoryResponse])
def get_deposit_histories(db: Session = Depends(get_db)):
    histories = db.query(models.DepositHistory).order_by(models.DepositHistory.id.desc()).all()
    # 사용자 이름 매핑
    result = []
    for h in histories:
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        res = schemas.DepositHistoryResponse.from_orm(h)
        res.user_name = user.name if user else "Unknown"
        result.append(res)
    return result

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
