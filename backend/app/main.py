import asyncio
import datetime
import hmac
import json
import os
import uuid
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Body, Header, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from anyio import to_thread
from fastapi.concurrency import run_in_threadpool

from app import models, schemas, security
from app.database import engine, get_db, init_db
from app.phone_utils import normalize_phone
from app.services.deposit_matcher import match_new_deposit
from app.services.history import get_history_page, get_kiosk_payment_history_page
from app.services.push import send_push_to_user, send_push_to_admins
from app.ws_manager import manager, notify_admins, notify_admins_alert, notify_user, notify_kiosk, notify_all_kiosks

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

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")

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


# FastAPI의 동기(sync def) 엔드포인트와 threadpool-오프로딩된 코드는 anyio의 기본
# 스레드풀(기본 40개 토큰)을 공유한다. 부하 테스트(동시 300명)에서 이 기본값이 지연시간의
# 주 원인 중 하나로 확인되어 늘림 - 1 OCPU 환경이라 DB I/O 대기 중 스레드가 대부분이라
# 늘려도 CPU 경합은 크지 않다.
@app.on_event("startup")
async def raise_threadpool_capacity():
    to_thread.current_default_thread_limiter().total_tokens = 200


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

@app.get("/api/users/me/qr-card")
def get_my_qr_card(user: models.User = Depends(require_user_auth), db: Session = Depends(get_db)):
    """로그인한 본인이 등록한 QR 카드(있으면)의 카드 값 조회 - 크레딧 카드 화면에 QR로
    표시해주기 위함. NFC 카드는 대상이 아니므로 card_type == QR_CODE만 조회한다."""
    card = db.query(models.NFCCard).filter(
        models.NFCCard.user_id == user.id,
        models.NFCCard.card_type == "QR_CODE",
    ).first()
    return {"card_uid": card.card_uid if card else None}

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

# ================= Web Push 구독 =================

@app.get("/api/push/vapid-public-key")
def get_vapid_public_key():
    """구독 생성 시 브라우저에 넘겨줄 VAPID 공개키 - 공개키라 인증 불필요."""
    return {"publicKey": VAPID_PUBLIC_KEY}

@app.post("/api/push/subscribe")
def subscribe_push(
    req: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """기기의 Web Push 구독을 등록/갱신한다(endpoint 기준 upsert - 같은 기기에서 재구독해도
    행이 늘어나지 않고, 다른 계정으로 로그인해 재구독하면 소유자만 갱신된다)."""
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint
    ).first()
    if existing:
        existing.user_id = user.id
        existing.p256dh = req.keys.p256dh
        existing.auth = req.keys.auth
    else:
        db.add(models.PushSubscription(
            user_id=user.id,
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
        ))
    db.commit()
    return {"success": True}

@app.delete("/api/push/subscribe")
def unsubscribe_push(
    req: schemas.PushSubscriptionDelete,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """본인 기기의 Web Push 구독을 해지한다."""
    db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint,
        models.PushSubscription.user_id == user.id,
    ).delete()
    db.commit()
    return {"success": True}

@app.post("/api/push/resubscribe")
def resubscribe_push(req: schemas.PushResubscribe, db: Session = Depends(get_db)):
    """서비스워커가 pushsubscriptionchange 이벤트나 주기적(Periodic Background Sync) 자체
    갱신에서 호출하는 전용 API - 이 시점엔 앱이 꺼져있을 수 있어 로그인 세션(Bearer 토큰)이
    없다. 대신 옛 endpoint(추측 불가능한 긴 문자열)를 아는 것 자체를 본인 소유 증명으로
    삼아 인증 없이 endpoint/키만 갱신한다 - user/admin 구분 없이 동일하게 동작(회원/관리자
    행 모두 이 테이블 하나를 같이 쓰므로)."""
    old_sub = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.old_endpoint
    ).first()
    if not old_sub:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    # 이미 새 endpoint로 등록된 행이 있다면(재시도로 두 번 불렸거나 하는 경우) 중복 방지 -
    # 옛 행은 지우고 이미 있는 새 행의 키만 최신화한다.
    conflicting = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint,
        models.PushSubscription.id != old_sub.id,
    ).first()
    if conflicting:
        conflicting.p256dh = req.keys.p256dh
        conflicting.auth = req.keys.auth
        db.delete(old_sub)
    else:
        old_sub.endpoint = req.endpoint
        old_sub.p256dh = req.keys.p256dh
        old_sub.auth = req.keys.auth
    db.commit()
    return {"success": True}

@app.post("/api/admin/push/subscribe")
def subscribe_admin_push(
    req: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자 기기의 Web Push 구독을 등록/갱신한다(endpoint 기준 upsert). 요청에 담긴
    항목별 on/off 값도 함께 저장한다."""
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint
    ).first()
    if existing:
        existing.user_id = admin.id
        existing.p256dh = req.keys.p256dh
        existing.auth = req.keys.auth
        # None으로 온 항목은 건드리지 않는다 - 만료된 구독을 자동으로 조용히 갱신할 때(재구독)
        # 항목별 on/off까지 같이 보내지 않아도 기존 설정이 기본값(전체 on)으로 되돌아가지 않게.
        if req.notify_deposit_error is not None:
            existing.notify_deposit_error = req.notify_deposit_error
        if req.notify_deposit_credited is not None:
            existing.notify_deposit_credited = req.notify_deposit_credited
        if req.notify_payment is not None:
            existing.notify_payment = req.notify_payment
    else:
        db.add(models.PushSubscription(
            user_id=admin.id,
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
            notify_deposit_error=req.notify_deposit_error if req.notify_deposit_error is not None else True,
            notify_deposit_credited=req.notify_deposit_credited if req.notify_deposit_credited is not None else True,
            notify_payment=req.notify_payment if req.notify_payment is not None else True,
        ))
    db.commit()
    return {"success": True}

@app.delete("/api/admin/push/subscribe")
def unsubscribe_admin_push(
    req: schemas.PushSubscriptionDelete,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """본인(관리자) 기기의 Web Push 구독을 해지한다."""
    db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint,
        models.PushSubscription.user_id == admin.id,
    ).delete()
    db.commit()
    return {"success": True}

@app.get("/api/admin/push/subscribe/categories")
def get_admin_push_categories(
    endpoint: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """설정 화면이 열릴 때 체크박스를 서버에 저장된 실제 값으로 맞추기 위한 조회용
    (지금까지는 체크박스가 항상 HTML 기본값(전체 체크)으로만 그려져 새로고침하면 이전에
    꺼둔 항목이 켜진 것처럼 보이는 문제가 있었다)."""
    sub = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == endpoint,
        models.PushSubscription.user_id == admin.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")
    return {
        "notify_deposit_error": sub.notify_deposit_error,
        "notify_deposit_credited": sub.notify_deposit_credited,
        "notify_payment": sub.notify_payment,
    }

@app.put("/api/admin/push/subscribe/categories")
def update_admin_push_categories(
    req: schemas.PushCategoriesUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """이미 구독 중인 관리자 기기의 항목별 on/off만 갱신한다(재구독 불필요)."""
    sub = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == req.endpoint,
        models.PushSubscription.user_id == admin.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다. 먼저 푸시 알림을 켜주세요.")
    sub.notify_deposit_error = req.notify_deposit_error
    sub.notify_deposit_credited = req.notify_deposit_credited
    sub.notify_payment = req.notify_payment
    db.commit()
    return {"success": True}

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
        birth_date=req.birth_date,
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

    # QR 코드는 더 이상 실물 스티커를 스캔해 등록하지 않고, 가입 시 서버가 임의 UUID를
    # 발급해 그 값을 그대로 QR 이미지로 그려 쓴다(user.js loadUserQrCard).
    db.add(models.NFCCard(
        card_uid=str(uuid.uuid4()),
        card_name=f"{new_user.name}의 교인증 QR 코드",
        card_type="QR_CODE",
        user_id=new_user.id,
    ))
    db.commit()

    if req.initial_credit > 0:
        db.add(models.DepositHistory(
            user_id=new_user.id,
            amount=req.initial_credit,
            deposit_type="ADMIN_MANUAL",
            memo="신규 등록 관리자 직권 초기 충전",
            admin_id=admin.id,
            balance_after=new_user.credit_balance,
        ))
        db.commit()

    await notify_admins(["users", "stats", "cards"])
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
    # birth_date는 다른 필드와 달리 "생략하면 안 바꿈"이 아니라 항상 그대로 반영한다 -
    # 선택 항목이라 비워서 지우는 것 자체가 유효한 수정이라, None을 "생략됨"으로 취급하면
    # 한 번 입력한 생년월일을 다시 지울 방법이 없어진다.
    user.birth_date = req.birth_date
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
        balance_after=user.credit_balance,
    ))
    db.commit()
    db.refresh(user)

    await notify_admins(["users", "stats", "deposits"])
    await notify_user(user.id, ["me"])
    send_push_to_user(db, user.id, "충전 완료", f"{req.amount:,}원이 충전되었습니다 (잔액 {user.credit_balance:,}원)")
    return {
        "success": True,
        "message": f"{user.name}님에게 {req.amount:,}원이 충전되었습니다.",
        "new_balance": user.credit_balance
    }

@app.post("/api/admin/deduct-credit")
async def admin_deduct_credit(
    req: schemas.AdminDeductRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자 수동 직권 크레딧 차감 API (오충전 정정, 환불 등). 잔액 부족 시 거부한다."""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    if user.credit_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"잔액이 부족합니다. (현재 잔액 {user.credit_balance:,}원)")

    user.credit_balance -= req.amount
    db.add(models.DepositHistory(
        user_id=user.id,
        amount=-req.amount,
        deposit_type="ADMIN_MANUAL_DEDUCT",
        memo=req.memo or "관리자 직권 차감",
        admin_id=admin.id,
        balance_after=user.credit_balance,
    ))
    db.commit()
    db.refresh(user)

    await notify_admins(["users", "stats", "deposits"])
    await notify_user(user.id, ["me"])
    return {
        "success": True,
        "message": f"{user.name}님의 잔액에서 {req.amount:,}원이 차감되었습니다.",
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
    if req.status == "SUSPENDED" and user.role == "ADMIN":
        raise HTTPException(status_code=400, detail="관리자 계정은 정지할 수 없습니다.")
    user.status = req.status
    db.commit()
    await notify_admins(["users"])
    await notify_user(user.id, ["me"])
    return {"success": True, "message": f"{user.name}님의 상태가 {req.status}로 변경되었습니다.", "status": user.status}

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """회원 삭제 - 잔액이 남아있으면 삭제할 수 없다(자금 손실 방지). 또한 결제/입금/충전
    이력이 하나라도 있으면 그 기록들이 삭제된 회원을 참조하는 FK(NOT NULL)라 하드 삭제 시
    DB 제약 위반이 나므로 여기서는 막고 "정지"를 대신 안내한다."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    if user.credit_balance != 0:
        raise HTTPException(status_code=400, detail=f"잔액이 남아있는 회원은 삭제할 수 없습니다. (현재 잔액 {user.credit_balance:,}원)")

    has_history = (
        db.query(models.PaymentTransaction).filter(models.PaymentTransaction.user_id == user_id).first() is not None
        or db.query(models.DepositHistory).filter(models.DepositHistory.user_id == user_id).first() is not None
        or db.query(models.BankTransaction).filter(models.BankTransaction.matched_user_id == user_id).first() is not None
    )
    if has_history:
        raise HTTPException(status_code=400, detail="결제/입금/충전 이력이 있는 회원은 삭제할 수 없습니다. 대신 '정지' 처리를 이용하세요.")

    user_name = user.name
    db.query(models.NFCCard).filter(models.NFCCard.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    await notify_admins(["users", "stats"])
    return {"success": True, "message": f"{user_name}님을 삭제했습니다."}

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
    """NFC 카드 등록·교체(실물 카드 태그 전용). 회원당 최대 1개 - 이미 있으면 UID를
    교체하고, 없으면 새로 발급한다. 태그된 UID가 이미 다른 회원 소유였다면 이 회원에게
    재할당한다. QR 코드는 실물 스캔으로 등록하지 않고 회원가입 시 자동 발급되며, 재발급은
    /api/admin/cards/qr-reissue/{user_id}를 사용한다."""
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원입니다.")
    if req.card_type != "NFC":
        raise HTTPException(status_code=400, detail="이 API는 NFC 카드만 등록할 수 있습니다. QR은 자동 발급/재발급 전용 API를 사용하세요.")

    default_name = f"{user.name}의 실물 NFC 카드"

    # 이 UID를 다른 회원/다른 타입으로 이미 쓰고 있었다면 그 행은 제거(재할당).
    # 그 카드를 참조하던 결제 이력은 카드 참조만 해제하고 보존한다.
    existing_by_uid = db.query(models.NFCCard).filter(func.upper(models.NFCCard.card_uid) == req.card_uid.strip().upper()).first()
    if existing_by_uid and not (existing_by_uid.user_id == req.user_id and existing_by_uid.card_type == req.card_type):
        db.query(models.PaymentTransaction).filter(models.PaymentTransaction.card_id == existing_by_uid.id).update({"card_id": None})
        db.delete(existing_by_uid)
        db.flush()

    target = db.query(models.NFCCard).filter(
        models.NFCCard.user_id == req.user_id,
        models.NFCCard.card_type == req.card_type,
    ).first()

    if target:
        target.card_uid = req.card_uid.strip().upper()
        target.card_name = req.card_name or default_name
        target.issued_at = datetime.datetime.utcnow()
    else:
        target = models.NFCCard(
            card_uid=req.card_uid.strip().upper(),
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

@app.post("/api/admin/cards/qr-reissue/{user_id}", response_model=schemas.NFCCardResponse)
async def reissue_qr_card(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """회원의 QR 코드를 새 UUID로 재발급(없으면 최초 발급)한다. 유출 등으로 기존 QR을
    무효화해야 할 때 쓰는 용도 - 기존 값은 즉시 결제에 쓸 수 없게 되고, 결제 이력은
    카드 참조만 해제되어 보존된다."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원입니다.")

    existing = db.query(models.NFCCard).filter(
        models.NFCCard.user_id == user_id,
        models.NFCCard.card_type == "QR_CODE",
    ).first()
    if existing:
        db.query(models.PaymentTransaction).filter(models.PaymentTransaction.card_id == existing.id).update({"card_id": None})
        db.delete(existing)
        db.flush()

    card = models.NFCCard(
        card_uid=str(uuid.uuid4()),
        card_name=f"{user.name}의 교인증 QR 코드",
        card_type="QR_CODE",
        user_id=user_id,
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    res = schemas.NFCCardResponse.from_orm(card)
    res.user_name = user.name
    await notify_admins(["cards"])
    return res

# ================= PRODUCTS (MENU) APIs =================

@app.get("/api/products", response_model=List[schemas.ProductResponse])
def get_products(device_uuid: Optional[str] = None, db: Session = Depends(get_db)):
    """전체 메뉴 카탈로그. device_uuid를 주면 그 키오스크에 배정된 메뉴만 반환하고,
    배정된 메뉴가 없거나(assigned_products 미설정) 단말기를 못 찾으면 하위호환을 위해
    전체 메뉴를 반환한다."""
    query = db.query(models.Product).filter(models.Product.is_active == True)
    if device_uuid:
        device = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == device_uuid).first()
        assigned_ids = json.loads(device.assigned_products) if device and device.assigned_products else []
        if assigned_ids:
            query = query.filter(models.Product.id.in_(assigned_ids))
    return query.all()

@app.post("/api/products", response_model=schemas.ProductResponse)
async def create_product(req: schemas.ProductCreate, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    product = models.Product(
        name=req.name,
        price_general=req.price_general,
        price_senior=req.price_senior,
        merchant_id=req.merchant_id
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    await notify_admins(["stats"])
    await notify_all_kiosks(["menu"])
    return product

@app.put("/api/products/{product_id}", response_model=schemas.ProductResponse)
async def update_product(product_id: int, req: schemas.ProductUpdate, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
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
    await notify_admins(["stats"])
    await notify_all_kiosks(["menu"])
    return product

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
    await notify_admins(["stats"])
    await notify_all_kiosks(["menu"])
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
        admin_user = db.query(models.User).filter(
            models.User.role == "ADMIN",
            models.User.status == "ACTIVE",
        ).first()
        if not admin_user:
            raise HTTPException(status_code=401, detail="관리자 계정이 정지되어 있어 인증할 수 없습니다.")
        token = security.create_admin_token(admin_user.id)
        return {"success": True, "message": "관리자 PIN 인증이 승인되었습니다.", "auth_type": "PIN", "token": token}

    if req.card_uid:
        card = db.query(models.NFCCard).filter(func.upper(models.NFCCard.card_uid) == req.card_uid.strip().upper()).first()
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

def _process_nfc_payment_sync(db: Session, req: schemas.PaymentRequest):
    """process_nfc_payment의 DB 바운드 로직 전체. run_in_threadpool로 실행되어
    (동기 SQLAlchemy 호출이 이벤트루프를 막지 않도록) 별도 스레드에서 돈다 - 부하
    테스트(동시 300명)에서 이 함수의 동기 DB 호출이 이벤트루프를 통째로 막아 다른
    요청(결제 아닌 것 포함)까지 초 단위로 지연되는 게 확인되어 분리함."""
    # 1. NFC 카드/교인증 QR 고유 식별자로 회원 계정 조회
    # 대소문자 무관 비교 - 물리 NFC UID는 읽는 경로(내장 NFC/외장 CCID·HID 리더/Web NFC)마다
    # 헥스 문자열의 대소문자 표기가 갈릴 수 있어(예: 등록은 admin.js Web NFC 경로가 강제
    # 대문자화하는데 결제 스캔 쪽 경로 하나는 원본 그대로 소문자로 내려보냄) 값은 같은 카드인데
    # 문자열이 달라 "등록되지 않은 식별자"로 오판되는 문제가 있었다. QR 코드는 이 앱이 발급한
    # 값을 그대로 다시 인코딩/디코딩할 뿐이라 대소문자가 갈릴 일이 없어 안전하게 함께 적용 가능.
    card = db.query(models.NFCCard).filter(func.upper(models.NFCCard.card_uid) == req.card_uid.strip().upper()).first()

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
            return "confirm_required", schemas.PaymentResponse(
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
    line_items = []  # 메뉴별 매출 집계를 위한 구조화된 라인아이템 (product_details는 사람이 읽는 요약용으로 계속 유지)

    for item in effective_items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product or not product.is_active:
            continue

        # 회원 유형에 따라 가격 결정 (SENIOR vs GENERAL)
        unit_price = product.price_senior if user.user_type == "SENIOR" else product.price_general
        item_total = unit_price * item.quantity
        total_amount += item_total
        item_summaries.append(f"{product.name} x{item.quantity} ({unit_price:,}원)")
        line_items.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "subtotal": item_total,
        })

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
        merchant_id=merchant_id,
        kiosk_device_id=kiosk_dev.id if kiosk_dev else None,
        product_details=", ".join(item_summaries),
        amount=total_amount,
        balance_after=user.credit_balance,
        status="SUCCESS"
    )
    db.add(tx_success)
    db.commit()
    db.refresh(tx_success)

    # 메뉴별 매출 집계용 라인아이템 (관리자 키오스크 탭에서 사용)
    for li in line_items:
        db.add(models.PaymentLineItem(
            payment_transaction_id=tx_success.id,
            product_id=li["product_id"],
            product_name=li["product_name"],
            quantity=li["quantity"],
            unit_price=li["unit_price"],
            subtotal=li["subtotal"],
        ))
    db.commit()

    return "success", tx_success, user, total_amount, item_summaries


@app.post("/api/payments/pay", response_model=schemas.PaymentResponse)
async def process_nfc_payment(req: schemas.PaymentRequest, db: Session = Depends(get_db)):
    """UC-01 & UC-08: 무인 단말기 듀얼 결제 승인 및 기본 결제 30초 중복 결제 방지 API"""
    outcome = await run_in_threadpool(_process_nfc_payment_sync, db, req)
    if outcome[0] == "confirm_required":
        return outcome[1]

    _, tx_success, user, total_amount, item_summaries = outcome

    # 결제로 잔액이 바뀌었으므로 관리자 대시보드와 결제한 회원 본인 화면을 갱신
    await notify_admins(["users", "stats"])
    await notify_user(user.id, ["me"])
    await run_in_threadpool(
        send_push_to_admins, db, "결제 발생",
        f"{user.name}님 {total_amount:,}원 결제 ({', '.join(item_summaries)})", category="payment", entity_id=user.id
    )
    await notify_admins_alert(
        "결제 발생", f"{user.name}님 {total_amount:,}원 결제 ({', '.join(item_summaries)})",
        category="payment", entity_id=user.id
    )

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

# ================= 이용내역 (계좌이체/결제/관리자충전 통합, 커서 페이지네이션) =================
# 세 소스를 병합해서 시간순으로 보여줘야 하는데, admin/user가 각자 따로 병합·정렬하다가
# 정렬 기준이 어긋나 두 화면에 다른 이력이 보이는 버그가 있었다(#history) - 이제 양쪽 다
# get_history_page() 하나만 호출해서 항상 같은 결과를 보게 한다.

def _parse_history_cursor(before: Optional[str]) -> Optional[datetime.datetime]:
    if not before:
        return None
    try:
        return datetime.datetime.fromisoformat(before)
    except ValueError:
        raise HTTPException(status_code=400, detail="잘못된 cursor 형식입니다.")

@app.get("/api/history/me", response_model=schemas.HistoryPageResponse)
def get_my_history(
    before: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """본인 이용내역(계좌이체 충전/결제/관리자 직권충전·차감 통합) - 커서 기반 페이지네이션."""
    return get_history_page(db, user.id, _parse_history_cursor(before), min(limit, 100))

@app.get("/api/admin/history", response_model=schemas.HistoryPageResponse)
def get_admin_history(
    user_id: int,
    before: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """관리자 회원상세 화면의 이용내역 - get_my_history와 동일 로직(user_id만 다름)."""
    return get_history_page(db, user_id, _parse_history_cursor(before), min(limit, 100))

# ================= 계좌이체 충전 (회원) =================

def _bank_txn_response(db: Session, txn: "models.BankTransaction") -> schemas.BankTransactionResponse:
    """BankTransaction을 응답 스키마로 변환하며 매칭 회원명/처리 관리자명을 조인해 채운다."""
    res = schemas.BankTransactionResponse.from_orm(txn)
    if txn.matched_user_id:
        u = db.query(models.User).filter(models.User.id == txn.matched_user_id).first()
        res.matched_user_name = u.name if u else None
    if txn.resolved_by_admin_id:
        a = db.query(models.User).filter(models.User.id == txn.resolved_by_admin_id).first()
        res.resolved_by_admin_name = a.name if a else None
    return res

@app.get("/api/settings/charge-guide", response_model=schemas.ChargeGuideResponse)
def get_charge_guide(user: models.User = Depends(require_user_auth)):
    """충전 안내: 교회 수신계좌 + 본인이 입금 시 입력해야 할 고유 입금자명(= 본인 이름)."""
    return schemas.ChargeGuideResponse(
        bank_name=CHURCH_BANK_NAME,
        account_number=CHURCH_ACCOUNT_NUMBER,
        account_holder=CHURCH_ACCOUNT_HOLDER,
        depositor_name=user.name,
    )

@app.get("/api/bank-transactions/me", response_model=List[schemas.BankTransactionResponse])
def get_my_bank_transactions(db: Session = Depends(get_db), user: models.User = Depends(require_user_auth)):
    """본인 이름으로 확인된 입금 내역(대기 중인 것 + 과거 처리된 것 모두 포함)."""
    txns = db.query(models.BankTransaction).filter(
        models.BankTransaction.matched_user_id == user.id
    ).order_by(models.BankTransaction.id.desc()).all()
    return [_bank_txn_response(db, t) for t in txns]

@app.post("/api/bank-transactions/{txn_id}/claim", response_model=schemas.DepositClaimResult)
async def claim_bank_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user_auth),
):
    """회원이 본인 앞으로 매칭된 대기 중인 입금 건을 선택해 직접 충전을 완료한다."""
    txn = db.query(models.BankTransaction).filter(models.BankTransaction.id == txn_id).first()
    if not txn or txn.matched_user_id != user.id:
        raise HTTPException(status_code=404, detail="입금 건을 찾을 수 없습니다.")
    if txn.status != "PENDING":
        raise HTTPException(status_code=400, detail="이미 처리되었거나 처리할 수 없는 입금 건입니다.")

    txn.status = "CREDITED"
    txn.resolved_at = datetime.datetime.utcnow()

    user.credit_balance += txn.amount
    txn.balance_after = user.credit_balance
    db.add(models.DepositHistory(
        user_id=user.id,
        amount=txn.amount,
        deposit_type="BANK_TRANSFER",
        memo="회원 본인 확인 후 충전",
        balance_after=user.credit_balance,
    ))
    db.commit()
    db.refresh(user)

    await notify_admins(["deposit_queue", "stats", "deposits", "users"])
    await notify_user(user.id, ["me"])
    send_push_to_admins(
        db, "충전 완료(셀프)", f"{user.name}님이 {txn.amount:,}원 입금건을 셀프 충전 완료했습니다",
        category="deposit_credited", entity_id=txn.id
    )
    await notify_admins_alert(
        "충전 완료(셀프)", f"{user.name}님이 {txn.amount:,}원 입금건을 셀프 충전 완료했습니다",
        category="deposit_credited", entity_id=txn.id
    )
    return schemas.DepositClaimResult(
        success=True,
        message=f"{txn.amount:,}원이 충전되었습니다.",
        new_balance=user.credit_balance,
    )

# ================= 관리자 - 계좌 입금 (충전함) =================

@app.post("/api/admin/bank-transactions", response_model=schemas.BankTransactionResponse)
async def admin_add_bank_transaction(
    req: schemas.BankTransactionCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """은행 계좌조회로 확인된(지금은 관리자가 직접 입력하거나 SMS/RCS 자동감지로 등록하는)
    입금 건을 등록한다. 등록 즉시 입금자명으로 등록 회원과 자동 매칭을 시도한다."""
    if db.query(models.BankTransaction).filter(models.BankTransaction.external_txn_id == req.external_txn_id).first():
        raise HTTPException(status_code=400, detail="이미 등록된 거래번호입니다.")

    txn = models.BankTransaction(
        external_txn_id=req.external_txn_id,
        amount=req.amount,
        depositor_name=req.depositor_name,
        transaction_at=req.transaction_at or datetime.datetime.utcnow(),
    )
    db.add(txn)
    match_new_deposit(db, txn)
    db.commit()
    db.refresh(txn)

    await notify_admins(["deposit_queue", "stats"])
    if txn.status == "PENDING":
        await notify_user(txn.matched_user_id, ["me", "deposits"])
        send_push_to_user(db, txn.matched_user_id, "입금이 확인됐어요", f"{txn.amount:,}원 입금 확인 - 앱에서 충전을 완료해주세요")
    elif txn.status == "ERROR":
        send_push_to_admins(
            db, "미매칭 입금 발생", f"입금자명 '{txn.depositor_name}' {txn.amount:,}원 - 매칭되는 회원이 없어 확인이 필요합니다",
            category="deposit_error", entity_id=txn.id
        )
        await notify_admins_alert(
            "미매칭 입금 발생", f"입금자명 '{txn.depositor_name}' {txn.amount:,}원 - 매칭되는 회원이 없어 확인이 필요합니다",
            category="deposit_error", entity_id=txn.id
        )
    return _bank_txn_response(db, txn)

@app.get("/api/admin/bank-transactions", response_model=List[schemas.BankTransactionResponse])
def admin_list_bank_transactions(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    query = db.query(models.BankTransaction)
    if status:
        query = query.filter(models.BankTransaction.status == status)
    txns = query.order_by(models.BankTransaction.id.desc()).all()
    return [_bank_txn_response(db, t) for t in txns]

@app.delete("/api/admin/bank-transactions/{txn_id}")
async def admin_delete_bank_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """미처리(PENDING/ERROR) 은행거래 삭제 - 테스트/오입력 건을 정리하는 용도.
    이미 충전까지 반영되었거나 기타 처리로 종결된 건은 이력과 얽혀 있어 삭제를 막는다."""
    txn = db.query(models.BankTransaction).filter(models.BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="은행거래를 찾을 수 없습니다.")
    if txn.status not in ("PENDING", "ERROR"):
        raise HTTPException(status_code=400, detail="이미 처리된 거래는 삭제할 수 없습니다.")

    db.delete(txn)
    db.commit()
    await notify_admins(["stats", "deposit_queue"])
    return {"success": True, "message": "은행거래를 삭제했습니다."}

@app.post("/api/admin/bank-transactions/{txn_id}/resolve", response_model=schemas.BankTransactionResponse)
async def admin_resolve_bank_transaction(
    txn_id: int,
    req: schemas.BankTransactionAdminResolve,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자가 대기(PENDING)/오류(ERROR) 상태 입금 건에 회원을 지정해 대신 충전을 완료
    처리한다(완료-예외). 자동 매칭된 회원과 다른 회원을 골라 오매칭을 바로잡을 수도 있다."""
    txn = db.query(models.BankTransaction).filter(models.BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="은행거래를 찾을 수 없습니다.")
    if txn.status not in ("PENDING", "ERROR"):
        raise HTTPException(status_code=400, detail="이미 처리된 거래입니다.")

    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    txn.matched_user_id = user.id
    txn.status = "CREDITED_MANUAL"
    txn.resolved_by_admin_id = admin.id
    txn.resolution_memo = req.memo
    txn.resolved_at = datetime.datetime.utcnow()

    user.credit_balance += txn.amount
    txn.balance_after = user.credit_balance
    db.add(models.DepositHistory(
        user_id=user.id,
        amount=txn.amount,
        deposit_type="BANK_TRANSFER",
        memo=req.memo or "관리자가 회원을 지정해 대신 충전 처리",
        admin_id=admin.id,
        balance_after=user.credit_balance,
    ))
    db.commit()
    db.refresh(txn)
    db.refresh(user)

    await notify_admins(["deposit_queue", "stats", "deposits", "users"])
    await notify_user(user.id, ["me"])
    send_push_to_user(db, user.id, "충전 완료", f"{txn.amount:,}원이 충전되었습니다 (잔액 {user.credit_balance:,}원)")
    return _bank_txn_response(db, txn)

@app.post("/api/admin/bank-transactions/{txn_id}/mark-other", response_model=schemas.BankTransactionResponse)
async def admin_mark_bank_transaction_other(
    txn_id: int,
    req: schemas.BankTransactionAdminOther,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_auth),
):
    """관리자가 대기(PENDING)/오류(ERROR) 상태 입금 건을 충전 대상이 아닌 것으로 사유와
    함께 종결한다(크레딧 미반영)."""
    txn = db.query(models.BankTransaction).filter(models.BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="은행거래를 찾을 수 없습니다.")
    if txn.status not in ("PENDING", "ERROR"):
        raise HTTPException(status_code=400, detail="이미 처리된 거래입니다.")

    txn.status = "OTHER"
    txn.resolved_by_admin_id = admin.id
    txn.resolution_memo = req.reason
    txn.resolved_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(txn)

    await notify_admins(["deposit_queue", "stats"])
    return _bank_txn_response(db, txn)

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
    users_with_balance = db.query(models.User).filter(
        models.User.role == "USER", models.User.credit_balance > 0
    ).count()
    pending_deposit_count = db.query(models.BankTransaction).filter(models.BankTransaction.status == "PENDING").count()
    error_deposit_count = db.query(models.BankTransaction).filter(models.BankTransaction.status == "ERROR").count()

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
        users_with_balance=users_with_balance,
        pending_deposit_count=pending_deposit_count,
        error_deposit_count=error_deposit_count,
        today=period_stats(period_starts["today"]),
        this_week=period_stats(period_starts["this_week"]),
        this_month=period_stats(period_starts["this_month"]),
    )

# ================= 실시간 알림 (WebSocket) =================
# 브라우저 WebSocket API는 커스텀 헤더를 못 보내므로, 기존 Bearer 토큰을 쿼리 파라미터로
# 받아 기존 verify_admin_token/verify_user_token으로 그대로 검증한다.

WS_PING_INTERVAL = 20  # seconds

async def _ws_keepalive_loop(websocket: WebSocket):
    """클라이언트는 먼저 말을 걸어오지 않으므로 receive_text()만 기다리면 이동통신망/공유기의
    유휴 NAT 타임아웃에 걸려 연결이 양쪽 모르게 끊길 수 있다(특히 휴대폰으로 접속하는 사용자
    앱에서 "실시간 반영이 안 된다"로 나타남, #18). 일정 주기로 ping을 보내 트래픽을 유지하고,
    전송 실패 시 예외를 던져 죽은 연결을 즉시 정리한다."""
    while True:
        try:
            await asyncio.wait_for(websocket.receive_text(), timeout=WS_PING_INTERVAL)
        except asyncio.TimeoutError:
            await websocket.send_json({"type": "ping"})

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
        await _ws_keepalive_loop(websocket)
    except Exception:
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
        await _ws_keepalive_loop(websocket)
    except Exception:
        manager.disconnect_user(user.id, websocket)

@app.websocket("/ws/kiosk")
async def ws_kiosk(websocket: WebSocket, device_uuid: str = Query(...)):
    # 키오스크 메인 화면은 로그인이 없는 공개 화면이므로(GET /api/kiosk/device/{device_uuid}와
    # 동일한 신뢰 모델) 토큰 검증 없이 device_uuid로만 그룹을 식별한다.
    await manager.connect_kiosk(device_uuid, websocket)
    try:
        await _ws_keepalive_loop(websocket)
    except Exception:
        manager.disconnect_kiosk(device_uuid, websocket)

# ================= KIOSK DEVICE PERSISTENCE APIS =================

def _next_kiosk_name(db: Session) -> str:
    """이름을 정하지 않고 등록되는 단말기에 "키오스크 1", "키오스크 2"... 처럼 겹치지 않는
    이름을 순서대로 붙여준다. 기존 이름 중 빈 번호를 찾아 채운다(중간 번호가 삭제로
    비어도 그 번호부터 다시 채움)."""
    existing_names = {name for (name,) in db.query(models.KioskDevice.device_name).all() if name}
    n = 1
    while f"키오스크 {n}" in existing_names:
        n += 1
    return f"키오스크 {n}"

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
            device_name=device_name or _next_kiosk_name(db),
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
        "is_active": device.is_active,
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
            "allow_camera_reader_concurrent": False,
            "is_active": False
        }

    assigned_list = json.loads(device.assigned_products) if device.assigned_products else []
    return {
        "device_uuid": device.device_uuid,
        "device_name": device.device_name,
        "assigned_products": assigned_list,
        "default_product_id": device.default_product_id,
        "default_quantity": device.default_quantity,
        "allow_camera_reader_concurrent": device.allow_camera_reader_concurrent,
        "is_active": device.is_active,
        "updated_at": device.updated_at
    }

@app.get("/api/kiosk/history", response_model=schemas.KioskPaymentHistoryPage)
def get_kiosk_history(
    device_uuid: str,
    before: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """단말기 화면 '최근 결제 내역' 패널용 - 새로고침/앱 재시작으로 화면이 초기화돼도
    (기존엔 kiosk.js의 메모리 배열이라 휘발성이었음) 서버에 남아있는 이력을 다시 불러온다.
    get_kiosk_device와 동일한 신뢰 모델(device_uuid만으로 조회, 별도 인증 없음)."""
    device = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == device_uuid).first()
    if not device:
        return schemas.KioskPaymentHistoryPage(items=[], next_cursor=None)
    return get_kiosk_payment_history_page(db, device.id, _parse_history_cursor(before), min(limit, 100))

class KioskRegisterRequest(schemas.BaseModel):
    device_uuid: str
    device_name: Optional[str] = None
    pin: str

@app.post("/api/kiosk/device/register")
def register_kiosk_device(req: KioskRegisterRequest, request: Request, db: Session = Depends(get_db)):
    """미등록 키오스크 단말기를 관리자 PIN으로 활성화한다. 등록 전에는 결제를 포함한 모든
    키오스크 기능이 프론트엔드(kiosk.js)에서 차단되고 이 화면만 노출된다 - PIN 인증 로직은
    verify_admin_auth와 동일한 시도횟수 제한을 공유한다."""
    client_ip = request.client.host if request.client else "unknown"
    if not security.register_pin_attempt(client_ip):
        raise HTTPException(status_code=429, detail="PIN 시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.")

    if not hmac.compare_digest(req.pin, security.ADMIN_PIN):
        raise HTTPException(status_code=401, detail="PIN 번호가 올바르지 않습니다.")

    security.clear_pin_attempts(client_ip)

    device = db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == req.device_uuid).first()
    if not device:
        default_merchant = db.query(models.Merchant).first()
        if not default_merchant:
            default_merchant = models.Merchant(
                merchant_name="소망 복지 결제 무인 가맹점",
                biz_number="123-45-67890"
            )
            db.add(default_merchant)
            db.commit()
            db.refresh(default_merchant)

        device = models.KioskDevice(
            device_uuid=req.device_uuid,
            device_name=req.device_name or _next_kiosk_name(db),
            merchant_id=default_merchant.id,
            is_active=True,
        )
        db.add(device)
    else:
        device.is_active = True
        if req.device_name:
            device.device_name = req.device_name

    db.commit()
    db.refresh(device)

    return {"success": True, "device_name": device.device_name}

# ================= 관리자 - 키오스크 관리 =================
# 메뉴별 매출 집계는 PaymentLineItem(이 기능 도입 이후의 결제 건)만 대상으로 한다 -
# product_details는 자유 텍스트라 소급 집계가 불가능하다.

def _kiosk_sales_for(db: Session, device_id: int, start_utc: Optional[datetime.datetime] = None):
    from sqlalchemy import func

    query = db.query(
        models.PaymentLineItem.product_id,
        models.PaymentLineItem.product_name,
        func.sum(models.PaymentLineItem.quantity),
        func.sum(models.PaymentLineItem.subtotal),
    ).join(
        models.PaymentTransaction, models.PaymentTransaction.id == models.PaymentLineItem.payment_transaction_id
    ).filter(
        models.PaymentTransaction.kiosk_device_id == device_id,
        models.PaymentTransaction.status == "SUCCESS",
    )
    if start_utc:
        query = query.filter(models.PaymentTransaction.created_at >= start_utc)
    rows = query.group_by(models.PaymentLineItem.product_id, models.PaymentLineItem.product_name).all()
    return [
        schemas.KioskProductSales(product_id=pid, product_name=name, quantity=int(qty), amount=int(amount))
        for pid, name, qty, amount in rows
    ]

@app.get("/api/admin/kiosks", response_model=List[schemas.AdminKioskResponse])
def admin_list_kiosks(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_auth)):
    devices = db.query(models.KioskDevice).order_by(models.KioskDevice.id.asc()).all()
    period_starts = _kst_period_starts_utc()

    result = []
    for device in devices:
        merchant = db.query(models.Merchant).filter(models.Merchant.id == device.merchant_id).first() if device.merchant_id else None
        assigned_list = json.loads(device.assigned_products) if device.assigned_products else []
        result.append(schemas.AdminKioskResponse(
            id=device.id,
            device_uuid=device.device_uuid,
            device_name=device.device_name,
            merchant_id=device.merchant_id,
            merchant_name=merchant.merchant_name if merchant else None,
            assigned_products=assigned_list,
            default_product_id=device.default_product_id,
            default_quantity=device.default_quantity,
            updated_at=device.updated_at,
            sales=schemas.KioskSalesSummary(
                today=_kiosk_sales_for(db, device.id, period_starts["today"]),
                this_week=_kiosk_sales_for(db, device.id, period_starts["this_week"]),
                this_month=_kiosk_sales_for(db, device.id, period_starts["this_month"]),
                all_time=_kiosk_sales_for(db, device.id),
            ),
        ))
    return result

@app.get("/api/admin/kiosks/{device_id}/history", response_model=schemas.KioskPaymentHistoryPage)
def admin_get_kiosk_history(
    device_id: int,
    before: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """관리자 키오스크 상세 화면의 결제 이력 탭 - 키오스크 화면과 동일한 소스(get_kiosk_payment_history_page)를
    공유해 양쪽이 항상 같은 결과를 보게 한다."""
    device = db.query(models.KioskDevice).filter(models.KioskDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="키오스크를 찾을 수 없습니다.")
    return get_kiosk_payment_history_page(db, device_id, _parse_history_cursor(before), min(limit, 100))

@app.put("/api/admin/kiosks/{device_id}")
async def admin_update_kiosk(
    device_id: int,
    req: schemas.KioskUpdateRequest,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """관리자 화면에서 키오스크에 노출할 메뉴(assigned_products) 및 기본 결제 설정을 변경한다."""
    device = db.query(models.KioskDevice).filter(models.KioskDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="키오스크를 찾을 수 없습니다.")

    if req.device_name is not None:
        device.device_name = req.device_name
    if req.assigned_products is not None:
        device.assigned_products = json.dumps(req.assigned_products)
    # default_product_id는 매번 admin.js가 현재 선택값을 통째로 보내는 필드라("기본 결제
    # 없음"을 고르면 null로 보냄) is not None으로 걸러내면 null을 못 받아 기존 값을 못 지웠다.
    if "default_product_id" in req.model_fields_set:
        device.default_product_id = req.default_product_id
    if req.default_quantity is not None:
        device.default_quantity = req.default_quantity

    db.commit()
    db.refresh(device)
    await notify_admins(["stats"])
    await notify_kiosk(device.device_uuid, ["menu"])
    return {"success": True, "message": "키오스크 설정을 저장했습니다."}

@app.delete("/api/admin/kiosks/{device_id}")
async def admin_delete_kiosk(
    device_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_auth),
):
    """등록된 키오스크 단말기를 삭제한다. 과거 결제 이력(payment_transactions)은 device_id 참조만
    끊어질 뿐 그대로 남는다 - kiosk_devices를 참조하는 FK 제약이 없어 안전하게 지울 수 있다."""
    device = db.query(models.KioskDevice).filter(models.KioskDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="키오스크를 찾을 수 없습니다.")

    device_uuid_to_notify = device.device_uuid
    db.delete(device)
    db.commit()
    await notify_admins(["stats"])
    await notify_kiosk(device_uuid_to_notify, ["menu"])
    return {"success": True, "message": "키오스크를 삭제했습니다."}
