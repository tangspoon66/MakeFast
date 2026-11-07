"""SQLite backup helpers for single-node deployments."""

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional


class BackupService:
    def __init__(self, data_dir: Optional[str] = None, backup_dir: Optional[str] = None, db_path: Optional[str] = None):
        self.data_dir = Path(data_dir or os.getenv("APP_DATA_PATH") or "./data")
        self.db_path = Path(db_path or os.getenv("OPS_DB_PATH") or self.data_dir / "ops.sqlite3")
        self.backup_dir = Path(backup_dir or os.getenv("BACKUP_PATH") or self.data_dir / "backups")
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def create_backup(self) -> Path:
        if not self.db_path.exists():
            raise FileNotFoundError(f"SQLite 数据库不存在: {self.db_path}")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = self.backup_dir / f"ops-{timestamp}.sqlite3"
        shutil.copy2(self.db_path, backup_path)
        return backup_path

    def list_backups(self) -> List[dict]:
        backups = []
        for item in sorted(self.backup_dir.glob("*.sqlite3"), reverse=True):
            stat = item.stat()
            backups.append({
                "name": item.name,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        return backups

    def get_backup_path(self, name: str) -> Path:
        if not name or "/" in name or "\\" in name or ".." in name:
            raise ValueError("备份文件名不合法")
        path = (self.backup_dir / name).resolve()
        if not str(path).startswith(str(self.backup_dir.resolve())) or not path.exists():
            raise FileNotFoundError("备份文件不存在")
        return path


backup_service = BackupService()
