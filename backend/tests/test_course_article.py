"""课文章节图文 API：管理端保存，学生端仅读已发布。"""
from __future__ import annotations

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext

import app.admin_console.store as store_module
from app.admin_console.store import AdminConsoleStore
from app.main import app

REPO = Path(__file__).resolve().parents[2]
PWD = CryptContext(schemes=["bcrypt"], deprecated="auto")
PASSWORD = "SyntheticTestPassword1!"


@pytest.fixture()
def console(tmp_path, monkeypatch):
    db = tmp_path / "learning.sqlite3"
    s = AdminConsoleStore(path=db, seed_root=REPO)
    monkeypatch.setattr(store_module, "console_store", s)
    monkeypatch.setenv("APP_DATA_PATH", str(tmp_path))
    s.create_user("t-admin", PWD.hash(PASSWORD), "admin", "测试管理员")
    return s


def login():
    c = TestClient(app)
    r = c.post("/api/admin/login", json={"username": "t-admin", "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c


COURSE = {
    "slug": "art-demo",
    "title": "图文课",
    "level": "入门",
    "summary": "",
    "skills": [],
    "prerequisites": [],
    "cover": "",
    "duration_min": 30,
    "board_id": "xiao-esp32-s3",
    "steps": [{"id": "s1", "title": "步", "why": ""}],
    "quiz": [{"id": "q1", "prompt": "?", "choices": ["a", "b"], "answer_index": 0, "explain": ""}],
    "resources": [],
}

ARTICLE = {
    "slug": "art-demo",
    "title": "图文课",
    "subtitle": {"low": "小", "mid": "中", "high": "高"},
    "chapters": {
        "low": [{"id": "c1", "title": "章", "blocks": [
            {"id": "i1", "type": "image", "src": "/boards/xiao-esp32-s3/cover.webp", "caption": "板"},
            {"id": "k1", "type": "callout", "tone": "tip", "text": "贴士"},
        ]}],
        "mid": [{"id": "c1", "title": "章", "blocks": [{"id": "p1", "type": "paragraph", "text": "中"}]}],
        "high": [{"id": "c1", "title": "章", "blocks": [{"id": "p1", "type": "paragraph", "text": "高"}]}],
    },
    "bilibili": {"bvid": "BV1xx", "title": "t"},
    "resources": [],
    "workbenchPath": "/workbench?course=art-demo",
}


def test_article_save_publish_and_public_read(console):
    c = login()
    assert c.post("/api/admin/console/courses", json=COURSE).status_code in (200, 201)
    r = c.put("/api/admin/console/courses/art-demo/article", json={"article": ARTICLE})
    assert r.status_code == 200, r.text
    assert r.json()["article"]["title"] == "图文课"

    pub = TestClient(app).get("/api/course-agent/courses/art-demo/article")
    assert pub.status_code == 200
    assert pub.json()["article"] is None

    assert c.post("/api/admin/console/courses/art-demo/publish").status_code == 200
    pub = TestClient(app).get("/api/course-agent/courses/art-demo/article")
    art = pub.json()["article"]
    assert art["chapters"]["low"][0]["blocks"][0]["type"] == "image"
    assert art["chapters"]["low"][0]["blocks"][1]["type"] == "callout"


def test_article_image_upload(console):
    c = login()
    assert c.post("/api/admin/console/courses", json=COURSE).status_code in (200, 201)
    r = c.post(
        "/api/admin/console/courses/art-demo/article/images",
        files={"file": ("pic.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 40), "image/png")},
    )
    assert r.status_code == 200, r.text
    assert "/files/" in r.json()["url"]
