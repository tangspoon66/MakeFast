"""Idempotent learner progress events, points, and badge projection."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .learner_identity import learner_db_path

POINTS = {
    "materials_confirmed": 20,
    "wiring_confirmed": 45,
    "blocks_saved": 30,
    "code_saved": 20,
    "compile_succeeded": 50,
    "flash_succeeded": 80,
    "serial_verified": 60,
    "challenge_completed": 45,
    "quiz_passed": 20,
    "course_completed": 120,
}
EVENT_LABELS = {
    "materials_confirmed": "确认全部材料",
    "wiring_confirmed": "完成接线确认",
    "blocks_saved": "保存积木程序",
    "code_saved": "保存代码程序",
    "compile_succeeded": "第一次编译成功",
    "flash_succeeded": "第一次烧录成功",
    "serial_verified": "观察到串口数据",
    "challenge_completed": "完成改造挑战",
    "quiz_passed": "答对知识检查",
    "course_completed": "完成整门课程",
}
BADGES = (
    ("first-build", "第一次做出作品", "完成一次编译并成功烧录", {"compile_succeeded", "flash_succeeded"}),
    ("serial-explorer", "串口观察员", "看到课程认可的温湿度串口数据", {"serial_verified"}),
    ("brave-modifier", "勇敢改造家", "完成一次改造挑战", {"challenge_completed"}),
    ("course-finisher", "课程完成者", "完成首课的全部关键步骤", {"course_completed"}),
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class LearningProgressStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        database = self.path or learner_db_path()
        database.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute(
            """CREATE TABLE IF NOT EXISTS learner_progress_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES learner_users(user_id) ON DELETE CASCADE,
                project_id TEXT,
                event_type TEXT NOT NULL,
                event_key TEXT NOT NULL,
                points INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, event_key)
            )"""
        )
        connection.execute("CREATE INDEX IF NOT EXISTS learner_progress_user_idx ON learner_progress_events(user_id, created_at DESC)")
        return connection

    def record(self, user_id: str, event_type: str, event_key: str, project_id: Optional[str] = None) -> dict[str, Any]:
        if event_type not in POINTS:
            raise ValueError("未知学习事件")
        key = event_key.strip()
        if not key or len(key) > 180:
            raise ValueError("事件幂等键无效")
        connection = self._connect()
        try:
            with connection:
                existing = connection.execute(
                    "SELECT event_id, points FROM learner_progress_events WHERE user_id = ? AND event_key = ?",
                    (user_id, key),
                ).fetchone()
                if existing:
                    return {"recorded": False, "points_awarded": 0, "event_id": existing["event_id"], "event_points": existing["points"]}
                count = connection.execute(
                    "SELECT COUNT(*) AS count FROM learner_progress_events WHERE user_id = ? AND event_type = ?",
                    (user_id, event_type),
                ).fetchone()["count"]
                base = POINTS[event_type]
                points = base if count == 0 else max(1, round(base * (0.35 ** min(count, 3))))
                cursor = connection.execute(
                    "INSERT INTO learner_progress_events(user_id, project_id, event_type, event_key, points, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (user_id, project_id, event_type, key, points, _now()),
                )
                return {"recorded": True, "points_awarded": points, "event_id": cursor.lastrowid, "event_points": points}
        finally:
            connection.close()

    def summary(self, user_id: str) -> dict[str, Any]:
        connection = self._connect()
        try:
            total = connection.execute("SELECT COALESCE(SUM(points), 0) AS total FROM learner_progress_events WHERE user_id = ?", (user_id,)).fetchone()["total"]
            rows = connection.execute("SELECT event_type, COUNT(*) AS count FROM learner_progress_events WHERE user_id = ? GROUP BY event_type", (user_id,)).fetchall()
            counts = {row["event_type"]: row["count"] for row in rows}
            badges = [{"key": key, "name": name} for key, name, _criteria, requirements in BADGES if all(counts.get(event, 0) > 0 for event in requirements)]
            recent = []
            for row in connection.execute("SELECT event_type, points, project_id, created_at FROM learner_progress_events WHERE user_id = ? ORDER BY event_id DESC LIMIT 12", (user_id,)).fetchall():
                item = dict(row)
                item["label"] = EVENT_LABELS.get(item["event_type"], item["event_type"])
                recent.append(item)
            return {"points_total": total, "badges": badges, "event_counts": counts, "recent_events": recent,
                    "event_catalog": [{"event_type": key, "label": EVENT_LABELS[key], "first_points": value} for key, value in POINTS.items()],
                    "badge_catalog": [{"key": key, "name": name, "criteria": criteria} for key, name, criteria, _ in BADGES]}
        finally:
            connection.close()


progress_store = LearningProgressStore()
