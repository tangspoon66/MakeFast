def test_compile_defaults_are_low_resource(monkeypatch):
    monkeypatch.delenv("COMPILE_CONCURRENCY", raising=False)
    monkeypatch.delenv("COMPILE_QUEUE_TIMEOUT_SECONDS", raising=False)

    from app.compile_config import get_compile_concurrency, get_compile_queue_timeout

    assert get_compile_concurrency() == 1
    assert get_compile_queue_timeout() == 2


def test_compile_config_can_be_overridden(monkeypatch):
    monkeypatch.setenv("COMPILE_CONCURRENCY", "2")
    monkeypatch.setenv("COMPILE_QUEUE_TIMEOUT_SECONDS", "4.5")

    from app.compile_config import get_compile_concurrency, get_compile_queue_timeout

    assert get_compile_concurrency() == 2
    assert get_compile_queue_timeout() == 4.5
