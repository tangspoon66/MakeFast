"""行为测试：个人版学习者注册、登录和会话。"""

from pathlib import Path

from fastapi.testclient import TestClient

import app.learner_auth_routes as learner_routes
from app.learner_identity import LearnerIdentityStore
from app.main import app


def test_registration_restores_session_and_logout_requires_fresh_csrf(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(
        learner_routes,
        "identity_store",
        LearnerIdentityStore(tmp_path / "learning.sqlite3"),
    )

    client = TestClient(app)
    registration = client.post(
        "/api/auth/register",
        json={
            "username": "xiaoming",
            "password": "password123",
            "display_name": "小明",
            "experience_markers": ["none"],
        },
    )

    assert registration.status_code == 201
    body = registration.json()
    assert body["learner"]["username"] == "xiaoming"
    assert body["csrf_token"]
    assert "makefast_session" in client.cookies

    current = client.get("/api/auth/me")
    assert current.status_code == 200
    current_body = current.json()
    assert current_body["learner"]["display_name"] == "小明"

    # /me rotates the CSRF token, so an older browser value must no longer work.
    stale_logout = client.delete(
        "/api/auth/session",
        headers={"X-CSRF-Token": body["csrf_token"]},
    )
    assert stale_logout.status_code == 403

    logout = client.delete(
        "/api/auth/session",
        headers={"X-CSRF-Token": current_body["csrf_token"]},
    )
    assert logout.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_login_rejects_bad_credentials_and_duplicate_username(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(
        learner_routes,
        "identity_store",
        LearnerIdentityStore(tmp_path / "learning.sqlite3"),
    )

    client = TestClient(app)
    payload = {"username": "maker_one", "password": "password123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    duplicate = client.post("/api/auth/register", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["code"] == "username_unavailable"

    client.delete("/api/auth/session", headers={"X-CSRF-Token": client.get("/api/auth/me").json()["csrf_token"]})
    invalid = client.post(
        "/api/auth/session",
        json={"username": "maker_one", "password": "wrong-password"},
    )
    assert invalid.status_code == 401
    assert invalid.json()["detail"]["code"] == "invalid_credentials"

    valid = client.post("/api/auth/session", json=payload)
    assert valid.status_code == 200
    assert valid.json()["learner"]["username"] == "maker_one"


def test_registration_validates_experience_markers(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(
        learner_routes,
        "identity_store",
        LearnerIdentityStore(tmp_path / "learning.sqlite3"),
    )

    response = TestClient(app).post(
        "/api/auth/register",
        json={
            "username": "maker_two",
            "password": "password123",
            "experience_markers": ["none", "connected_component"],
        },
    )
    assert response.status_code == 422
