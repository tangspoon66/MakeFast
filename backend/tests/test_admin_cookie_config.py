from app.security_config import cookie_secure_enabled


def test_cookie_secure_parses_false_string(monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("ENV", "production")

    assert cookie_secure_enabled() is False


def test_cookie_secure_defaults_to_production_env(monkeypatch):
    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    monkeypatch.setenv("ENV", "production")

    assert cookie_secure_enabled() is True
