import importlib
import os


def test_service_config_save_preserves_blank_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_PATH", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-existing")
    monkeypatch.setenv("OPENAI_API_BASE", "https://api.example.com/v1")
    monkeypatch.setenv("AI_MODEL", "old-model")
    monkeypatch.setenv("TENCENT_ASR_SECRET_ID", "old-secret-id")
    monkeypatch.setenv("TENCENT_ASR_SECRET_KEY", "old-secret-key")

    from app import service_config

    importlib.reload(service_config)
    saved = service_config.save_service_config({
        "ai": {
            "api_key": "",
            "api_base": "https://api.deepseek.com/v1",
            "model": "deepseek-chat",
            "temperature": 0.5,
            "max_tokens": 1234,
        },
        "asr": {
            "enabled": True,
            "secret_id": "",
            "secret_key": "",
            "app_id": "125",
            "region": "ap-guangzhou",
            "engine_model_type": "16k_zh",
        },
        "oss": {"enabled": False},
    })

    assert saved["ai"]["api_key"] == "sk-existing"
    assert saved["asr"]["secret_id"] == "old-secret-id"
    assert saved["asr"]["secret_key"] == "old-secret-key"
    assert os.getenv("OPENAI_API_KEY") == "sk-existing"
    assert os.getenv("AI_MODEL") == "deepseek-chat"


def test_ai_service_reads_persistent_config(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_PATH", str(tmp_path))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from app import service_config

    importlib.reload(service_config)
    service_config.save_service_config({
        "ai": {
            "api_key": "sk-runtime",
            "api_base": "https://api.deepseek.com/v1",
            "model": "deepseek-chat",
            "temperature": 0.7,
            "max_tokens": 2000,
        }
    })

    from app.ai_service import AIService

    service = AIService()
    assert service.api_key == "sk-runtime"
    assert service.api_base == "https://api.deepseek.com/v1"
    assert service.model == "deepseek-chat"
