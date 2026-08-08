import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Optional

# 관리자 PIN - 운영 환경에서는 반드시 환경변수로 재정의해야 한다 (기본값은 데모/개발용)
ADMIN_PIN = os.getenv("ADMIN_PIN", "1234")

_secret_env = os.getenv("ADMIN_SECRET_KEY")
if not _secret_env:
    print(
        "[SECURITY WARNING] ADMIN_SECRET_KEY 환경변수가 설정되지 않아 임시 비밀키를 무작위로 "
        "생성합니다. 서버가 재시작되면 기존에 발급된 관리자 세션이 모두 무효화됩니다. "
        "운영 배포 전 반드시 ADMIN_SECRET_KEY를 고정된 값으로 설정하세요."
    )
    _secret_env = secrets.token_hex(32)
ADMIN_SECRET_KEY = _secret_env.encode()

TOKEN_TTL_SECONDS = 12 * 60 * 60  # 관리자 세션 유효시간: 12시간
PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256으로 비밀번호를 해싱한다. 신규 의존성 없이 표준 라이브러리만 사용."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """새 해시 포맷과, 시드 데이터 등에 남아있는 레거시 평문 둘 다 검증한다."""
    if not stored or not password:
        return False
    if stored.startswith("pbkdf2_sha256$") and stored.count("$") == 3:
        try:
            _, iterations_str, salt, digest = stored.split("$")
            iterations = int(iterations_str)
        except ValueError:
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
        return hmac.compare_digest(candidate, digest)
    # 레거시 평문 비밀번호 (기존 시드 데이터 등)
    return hmac.compare_digest(stored, password)


def needs_rehash(stored: str) -> bool:
    return not (stored and stored.startswith("pbkdf2_sha256$"))


def create_admin_token(admin_id: int) -> str:
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{admin_id}:{expires_at}"
    sig = hmac.new(ADMIN_SECRET_KEY, payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_admin_token(token: str) -> Optional[int]:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        admin_id_str, expires_at_str, sig = raw.split(":")
        payload = f"{admin_id_str}:{expires_at_str}"
        expected_sig = hmac.new(ADMIN_SECRET_KEY, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, sig):
            return None
        if int(expires_at_str) < int(time.time()):
            return None
        return int(admin_id_str)
    except Exception:
        return None


# 인메모리 PIN 브루트포스 시도 제한 (IP당 5분 내 5회).
# 다중 워커/재시작 시 리셋되는 한계는 있지만 단일 프로세스 배포 기준으로는 충분한 억제 효과.
_pin_attempts: dict[str, list[float]] = {}
_PIN_ATTEMPT_WINDOW_SECONDS = 300
_PIN_ATTEMPT_MAX = 5


def register_pin_attempt(client_ip: str) -> bool:
    """True면 이번 시도 허용, False면 시도 횟수 초과로 차단."""
    now = time.time()
    attempts = [t for t in _pin_attempts.get(client_ip, []) if now - t < _PIN_ATTEMPT_WINDOW_SECONDS]
    if len(attempts) >= _PIN_ATTEMPT_MAX:
        _pin_attempts[client_ip] = attempts
        return False
    attempts.append(now)
    _pin_attempts[client_ip] = attempts
    return True


def clear_pin_attempts(client_ip: str):
    _pin_attempts.pop(client_ip, None)


# NH농협 웹훅 서명 검증용 시크릿. 설정 안 하면 웹훅 서명 검증을 건너뛴다(개발 편의) - 운영에서는
# 반드시 설정해서 위조 웹훅 호출을 막아야 한다.
NH_WEBHOOK_SECRET = os.getenv("NH_WEBHOOK_SECRET")


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    if not NH_WEBHOOK_SECRET:
        return True  # 시크릿 미설정 시 검증 생략 (개발/데모 환경 호환)
    if not signature:
        return False
    expected = hmac.new(NH_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
