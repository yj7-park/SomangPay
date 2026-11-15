"""카드 식별자(NFC UID / QR 값)로 등록 카드를 찾는다.

키오스크 USB 리더(NFC-X, VendorHidUidReader)는 7바이트 UID 카드(NTAG215 스티커 등)를 앞 4바이트만
읽어 보낸다(2026-11-15 운영 확인: 관리자 앱 등록 04:EB:AA:13:D4:2A:81 → 키오스크 04:EB:AA:13). 그래서
정확히 맞는 카드가 없고 4바이트 UID가 들어오면, 그 4바이트로 시작하는 7바이트 NFC 카드가 **딱 하나**일
때만 그 카드로 본다(둘 이상이면 어느 쪽인지 모르니 없음으로 처리).
"""
import logging
import re
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)

_UID4 = re.compile(r"^[0-9A-F]{2}(:[0-9A-F]{2}){3}$")


def find_card_by_uid(db: Session, raw_uid: str) -> Optional[models.NFCCard]:
    uid = (raw_uid or "").strip().upper()
    if not uid:
        return None
    # 대소문자 무관 비교 - 읽는 경로마다 헥스 대소문자 표기가 갈릴 수 있다.
    card = db.query(models.NFCCard).filter(func.upper(models.NFCCard.card_uid) == uid).first()
    if card or not _UID4.match(uid):
        return card

    candidates = (
        db.query(models.NFCCard)
        .filter(
            models.NFCCard.card_type == "NFC",
            func.upper(models.NFCCard.card_uid).like(uid + ":%"),
            func.length(models.NFCCard.card_uid) == 20,  # 7바이트 "XX:XX:XX:XX:XX:XX:XX"
        )
        .limit(2)
        .all()
    )
    if len(candidates) == 1:
        logger.info("4바이트 UID %s를 7바이트 카드 %s로 매칭", uid, candidates[0].card_uid)
        return candidates[0]
    return None
