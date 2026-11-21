"""관리자 인증 방식(2026-11-08, #admin-account).

관리자 권한은 일반 회원 계정에 얹는다(users.is_admin). 인증 방식은 화면(surface)별로 고른다.

- admin_app (관리자 앱 로그인): "pin" = 공용 관리자 PIN / "account" = 관리자 권한 회원의 휴대폰 번호 +
  회원 앱과 같은 비밀번호
- kiosk (키오스크 설정 진입): "pin" = 공용 관리자 PIN / "account" = 관리자 권한 회원의 QR 코드나 NFC 카드.
  2026-11-21부터 키오스크마다 고른다(kiosk_devices.admin_auth_mode, 관리자 앱 키오스크 상세). 키오스크 토큰은
  "admin_<method>_kiosk_d<키오스크 id>"로 어느 키오스크에서 받았는지 담는다. 옛 전체 설정(app_settings
  admin_auth_mode.kiosk)은 컬럼 추가 때 기존 키오스크로 옮겼고 더는 쓰지 않는다.

기본값은 둘 다 "account"다. 다만 그 방식으로 들어갈 수 있는 관리자 회원이 한 명도 없으면(처음 배포 직후,
권한을 모두 회수한 경우) 잠겨서 아무도 못 들어오지 않게 그 화면은 PIN으로 동작한다(effective_mode).

발급하는 관리자 토큰에는 방식과 화면을 넣는다(purpose 토큰 "admin_<method>_<surface>"). 매 요청마다
require_admin_auth가 그 화면의 지금 방식과 맞는지, 계정 토큰이면 그 회원이 아직 활성 + 관리자 권한인지
다시 확인한다 - 방식을 바꾸거나 권한을 회수하면 기존 세션이 바로 끊긴다.
"""
import re
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app import models, security

SURFACES = ("admin_app", "kiosk")
METHODS = ("pin", "account")
DEFAULT_MODE = "account"
ADMIN_TOKEN_TTL_SECONDS = security.ADMIN_TOKEN_TTL_SECONDS


def _setting_key(surface: str) -> str:
    return f"admin_auth_mode.{surface}"


def configured_mode(db: Session, surface: str) -> str:
    row = db.get(models.AppSetting, _setting_key(surface))
    return row.value if row and row.value in METHODS else DEFAULT_MODE


def eligible_admins_query(db: Session, surface: str):
    """그 화면에 계정 방식으로 들어갈 수 있는 회원 - 관리자 앱은 비밀번호를 정한(회원 앱 가입한) 사람만,
    키오스크는 QR/NFC가 있으면 되므로 활성 관리자 회원 전체."""
    q = db.query(models.User).filter(models.User.is_admin == True, models.User.status == "ACTIVE")  # noqa: E712
    if surface == "admin_app":
        q = q.filter(models.User.password_set == True, models.User.phone.isnot(None))  # noqa: E712
    return q


def effective_mode(db: Session, surface: str) -> str:
    mode = configured_mode(db, surface)
    if mode == "account" and eligible_admins_query(db, surface).first() is None:
        return "pin"
    return mode


def kiosk_configured_mode(device: Optional[models.KioskDevice]) -> str:
    mode = device.admin_auth_mode if device else None
    return mode if mode in METHODS else DEFAULT_MODE


def kiosk_effective_mode(db: Session, device: Optional[models.KioskDevice]) -> str:
    """그 키오스크에 지금 실제로 적용되는 방식. 등록 전(행이 없는) 키오스크는 기본값을 따른다."""
    mode = kiosk_configured_mode(device)
    if mode == "account" and eligible_admins_query(db, "kiosk").first() is None:
        return "pin"
    return mode


def find_kiosk(db: Session, device_uuid: Optional[str]) -> Optional[models.KioskDevice]:
    if not device_uuid:
        return None
    return db.query(models.KioskDevice).filter(models.KioskDevice.device_uuid == device_uuid).first()


def modes(db: Session) -> Dict[str, Dict[str, str]]:
    return {"admin_app": {"configured": configured_mode(db, "admin_app"), "effective": effective_mode(db, "admin_app")}}


def set_mode(db: Session, surface: str, mode: str):
    if surface not in SURFACES or mode not in METHODS:
        raise ValueError("잘못된 설정입니다.")
    row = db.get(models.AppSetting, _setting_key(surface))
    if row:
        row.value = mode
    else:
        db.add(models.AppSetting(key=_setting_key(surface), value=mode))


def create_token(user_id: int, method: str, surface: str, kiosk: Optional[models.KioskDevice] = None) -> str:
    purpose = f"admin_{method}_{surface}"
    if surface == "kiosk" and kiosk is not None:
        purpose += f"_d{kiosk.id}"
    return security.create_purpose_token(purpose, user_id, ADMIN_TOKEN_TTL_SECONDS)


_PURPOSE_RE = re.compile(r"admin_(pin|account)_(admin_app|kiosk)(?:_d(\d+))?")


def resolve_token(db: Session, token: str) -> Optional[models.User]:
    """유효한 관리자 토큰이면 그 계정, 아니면 None."""
    parsed = security.read_purpose_token(token)
    m = _PURPOSE_RE.fullmatch(parsed[0]) if parsed else None
    if m:
        method, surface, kiosk_id = m.group(1), m.group(2), m.group(3)
        if surface == "kiosk":
            # 키오스크 id가 없는 토큰은 등록 전 키오스크(또는 이 기능 전)에서 받은 것 - 기본값으로 판단.
            kiosk = db.get(models.KioskDevice, int(kiosk_id)) if kiosk_id else None
            if kiosk_id and kiosk is None:
                return None  # 삭제된 키오스크
            current = kiosk_effective_mode(db, kiosk)
        else:
            current = effective_mode(db, surface)
        if current != method:
            return None  # 방식이 바뀌었으면 기존 세션은 끝
        user = db.get(models.User, parsed[1])
        if not user or user.status != "ACTIVE":
            return None
        if method == "pin":
            return user if user.role == "ADMIN" else None
        return user if user.is_admin else None
    # 이 기능 이전에 발급된 PIN 토큰(형식이 회원 토큰과 같다) - 관리자 앱 PIN 세션으로 취급한다.
    legacy_id = security.verify_admin_token(token)
    if legacy_id and effective_mode(db, "admin_app") == "pin":
        user = db.get(models.User, legacy_id)
        if user and user.role == "ADMIN" and user.status == "ACTIVE":
            return user
    return None
