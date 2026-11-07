from pathlib import Path

from fastapi.testclient import TestClient

import app.learner_auth_routes as auth_routes
import app.learning_project_routes as project_routes
from app.learner_identity import LearnerIdentityStore
from app.learning_project_store import LearnerProjectStore
from app.main import app


def _register(client: TestClient, username: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()["csrf_token"]


def test_projects_are_private_and_saves_use_revision(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    monkeypatch.setattr(auth_routes, "identity_store", LearnerIdentityStore(database))
    monkeypatch.setattr(project_routes, "project_store", LearnerProjectStore(database))

    first = TestClient(app)
    first_csrf = _register(first, "maker_one")
    created = first.post(
        "/api/learning/projects",
        json={"title": "温湿度提醒器", "course_slug": "temperature-alert"},
        headers={"X-CSRF-Token": first_csrf},
    )
    assert created.status_code == 201
    project = created.json()
    assert project["revision"] == 1

    save_payload = {
        "revision": 1,
        "title": "我的温湿度提醒器",
        "learning_mode": "guided",
        "editor_source": "blocks",
        "board_id": "xiao-esp32-s3",
        "project_state": {"files": [{"name": "main.ino", "content": "void setup() {}"}]},
        "current_step_id": "connect-sensor",
        "completed_step_ids": ["prepare"],
    }
    saved = first.put(
        f"/api/learning/projects/{project['project_id']}",
        json=save_payload,
        headers={"X-CSRF-Token": first_csrf},
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == 2

    stale = first.put(
        f"/api/learning/projects/{project['project_id']}",
        json=save_payload,
        headers={"X-CSRF-Token": first_csrf},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["current_revision"] == 2

    dashboard = first.get("/api/users/me/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["continue_project"]["current_step_id"] == "connect-sensor"
    assert dashboard.json()["recent_projects"][0]["title"] == "我的温湿度提醒器"

    second = TestClient(app)
    _register(second, "maker_two")
    assert second.get("/api/learning/projects").json()["items"] == []
    assert second.get(f"/api/learning/projects/{project['project_id']}").status_code == 404


def test_dashboard_continues_starter_course_even_before_first_step(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    monkeypatch.setattr(auth_routes, "identity_store", LearnerIdentityStore(database))
    monkeypatch.setattr(project_routes, "project_store", LearnerProjectStore(database))
    client = TestClient(app)
    csrf = _register(client, "maker_starter")

    course = client.post(
        "/api/learning/projects",
        json={"title": "温湿度提醒器", "course_slug": "temperature-alert"},
        headers={"X-CSRF-Token": csrf},
    ).json()
    client.post(
        "/api/learning/projects",
        json={"title": "其他想法"},
        headers={"X-CSRF-Token": csrf},
    )

    dashboard = client.get("/api/users/me/dashboard").json()
    assert dashboard["continue_project"]["project_id"] == course["project_id"]
    assert dashboard["continue_project"]["current_step_id"] is None


def test_project_writes_require_login_and_csrf(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    monkeypatch.setattr(auth_routes, "identity_store", LearnerIdentityStore(database))
    monkeypatch.setattr(project_routes, "project_store", LearnerProjectStore(database))
    client = TestClient(app)

    assert client.get("/api/users/me/dashboard").status_code == 401
    assert client.post("/api/learning/projects", json={"title": "No session"}).status_code == 401

    _register(client, "maker_three")
    no_csrf = client.post("/api/learning/projects", json={"title": "No CSRF"})
    assert no_csrf.status_code == 403


def test_guest_cannot_compile_use_ai_or_download_firmware():
    client = TestClient(app)
    assert client.post(
        "/api/compile",
        json={"code": "void setup() {} void loop() {}", "board_id": "esp32dev"},
    ).status_code == 401
    assert client.post(
        "/api/ai/generate",
        json={"messages": [{"role": "user", "content": "help"}]},
    ).status_code == 401
    assert client.get("/api/firmware/example/download").status_code == 401
    assert client.get("/api/firmware/example/files/app.bin").status_code == 401
    assert client.get("/api/firmware/example/app.bin").status_code == 401
