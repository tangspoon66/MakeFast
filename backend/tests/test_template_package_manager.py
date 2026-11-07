import io
import zipfile

import pytest

from app.template_manager import TemplateManager
from app.template_models import TemplateCreateRequest, TemplateSourceFile


def _zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("readme.txt", "package")
    return buf.getvalue()


def test_rename_package_updates_file_and_metadata(tmp_path):
    manager = TemplateManager(storage_path=str(tmp_path))
    meta = manager.create_template(
        TemplateCreateRequest(
            name="Package Rename Course",
            description="A course with package resources",
            category="IoT",
            tags=["esp32"],
            supported_board_ids=["esp32"],
            published=True,
            files=[TemplateSourceFile(name="sketch.ino", content="void setup() {}\nvoid loop() {}")],
            locked_resources=["document"],
        )
    )

    assert manager.upload_package(meta.template_id, "document", _zip_bytes()) is True
    assert manager.rename_package(meta.template_id, "document", "wiring_diagram") is True

    packages = manager.list_packages(meta.template_id)
    assert [pkg["tag"] for pkg in packages] == ["wiring_diagram"]

    detail = manager.get_template_detail(meta.template_id)
    assert detail is not None
    assert detail.packages == ["wiring_diagram"]
    assert detail.locked_resources == ["wiring_diagram"]


def test_rename_package_file_updates_display_filename(tmp_path):
    manager = TemplateManager(storage_path=str(tmp_path))
    meta = manager.create_template(
        TemplateCreateRequest(
            name="Package Filename Course",
            description="A course with package display filenames",
            category="IoT",
            tags=["esp32"],
            supported_board_ids=["esp32"],
            published=True,
            files=[TemplateSourceFile(name="sketch.ino", content="void setup() {}\nvoid loop() {}")],
        )
    )

    assert manager.upload_package(meta.template_id, "document", _zip_bytes(), "old-name.pdf") is True
    assert manager.rename_package_file(meta.template_id, "document", "lesson-handout.pdf") is True

    packages = manager.list_packages(meta.template_id)
    assert packages[0]["tag"] == "document"
    assert packages[0]["filename"] == "lesson-handout.pdf"


def test_rename_package_rejects_existing_target(tmp_path):
    manager = TemplateManager(storage_path=str(tmp_path))
    meta = manager.create_template(
        TemplateCreateRequest(
            name="Package Conflict Course",
            description="A course with package resource conflicts",
            category="IoT",
            tags=["esp32"],
            supported_board_ids=["esp32"],
            published=True,
            files=[TemplateSourceFile(name="sketch.ino", content="void setup() {}\nvoid loop() {}")],
        )
    )

    assert manager.upload_package(meta.template_id, "document", _zip_bytes()) is True
    assert manager.upload_package(meta.template_id, "slide", _zip_bytes()) is True

    with pytest.raises(ValueError):
        manager.rename_package(meta.template_id, "document", "slide")
