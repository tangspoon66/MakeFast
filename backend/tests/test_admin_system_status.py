from app.backup_service import BackupService
from app.system_status import collect_system_status


def test_admin_system_status_reports_deployment_config(tmp_path, monkeypatch):
    db_path = tmp_path / "ops.sqlite3"
    db_path.write_bytes(b"sqlite-data")
    backup_dir = tmp_path / "backups"

    import app.backup_service as backup_module

    monkeypatch.setattr(
        backup_module,
        "backup_service",
        BackupService(data_dir=str(tmp_path), backup_dir=str(backup_dir), db_path=str(db_path)),
    )
    monkeypatch.setenv("APP_DATA_PATH", str(tmp_path))  # 不读本机 data/service_config.json
    monkeypatch.setenv("OPS_DB_PATH", str(db_path))
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://makefast.cn,http://localhost:5173")
    monkeypatch.setenv("COMPILE_CONCURRENCY", "1")
    monkeypatch.setenv("COMPILE_QUEUE_TIMEOUT_SECONDS", "2")
    monkeypatch.setenv("OBJECT_STORAGE_ENABLED", "true")
    monkeypatch.setenv("OBJECT_STORAGE_BUCKET", "makefast-assets")
    monkeypatch.setenv("OBJECT_STORAGE_ENDPOINT_URL", "https://cos.example.com")
    monkeypatch.setenv("OBJECT_STORAGE_PUBLIC_BASE_URL", "https://cdn.example.com")
    monkeypatch.setenv("OBJECT_STORAGE_ACCESS_KEY_ID", "access-key")
    monkeypatch.setenv("OBJECT_STORAGE_SECRET_ACCESS_KEY", "secret-key")
    monkeypatch.setenv("AI_MODEL", "test-model")
    monkeypatch.delenv("ALLOW_RUNTIME_ENV_WRITE", raising=False)

    data = collect_system_status()

    assert data["environment"] == "production"
    assert data["domain"] == "makefast.cn"
    assert data["cookie_secure"] is True
    assert data["allowed_origins"] == ["https://makefast.cn", "http://localhost:5173"]
    assert data["compile"]["concurrency"] == 1
    assert data["sqlite"]["exists"] is True
    assert data["object_storage"]["enabled"] is True
    assert data["object_storage"]["bucket"] == "makefast-assets"
    assert data["object_storage"]["access_key_configured"] is True
    assert data["object_storage"]["secret_key_configured"] is True
    assert data["ai_config"]["runtime_write_allowed"] is False
    assert data["ai_config"]["model"] == "test-model"
