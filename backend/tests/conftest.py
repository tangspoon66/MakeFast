import os
import sys

# 测试不读取 backend/.env（保持可重复，避免本机配置/密钥影响结果）
os.environ.setdefault("MAKEFAST_SKIP_DOTENV", "1")
import tempfile as _tempfile
_TEST_TMP = _tempfile.mkdtemp(prefix="makefast-tests-")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-jwt-secret-not-for-production-0123456789")
os.environ.setdefault("FIRMWARE_STORAGE_PATH", os.path.join(_TEST_TMP, "firmware"))
os.environ.setdefault("APP_DATA_PATH", _TEST_TMP)
os.environ.setdefault("TEMPLATE_STORAGE_PATH", os.path.join(_TEST_TMP, "templates"))
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


_SHARED_STORE = None
_CLIENT_SEQ = 0


def make_learner_client(db_dir=None):
    """返回已登录（带会话 cookie + CSRF 头）的 TestClient；学习者库放在临时目录。

    /api/compile、固件下载等私有接口需要学习者会话，测试用它代替匿名 client。
    """
    from fastapi.testclient import TestClient

    import app.learner_auth_routes as learner_routes
    from app.learner_identity import LearnerIdentityStore
    from app.main import app

    global _SHARED_STORE, _CLIENT_SEQ
    if db_dir is not None:
        learner_routes.identity_store = LearnerIdentityStore(Path(db_dir) / "learning.sqlite3")
    else:
        if _SHARED_STORE is None:
            _SHARED_STORE = LearnerIdentityStore(Path(_TEST_TMP) / "learning.sqlite3")
        learner_routes.identity_store = _SHARED_STORE
    _CLIENT_SEQ += 1
    client = TestClient(app)
    resp = client.post(
        "/api/auth/register",
        json={"username": f"tester{_CLIENT_SEQ}", "password": "password123", "display_name": "测试", "experience_markers": ["none"]},
    )
    assert resp.status_code == 201, resp.text
    client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
    return client
