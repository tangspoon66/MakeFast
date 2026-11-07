"""R6 会话 / 测验提交 / 画像 API。"""
from fastapi.testclient import TestClient

from app.main import app


def test_session_quiz_profile_flow():
    c = TestClient(app)
    s = c.post("/api/lesson/courses/first-lesson/sessions", json={"learner_id": "kid-1"})
    assert s.status_code == 201
    sid = s.json()["sessionId"]
    # 别人拿不到
    assert c.get(f"/api/lesson/sessions/{sid}", headers={"X-Learner-Id": "kid-2"}).status_code == 404
    # 主线没完成不能交测验
    assert c.post(f"/api/lesson/sessions/{sid}/quiz/submit", json={"learner_id": "kid-1", "items": []}).status_code == 409
    r = c.patch(f"/api/lesson/sessions/{sid}", json={"learner_id": "kid-1", "step_index": 8, "done_steps": ["meet"], "mainline_completed": True, "toolchain": {"build": "done"}})
    assert r.json()["mainlineCompleted"] is True
    q = c.post(f"/api/lesson/sessions/{sid}/quiz/submit", json={"learner_id": "kid-1", "practical_confirmed": True,
               "items": [{"question_id": "q1", "correct": True, "ms": 3000}, {"question_id": "q2", "correct": True, "ms": 5000}, {"question_id": "q3", "correct": False, "ms": 9000}]})
    assert q.json()["passed"] is True and q.json()["correct"] == 2
    assert c.get(f"/api/lesson/sessions/{sid}", headers={"X-Learner-Id": "kid-1"}).json()["quiz"]["passed"] is True
    assert c.get("/api/lesson/profile", headers={"X-Learner-Id": "kid-1"}).json()["profile"] is None
    assert c.put("/api/lesson/profile", json={"learner_id": "kid-1", "profile": {"stage": "explorer"}, "difficulties": {"wiring": 2}, "events": [{"type": "x"}]}).status_code == 200
    p = c.get("/api/lesson/profile", headers={"X-Learner-Id": "kid-1"}).json()
    assert p["profile"]["stage"] == "explorer" and p["difficulties"]["wiring"] == 2
    assert c.post("/api/lesson/courses/first-lesson/sessions", json={}).status_code == 400


def test_admin_learner_detail_reads_profile():
    from conftest import make_learner_client
    from app.admin_console.store import console_store
    c = make_learner_client()
    me = c.get("/api/auth/me").json()
    uid = me["learner"]["id"]
    c.put("/api/lesson/profile", json={"profile": {"stage": "maker"}, "difficulties": {"syntax": 1}})
    sid = c.post("/api/lesson/courses/first-lesson/sessions", json={}).json()["sessionId"]
    d = console_store.learner_detail(uid)
    assert d["lesson_profile"]["profile"]["stage"] == "maker"
    assert d["lesson_sessions"][0]["session_id"] == sid


def test_session_status_guest_and_learner():
    from conftest import make_learner_client
    assert TestClient(app).get("/api/auth/session-status").json() == {"authenticated": False}
    r = make_learner_client().get("/api/auth/session-status").json()
    assert r["authenticated"] is True and r["learner"]["username"] and r["csrf_token"]


def test_latest_session_per_course():
    c = TestClient(app)
    h = {"X-Learner-Id": "kid-latest"}
    assert c.get("/api/lesson/courses/debug-detective/sessions/latest", headers=h).json() == {"session": None}
    a = c.post("/api/lesson/courses/first-lesson/sessions", json={"learner_id": "kid-latest"}).json()["sessionId"]
    c.patch(f"/api/lesson/sessions/{a}", json={"learner_id": "kid-latest", "step_index": 4})
    c.post("/api/lesson/courses/first-lesson/sessions", json={"learner_id": "kid-latest"})
    b = c.post("/api/lesson/courses/debug-detective/sessions", json={"learner_id": "kid-latest"}).json()["sessionId"]
    c.patch(f"/api/lesson/sessions/{b}", json={"learner_id": "kid-latest", "step_index": 2})
    r1 = c.get("/api/lesson/courses/first-lesson/sessions/latest", headers=h).json()["session"]
    r2 = c.get("/api/lesson/courses/debug-detective/sessions/latest", headers=h).json()["session"]
    assert r1["stepIndex"] == 4 and r2["stepIndex"] == 2
    assert c.get("/api/lesson/courses/first-lesson/sessions/latest", headers={"X-Learner-Id": "other"}).json() == {"session": None}
