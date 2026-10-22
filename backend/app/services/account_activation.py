"""앱 계정 활성화(#activation) - 비밀번호를 아직 안 정한 회원(users.password_set = False)의 첫 로그인.

흐름(회원 앱 로그인 화면, user.js):
1. 로그인 시도 → 서버가 "activation_required"로 응답 → request_code로 6자리 인증번호를 만들어
   문자 대기열에 넣는다(실제 발송은 "이 기기에서 문자 발송"을 켠 관리자 APK, sms_outbox.py).
2. 화면은 code_status를 짧게 폴링해서 문자가 실제로 나간 순간부터 1분 카운트다운을 보여준다.
   유효시간을 발송 시각(sms.sent_at)부터 재는 이유: APK가 20초 주기로 가져가므로 요청 시각부터
   재면 회원이 받기도 전에 시간이 깎인다.
3. verify_code가 맞으면 10분짜리 "activate" 토큰을 주고, complete가 그 토큰으로 비밀번호를 정하면서
   password_set = True(활성) + 로그인 토큰을 돌려준다.

문자 비용/스팸 방지: 같은 회원에게 1분 안에는 새 번호를 다시 안 보내고(진행 중인 걸 그대로 씀),
하루 MAX_CODES_PER_DAY개까지만. 번호 하나당 틀릴 수 있는 횟수는 MAX_VERIFY_ATTEMPTS.
"""
import datetime
import hashlib
import hmac
import secrets

from sqlalchemy.orm import Session

from app import models, security
from app.services import sms_outbox

CODE_TTL_SECONDS = 60
CODE_GRACE_SECONDS = 5  # 화면 카운트다운과 서버 시계 차이 여유
RESEND_COOLDOWN_SECONDS = 60
SEND_TIMEOUT_SECONDS = 120  # 이 안에 발송 기기가 못 보내면 실패로 보고 다시 요청하게 한다
MAX_CODES_PER_DAY = 10
MAX_VERIFY_ATTEMPTS = 5
ACTIVATE_TOKEN_TTL_SECONDS = 600
PASSWORD_MIN_LEN = 4


class ActivationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _code_hash(user_id: int, code: str) -> str:
    return hmac.new(security.ADMIN_SECRET_KEY, f"otp:{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def needs_activation(user: models.User) -> bool:
    return user.role != "ADMIN" and not user.password_set


def mask_phone(phone: str) -> str:
    d = phone or ""
    return f"{d[:3]}-****-{d[-4:]}" if len(d) == 11 else d


def _latest_code(db: Session, user_id: int):
    return (
        db.query(models.UserActivationCode)
        .filter(models.UserActivationCode.user_id == user_id)
        .order_by(models.UserActivationCode.id.desc())
        .first()
    )


def _sms_state(row: models.UserActivationCode, sms: models.SmsOutbox, now: datetime.datetime):
    """(state, expires_in) - state: sending / sent / expired / failed."""
    if row.verified_at:
        return "expired", 0
    if sms is None or sms.status in ("FAILED", "CANCELED"):
        return "failed", 0
    if sms.status == "SENT" and sms.sent_at:
        remaining = (sms.sent_at + datetime.timedelta(seconds=CODE_TTL_SECONDS) - now).total_seconds()
        return ("sent", int(remaining)) if remaining > 0 else ("expired", 0)
    if (now - row.created_at).total_seconds() > SEND_TIMEOUT_SECONDS:
        return "failed", 0
    return "sending", 0


def request_code(db: Session, user: models.User) -> models.UserActivationCode:
    if not needs_activation(user):
        raise ActivationError("이미 비밀번호를 정한 계정이에요. 비밀번호로 로그인해 주세요.")
    if user.status == "INACTIVE":
        raise ActivationError("아직 이용이 열리지 않은 계정이에요. 교회 사무실에 문의해 주세요.", 403)
    if user.status != "ACTIVE":
        raise ActivationError("이용이 정지된 계정이에요. 교회 사무실에 문의해 주세요.", 403)
    if not user.phone:
        raise ActivationError("등록된 휴대폰 번호가 없어요. 교회 사무실에 문의해 주세요.")

    now = _now()
    last = _latest_code(db, user.id)
    if last and (now - last.created_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
        sms = db.get(models.SmsOutbox, last.sms_id) if last.sms_id else None
        state, _ = _sms_state(last, sms, now)
        if state in ("sending", "sent"):
            return last  # 1분 안 재요청은 같은 번호를 그대로 쓴다(문자 중복 방지)

    online = [d for d in db.query(models.SmsSenderDevice).all() if sms_outbox.sender_is_online(d)]
    if not online:
        raise ActivationError("지금은 인증 문자를 보낼 수 없어요. 잠시 후 다시 시도하거나 교회 사무실에 문의해 주세요.", 503)

    day_ago = now - datetime.timedelta(days=1)
    today_count = db.query(models.UserActivationCode).filter(
        models.UserActivationCode.user_id == user.id,
        models.UserActivationCode.created_at >= day_ago,
    ).count()
    if today_count >= MAX_CODES_PER_DAY:
        raise ActivationError("인증 문자를 너무 많이 요청했어요. 내일 다시 시도하거나 교회 사무실에 문의해 주세요.", 429)

    code = f"{secrets.randbelow(10 ** 6):06d}"
    sms = sms_outbox.enqueue_sms(
        db, user.phone,
        f"[소망페이] 인증번호 {code}\n1분 안에 입력해 주세요.",
        source="activation", user_id=user.id, commit=False,
    )
    db.flush()
    row = models.UserActivationCode(user_id=user.id, code_hash=_code_hash(user.id, code), sms_id=sms.id, created_at=now)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def code_status(db: Session, user: models.User, request_id: int) -> dict:
    row = db.get(models.UserActivationCode, request_id)
    if not row or row.user_id != user.id:
        raise ActivationError("인증 요청을 찾을 수 없어요. 처음부터 다시 시도해 주세요.", 404)
    sms = db.get(models.SmsOutbox, row.sms_id) if row.sms_id else None
    state, expires_in = _sms_state(row, sms, _now())
    return {"state": state, "expires_in": expires_in}


def verify_code(db: Session, user: models.User, request_id: int, code: str) -> str:
    row = db.get(models.UserActivationCode, request_id)
    latest = _latest_code(db, user.id)
    if not row or row.user_id != user.id or not latest or latest.id != row.id:
        raise ActivationError("인증 요청을 찾을 수 없어요. 인증번호를 다시 받아 주세요.", 404)
    if row.verified_at:
        raise ActivationError("이미 사용한 인증번호예요. 다시 받아 주세요.")
    if row.attempts >= MAX_VERIFY_ATTEMPTS:
        raise ActivationError("인증번호를 여러 번 틀렸어요. 인증번호를 다시 받아 주세요.")

    sms = db.get(models.SmsOutbox, row.sms_id) if row.sms_id else None
    now = _now()
    if not sms or sms.status != "SENT" or not sms.sent_at:
        raise ActivationError("아직 인증 문자가 발송되지 않았어요. 잠시만 기다려 주세요.")
    if now > sms.sent_at + datetime.timedelta(seconds=CODE_TTL_SECONDS + CODE_GRACE_SECONDS):
        raise ActivationError("인증 시간(1분)이 지났어요. 인증번호를 다시 받아 주세요.")

    row.attempts += 1
    if not hmac.compare_digest(row.code_hash, _code_hash(user.id, (code or "").strip())):
        db.commit()
        left = MAX_VERIFY_ATTEMPTS - row.attempts
        raise ActivationError(
            f"인증번호가 맞지 않아요. (남은 횟수 {left}번)" if left > 0
            else "인증번호를 여러 번 틀렸어요. 인증번호를 다시 받아 주세요."
        )
    row.verified_at = now
    db.commit()
    return security.create_purpose_token("activate", user.id, ACTIVATE_TOKEN_TTL_SECONDS)


def complete(db: Session, activation_token: str, new_password: str) -> models.User:
    user_id = security.verify_purpose_token(activation_token or "", "activate")
    if not user_id:
        raise ActivationError("인증 시간이 지났어요. 처음부터 다시 진행해 주세요.", 401)
    user = db.get(models.User, user_id)
    if not user or user.status != "ACTIVE":
        raise ActivationError("계정을 찾을 수 없어요. 교회 사무실에 문의해 주세요.", 404)
    if not needs_activation(user):
        raise ActivationError("이미 비밀번호를 정한 계정이에요. 비밀번호로 로그인해 주세요.")
    password = (new_password or "").strip()
    if len(password) < PASSWORD_MIN_LEN:
        raise ActivationError(f"비밀번호는 {PASSWORD_MIN_LEN}자 이상으로 정해 주세요.")
    user.password_hash = security.hash_password(password)
    user.password_set = True
    db.commit()
    db.refresh(user)
    return user
