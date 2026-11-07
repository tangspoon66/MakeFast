"""Persistent runtime service configuration.

Production containers should not rewrite the deployment `.env` file. This
module stores admin-managed AI/ASR/OSS settings in APP_DATA_PATH, which is a
Docker volume in production, and mirrors the active values into os.environ for
existing services that still read environment variables.
"""

import json
import os
from pathlib import Path
from typing import Any, Optional


SENSITIVE_FIELDS = {
    ("ai", "api_key"),
    ("asr", "secret_id"),
    ("asr", "secret_key"),
    ("oss", "access_key_id"),
    ("oss", "secret_access_key"),
    ("email", "password"),
}


def _data_path() -> Path:
    root = Path(os.getenv("APP_DATA_PATH") or "./data")
    root.mkdir(parents=True, exist_ok=True)
    return root / "service_config.json"


def _env_config() -> dict[str, Any]:
    return {
        "ai": {
            "api_key": os.getenv("OPENAI_API_KEY") or os.getenv("AI_API_KEY", ""),
            "api_base": os.getenv("OPENAI_API_BASE") or os.getenv("AI_API_BASE", "https://api.openai.com/v1"),
            "model": os.getenv("AI_MODEL", "gpt-4"),
            "temperature": float(os.getenv("AI_TEMPERATURE", "0.7")),
            "max_tokens": int(os.getenv("AI_MAX_TOKENS", "2000")),
        },
        "asr": {
            "enabled": os.getenv("TENCENT_ASR_ENABLED", "false").lower() == "true",
            "provider": "tencent",
            "secret_id": os.getenv("TENCENT_ASR_SECRET_ID", ""),
            "secret_key": os.getenv("TENCENT_ASR_SECRET_KEY", ""),
            "app_id": os.getenv("TENCENT_ASR_APP_ID", ""),
            "region": os.getenv("TENCENT_ASR_REGION", "ap-guangzhou"),
            "engine_model_type": os.getenv("TENCENT_ASR_ENGINE_MODEL_TYPE", "16k_zh"),
        },
        "oss": {
            "enabled": os.getenv("OBJECT_STORAGE_ENABLED", "false").lower() == "true",
            "bucket": os.getenv("OBJECT_STORAGE_BUCKET", ""),
            "endpoint": os.getenv("OBJECT_STORAGE_ENDPOINT", ""),
            "region": os.getenv("OBJECT_STORAGE_REGION", "auto"),
            "access_key_id": os.getenv("OBJECT_STORAGE_ACCESS_KEY_ID", ""),
            "secret_access_key": os.getenv("OBJECT_STORAGE_SECRET_ACCESS_KEY", ""),
            "public_base_url": os.getenv("OBJECT_STORAGE_PUBLIC_BASE_URL", ""),
            "prefix": os.getenv("OBJECT_STORAGE_PREFIX", "makefast"),
        },
        "email": {
            "enabled": os.getenv("SMTP_ENABLED", "false").lower() == "true",
            "smtp_host": os.getenv("SMTP_HOST", ""),
            "smtp_port": int(os.getenv("SMTP_PORT", "465")),
            "username": os.getenv("SMTP_USERNAME", ""),
            "password": os.getenv("SMTP_PASSWORD", ""),
            "from_email": os.getenv("SMTP_FROM_EMAIL", ""),
            "from_name": os.getenv("SMTP_FROM_NAME", "MakeFast"),
            "use_ssl": os.getenv("SMTP_USE_SSL", "true").lower() == "true",
            "use_tls": os.getenv("SMTP_USE_TLS", "false").lower() == "true",
        },
    }


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = {section: dict(values) for section, values in base.items()}
    for section, values in (override or {}).items():
        if isinstance(values, dict):
            merged.setdefault(section, {})
            merged[section].update(values)
    return merged


def load_service_config() -> dict[str, Any]:
    config = _env_config()
    path = _data_path()
    if not path.exists():
        return config
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return config
    return _deep_merge(config, saved)


def save_service_config(payload: dict[str, Any]) -> dict[str, Any]:
    current = load_service_config()
    next_config = _deep_merge(current, payload or {})

    for section, field in SENSITIVE_FIELDS:
        incoming = (payload or {}).get(section, {}).get(field)
        if incoming == "":
            next_config[section][field] = current.get(section, {}).get(field, "")

    path = _data_path()
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(
        json.dumps(next_config, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    os.replace(temp_path, path)
    apply_service_config_to_env(next_config)
    return next_config


def apply_service_config_to_env(config: Optional[dict[str, Any]] = None) -> None:
    config = config or load_service_config()
    ai = config.get("ai", {})
    asr = config.get("asr", {})
    oss = config.get("oss", {})
    email = config.get("email", {})
    os.environ.update({
        "OPENAI_API_KEY": str(ai.get("api_key", "")),
        "OPENAI_API_BASE": str(ai.get("api_base", "")),
        "AI_MODEL": str(ai.get("model", "")),
        "AI_TEMPERATURE": str(ai.get("temperature", 0.7)),
        "AI_MAX_TOKENS": str(ai.get("max_tokens", 2000)),
        "TENCENT_ASR_ENABLED": "true" if asr.get("enabled") else "false",
        "TENCENT_ASR_SECRET_ID": str(asr.get("secret_id", "")),
        "TENCENT_ASR_SECRET_KEY": str(asr.get("secret_key", "")),
        "TENCENT_ASR_APP_ID": str(asr.get("app_id", "")),
        "TENCENT_ASR_REGION": str(asr.get("region", "ap-guangzhou")),
        "TENCENT_ASR_ENGINE_MODEL_TYPE": str(asr.get("engine_model_type", "16k_zh")),
        "OBJECT_STORAGE_ENABLED": "true" if oss.get("enabled") else "false",
        "OBJECT_STORAGE_BUCKET": str(oss.get("bucket", "")),
        "OBJECT_STORAGE_ENDPOINT": str(oss.get("endpoint", "")),
        "OBJECT_STORAGE_REGION": str(oss.get("region", "auto")),
        "OBJECT_STORAGE_ACCESS_KEY_ID": str(oss.get("access_key_id", "")),
        "OBJECT_STORAGE_SECRET_ACCESS_KEY": str(oss.get("secret_access_key", "")),
        "OBJECT_STORAGE_PUBLIC_BASE_URL": str(oss.get("public_base_url", "")),
        "OBJECT_STORAGE_PREFIX": str(oss.get("prefix", "makefast")),
        "SMTP_ENABLED": "true" if email.get("enabled") else "false",
        "SMTP_HOST": str(email.get("smtp_host", "")),
        "SMTP_PORT": str(email.get("smtp_port", 465)),
        "SMTP_USERNAME": str(email.get("username", "")),
        "SMTP_PASSWORD": str(email.get("password", "")),
        "SMTP_FROM_EMAIL": str(email.get("from_email", "")),
        "SMTP_FROM_NAME": str(email.get("from_name", "MakeFast")),
        "SMTP_USE_SSL": "true" if email.get("use_ssl", True) else "false",
        "SMTP_USE_TLS": "true" if email.get("use_tls") else "false",
    })


def mask_secret(value: str, head: int = 8, tail: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= head + tail + 3:
        return value[:4] + "..." if len(value) > 4 else "***"
    return value[:head] + "..." + value[-tail:]
