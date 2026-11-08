"""관리자 인증 방식(2026-11-08, #admin-account).

관리자 권한은 일반 회원 계정에 얹는다(users.is_admin). 인증 방식은 화면(surface)별로 고른다.

- admin_app (관리자 앱 로그인): "pin" = 공용 관리자 PIN / "account" = 관리자 권한 회원의 휴대폰 번호 +
  회원 앱과 같은 비밀번호
- kiosk (키오스크 설정 진입): "pin" = 공용 관리자 PIN / "account" = 관리자 권한 회원의 QR 코드나 NFC 카드

기본값은 둘 다 "account"다. 다만 그 방식으로 들어갈 수 있는 관리자 회원이 한 명도 없으면(처음 배포 직후,
권한을 모두 회수한 경우) 잠겨서 아무도 못 들어오지 않게 그 화면은 PIN으로 동작한다(effective_mode).

발급하는 관리자 토큰에는 방식과 화면을 넣는다(purpose 토큰 "admin_<method>_<surface>"). 매 요청마다
require_admin_auth가 그 화면의 지금 방식과 맞는지, 계정 토큰이면 그 회원이 아직 활성 + 관리자 권한인지
다시 확인한다 - 방식을 바꾸거나 권한을 회수하면 기존 세션이 바로 끊긴다.
"""
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


def modes(db: Session) -> Dict[str, Dict[str, str]]:
    return {s: {"configured": configured_mode(db, s), "effective": effective_mode(db, s)} for s in SURFACES}


def set_mode(db: Session, surface: str, mode: str):
    if surface not in SURFACES or mode not in METHODS:
        raise ValueError("잘못된 설정입니다.")
    row = db.get(models.AppSetting, _setting_key(surface))
    if row:
        row.value = mode
    else:
        db.add(models.AppSetting(key=_setting_key(surface), value=mode))


def create_token(user_id: int, method: str, surface: str) -> str:
    return security.create_purpose_token(f"admin_{method}_{surface}", user_id, ADMIN_TOKEN_TTL_SECONDS)


def resolve_token(db: Session, token: str) -> Optional[models.User]:
    """유효한 관리자 토큰이면 그 계정, 아니면 None."""
    for surface in SURFACES:
        for method in METHODS:
            user_id = security.verify_purpose_token(token, f"admin_{method}_{surface}")
            if not user_id:
                continue
            if effective_mode(db, surface) != method:
                return None  # 방식이 바뀌었으면 기존 세션은 끝
            user = db.get(models.User, user_id)
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
