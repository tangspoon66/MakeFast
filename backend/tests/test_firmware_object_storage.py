import io

from PIL import Image
from starlette.datastructures import UploadFile

from app.firmware_manager import FirmwareManager


class FakeObjectStorage:
    enabled = True

    def upload_file(self, local_path, key, content_type=None):
        return f"https://assets.example.com/{key}"


def _png_upload(filename: str = "thumb.png") -> UploadFile:
    buf = io.BytesIO()
    Image.new("RGB", (240, 240), color=(255, 64, 0)).save(buf, format="PNG")
    buf.seek(0)
    return UploadFile(file=buf, filename=filename)


def test_firmware_thumbnail_upload_writes_object_storage_asset(tmp_path, monkeypatch):
    from app import object_storage as object_storage_module

    monkeypatch.setattr(object_storage_module, "object_storage", FakeObjectStorage())
    manager = FirmwareManager(storage_path=str(tmp_path))
    firmware_id = "fw1"
    firmware_dir = tmp_path / firmware_id
    firmware_dir.mkdir()
    (firmware_dir / "metadata.json").write_text(
        """
        {
          "firmware_id": "fw1",
          "project_name": "Demo",
          "version": "1.0.0",
          "description": "Demo firmware",
          "supported_board_ids": ["esp32"],
          "files": [],
          "total_size": 0,
          "published": true,
          "created_at": "2026-01-01T00:00:00Z",
          "updated_at": "2026-01-01T00:00:00Z",
          "download_count": 0,
          "flash_count": 0
        }
        """,
        encoding="utf-8",
    )

    assert manager.upload_thumbnail(firmware_id, _png_upload()) is True
    assert manager.get_thumbnail_url(firmware_id) == "https://assets.example.com/firmware/fw1/thumbnail.png"
