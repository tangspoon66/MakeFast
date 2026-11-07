import json
from pathlib import Path

from fastapi.testclient import TestClient

import app.learner_auth_routes as auth_routes
import app.learning_agent_routes as agent_routes
import app.learning_agent_store as agent_store_module
import app.learning_project_routes as project_routes
from app.learner_identity import LearnerIdentityStore
from app.learning_agent_store import LearningAgentStore
from app.learning_project_store import LearnerProjectStore
from app.main import app


def test_agent_conversations_are_project_bound_and_persistent(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    identity = LearnerIdentityStore(database)
    project_store = LearnerProjectStore(database)
    agent_store = LearningAgentStore(database)
    monkeypatch.setattr(auth_routes, "identity_store", identity)
    monkeypatch.setattr(project_routes, "project_store", project_store)
    monkeypatch.setattr(agent_routes, "project_store", project_store)
    monkeypatch.setattr(agent_routes, "agent_store", agent_store)
    monkeypatch.setattr(agent_routes.course_store, "get_published", lambda slug, version: {
        "slug": slug, "version": version, "content": course,
    })

    connection = database and __import__("sqlite3").connect(database)
    connection.execute("""CREATE TABLE learning_courses (
        slug TEXT PRIMARY KEY, draft_json TEXT NOT NULL, draft_revision INTEGER NOT NULL DEFAULT 1,
        published_version INTEGER, published_draft_revision INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )""")
    connection.execute("""CREATE TABLE learning_course_versions (
        slug TEXT NOT NULL, version INTEGER NOT NULL, content_json TEXT NOT NULL, published_at TEXT NOT NULL,
        PRIMARY KEY(slug, version)
    )""")
    course = {"slug": "temperature-alert", "title": "温湿度提醒器", "steps": [{"id": "materials", "title": "准备材料", "body": "找齐桌面材料"}]}
    connection.execute("INSERT INTO learning_courses VALUES (?, ?, 1, 1, 1, 'now', 'now')", (course["slug"], json.dumps(course)))
    connection.execute("INSERT INTO learning_course_versions VALUES (?, 1, ?, 'now')", (course["slug"], json.dumps(course)))
    connection.commit()
    connection.close()

    client = TestClient(app)
    session = client.post("/api/auth/register", json={"username": "agent_user", "password": "password123"})
    csrf = session.json()["csrf_token"]
    headers = {"X-CSRF-Token": csrf}
    project = client.post("/api/learning/projects", json={"title": "我的作品", "course_slug": course["slug"]}, headers=headers).json()
    created = client.post(f"/api/learning/projects/{project['project_id']}/agent/conversations", json={"title": "第一次问"}, headers=headers)
    assert created.status_code == 201
    conversation_id = created.json()["conversation_id"]

    async def fake_ai(messages):
        assert "找齐桌面材料" in str(messages)
        assert "void setup" not in str(messages)
        return {"message": "先找到开发板和传感器，找齐后告诉我。"}

    monkeypatch.setattr(agent_routes.get_ai_service(), "_call_ai_api", fake_ai)
    asked = client.post(
        f"/api/learning/projects/{project['project_id']}/agent/conversations/{conversation_id}/ask",
        json={"question": "我现在先做什么？", "current_step_id": "materials"}, headers=headers,
    )
    assert asked.status_code == 200
    assert len(asked.json()["conversation"]["messages"]) == 2

    restored = client.get(f"/api/learning/projects/{project['project_id']}/agent/conversations/{conversation_id}")
    assert restored.json()["messages"][0]["content"] == "我现在先做什么？"
    other_project = client.post("/api/learning/projects", json={"title": "另一个项目"}, headers=headers).json()
    assert client.get(f"/api/learning/projects/{other_project['project_id']}/agent/conversations/{conversation_id}").status_code == 404
    assert client.delete(f"/api/learning/projects/{project['project_id']}/agent/conversations/{conversation_id}", headers=headers).status_code == 204
    assert client.get(f"/api/learning/projects/{project['project_id']}/agent/conversations/{conversation_id}").status_code == 404


def test_agent_proposal_requires_explicit_apply_and_supports_undo(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    identity = LearnerIdentityStore(database)
    project_store = LearnerProjectStore(database)
    agent_store = LearningAgentStore(database)
    monkeypatch.setattr(auth_routes, "identity_store", identity)
    monkeypatch.setattr(project_routes, "project_store", project_store)
    monkeypatch.setattr(agent_routes, "project_store", project_store)
    monkeypatch.setattr(agent_routes, "agent_store", agent_store)
    course = {"slug": "temperature-alert", "title": "温湿度提醒器", "steps": [{"id": "code", "title": "代码编程", "body": "修改提醒阈值"}]}
    monkeypatch.setattr(agent_routes.course_store, "get_published", lambda slug, version: {"slug": slug, "version": version, "content": course})
    connection = __import__("sqlite3").connect(database)
    connection.execute("""CREATE TABLE learning_courses (slug TEXT PRIMARY KEY, draft_json TEXT NOT NULL, draft_revision INTEGER NOT NULL DEFAULT 1, published_version INTEGER, published_draft_revision INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")
    connection.execute("""CREATE TABLE learning_course_versions (slug TEXT NOT NULL, version INTEGER NOT NULL, content_json TEXT NOT NULL, published_at TEXT NOT NULL, PRIMARY KEY(slug, version))""")
    connection.execute("INSERT INTO learning_courses VALUES (?, ?, 1, 1, 1, 'now', 'now')", (course["slug"], json.dumps(course)))
    connection.execute("INSERT INTO learning_course_versions VALUES (?, 1, ?, 'now')", (course["slug"], json.dumps(course)))
    connection.commit(); connection.close()

    client = TestClient(app)
    session = client.post("/api/auth/register", json={"username": "proposal_user", "password": "password123"})
    headers = {"X-CSRF-Token": session.json()["csrf_token"]}
    project = client.post("/api/learning/projects", json={"title": "我的提醒器", "course_slug": course["slug"]}, headers=headers).json()
    saved = client.put(f"/api/learning/projects/{project['project_id']}", json={
        "revision": project["revision"], "title": project["title"], "learning_mode": "guided", "editor_source": "code",
        "board_id": "esp32s3", "project_state": {"code": "void setup() {}\nvoid loop() {}"}, "current_step_id": "code", "completed_step_ids": [],
    }, headers=headers).json()

    async def fake_ai(messages):
        assert "完整代码" in str(messages)
        return {"message": json.dumps({"summary": "把等待时间改短", "code": "void setup() {}\nvoid loop() { delay(500); }", "dependencies": [], "hardware_assumptions": ["仍使用课程已核验的引脚"]})}
    monkeypatch.setattr(agent_routes.get_ai_service(), "_call_ai_api", fake_ai)
    proposal_response = client.post(f"/api/learning/projects/{project['project_id']}/agent/proposals", json={"question": "让提醒更快一点", "current_step_id": "code"}, headers=headers)
    assert proposal_response.status_code == 201
    proposal = proposal_response.json()["proposal"]
    assert proposal["status"] == "preview"
    assert client.get(f"/api/learning/projects/{project['project_id']}/agent/proposals/{proposal['proposal_id']}").json()["status"] == "preview"

    applied = client.post(f"/api/learning/projects/{project['project_id']}/agent/proposals/{proposal['proposal_id']}/apply", headers=headers)
    assert applied.status_code == 200
    assert applied.json()["project"]["project_state"]["code"].endswith("delay(500); }")
    undone = client.post(f"/api/learning/projects/{project['project_id']}/agent/proposals/{proposal['proposal_id']}/undo", headers=headers)
    assert undone.status_code == 200
    assert undone.json()["project"]["project_state"]["code"] == "void setup() {}\nvoid loop() {}"
    assert client.post(f"/api/learning/projects/{project['project_id']}/agent/proposals/{proposal['proposal_id']}/undo", headers=headers).status_code == 409
