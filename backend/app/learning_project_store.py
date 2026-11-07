"""SQLite persistence for learner-owned projects and dashboard summaries."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .learner_identity import learner_db_path


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ProjectRevisionConflict(Exception):
    def __init__(self, current_revision: int):
        self.current_revision = current_revision


class LearnerProjectStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        path = self.path or learner_db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS learner_projects (
                project_id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL REFERENCES learner_users(user_id) ON DELETE CASCADE,
                course_slug TEXT,
                course_version INTEGER,
                title TEXT NOT NULL,
                learning_mode TEXT NOT NULL DEFAULT 'guided',
                editor_source TEXT NOT NULL DEFAULT 'blocks',
                board_id TEXT,
                project_state_json TEXT NOT NULL DEFAULT '{}',
                current_step_id TEXT,
                completed_step_ids_json TEXT NOT NULL DEFAULT '[]',
                revision INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived_at TEXT
            )
            """
        )
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(learner_projects)")}
        if "course_version" not in columns:
            connection.execute("ALTER TABLE learner_projects ADD COLUMN course_version INTEGER")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS learner_projects_owner_updated_idx "
            "ON learner_projects(owner_user_id, archived_at, updated_at DESC)"
        )
        return connection

    @staticmethod
    def _serialize(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "project_id": row["project_id"],
            "course_slug": row["course_slug"],
            "course_version": row["course_version"],
            "title": row["title"],
            "learning_mode": row["learning_mode"],
            "editor_source": row["editor_source"],
            "board_id": row["board_id"],
            "project_state": json.loads(row["project_state_json"]),
            "current_step_id": row["current_step_id"],
            "completed_step_ids": json.loads(row["completed_step_ids_json"]),
            "revision": row["revision"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def create(self, owner_id: str, title: str, course_slug: Optional[str] = None) -> dict[str, Any]:
        import secrets

        project_id = secrets.token_urlsafe(18)
        timestamp = _now()
        connection = self._connect()
        try:
            with connection:
                course_version = None
                if course_slug:
                    course_table = connection.execute(
                        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'learning_courses'"
                    ).fetchone()
                    if course_table:
                        course = connection.execute(
                            "SELECT published_version FROM learning_courses WHERE slug = ?", (course_slug,)
                        ).fetchone()
                        course_version = course["published_version"] if course else None
                connection.execute(
                    "INSERT INTO learner_projects "
                    "(project_id, owner_user_id, course_slug, course_version, title, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (project_id, owner_id, course_slug, course_version, title.strip(), timestamp, timestamp),
                )
                row = connection.execute(
                    "SELECT * FROM learner_projects WHERE project_id = ?", (project_id,)
                ).fetchone()
            return self._serialize(row)
        finally:
            connection.close()

    def list_for_user(self, owner_id: str) -> list[dict[str, Any]]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT * FROM learner_projects WHERE owner_user_id = ? AND archived_at IS NULL "
                "ORDER BY updated_at DESC",
                (owner_id,),
            ).fetchall()
            return [self._serialize(row) for row in rows]
        finally:
            connection.close()

    def get(self, owner_id: str, project_id: str) -> Optional[dict[str, Any]]:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM learner_projects WHERE owner_user_id = ? "
                "AND project_id = ? AND archived_at IS NULL",
                (owner_id, project_id),
            ).fetchone()
            return self._serialize(row) if row else None
        finally:
            connection.close()

    def save(self, owner_id: str, project_id: str, expected_revision: int, values: dict[str, Any]) -> Optional[dict[str, Any]]:
        connection = self._connect()
        try:
            with connection:
                row = connection.execute(
                    "SELECT * FROM learner_projects WHERE owner_user_id = ? "
                    "AND project_id = ? AND archived_at IS NULL",
                    (owner_id, project_id),
                ).fetchone()
                if row is None:
                    return None
                if row["revision"] != expected_revision:
                    raise ProjectRevisionConflict(row["revision"])
                timestamp = _now()
                next_revision = expected_revision + 1
                connection.execute(
                    "UPDATE learner_projects SET title = ?, learning_mode = ?, editor_source = ?, "
                    "board_id = ?, project_state_json = ?, current_step_id = ?, "
                    "completed_step_ids_json = ?, revision = ?, updated_at = ? "
                    "WHERE project_id = ? AND owner_user_id = ?",
                    (
                        values["title"].strip(), values["learning_mode"], values["editor_source"],
                        values.get("board_id"), json.dumps(values["project_state"], ensure_ascii=False),
                        values.get("current_step_id"),
                        json.dumps(values["completed_step_ids"], ensure_ascii=False),
                        next_revision, timestamp, project_id, owner_id,
                    ),
                )
                updated = connection.execute(
                    "SELECT * FROM learner_projects WHERE project_id = ?", (project_id,)
                ).fetchone()
            return self._serialize(updated)
        finally:
            connection.close()

    def archive(self, owner_id: str, project_id: str) -> bool:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_projects SET archived_at = ?, updated_at = ? "
                    "WHERE owner_user_id = ? AND project_id = ? AND archived_at IS NULL",
                    (_now(), _now(), owner_id, project_id),
                )
                return cursor.rowcount == 1
        finally:
            connection.close()

    def project_progress_event(self, owner_id: str, project_id: str, event_type: str, step_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        """Project progress is a projection of verified learning events.

        The event ledger remains the source of truth; this small projection keeps
        the dashboard/workbench fast without allowing a client to mark arbitrary
        steps complete.
        """
        event_to_step = {
            "materials_confirmed": "materials",
            "wiring_confirmed": "wiring",
            "blocks_saved": "blocks",
            "code_saved": "code",
            "compile_succeeded": "compile",
            "flash_succeeded": "flash",
            "serial_verified": "verify",
            "challenge_completed": "challenge",
            "quiz_passed": "quiz",
            "course_completed": "completion",
        }
        step_type = step_id or event_to_step.get(event_type)
        if not step_type:
            return self.get(owner_id, project_id)
        connection = self._connect()
        try:
            with connection:
                row = connection.execute(
                    "SELECT * FROM learner_projects WHERE owner_user_id = ? AND project_id = ? AND archived_at IS NULL",
                    (owner_id, project_id),
                ).fetchone()
                if row is None:
                    return None
                completed = json.loads(row["completed_step_ids_json"])
                if step_type not in completed:
                    completed.append(step_type)
                state = json.loads(row["project_state_json"])
                state.setdefault("progressEvents", {})[event_type] = _now()
                connection.execute(
                    "UPDATE learner_projects SET project_state_json = ?, completed_step_ids_json = ?, updated_at = ? WHERE project_id = ? AND owner_user_id = ?",
                    (json.dumps(state, ensure_ascii=False), json.dumps(completed, ensure_ascii=False), _now(), project_id, owner_id),
                )
                updated = connection.execute("SELECT * FROM learner_projects WHERE project_id = ?", (project_id,)).fetchone()
            return self._serialize(updated)
        finally:
            connection.close()

    def dashboard(self, owner_id: str) -> dict[str, Any]:
        from .learning_progress_store import progress_store
        projects = self.list_for_user(owner_id)
        progress = progress_store.summary(owner_id)
        current = next((item for item in projects if item["course_slug"] == "temperature-alert"), None)
        return {
            "continue_project": current,
            "recent_projects": projects[:5],
            "project_count": len(projects),
            "points_total": progress["points_total"],
            "badges": progress["badges"],
            "recent_events": progress["recent_events"],
        }


project_store = LearnerProjectStore()
