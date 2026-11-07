"""Runtime state helpers with optional Redis backing."""

import os
import time
from typing import Optional

try:
    import redis
except Exception:  # pragma: no cover - redis is optional at runtime
    redis = None


class RateLimiter:
    """Small fixed-window rate limiter.

    Uses Redis when REDIS_URL is configured, otherwise falls back to in-memory
    state for local development and tests.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL")
        self._memory: dict[str, list[float]] = {}
        self._redis = None
        if self.redis_url and redis:
            try:
                self._redis = redis.Redis.from_url(self.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    @property
    def using_redis(self) -> bool:
        return self._redis is not None

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        if self._redis:
            bucket = f"rate:{key}:{int(now // window_seconds)}"
            count = self._redis.incr(bucket)
            if count == 1:
                self._redis.expire(bucket, window_seconds + 5)
            return int(count) <= limit

        cutoff = now - window_seconds
        hits = [ts for ts in self._memory.get(key, []) if ts >= cutoff]
        if len(hits) >= limit:
            self._memory[key] = hits
            return False
        hits.append(now)
        self._memory[key] = hits
        return True


class CompileRuntimeState:
    """Cancellation state shared by compile workers.

    In single-process mode the in-memory event remains the fastest path. Redis
    makes the cancellation marker visible to future multi-worker deployments.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL")
        self._redis = None
        if self.redis_url and redis:
            try:
                self._redis = redis.Redis.from_url(self.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def mark_cancelled(self, job_id: str, ttl_seconds: int = 3600) -> None:
        if self._redis:
            self._redis.setex(f"compile:cancel:{job_id}", ttl_seconds, "1")

    def is_cancelled(self, job_id: str) -> bool:
        if not self._redis:
            return False
        return self._redis.exists(f"compile:cancel:{job_id}") == 1


rate_limiter = RateLimiter()
compile_runtime_state = CompileRuntimeState()
