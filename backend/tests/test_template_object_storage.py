import io
import zipfile

from fastapi.testclient import TestClient
from PIL import Image

from app.template_manager import TemplateManager
from app.template_models import TemplateCreateRequest, TemplateSourceFile
from app.template_routes import router
from fastapi import FastAPI


class FakeObjectStorage:
    enabled = True

    def upload_file(self, local_path, key, content_type=None):
        return f"https://assets.example.com/{key}"


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), color=(0, 128, 255)).save(buf, format="PNG")
    return buf.getvalue()


def _zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("readme.txt", "hello")
    return buf.getvalue()


def _create_template(manager: TemplateManager) -> str:
    meta = manager.create_template(
        TemplateCreateRequest(
            name="Object Storage Demo",
            description="A demo template for object storage tests",
            category="IoT",
            tags=[],
            supported_board_ids=["esp32"],
            files=[TemplateSourceFile(name="sketch.ino", content="void setup() {}\nvoid loop() {}")],
        )
    )
    return meta.template_id


def test_template_thumbnail_upload_writes_object_storage_asset(tmp_path, monkeypatch):
    from app import object_storage as object_storage_module

    monkeypatch.setattr(object_storage_module, "object_storage", FakeObjectStorage())
    manager = TemplateManager(storage_path=str(tmp_path))
    template_id = _create_template(manager)

    assert manager.upload_thumbnail(template_id, _png_bytes(), "cover.png") is True

    meta = manager.get_template_detail(template_id)
    assert meta is not None
    assert meta.has_thumbnail is True
    assert meta.cover_url == f"https://assets.example.com/templates/{template_id}/thumbnail.png"
    assert manager.get_thumbnail_url(template_id) == meta.cover_url


def test_template_package_upload_writes_object_storage_asset(tmp_path, monkeypatch):
    from app import object_storage as object_storage_module

    monkeypatch.setattr(object_storage_module, "object_storage", FakeObjectStorage())
    manager = TemplateManager(storage_path=str(tmp_path))
    template_id = _create_template(manager)

    assert manager.upload_package(template_id, "course_material", _zip_bytes()) is True

    packages = manager.list_packages(template_id)
    assert packages[0]["tag"] == "course_material"
    assert packages[0]["url"] == f"https://assets.example.com/templates/{template_id}/packages/course_material.zip"
    assert manager.get_package_url(template_id, "course_material") == packages[0]["url"]


def test_template_routes_redirect_to_object_storage(monkeypatch):
    from app.learner_auth_routes import require_learner_request

    app = FastAPI()
    app.include_router(router)
    # 课包下载需要学习者会话；这里只测重定向，直接放行
    app.dependency_overrides[require_learner_request] = lambda: ({"id": "t"}, "csrf")

    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.template_routes.template_manager.get_template_detail",
        lambda template_id: SimpleNamespace(locked_resources=[]),
    )
    monkeypatch.setattr(
        "app.template_routes.template_manager.get_thumbnail_url",
        lambda template_id: "https://assets.example.com/thumb.png",
    )
    monkeypatch.setattr(
        "app.template_routes.template_manager.get_package_url",
        lambda template_id, tag: "https://assets.example.com/pkg.zip",
    )
    monkeypatch.setattr(
        "app.template_routes.template_manager.update_package_download_statistics",
        lambda template_id: True,
    )

    client = TestClient(app, follow_redirects=False)
    thumb = client.get("/api/templates/tpl1/thumbnail")
    package = client.get("/api/templates/tpl1/packages/course_material")

    assert thumb.status_code == 302
    assert thumb.headers["location"] == "https://assets.example.com/thumb.png"
    assert package.status_code == 302
    assert package.headers["location"] == "https://assets.example.com/pkg.zip"
