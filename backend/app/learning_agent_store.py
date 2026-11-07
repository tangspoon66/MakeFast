"""Persistent project/course-bound Agent conversations."""

import json
import sqlite3
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .learner_identity import learner_db_path


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class LearningAgentStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        path = self.path or learner_db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS learner_agent_conversations (
                conversation_id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL REFERENCES learner_users(user_id) ON DELETE CASCADE,
                project_id TEXT NOT NULL REFERENCES learner_projects(project_id) ON DELETE CASCADE,
                course_slug TEXT NOT NULL,
                course_version INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived_at TEXT
            );
            CREATE INDEX IF NOT EXISTS learner_agent_conversations_project_idx
                ON learner_agent_conversations(owner_user_id, project_id, archived_at, updated_at DESC);
            CREATE TABLE IF NOT EXISTS learner_agent_messages (
                message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL REFERENCES learner_agent_conversations(conversation_id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learner_agent_proposals (
                proposal_id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL REFERENCES learner_users(user_id) ON DELETE CASCADE,
                project_id TEXT NOT NULL REFERENCES learner_projects(project_id) ON DELETE CASCADE,
                conversation_id TEXT REFERENCES learner_agent_conversations(conversation_id) ON DELETE SET NULL,
                base_revision INTEGER NOT NULL,
                source_mode TEXT NOT NULL CHECK(source_mode IN ('code', 'blocks')),
                proposed_code TEXT,
                proposed_blocks_xml TEXT,
                summary TEXT NOT NULL,
                dependencies_json TEXT NOT NULL,
                assumptions_json TEXT NOT NULL,
                roundtrip_status TEXT NOT NULL,
                previous_state_json TEXT NOT NULL,
                applied_revision INTEGER,
                applied_at TEXT,
                undone_at TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS learner_agent_proposals_project_idx
                ON learner_agent_proposals(owner_user_id, project_id, created_at DESC);
        """)
        return connection

    @staticmethod
    def _conversation(row: sqlite3.Row) -> dict:
        return {key: row[key] for key in (
            "conversation_id", "project_id", "course_slug", "course_version",
            "title", "created_at", "updated_at",
        )}

    def create(self, user_id: str, project_id: str, title: str) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                project = connection.execute(
                    "SELECT course_slug, course_version FROM learner_projects "
                    "WHERE project_id = ? AND owner_user_id = ? AND archived_at IS NULL",
                    (project_id, user_id),
                ).fetchone()
                if not project or not project["course_slug"] or not project["course_version"]:
                    return None
                conversation_id = secrets.token_urlsafe(18)
                timestamp = _now()
                connection.execute(
                    "INSERT INTO learner_agent_conversations "
                    "(conversation_id, owner_user_id, project_id, course_slug, course_version, title, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (conversation_id, user_id, project_id, project["course_slug"], project["course_version"], title.strip() or "新对话", timestamp, timestamp),
                )
                return self._conversation(connection.execute(
                    "SELECT * FROM learner_agent_conversations WHERE conversation_id = ?", (conversation_id,),
                ).fetchone())
        finally:
            connection.close()

    def list(self, user_id: str, project_id: str) -> list[dict]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT * FROM learner_agent_conversations WHERE owner_user_id = ? AND project_id = ? "
                "AND archived_at IS NULL ORDER BY updated_at DESC", (user_id, project_id),
            ).fetchall()
            return [self._conversation(row) for row in rows]
        finally:
            connection.close()

    def get(self, user_id: str, project_id: str, conversation_id: str) -> Optional[dict]:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM learner_agent_conversations WHERE owner_user_id = ? AND project_id = ? "
                "AND conversation_id = ? AND archived_at IS NULL",
                (user_id, project_id, conversation_id),
            ).fetchone()
            if not row:
                return None
            result = self._conversation(row)
            result["messages"] = [dict(message) for message in connection.execute(
                "SELECT role, content, created_at FROM learner_agent_messages "
                "WHERE conversation_id = ? ORDER BY message_id", (conversation_id,),
            ).fetchall()]
            return result
        finally:
            connection.close()

    def add_exchange(self, user_id: str, project_id: str, conversation_id: str, question: str, answer: str) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                conversation = connection.execute(
                    "SELECT conversation_id FROM learner_agent_conversations WHERE owner_user_id = ? "
                    "AND project_id = ? AND conversation_id = ? AND archived_at IS NULL",
                    (user_id, project_id, conversation_id),
                ).fetchone()
                if not conversation:
                    return None
                timestamp = _now()
                connection.executemany(
                    "INSERT INTO learner_agent_messages(conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                    [(conversation_id, "user", question, timestamp), (conversation_id, "assistant", answer, timestamp)],
                )
                connection.execute(
                    "UPDATE learner_agent_conversations SET updated_at = ?, "
                    "title = CASE WHEN title = '新对话' THEN ? ELSE title END WHERE conversation_id = ?",
                    (timestamp, question[:48], conversation_id),
                )
            return self.get(user_id, project_id, conversation_id)
        finally:
            connection.close()

    def rename(self, user_id: str, project_id: str, conversation_id: str, title: str) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_agent_conversations SET title = ?, updated_at = ? "
                    "WHERE owner_user_id = ? AND project_id = ? AND conversation_id = ? AND archived_at IS NULL",
                    (title.strip(), _now(), user_id, project_id, conversation_id),
                )
                if cursor.rowcount != 1:
                    return None
            return self.get(user_id, project_id, conversation_id)
        finally:
            connection.close()

    def archive(self, user_id: str, project_id: str, conversation_id: str) -> bool:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_agent_conversations SET archived_at = ?, updated_at = ? "
                    "WHERE owner_user_id = ? AND project_id = ? AND conversation_id = ? AND archived_at IS NULL",
                    (_now(), _now(), user_id, project_id, conversation_id),
                )
                return cursor.rowcount == 1
        finally:
            connection.close()

    @staticmethod
    def _proposal(row: sqlite3.Row) -> dict:
        result = {key: row[key] for key in (
            "proposal_id", "project_id", "conversation_id", "base_revision", "source_mode",
            "proposed_code", "proposed_blocks_xml", "summary", "roundtrip_status",
            "applied_revision", "applied_at", "undone_at", "created_at",
        )}
        result["dependencies"] = json.loads(row["dependencies_json"])
        result["hardware_assumptions"] = json.loads(row["assumptions_json"])
        result["status"] = "undone" if row["undone_at"] else "applied" if row["applied_at"] else "preview"
        return result

    def create_proposal(self, user_id: str, project_id: str, values: dict) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                project = connection.execute(
                    "SELECT * FROM learner_projects WHERE owner_user_id = ? AND project_id = ? AND archived_at IS NULL",
                    (user_id, project_id),
                ).fetchone()
                if not project:
                    return None
                proposal_id = secrets.token_urlsafe(18)
                connection.execute(
                    "INSERT INTO learner_agent_proposals "
                    "(proposal_id, owner_user_id, project_id, conversation_id, base_revision, source_mode, "
                    "proposed_code, proposed_blocks_xml, summary, dependencies_json, assumptions_json, "
                    "roundtrip_status, previous_state_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        proposal_id, user_id, project_id, values.get("conversation_id"), project["revision"],
                        values["source_mode"], values.get("proposed_code"), values.get("proposed_blocks_xml"),
                        values["summary"], json.dumps(values.get("dependencies", []), ensure_ascii=False),
                        json.dumps(values.get("hardware_assumptions", []), ensure_ascii=False), values["roundtrip_status"],
                        json.dumps({
                            "project_state": json.loads(project["project_state_json"]),
                            "editor_source": project["editor_source"],
                            "board_id": project["board_id"],
                        }, ensure_ascii=False), _now(),
                    ),
                )
                return self._proposal(connection.execute(
                    "SELECT * FROM learner_agent_proposals WHERE proposal_id = ?", (proposal_id,),
                ).fetchone())
        finally:
            connection.close()

    def get_proposal(self, user_id: str, project_id: str, proposal_id: str) -> Optional[dict]:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM learner_agent_proposals WHERE owner_user_id = ? AND project_id = ? AND proposal_id = ?",
                (user_id, project_id, proposal_id),
            ).fetchone()
            return self._proposal(row) if row else None
        finally:
            connection.close()

    def get_proposal_snapshot(self, user_id: str, project_id: str, proposal_id: str) -> Optional[dict]:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT previous_state_json FROM learner_agent_proposals "
                "WHERE owner_user_id = ? AND project_id = ? AND proposal_id = ?",
                (user_id, project_id, proposal_id),
            ).fetchone()
            return json.loads(row["previous_state_json"]) if row else None
        finally:
            connection.close()

    def mark_applied(self, user_id: str, project_id: str, proposal_id: str, revision: int) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_agent_proposals SET applied_revision = ?, applied_at = ? "
                    "WHERE owner_user_id = ? AND project_id = ? AND proposal_id = ? AND applied_at IS NULL AND undone_at IS NULL",
                    (revision, _now(), user_id, project_id, proposal_id),
                )
                if cursor.rowcount != 1:
                    return None
            return self.get_proposal(user_id, project_id, proposal_id)
        finally:
            connection.close()

    def mark_undone(self, user_id: str, project_id: str, proposal_id: str) -> Optional[dict]:
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_agent_proposals SET undone_at = ? "
                    "WHERE owner_user_id = ? AND project_id = ? AND proposal_id = ? AND applied_at IS NOT NULL AND undone_at IS NULL",
                    (_now(), user_id, project_id, proposal_id),
                )
                if cursor.rowcount != 1:
                    return None
            return self.get_proposal(user_id, project_id, proposal_id)
        finally:
            connection.close()


agent_store = LearningAgentStore()
