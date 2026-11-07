import io
import zipfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.template_manager import TemplateManager
from app.template_models import TemplateCreateRequest, TemplateSourceFile
import app.learner_auth_routes as learner_routes
from app.learner_identity import LearnerIdentityStore
from app.learner_auth_routes import router as learner_auth_router
from app.template_routes import router


def _zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.txt", "locked package")
    return buf.getvalue()


def _create_locked_template(manager: TemplateManager) -> str:
    meta = manager.create_template(
        TemplateCreateRequest(
            name="Locked Course Demo",
            description="A published course with locked source and package",
            category="IoT",
            tags=["lock"],
            supported_board_ids=["esp32"],
            published=True,
            files=[
                TemplateSourceFile(
                    name="sketch.ino",
                    content="void setup() {}\nvoid loop() {}",
                )
            ],
            packages=["document"],
            locked_resources=["source_code", "document"],
            unlock_code="secret123",
        )
    )
    assert manager.upload_package(meta.template_id, "document", _zip_bytes()) is True
    return meta.template_id


def _register(client: TestClient, username: str = "maker_user") -> str:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()["csrf_token"]


def test_locked_source_is_not_exposed_to_guests_and_unlock_requires_login(tmp_path, monkeypatch):
    monkeypatch.setattr(learner_routes, "identity_store", LearnerIdentityStore(tmp_path / "users.sqlite3"))
    manager = TemplateManager(storage_path=str(tmp_path))
    template_id = _create_locked_template(manager)
    monkeypatch.setattr("app.template_routes.template_manager", manager)

    app = FastAPI()
    app.include_router(learner_auth_router)
    app.include_router(router)
    client = TestClient(app)

    public_detail = client.get(f"/api/templates/{template_id}")
    assert public_detail.status_code == 200
    assert public_detail.json()["files"] == []

    wrong_unlock = client.post(
        f"/api/templates/{template_id}/unlock-detail",
        json={"code": "wrong"},
    )
    assert wrong_unlock.status_code == 401

    csrf_token = _register(client)
    wrong_unlock = client.post(
        f"/api/templates/{template_id}/unlock-detail",
        json={"code": "wrong"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert wrong_unlock.status_code == 403

    unlocked = client.post(
        f"/api/templates/{template_id}/unlock-detail",
        json={"code": "secret123"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert unlocked.status_code == 200
    assert unlocked.json()["files"][0]["name"] == "sketch.ino"


def test_locked_downloads_require_login_and_unlock_code(tmp_path, monkeypatch):
    monkeypatch.setattr(learner_routes, "identity_store", LearnerIdentityStore(tmp_path / "users.sqlite3"))
    manager = TemplateManager(storage_path=str(tmp_path))
    template_id = _create_locked_template(manager)
    monkeypatch.setattr("app.template_routes.template_manager", manager)

    app = FastAPI()
    app.include_router(learner_auth_router)
    app.include_router(router)
    client = TestClient(app)

    source_without_code = client.get(f"/api/templates/{template_id}/download-source")
    package_without_code = client.get(f"/api/templates/{template_id}/packages/document")
    assert source_without_code.status_code == 401
    assert package_without_code.status_code == 401

    _register(client)

    source_without_code = client.get(f"/api/templates/{template_id}/download-source")
    package_without_code = client.get(f"/api/templates/{template_id}/packages/document")
    assert source_without_code.status_code == 403
    assert package_without_code.status_code == 403

    source_with_code = client.get(
        f"/api/templates/{template_id}/download-source",
        params={"code": "secret123"},
    )
    package_with_code = client.get(
        f"/api/templates/{template_id}/packages/document",
        params={"code": "secret123"},
    )
    assert source_with_code.status_code == 200
    assert package_with_code.status_code == 200
