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

def init_db():
    from . import models
    from sqlalchemy import text

    # DB 컬럼 안전 마이그레이션 (users.password_hash, nfc_cards.card_type, kiosk_devices default pay)
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200) DEFAULT '1234';"))
        db.execute(text("ALTER TABLE nfc_cards ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'NFC';"))
        db.execute(text("ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS default_product_id INTEGER;"))
        db.execute(text("ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS default_quantity INTEGER DEFAULT 1;"))
        db.execute(text("ALTER TABLE kiosk_devices ADD COLUMN IF NOT EXISTS allow_camera_reader_concurrent BOOLEAN DEFAULT FALSE;"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Migration error: {e}")
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
