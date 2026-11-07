"""Security-related runtime configuration helpers."""

import os


def cookie_secure_enabled() -> bool:
    """Return whether admin cookies should use the Secure flag."""
    value = os.getenv("COOKIE_SECURE")
    if value is not None:
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return os.getenv("ENV", "").strip().lower() == "production"
