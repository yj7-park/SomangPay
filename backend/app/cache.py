"""아주 단순한 스레드-세이프 인프로세스 TTL 캐시.

/api/admin/stats/summary, /api/users/me/stats/summary처럼 "몇 초 정도는 낡아도 되는"
집계 응답을 위한 것 - Redis 등 외부 캐시 인프라 없이, 워커 프로세스 하나 안에서만
유효하면 충분하다는 전제(#부하테스트, 2026-09-01/02). uvicorn --workers로 프로세스가
여러 개면 캐시도 프로세스마다 따로 생기므로 bust()는 "그 워커가 처리한 요청" 안에서만
확실히 즉시 반영되고, 다른 워커는 최대 ttl초 뒤에 갱신된다 - 통계 요약처럼 초 단위
지연이 무해한 화면에만 붙일 것.
"""
import threading
import time
from typing import Any, Optional


class TTLCache:
    def __init__(self, ttl: float):
        self.ttl = ttl
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at < time.monotonic():
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (value, time.monotonic() + self.ttl)

    def bust(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._store.pop(key, None)


# 관리자/유저 통계 요약 전용 - TTL 20초 (대시보드 숫자가 20초 늦게 갱신되는 건 무해하지만,
# 결제/충전 직후엔 bust()로 즉시 무효화해 체감 지연을 없앤다)
stats_cache = TTLCache(ttl=20)
