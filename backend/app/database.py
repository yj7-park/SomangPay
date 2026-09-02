import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_DB = "postgresql://somanguser:somangpass@db:5432/somangdb"
DB_URL = os.getenv("DATABASE_URL", DEFAULT_DB)

# SQLite일 때만 check_same_thread 적용
connect_args = {"check_same_thread": False} if "sqlite" in DB_URL else {}

# 부하 테스트(키오스크 5대 + 동시 접속 300명 시나리오)에서 기본 풀 크기(5+10=15)로는
# 커넥션 대기가 지연의 절반 이상을 차지해 30+30=60으로 늘렸었다(당시 uvicorn 워커 1개).
# 이후(2026-09) A1.Flex(2 OCPU/12GB)로 이전 + uvicorn --workers 4로 올리면서, 이 풀은
# "워커 프로세스마다" 따로 생기므로 워커당 10+10=20으로 잡는다 -> 4워커 x 20 = 80으로
# postgres max_connections(100)를 넘지 않고 psql 점검 등 여유분(약 20)도 남긴다.
# (postgres를 max_connections 200 / shared_buffers 2~3GB로 올리면 워커당 풀도 더 키울 수 있음)
is_sqlite = "sqlite" in DB_URL
pool_kwargs = {} if is_sqlite else {"pool_size": 10, "max_overflow": 10, "pool_timeout": 10}

engine = create_engine(
    DB_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    **pool_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def _run_migration_step(db, sql, description=""):
    """마이그레이션 구문을 하나씩 독립적으로 실행한다. 재시작 시 이미 적용된 구문(예:
    ADD CONSTRAINT처럼 IF NOT EXISTS가 없는 DDL)이 실패해도, 그 실패가 다른 구문의
    실행을 막지 않도록 각 구문을 별도 트랜잭션으로 분리한다."""
    from sqlalchemy import text
    try:
        db.execute(text(sql))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Migration step skipped ({description or sql[:60]}): {e}")


def _backfill_balance_snapshots(db):
    """과거 이력에는 반영 시점 잔액 스냅샷(balance_after)이 없어 이력 카드에서 충전 건만
    잔액이 안 보이는 문제(#19 후속) - 회원별로 잔액에 영향을 준 사건(deposit_histories +
    성공한 payment_transactions)을 시간순으로 재생해 각 시점의 잔액을 역산해 채운다.
    deposit_histories와 bank_transactions는 같은 계좌이체 충전 사건을 서로 다른
    테이블에 중복 기록하므로(각각 admin.js/user.js가 읽는 소스), 두 테이블에 대해
    각자의 타임스탬프 기준으로 독립적으로 재생한다 - 같은 사건은 같은 커밋에서 생성돼
    두 테이블의 타임스탬프가 사실상 동시이므로 순서가 어긋나지 않는다."""
    from . import models

    pending_dh = db.query(models.DepositHistory).filter(models.DepositHistory.balance_after.is_(None)).count()
    pending_bt = db.query(models.BankTransaction).filter(
        models.BankTransaction.balance_after.is_(None),
        models.BankTransaction.status.in_(["CREDITED", "CREDITED_MANUAL"]),
    ).count()
    if not pending_dh and not pending_bt:
        return
    print(f"Backfilling balance_after snapshots: {pending_dh} deposit_histories, {pending_bt} bank_transactions rows...")

    user_ids = [row[0] for row in db.query(models.DepositHistory.user_id).distinct().all()]

    for user_id in user_ids:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            continue

        payment_deltas = [
            (p.created_at, p.id, -p.amount, None)
            for p in db.query(models.PaymentTransaction).filter(
                models.PaymentTransaction.user_id == user_id,
                models.PaymentTransaction.status == "SUCCESS",
            ).all()
        ]

        # Timeline 1: deposit_histories 자체("충전 경로 불문 통합 원장") + 성공 결제
        all_deposits = db.query(models.DepositHistory).filter(models.DepositHistory.user_id == user_id).all()
        if any(d.balance_after is None for d in all_deposits):
            events = [(d.created_at, d.id, d.amount, d) for d in all_deposits] + payment_deltas
            events.sort(key=lambda e: (e[0], e[1] if isinstance(e[1], int) else 0))
            running = user.credit_balance - sum(e[2] for e in events)
            for _, _, delta, row in events:
                running += delta
                if row is not None and row.balance_after is None:
                    row.balance_after = running

        # Timeline 2: bank_transactions(CREDITED/CREDITED_MANUAL, 계좌이체 충전) + 비계좌이체
        # deposit_histories(직권 충전/차감) + 성공 결제 - Timeline 1과 같은 사건 집합을
        # 계좌이체 건만 bank_transactions 쪽 표현으로 바꿔서 재생한 것.
        all_bts = db.query(models.BankTransaction).filter(
            models.BankTransaction.matched_user_id == user_id,
            models.BankTransaction.status.in_(["CREDITED", "CREDITED_MANUAL"]),
        ).all()
        if any(t.balance_after is None for t in all_bts):
            non_bank_deposits = [d for d in all_deposits if d.deposit_type != "BANK_TRANSFER"]
            events = [(t.created_at, t.id, t.amount, t) for t in all_bts] + \
                     [(d.created_at, d.id, d.amount, None) for d in non_bank_deposits] + \
                     payment_deltas
            events.sort(key=lambda e: (e[0], e[1] if isinstance(e[1], int) else 0))
            running = user.credit_balance - sum(e[2] for e in events)
            for _, _, delta, row in events:
                running += delta
                if row is not None and row.balance_after is None:
                    row.balance_after = running

        db.commit()
    print("Balance snapshot backfill complete.")


def _backfill_qr_uuids(db):
    """QR 코드는 예전엔 관리자가 실물 QR 스티커를 카메라로 스캔해 읽은 임의 문자열을
    등록했지만, 이제는 회원가입 시 서버가 UUID를 발급해 그 값을 그대로 QR로 그려 쓰는
    방식으로 바뀌었다(admin_register_user). 기존 회원의 QR_CODE 카드는 UUID 형식이
    아닌 옛 값이므로 전부 새 UUID로 일괄 재발급하고, QR이 아예 없던 회원에게도 새로
    발급한다. UUID 형식이면 이미 이 마이그레이션을 거친 것이므로 매 재시작마다 반복
    재발급하지 않는다(재발급 API로 admin이 바꾼 값도 항상 UUID라 안전)."""
    import re
    import uuid
    from . import models

    uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

    stale_cards = [
        c for c in db.query(models.NFCCard).filter(models.NFCCard.card_type == "QR_CODE").all()
        if not uuid_re.match(c.card_uid or "")
    ]
    users_without_qr = db.query(models.User).filter(
        ~models.User.id.in_(db.query(models.NFCCard.user_id).filter(models.NFCCard.card_type == "QR_CODE"))
    ).all()
    if not stale_cards and not users_without_qr:
        return

    print(f"Reissuing QR UUIDs: {len(stale_cards)} legacy cards, {len(users_without_qr)} users without a QR yet...")
    for card in stale_cards:
        db.query(models.PaymentTransaction).filter(models.PaymentTransaction.card_id == card.id).update({"card_id": None})
        db.delete(card)
    db.flush()

    for card in stale_cards:
        user = db.query(models.User).filter(models.User.id == card.user_id).first()
        if not user:
            continue
        db.add(models.NFCCard(
            card_uid=str(uuid.uuid4()),
            card_name=f"{user.name}의 교인증 QR 코드",
            card_type="QR_CODE",
            user_id=user.id,
        ))
    for user in users_without_qr:
        db.add(models.NFCCard(
            card_uid=str(uuid.uuid4()),
            card_name=f"{user.name}의 교인증 QR 코드",
            card_type="QR_CODE",
            user_id=user.id,
        ))
    db.commit()
    print("QR UUID reissue complete.")


def _migrate_and_seed():
    from . import models

    # DB 컬럼/제약조건 안전 마이그레이션 (신규 컬럼은 ADD COLUMN IF NOT EXISTS로,
    # 유일성 제약은 CREATE UNIQUE INDEX IF NOT EXISTS로 - 둘 다 재실행해도 안전).
    db = SessionLocal()
    try:
        _run_migration_step(db, "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200) DEFAULT '1234';", "users.password_hash")
        _run_migration_step(db, "ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'NFC';", "nfc_cards.card_type")
        _run_migration_step(db, "ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS default_product_id INTEGER;", "kiosk_devices.default_product_id")
        _run_migration_step(db, "ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS default_quantity INTEGER DEFAULT 1;", "kiosk_devices.default_quantity")
        _run_migration_step(db, "ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS allow_camera_reader_concurrent BOOLEAN DEFAULT FALSE;", "kiosk_devices.allow_camera_reader_concurrent")
        _run_migration_step(db, "ALTER TABLE deposit_histories ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);", "deposit_histories.transaction_id")
        _run_migration_step(db, "ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS kiosk_device_id INTEGER;", "payment_transactions.kiosk_device_id")

        # 신규 설계: 계좌번호 기반 매칭 폐기 - source_account 컬럼 제거
        _run_migration_step(db, "ALTER TABLE deposit_histories DROP COLUMN IF EXISTS source_account;", "deposit_histories.source_account drop")

        # 신규 설계: 카드는 존재 = 활성. is_active 컬럼 제거 + 회원당 타입별 1개 제약
        _run_migration_step(db, "ALTER TABLE nfc_cards DROP COLUMN IF EXISTS is_active;", "nfc_cards.is_active drop")
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_nfc_cards_user_type ON nfc_cards(user_id, card_type);", "nfc_cards unique(user_id, card_type)")

        # 신규 설계: 회원 이름 유일성(동명이인은 관리자가 구분 이름으로 직접 등록), 전화번호=로그인ID 유일성
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_name ON users(name);", "users unique(name)")
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users(phone);", "users unique(phone)")

        # 신규 설계: '충전 신청(RechargeRequest)' 단계 폐기 - 계좌 입금이 등록 회원과 자동
        # 매칭되면 회원이 직접 선택해 충전을 완료하는 흐름으로 대체. 실제 충전 이력은
        # deposit_histories에 그대로 남아있어 정보 손실 없음.
        _run_migration_step(db, "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS resolved_by_admin_id INTEGER;", "bank_transactions.resolved_by_admin_id")
        _run_migration_step(db, "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS resolution_memo VARCHAR(200);", "bank_transactions.resolution_memo")
        _run_migration_step(db, "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;", "bank_transactions.resolved_at")
        _run_migration_step(db, "ALTER TABLE bank_transactions DROP COLUMN IF EXISTS matched_recharge_request_id;", "bank_transactions.matched_recharge_request_id drop")
        # 과거 상태값 백필(최선 근사) - 이전에는 매칭=즉시크레딧반영이었으므로 MATCHED는 CREDITED로 간주.
        _run_migration_step(db, "UPDATE bank_transactions SET status='ERROR' WHERE status='UNMATCHED';", "bank_transactions backfill ERROR")
        _run_migration_step(db, "UPDATE bank_transactions SET status='CREDITED' WHERE status='MATCHED';", "bank_transactions backfill CREDITED")
        _run_migration_step(db, "DROP TABLE IF EXISTS recharge_requests;", "recharge_requests drop table")

        # 이력 카드에 "처리 후 잔액" 표시(#18) - 충전이 실제 반영된 시점의 잔액 스냅샷
        _run_migration_step(db, "ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER;", "bank_transactions.balance_after")

        # 어드민 회원상세 이력 카드에도 동일하게 "처리 후 잔액" 표시(#19)
        _run_migration_step(db, "ALTER TABLE deposit_histories ADD COLUMN IF NOT EXISTS balance_after INTEGER;", "deposit_histories.balance_after")

        # 키오스크 단말기 등록 절차(#kiosk-register) - is_active 컬럼을 이번에 처음 추가하는
        # 경우에만 기존 단말기를 전부 활성 상태로 간주해 그랜드파더링한다(안 그러면 이미 잘
        # 쓰이던 단말기가 이 배포 직후 전부 "미등록" 상태로 잠겨버림). DO 블록으로 컬럼이
        # 이번에 새로 생겼을 때만 백필하도록 감싸서, 이후 재시작 때는 관리자가 등록/해제한
        # 상태를 건드리지 않는다.
        _run_migration_step(db, """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='kiosk_devices' AND column_name='is_active'
                ) THEN
                    ALTER TABLE kiosk_devices ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT FALSE;
                    UPDATE kiosk_devices SET is_active = TRUE;
                END IF;
            END $$;
        """, "kiosk_devices.is_active (+ grandfather existing devices)")

        # 관리자 푸시 알림 항목별 on/off (#push-admin)
        _run_migration_step(db, "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS notify_deposit_error BOOLEAN NOT NULL DEFAULT TRUE;", "push_subscriptions.notify_deposit_error")
        _run_migration_step(db, "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS notify_deposit_credited BOOLEAN NOT NULL DEFAULT TRUE;", "push_subscriptions.notify_deposit_credited")
        _run_migration_step(db, "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS notify_payment BOOLEAN NOT NULL DEFAULT TRUE;", "push_subscriptions.notify_payment")

        # 관리자 키오스크 관리 화면 "온라인 상태 / 마지막 접속"(#redesign) - 실시간 온라인
        # 여부는 DB가 아니라 ws_manager의 인메모리 WS 연결로 판단하고(admin_list_kiosks 참고),
        # 이 컬럼은 오프라인일 때 보여줄 "마지막으로 연결됐던 시각"만 담는다.
        _run_migration_step(db, "ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;", "kiosk_devices.last_seen_at")

        try:
            _backfill_balance_snapshots(db)
        except Exception as e:
            db.rollback()
            print(f"Balance snapshot backfill error: {e}")

        try:
            _backfill_qr_uuids(db)
        except Exception as e:
            db.rollback()
            print(f"QR UUID reissue error: {e}")
    finally:
        db.close()

    models.Base.metadata.create_all(bind=engine)
    
    # 기본 가맹점 (merchant_id=1) 자동 보장
    db = SessionLocal()
    try:
        default_merchant = db.query(models.Merchant).filter(models.Merchant.id == 1).first()
        if not default_merchant:
            default_merchant = models.Merchant(
                merchant_name="소망 복지 결제 무인 가맹점",
                biz_number="123-45-67890"
            )
            db.add(default_merchant)
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Merchant init error: {e}")
    finally:
        db.close()


def init_db():
    """uvicorn --workers로 워커가 여러 개면 각 워커가 부팅 시 _migrate_and_seed()를 동시에
    실행해 DDL 마이그레이션·백필(_backfill_qr_uuids 등)이 서로 레이스를 일으킨다(관찰됨:
    uq_nfc_cards_user_type 중복키). postgres 어드바이저리 락으로 한 번에 한 워커만 돌도록
    직렬화한다 - 뒤이어 락을 얻은 워커도 본문을 다시 돌지만 그땐 전부 IF NOT EXISTS /
    조기 return이라 사실상 no-op. SQLite(테스트)엔 어드바이저리 락이 없어 바로 실행한다."""
    if is_sqlite:
        _migrate_and_seed()
        return

    from sqlalchemy import text
    lock_conn = engine.connect()
    try:
        lock_conn.execute(text("SELECT pg_advisory_lock(731942)"))
        _migrate_and_seed()
    finally:
        try:
            lock_conn.execute(text("SELECT pg_advisory_unlock(731942)"))
        finally:
            lock_conn.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
