"""Operational metrics and user feedback storage backed by SQLite."""

import json
import os
import shutil
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


class OpsMetricsStore:
    """Store admin-facing counters and feedback in SQLite.

    SQLite with WAL is a good fit for the current single-node deployment: it
    keeps writes transactional without introducing a full database service.
    """

    def __init__(self, data_dir: Optional[str] = None, db_path: Optional[str] = None):
        root = data_dir or os.getenv("APP_DATA_PATH") or os.getenv("OPS_DATA_PATH") or "./data"
        self.data_dir = Path(root)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = Path(db_path or os.getenv("OPS_DB_PATH") or self.data_dir / "ops.sqlite3")
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS counters (
                    key TEXT PRIMARY KEY,
                    total INTEGER NOT NULL DEFAULT 0,
                    success INTEGER NOT NULL DEFAULT 0,
                    failure INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    message TEXT NOT NULL,
                    contact TEXT NOT NULL DEFAULT '',
                    page_url TEXT NOT NULL DEFAULT '',
                    logs_json TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'new',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)")
            for key in ("compile", "flash"):
                conn.execute(
                    """
                    INSERT OR IGNORE INTO counters (key, total, success, failure, updated_at)
                    VALUES (?, 0, 0, 0, NULL)
                    """,
                    (key,),
                )

    def record_compile(self, success: bool) -> None:
        self._record_event("compile", success)

    def record_flash(self, success: bool) -> None:
        self._record_event("flash", success)

    def _record_event(self, key: str, success: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO counters (key, total, success, failure, updated_at)
                VALUES (?, 1, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    total = total + 1,
                    success = success + excluded.success,
                    failure = failure + excluded.failure,
                    updated_at = excluded.updated_at
                """,
                (key, 1 if success else 0, 0 if success else 1, now),
            )

    def get_metrics(self) -> Dict:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM counters WHERE key IN ('compile', 'flash')").fetchall()

        by_key = {row["key"]: dict(row) for row in rows}

        def normalize(key: str) -> Dict:
            section = by_key.get(key, {})
            total = int(section.get("total", 0) or 0)
            success = int(section.get("success", 0) or 0)
            failure = int(section.get("failure", 0) or 0)
            failure_rate = round((failure / total) * 100, 2) if total else 0
            return {
                "total": total,
                "success": success,
                "failure": failure,
                "failure_rate": failure_rate,
            }

        updated_at = max(
            [row.get("updated_at") for row in by_key.values() if row.get("updated_at")] or [None]
        )
        return {
            "compile": normalize("compile"),
            "flash": normalize("flash"),
            "updated_at": updated_at,
        }

    def add_feedback(
        self,
        category: str,
        message: str,
        contact: str = "",
        page_url: str = "",
        logs: Optional[List[str]] = None,
    ) -> Dict:
        feedback = {
            "id": uuid.uuid4().hex,
            "category": category[:50],
            "message": message[:3000],
            "contact": contact[:120],
            "page_url": page_url[:500],
            "logs": (logs or [])[-30:],
            "status": "new",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO feedback (id, category, message, contact, page_url, logs_json, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    feedback["id"],
                    feedback["category"],
                    feedback["message"],
                    feedback["contact"],
                    feedback["page_url"],
                    json.dumps(feedback["logs"], ensure_ascii=False),
                    feedback["status"],
                    feedback["created_at"],
                ),
            )
            conn.execute(
                """
                DELETE FROM feedback
                WHERE id NOT IN (
                    SELECT id FROM feedback ORDER BY created_at DESC LIMIT 500
                )
                """
            )
        return feedback

    def list_feedback(self, limit: int = 20) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM feedback
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 500)),),
            ).fetchall()

        items = []
        for row in rows:
            item = dict(row)
            try:
                item["logs"] = json.loads(item.pop("logs_json") or "[]")
            except json.JSONDecodeError:
                item["logs"] = []
            items.append(item)
        return items

    def get_storage_usage(self, paths: Dict[str, Path]) -> Dict:
        resolved = {}
        for key, path in paths.items():
            try:
                resolved[key] = path.resolve()
            except Exception:
                resolved[key] = path

        data_root = resolved.get("data") or self.data_dir.resolve()
        try:
            disk = shutil.disk_usage(data_root)
        except Exception:
            disk = shutil.disk_usage(Path.cwd())

        def dir_size(path: Path) -> int:
            if not path.exists():
                return 0
            if path.is_file():
                return path.stat().st_size
            total = 0
            for item in path.rglob("*"):
                try:
                    if item.is_file():
                        total += item.stat().st_size
                except OSError:
                    continue
            return total

        used_by_path = {
            key: dir_size(path)
            for key, path in resolved.items()
        }
        unique_path_sizes = {}
        for key, path in resolved.items():
            unique_path_sizes.setdefault(str(path), used_by_path.get(key, 0))
        app_used = sum(unique_path_sizes.values())
        usage_percent = round((disk.used / disk.total) * 100, 2) if disk.total else 0

        return {
            "disk_path": str(data_root),
            "disk_total_mb": round(disk.total / (1024 * 1024), 2),
            "disk_used_mb": round(disk.used / (1024 * 1024), 2),
            "disk_free_mb": round(disk.free / (1024 * 1024), 2),
            "disk_usage_percent": usage_percent,
            "app_used_mb": round(app_used / (1024 * 1024), 2),
            "breakdown_mb": {
                key: round(value / (1024 * 1024), 2)
                for key, value in used_by_path.items()
            },
            "warning": usage_percent >= 80,
        }


ops_metrics = OpsMetricsStore()
