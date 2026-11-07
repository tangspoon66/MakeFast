"""Draft course definitions and immutable published snapshots."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .learner_identity import learner_db_path
from .learning_course_schema import CourseDefinition


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class CourseConflict(Exception):
    pass


class LearningCourseStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        path = self.path or learner_db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS learning_courses (
                slug TEXT PRIMARY KEY,
                draft_json TEXT NOT NULL,
                draft_revision INTEGER NOT NULL DEFAULT 1,
                published_version INTEGER,
                published_draft_revision INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learning_course_versions (
                slug TEXT NOT NULL REFERENCES learning_courses(slug),
                version INTEGER NOT NULL,
                content_json TEXT NOT NULL,
                published_at TEXT NOT NULL,
                PRIMARY KEY (slug, version)
            );
        """)
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(learning_courses)")}
        if "published_draft_revision" not in columns:
            connection.execute("ALTER TABLE learning_courses ADD COLUMN published_draft_revision INTEGER")
        return connection

    def create(self, course: CourseDefinition) -> dict:
        connection = self._connect()
        try:
            timestamp = _now()
            with connection:
                connection.execute(
                    "INSERT INTO learning_courses (slug, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (course.slug, course.model_dump_json(), timestamp, timestamp),
                )
            return self.get_draft(course.slug)
        finally:
            connection.close()

    def get_draft(self, slug: str) -> Optional[dict]:
        connection = self._connect()
        try:
            row = connection.execute("SELECT * FROM learning_courses WHERE slug = ?", (slug,)).fetchone()
            if row is None:
                return None
            return {
                "slug": slug, "revision": row["draft_revision"],
                "published_version": row["published_version"],
                "content": json.loads(row["draft_json"]), "updated_at": row["updated_at"],
            }
        finally:
            connection.close()

    def update_draft(self, slug: str, revision: int, course: CourseDefinition) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                row = connection.execute("SELECT draft_revision FROM learning_courses WHERE slug = ?", (slug,)).fetchone()
                if row is None:
                    return None
                if row["draft_revision"] != revision:
                    raise CourseConflict()
                connection.execute(
                    "UPDATE learning_courses SET draft_json = ?, draft_revision = draft_revision + 1, updated_at = ? WHERE slug = ?",
                    (course.model_dump_json(), _now(), slug),
                )
            return self.get_draft(slug)
        finally:
            connection.close()

    def publish(self, slug: str, revision: int) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                row = connection.execute("SELECT * FROM learning_courses WHERE slug = ?", (slug,)).fetchone()
                if row is None:
                    return None
                if row["draft_revision"] != revision:
                    raise CourseConflict()
                if row["published_draft_revision"] == revision:
                    raise CourseConflict()
                version = (row["published_version"] or 0) + 1
                timestamp = _now()
                connection.execute(
                    "INSERT INTO learning_course_versions (slug, version, content_json, published_at) VALUES (?, ?, ?, ?)",
                    (slug, version, row["draft_json"], timestamp),
                )
                connection.execute(
                    "UPDATE learning_courses SET published_version = ?, published_draft_revision = ?, updated_at = ? WHERE slug = ?",
                    (version, revision, timestamp, slug),
                )
            return self.get_published(slug, version)
        finally:
            connection.close()

    def get_published(self, slug: str, version: Optional[int] = None) -> Optional[dict]:
        connection = self._connect()
        try:
            if version is None:
                row = connection.execute(
                    "SELECT v.* FROM learning_course_versions v JOIN learning_courses c ON c.slug = v.slug "
                    "WHERE v.slug = ? AND v.version = c.published_version", (slug,),
                ).fetchone()
            else:
                row = connection.execute(
                    "SELECT * FROM learning_course_versions WHERE slug = ? AND version = ?", (slug, version),
                ).fetchone()
            if row is None:
                return None
            return {"slug": slug, "version": row["version"], "content": json.loads(row["content_json"]), "published_at": row["published_at"]}
        finally:
            connection.close()

    def versions(self, slug: str) -> list[dict]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT version, published_at FROM learning_course_versions WHERE slug = ? ORDER BY version DESC", (slug,),
            ).fetchall()
            return [dict(row) for row in rows]
        finally:
            connection.close()


course_store = LearningCourseStore()
