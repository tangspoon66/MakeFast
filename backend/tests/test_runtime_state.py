from app.runtime_state import RateLimiter


def test_memory_rate_limiter_allows_until_limit():
    limiter = RateLimiter(redis_url=None)

    assert limiter.using_redis is False
    assert limiter.allow("feedback:127.0.0.1", limit=2, window_seconds=60) is True
    assert limiter.allow("feedback:127.0.0.1", limit=2, window_seconds=60) is True
    assert limiter.allow("feedback:127.0.0.1", limit=2, window_seconds=60) is False


def test_memory_rate_limiter_is_key_scoped():
    limiter = RateLimiter(redis_url=None)

    assert limiter.allow("a", limit=1, window_seconds=60) is True
    assert limiter.allow("a", limit=1, window_seconds=60) is False
    assert limiter.allow("b", limit=1, window_seconds=60) is True
