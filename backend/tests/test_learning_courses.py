from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

import app.learner_auth_routes as auth_routes
import app.learning_course_routes as course_routes
from app.admin_routes import verify_admin_token
from app.learner_identity import LearnerIdentityStore
from app.learning_course_store import LearningCourseStore
from app.learning_course_schema import CourseMedia, CourseDefinition, validate_wiring_graph
from app.learning_project_store import LearnerProjectStore
from app.main import app


def draft_course():
    return {
        "schema_version": 1,
        "slug": "temperature-alert",
        "title": "温湿度提醒器",
        "board_component_id": "xiao-board",
        "finished_media": {"asset_id": "finished-photo"},
        "components": [{
            "id": "xiao-board", "name": "XIAO ESP32-S3 Sense", "kind": "board",
            "media": {"asset_id": "board-photo"}, "pins": [],
        }, {
            "id": "dht11", "name": "温湿度传感器", "kind": "sensor",
            "media": {"asset_id": "sensor-photo"}, "pins": [],
        }],
        "steps": [{"id": "intro", "type": "intro", "title": "看看要做什么", "agent_anchor": "step.overview"},
                  {"id": "materials", "type": "materials", "title": "准备材料", "material_ids": ["xiao-board", "dht11"], "prerequisite_ids": ["intro"]}],
    }


def verified_media(asset_id):
    return {
        "asset_id": asset_id, "url": f"/media/{asset_id}.jpg", "source": "实物拍摄",
        "license": "自有版权", "exact_variant": "首发套件实物", "alt": "首发套件照片",
        "verification_status": "verified", "is_real_photo": True,
    }


def publishable_course():
    course = draft_course()
    course["finished_media"] = verified_media("finished-photo")
    for part in course["components"]:
        part["exact_variant"] = "首发套件实物"
        part["media"] = verified_media(part["media"]["asset_id"])
        part["pinmap_status"] = "verified"
        part["pinmap_evidence"] = "tests/fixtures/physical-kit-check.md"
    course["components"][0]["pins"] = [{"id": "power", "label": "电源引脚", "kind": "power"}]
    course["components"][1]["pins"] = [{"id": "vcc", "label": "VCC 引脚", "kind": "power"}]
    course["connections"] = [{
        "id": "sensor-power", "from_pin": {"component_id": "xiao-board", "pin_id": "power"},
        "to_pin": {"component_id": "dht11", "pin_id": "vcc"}, "kind": "power", "verified": True,
        "verification_evidence": "tests/fixtures/physical-kit-check.md",
    }]
    course["steps"] = []
    for kind in ("intro", "materials", "wiring", "blocks", "code", "compile", "flash", "verify", "challenge", "quiz", "completion"):
        step = {"id": kind, "type": kind, "title": kind, "completion": {"kind": "manual"}}
        if kind == "materials":
            step["material_ids"] = ["xiao-board", "dht11"]
        if kind == "wiring":
            step["connection_ids"] = ["sensor-power"]
        if kind == "verify":
            step["expected_observation"] = "串口显示温湿度读数"
        if kind == "challenge":
            step["challenge"] = {"task": "修改提醒阈值", "success_observation": "达到阈值后听到提示音"}
        if kind == "quiz":
            step["quiz"] = {"question": "传感器有什么作用？", "options": [{"id": "a", "text": "读取环境"}, {"id": "b", "text": "播放声音"}], "answer_id": "a", "explanation": "传感器负责感知。"}
        course["steps"].append(step)
    return course


def setup_clients(tmp_path: Path, monkeypatch):
    database = tmp_path / "learning.sqlite3"
    monkeypatch.setattr(course_routes, "course_store", LearningCourseStore(database))
    monkeypatch.setattr(auth_routes, "identity_store", LearnerIdentityStore(database))
    app.dependency_overrides[verify_admin_token] = lambda: {"role": "admin"}
    return TestClient(app), TestClient(app)


def test_draft_roundtrip_and_unpublished_content_is_private(tmp_path, monkeypatch):
    admin, learner = setup_clients(tmp_path, monkeypatch)
    try:
        draft = draft_course()
        response = admin.post("/api/admin/learning/courses", json=draft)
        assert response.status_code == 201
        assert response.json()["content"]["steps"][1]["material_ids"] == ["xiao-board", "dht11"]
        assert admin.get("/api/admin/learning/courses/temperature-alert/draft").json()["revision"] == 1
        assert learner.get("/api/learning/courses/temperature-alert").status_code == 401
        learner.post("/api/auth/register", json={"username": "course_learner", "password": "password123"})
        assert learner.get("/api/learning/courses/temperature-alert").status_code == 404
        validation = admin.post("/api/admin/learning/courses/temperature-alert/validate").json()
        assert validation["valid"] is False
        assert any(item["field"] == "finished_media" for item in validation["errors"])
        blocked = admin.post("/api/admin/learning/courses/temperature-alert/publish", json={"revision": 1})
        assert blocked.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_invalid_references_and_anchors_have_field_errors(tmp_path, monkeypatch):
    admin, _ = setup_clients(tmp_path, monkeypatch)
    try:
        draft = draft_course()
        draft["steps"][0]["agent_anchor"] = "not-a-real-button"
        bad_anchor = admin.post("/api/admin/learning/courses", json=draft)
        assert bad_anchor.status_code == 422
        assert "agent_anchor" in str(bad_anchor.json())
        draft["steps"][0]["agent_anchor"] = "step.overview"
        draft["connections"] = [{
            "id": "bad-wire", "from_pin": {"component_id": "xiao-board", "pin_id": "imaginary"},
            "to_pin": {"component_id": "dht11", "pin_id": "vcc"}, "kind": "power",
        }]
        bad_pin = admin.post("/api/admin/learning/courses", json=draft)
        assert bad_pin.status_code == 422
        assert "connections.bad-wire" in str(bad_pin.json())
        draft["connections"] = []
        draft["steps"][1]["prerequisite_ids"] = ["later-step"]
        bad_prerequisite = admin.post("/api/admin/learning/courses", json=draft)
        assert bad_prerequisite.status_code == 422
        assert "prerequisite_ids" in str(bad_prerequisite.json())
        draft["steps"][1]["prerequisite_ids"] = ["intro"]
        draft["board_component_id"] = "dht11"
        bad_board = admin.post("/api/admin/learning/courses", json=draft)
        assert bad_board.status_code == 422
        assert "board_component_id" in str(bad_board.json())
        draft["board_component_id"] = "xiao-board"
        draft["steps"][0]["reward"] = {"event_type": "imaginary-event", "points": 10}
        bad_rule = admin.post("/api/admin/learning/courses", json=draft)
        assert bad_rule.status_code == 422
        assert "未知的积分事件" in str(bad_rule.json())
    finally:
        app.dependency_overrides.clear()


def test_published_snapshot_does_not_change_with_new_draft(tmp_path, monkeypatch):
    admin, learner = setup_clients(tmp_path, monkeypatch)
    try:
        import app.learning_project_routes as project_routes
        monkeypatch.setattr(project_routes, "project_store", LearnerProjectStore(tmp_path / "learning.sqlite3"))
        course = publishable_course()
        assert admin.post("/api/admin/learning/courses", json=course).status_code == 201
        published = admin.post("/api/admin/learning/courses/temperature-alert/publish", json={"revision": 1})
        assert published.status_code == 200
        assert published.json()["version"] == 1
        assert admin.post("/api/admin/learning/courses/temperature-alert/publish", json={"revision": 1}).status_code == 409
        csrf = learner.post("/api/auth/register", json={"username": "version_learner", "password": "password123"}).json()["csrf_token"]
        first_project = learner.post("/api/learning/projects", json={"title": "第一版项目", "course_slug": "temperature-alert"}, headers={"X-CSRF-Token": csrf}).json()
        assert first_project["course_version"] == 1
        assert learner.get("/api/learning/courses/temperature-alert").json()["content"]["title"] == "温湿度提醒器"
        changed = deepcopy(course)
        changed["title"] = "新的标题"
        saved = admin.put("/api/admin/learning/courses/temperature-alert/draft", json={"revision": 1, "content": changed})
        assert saved.status_code == 200
        assert saved.json()["revision"] == 2
        assert learner.get("/api/learning/courses/temperature-alert?version=1").json()["content"]["title"] == "温湿度提醒器"
        assert admin.put("/api/admin/learning/courses/temperature-alert/draft", json={"revision": 1, "content": changed}).status_code == 409
        second = admin.post("/api/admin/learning/courses/temperature-alert/publish", json={"revision": 2})
        assert second.json()["version"] == 2
        assert learner.get("/api/learning/courses/temperature-alert").json()["content"]["title"] == "新的标题"
        assert learner.get(f"/api/learning/projects/{first_project['project_id']}").json()["course_version"] == 1
        second_project = learner.post("/api/learning/projects", json={"title": "第二版项目", "course_slug": "temperature-alert"}, headers={"X-CSRF-Token": csrf}).json()
        assert second_project["course_version"] == 2
        assert admin.get("/api/admin/learning/courses/temperature-alert/versions").json()["items"] == [
            {"version": 2, "published_at": second.json()["published_at"]},
            {"version": 1, "published_at": published.json()["published_at"]},
        ]
    finally:
        app.dependency_overrides.clear()


def test_verified_technical_render_requires_variant_comparison():
    media = verified_media("board-render")
    media["is_real_photo"] = False
    media["visual_kind"] = "technical_render"
    media["variant_check"] = "与指定板卡型号及照片比对一致"
    assert CourseMedia.model_validate(media).visual_kind == "technical_render"
    media.pop("variant_check")
    from pydantic import ValidationError
    try:
        CourseMedia.model_validate(media)
    except ValidationError as error:
        assert "比对依据" in str(error)
    else:
        raise AssertionError("未经型号比对的渲染图不能标为已核验")


def test_wiring_graph_roundtrip_coordinates_and_electrical_rules():
    course_data = draft_course()
    course_data["components"][0]["pins"] = [
        {"id": "3v3", "label": "3V3 电源脚", "kind": "power", "x": 0.1, "y": 0.2, "side": "left"},
        {"id": "gnd", "label": "GND 地线脚", "kind": "ground", "x": 0.1, "y": 0.8, "side": "left"},
        {"id": "d0", "label": "D0 信号脚", "kind": "digital", "x": 0.9, "y": 0.3, "side": "right"},
    ]
    course_data["components"][1]["pins"] = [
        {"id": "vcc", "label": "VCC 电源脚", "kind": "power", "x": 0.1, "y": 0.2, "side": "left", "aliases": ["VCC"]},
        {"id": "gnd", "label": "GND 地线脚", "kind": "ground", "x": 0.1, "y": 0.8, "side": "left"},
        {"id": "data", "label": "DATA 信号脚", "kind": "digital", "x": 0.9, "y": 0.5, "side": "right"},
    ]
    course_data["connections"] = [
        {"id": "sensor-power", "from_pin": {"component_id": "xiao-board", "pin_id": "3v3"}, "to_pin": {"component_id": "dht11", "pin_id": "vcc"}, "kind": "power", "direction": "static", "label": "电源脚（VCC）"},
        {"id": "sensor-ground", "from_pin": {"component_id": "xiao-board", "pin_id": "gnd"}, "to_pin": {"component_id": "dht11", "pin_id": "gnd"}, "kind": "ground", "direction": "static", "label": "地线脚（GND）"},
        {"id": "sensor-data", "from_pin": {"component_id": "xiao-board", "pin_id": "d0"}, "to_pin": {"component_id": "dht11", "pin_id": "data"}, "kind": "digital", "direction": "source_to_sink", "label": "信号脚（DATA）", "wire_color": "any"},
    ]
    course = CourseDefinition.model_validate(course_data)
    restored = CourseDefinition.model_validate(course.model_dump())
    assert restored.components[1].pins[2].x == 0.9
    assert restored.connections[0].label == "电源脚（VCC）"
    assert validate_wiring_graph(restored) == []

    shorted = deepcopy(course_data)
    shorted["connections"].append({
        "id": "short", "from_pin": {"component_id": "xiao-board", "pin_id": "3v3"},
        "to_pin": {"component_id": "dht11", "pin_id": "gnd"}, "kind": "ground",
    })
    try:
        CourseDefinition.model_validate(shorted)
    except Exception as error:
        assert "不支持 ground 类型" in str(error) or "不能直接相连" in str(error)
    else:
        raise AssertionError("电源与地线短接必须被拒绝")
