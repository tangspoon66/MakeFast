"""Admin console API: role auth, courses, hardware validation, learners, agent ops, users, settings."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext

import app.admin_console.store as store_module
from app.admin_console.store import AdminConsoleStore, redact, validate_hardware
from app.learner_identity import LearnerIdentityStore
from app.learning_progress_store import LearningProgressStore
from app.main import app

REPO = Path(__file__).resolve().parents[2]
PWD = CryptContext(schemes=["bcrypt"], deprecated="auto")
PASSWORD = "SyntheticTestPassword1!"


@pytest.fixture()
def console(tmp_path, monkeypatch):
    db = tmp_path / "learning.sqlite3"
    s = AdminConsoleStore(path=db, seed_root=REPO)
    monkeypatch.setattr(store_module, "console_store", s)
    h = PWD.hash(PASSWORD)
    s.create_user("t-admin", h, "admin", "测试管理员")
    s.create_user("t-editor", h, "editor")
    s.create_user("t-viewer", h, "viewer")
    return s, db


def login(username):
    c = TestClient(app)
    r = c.post("/api/admin/login", json={"username": username, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c


def test_requires_login(console):
    r = TestClient(app).get("/api/admin/console/dashboard")
    assert r.status_code == 401


def test_me_returns_role(console):
    c = login("t-editor")
    r = c.get("/api/admin/console/me")
    assert r.status_code == 200
    assert r.json()["role"] == "editor"
    assert c.get("/api/admin/verify").json()["role"] == "editor"


def test_viewer_is_read_only_and_blocked_from_legacy_admin(console):
    c = login("t-viewer")
    assert c.get("/api/admin/console/courses").status_code == 200
    assert c.post("/api/admin/console/agent/faq", json={"question": "怎么接线？", "answer": "看连线图。"}).status_code == 403
    assert c.get("/api/admin/console/users").status_code == 403
    assert c.get("/api/admin/statistics").status_code == 403


def test_disabled_user_token_rejected(console):
    s, _ = console
    c = login("t-editor")
    s.update_user("t-editor", disabled=True)
    assert c.get("/api/admin/console/me").status_code == 401


def test_dashboard_empty_state(console):
    d = login("t-viewer").get("/api/admin/console/dashboard").json()
    assert d["learner_count"] == 0
    assert d["completion_rate"] is None and d["quiz_pass_rate"] is None


def _seed_learners(db):
    ids = LearnerIdentityStore(path=db)
    prog = LearningProgressStore(path=db)
    a, _, _ = ids.create_user("kid-a", "Kid-pass-123", "小A", [])
    b, _, _ = ids.create_user("kid-b", "Kid-pass-123", "小B", [])
    for ev in ("compile_succeeded", "flash_succeeded", "serial_verified", "quiz_passed", "course_completed"):
        prog.record(a["id"], ev, f"first:{ev}")
    prog.record(b["id"], "compile_succeeded", "first:compile_succeeded")
    prog.record(b["id"], "serial_verified", "first:serial_verified")
    return a, b


def test_dashboard_and_learners_from_real_data(console):
    s, db = console
    a, b = _seed_learners(db)
    s.record_agent_event("refusal", category="off_topic", question="我的电话 13800000001 帮我写作业")
    c = login("t-viewer")
    d = c.get("/api/admin/console/dashboard").json()
    assert d["learner_count"] == 2 and d["active_sessions"] == 2
    assert d["completion_rate"] == 0.5 and d["quiz_pass_rate"] == 0.5
    assert d["agent_refusals"] == 1
    items = c.get("/api/admin/console/learners").json()["items"]
    assert {i["username"] for i in items} == {"kid-a", "kid-b"}
    det = c.get(f"/api/admin/console/learners/{a['id']}").json()
    assert det["completed"] and len(det["quiz_history"]) == 1
    assert det["skills"]["原理理解"] == 1.0
    assert c.get("/api/admin/console/learners/nope").status_code == 404
    ref = c.get("/api/admin/console/agent/refusals").json()["items"][0]
    assert "13800000001" not in ref["question"] and "手机号已隐藏" in ref["question"]


def test_course_crud_publish_flow(console):
    c = login("t-editor")
    items = c.get("/api/admin/console/courses").json()["items"]
    assert any(i["slug"] == "first-lesson" and i["status"] == "published" for i in items)
    body = {"slug": "led-test", "title": "LED 测试", "level": "入门", "skills": ["电子与接线"], "prerequisites": ["first-lesson"]}
    r = c.post("/api/admin/console/courses", json=body)
    assert r.status_code == 201 and r.json()["status"] == "draft"
    assert c.post("/api/admin/console/courses", json=body).status_code == 409
    assert c.post("/api/admin/console/courses/led-test/publish").status_code == 422
    upd = dict(body, steps=[{"id": "s1", "title": "接 LED"}],
               quiz=[{"id": "q1", "prompt": "LED 长脚是？", "choices": ["正极", "负极"], "answer_index": 0}])
    r = c.put("/api/admin/console/courses/led-test", json={"revision": 1, "course": upd})
    assert r.status_code == 200 and r.json()["revision"] == 2
    assert c.put("/api/admin/console/courses/led-test", json={"revision": 1, "course": upd}).status_code == 409
    assert c.post("/api/admin/console/courses/led-test/publish").json()["status"] == "published"
    assert c.post("/api/admin/console/courses/led-test/unpublish").json()["status"] == "draft"
    # editors cannot delete; admins can delete drafts
    assert c.delete("/api/admin/console/courses/led-test").status_code == 403
    assert login("t-admin").delete("/api/admin/console/courses/led-test").status_code == 200


def test_course_validation(console):
    c = login("t-editor")
    bad = {"slug": "Bad Slug", "title": "x"}
    assert c.post("/api/admin/console/courses", json=bad).status_code == 422
    bad_quiz = {"slug": "q", "title": "x", "quiz": [{"id": "a", "prompt": "?", "choices": ["1", "2"], "answer_index": 5}]}
    assert c.post("/api/admin/console/courses", json=bad_quiz).status_code == 422
    assert c.post("/api/admin/console/courses", json={"slug": "p", "title": "x", "prerequisites": ["ghost"]}).status_code == 422


def test_hardware_seeded_and_validated(console):
    c = login("t-editor")
    items = c.get("/api/admin/console/hardware").json()["items"]
    board = next(i for i in items if i["kind"] == "board" and i["id"] == "xiao-esp32-s3")
    assert board["errors"] == [] and board["pin_count"] >= 10
    assert any(i["kind"] == "component" and i["id"] == "dht22" for i in items)
    data, pinmap = board["data"], board["pinmap"]
    broken = dict(pinmap, pins=pinmap["pins"] + [dict(pinmap["pins"][0])])
    r = c.put("/api/admin/console/hardware/board/xiao-esp32-s3", json={"data": data, "pinmap": broken})
    assert r.status_code == 422 and any("重复" in e for e in r.json()["detail"]["errors"])
    data2 = dict(data, nickname="XIAO S3")
    r = c.put("/api/admin/console/hardware/board/xiao-esp32-s3", json={"data": data2, "pinmap": pinmap})
    assert r.status_code == 200 and r.json()["data"]["nickname"] == "XIAO S3"
    v = c.post("/api/admin/console/hardware/component/validate", json={"data": {"id": "x"}}).json()
    assert not v["valid"]


def test_validate_hardware_unit():
    assert "缺少字段 name" in validate_hardware("component", {"id": "a"}, None)
    errs = validate_hardware("board", {"id": "b", "name": "B", "logicVoltage": 3.3, "toolchain": {"backendBoardId": "x"}},
                             {"boardId": "other", "pins": [{"id": "D0", "x": 1, "y": 2, "gpio": 1}, {"id": "D1", "x": 1, "y": 2, "gpio": 1}]})
    assert any("归属" in e for e in errs) and any("GPIO 重复" in e for e in errs)


def test_faq_crud_and_guard(console):
    c = login("t-editor")
    faqs = c.get("/api/admin/console/agent/faq").json()["items"]
    assert len(faqs) >= 4
    r = c.post("/api/admin/console/agent/faq", json={"question": "LED 不亮？", "answer": "检查正负极。", "tags": ["接线"]})
    fid = r.json()["id"]
    r = c.put(f"/api/admin/console/agent/faq/{fid}", json={"question": "LED 不亮？", "answer": "检查长脚接 D1。", "enabled": False})
    assert r.json()["enabled"] is False
    assert c.delete(f"/api/admin/console/agent/faq/{fid}").status_code == 200
    assert c.delete(f"/api/admin/console/agent/faq/{fid}").status_code == 404
    lists = c.get("/api/admin/console/agent/guard").json()["lists"]
    assert "蜂鸣器" in lists["course"]
    assert c.put("/api/admin/console/agent/guard/injection", json={"keywords": ["(bad"]}).status_code == 422
    r = c.put("/api/admin/console/agent/guard/off_topic", json={"keywords": ["游戏", " 游戏 ", "", "作业"]})
    assert r.json()["keywords"] == ["游戏", "作业"]
    t = c.post("/api/admin/console/agent/guard/test", json={"message": "帮我写作业"}).json()
    assert t["verdict"] == "off_topic" and not t["allowed"]
    t = c.post("/api/admin/console/agent/guard/test", json={"message": "蜂鸣器不响怎么办"}).json()
    assert t["allowed"]


def test_provider_status_never_leaks_key(console, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-very-secret-value")
    r = login("t-viewer").get("/api/admin/console/agent/providers")
    assert "sk-very-secret-value" not in r.text
    ds = next(i for i in r.json()["items"] if i["id"] == "deepseek")
    assert ds["key_configured"] is True


def test_conversation_logs_redacted(console):
    s, db = console
    a, _ = _seed_learners(db)
    import sqlite3
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE IF NOT EXISTS learner_agent_conversations (conversation_id TEXT PRIMARY KEY, owner_user_id TEXT, project_id TEXT, course_slug TEXT, course_version INTEGER, title TEXT, created_at TEXT, updated_at TEXT, archived_at TEXT)")
    con.execute("CREATE TABLE IF NOT EXISTS learner_agent_messages (message_id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, role TEXT, content TEXT, created_at TEXT)")
    con.execute("INSERT INTO learner_agent_conversations VALUES ('c1', ?, 'p', 'first-lesson', 1, '提问', 't', 't', NULL)", (a["id"],))
    con.execute("INSERT INTO learner_agent_messages(conversation_id, role, content, created_at) VALUES ('c1','user','我叫王小明，邮箱 a@example.com','t')")
    con.commit(); con.close()
    item = login("t-viewer").get("/api/admin/console/agent/conversations").json()["items"][0]
    text = item["messages"][0]["content"]
    assert "王小明" not in text and "a@example.com" not in text
    assert item["learner"].startswith("学习者#") and a["username"] not in item["learner"]


def test_users_roles_management(console):
    c = login("t-admin")
    r = c.post("/api/admin/console/users", json={"username": "new-ed", "password": "Newpass-123", "role": "editor"})
    assert r.status_code == 201
    assert "password_hash" not in r.text
    assert c.post("/api/admin/console/users", json={"username": "new-ed", "password": "Newpass-123"}).status_code == 409
    assert c.patch("/api/admin/console/users/new-ed", json={"role": "viewer"}).json()["role"] == "viewer"
    assert c.patch("/api/admin/console/users/t-admin", json={"disabled": True}).status_code == 409
    assert c.delete("/api/admin/console/users/t-admin").status_code == 409
    assert c.delete("/api/admin/console/users/new-ed").status_code == 200
    assert login("t-editor").post("/api/admin/console/users", json={"username": "zz-1", "password": "Newpass-123"}).status_code == 403


def test_settings(console):
    c = login("t-admin")
    s = c.get("/api/admin/console/settings").json()["settings"]
    assert s["agent_enabled"] is True
    r = c.put("/api/admin/console/settings", json={"agent_offline_only": True, "agent_daily_message_limit": 20})
    assert r.json()["settings"]["agent_daily_message_limit"] == 20
    assert c.put("/api/admin/console/settings", json={"agent_daily_message_limit": -1}).status_code == 422
    assert c.put("/api/admin/console/settings", json={"default_course": "ghost"}).status_code == 422
    assert c.put("/api/admin/console/settings", json={"unknown": 1}).status_code == 422
    assert login("t-editor").put("/api/admin/console/settings", json={"agent_enabled": False}).status_code == 403
    assert len(c.get("/api/admin/console/audit").json()["items"]) >= 1


def test_redact_unit():
    out = redact("我叫李雷，电话13800000002，家住北京市海淀区某路1号，身份证110101200001011234")
    for secret in ("李雷", "13800000002", "海淀区", "110101200001011234"):
        assert secret not in out
