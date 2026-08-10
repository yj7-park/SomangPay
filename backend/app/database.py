import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_DB = "postgresql://somanguser:somangpass@db:5432/somangdb"
DB_URL = os.getenv("DATABASE_URL", DEFAULT_DB)

# SQLite일 때만 check_same_thread 적용
connect_args = {"check_same_thread": False} if "sqlite" in DB_URL else {}

engine = create_engine(
    DB_URL,
    connect_args=connect_args,
    pool_pre_ping=True
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


def init_db():
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

        # 신규 설계: 계좌번호 기반 매칭 폐기 - source_account 컬럼 제거
        _run_migration_step(db, "ALTER TABLE deposit_histories DROP COLUMN IF EXISTS source_account;", "deposit_histories.source_account drop")

        # 신규 설계: 카드는 존재 = 활성. is_active 컬럼 제거 + 회원당 타입별 1개 제약
        _run_migration_step(db, "ALTER TABLE nfc_cards DROP COLUMN IF EXISTS is_active;", "nfc_cards.is_active drop")
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_nfc_cards_user_type ON nfc_cards(user_id, card_type);", "nfc_cards unique(user_id, card_type)")

        # 신규 설계: 회원 이름 유일성(동명이인은 관리자가 구분 이름으로 직접 등록), 전화번호=로그인ID 유일성
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_name ON users(name);", "users unique(name)")
        _run_migration_step(db, "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone ON users(phone);", "users unique(phone)")
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
