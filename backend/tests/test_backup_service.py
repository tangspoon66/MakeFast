import pytest

from app.backup_service import BackupService


def test_backup_service_creates_and_lists_backup(tmp_path):
    data_dir = tmp_path / "data"
    backup_dir = tmp_path / "backups"
    data_dir.mkdir()
    db_path = data_dir / "ops.sqlite3"
    db_path.write_bytes(b"sqlite-data")

    service = BackupService(data_dir=str(data_dir), backup_dir=str(backup_dir), db_path=str(db_path))
    backup = service.create_backup()

    assert backup.exists()
    assert backup.read_bytes() == b"sqlite-data"
    backups = service.list_backups()
    assert backups[0]["name"] == backup.name


def test_backup_service_rejects_unsafe_name(tmp_path):
    service = BackupService(data_dir=str(tmp_path / "data"), backup_dir=str(tmp_path / "backups"))

    with pytest.raises(ValueError):
        service.get_backup_path("../ops.sqlite3")
