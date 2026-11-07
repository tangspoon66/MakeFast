"""Deployment and runtime status helpers for the admin console."""

import os
from pathlib import Path

from .backup_service import backup_service
from .object_storage import ObjectStorageConfig
from .ops_metrics import ops_metrics
from .runtime_state import rate_limiter
from .service_config import load_service_config


def collect_system_status() -> dict:
    service_config = load_service_config()
    object_config = ObjectStorageConfig.from_env()
    backups = backup_service.list_backups()
    ops_db_path = Path(os.getenv("OPS_DB_PATH") or ops_metrics.data_dir / "ops.sqlite3")

    return {
        "environment": os.getenv("ENV", "development"),
        "domain": "makefast.cn",
        "allowed_origins": [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()],
        "cookie_secure": os.getenv("COOKIE_SECURE", "").lower() == "true",
        "redis": {
            "configured": bool(os.getenv("REDIS_URL")),
            "connected": rate_limiter.using_redis,
        },
        "compile": {
            "concurrency": int(os.getenv("COMPILE_CONCURRENCY", "1")),
            "queue_timeout_seconds": float(os.getenv("COMPILE_QUEUE_TIMEOUT_SECONDS", "2")),
        },
        "sqlite": {
            "path": str(ops_db_path),
            "exists": ops_db_path.exists(),
            "size_mb": round(ops_db_path.stat().st_size / (1024 * 1024), 2) if ops_db_path.exists() else 0,
            "backup_count": len(backups),
            "latest_backup": backups[0] if backups else None,
        },
        "object_storage": {
            "enabled": object_config.enabled,
            "bucket": object_config.bucket,
            "endpoint": object_config.endpoint_url,
            "region": object_config.region,
            "public_base_url": object_config.public_base_url,
            "prefix": object_config.prefix,
            "access_key_configured": bool(object_config.access_key_id),
            "secret_key_configured": bool(object_config.secret_access_key),
        },
        "ai_config": {
            "runtime_write_allowed": not (
                os.getenv("ENV", "").lower() == "production"
                and os.getenv("ALLOW_RUNTIME_ENV_WRITE", "false").lower() != "true"
            ),
            "api_key_configured": bool(service_config.get("ai", {}).get("api_key")),
            "model": service_config.get("ai", {}).get("model", ""),
        },
    }
