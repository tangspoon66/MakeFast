"""Persistence and security helpers for personal learner accounts."""

import hashlib
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from passlib.context import CryptContext


LEARNER_SESSION_COOKIE = "makefast_session"
SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60
EXPERIENCE_MARKERS = {
    "none",
    "recognizes_board_sensor",
    "connected_component",
    "compiled_or_flashed",
    "used_serial_or_debugged",
}

password_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    pbkdf2_sha256__rounds=600_000,
    deprecated="auto",
)
DUMMY_PASSWORD_HASH = password_context.hash("makefast-invalid-login-password")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def learner_db_path() -> Path:
    data_dir = Path(os.getenv("APP_DATA_PATH") or "./data")
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "learning.sqlite3"


class LearnerIdentityStore:
    """Small stdlib SQLite store isolated from admin and operational databases."""

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
        self._ensure_schema(connection)
        return connection

    @staticmethod
    def _ensure_schema(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learner_users (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                experience_markers_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learner_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES learner_users(user_id) ON DELETE CASCADE,
                csrf_token TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS learner_sessions_user_id_idx
                ON learner_sessions(user_id);
            CREATE TABLE IF NOT EXISTS learner_auth_rate_limits (
                rate_key TEXT NOT NULL,
                action TEXT NOT NULL,
                window_started INTEGER NOT NULL,
                attempt_count INTEGER NOT NULL,
                PRIMARY KEY (rate_key, action)
            );
            INSERT OR IGNORE INTO schema_migrations(version, applied_at)
                VALUES (1, CURRENT_TIMESTAMP);
            """
        )

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def hash_csrf_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _safe_user(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["user_id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "experience_markers": json.loads(row["experience_markers_json"]),
            "created_at": row["created_at"],
        }

    def check_rate_limit(self, action: str, rate_key: str, limit: int) -> bool:
        now = int(time.time())
        window_seconds = 15 * 60
        anonymized_key = hashlib.sha256(rate_key.encode("utf-8")).hexdigest()
        connection = self._connect()
        try:
            with connection:
                row = connection.execute(
                    "SELECT window_started, attempt_count FROM learner_auth_rate_limits "
                    "WHERE rate_key = ? AND action = ?",
                    (anonymized_key, action),
                ).fetchone()
                if row is None or now - row["window_started"] >= window_seconds:
                    connection.execute(
                        "INSERT INTO learner_auth_rate_limits "
                        "(rate_key, action, window_started, attempt_count) VALUES (?, ?, ?, 1) "
                        "ON CONFLICT(rate_key, action) DO UPDATE SET "
                        "window_started = excluded.window_started, attempt_count = 1",
                        (anonymized_key, action, now),
                    )
                    return True
                if row["attempt_count"] >= limit:
                    return False
                connection.execute(
                    "UPDATE learner_auth_rate_limits SET attempt_count = attempt_count + 1 "
                    "WHERE rate_key = ? AND action = ?",
                    (anonymized_key, action),
                )
                return True
        finally:
            connection.close()

    def create_user(
        self,
        username: str,
        password: str,
        display_name: Optional[str],
        experience_markers: list[str],
    ) -> tuple[dict[str, Any], str, str]:
        user_id = secrets.token_urlsafe(18)
        created_at = _iso(_utc_now())
        password_hash = password_context.hash(password)
        session_token, csrf_token = self._new_session_values()
        connection = self._connect()
        try:
            with connection:
                connection.execute(
                    "INSERT INTO learner_users "
                    "(user_id, username, password_hash, display_name, "
                    "experience_markers_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        user_id,
                        username,
                        password_hash,
                        (display_name or username)[:48],
                        json.dumps(experience_markers, ensure_ascii=False),
                        created_at,
                    ),
                )
                connection.execute(
                    "INSERT INTO learner_sessions "
                    "(token_hash, user_id, csrf_token, created_at, expires_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (
                        self._token_hash(session_token),
                        user_id,
                        self.hash_csrf_token(csrf_token),
                        created_at,
                        _iso(_utc_now() + timedelta(seconds=SESSION_LIFETIME_SECONDS)),
                    ),
                )
                row = connection.execute(
                    "SELECT * FROM learner_users WHERE user_id = ?", (user_id,)
                ).fetchone()
            return self._safe_user(row), session_token, csrf_token
        finally:
            connection.close()

    def authenticate(self, username: str, password: str) -> Optional[tuple[dict[str, Any], str, str]]:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM learner_users WHERE username = ? COLLATE NOCASE", (username,)
            ).fetchone()
            stored_hash = row["password_hash"] if row else DUMMY_PASSWORD_HASH
            valid_password = password_context.verify(password, stored_hash)
            if row is None or not valid_password:
                return None

            session_token, csrf_token = self._new_session_values()
            created_at = _iso(_utc_now())
            with connection:
                connection.execute(
                    "INSERT INTO learner_sessions "
                    "(token_hash, user_id, csrf_token, created_at, expires_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (
                        self._token_hash(session_token),
                        row["user_id"],
                        self.hash_csrf_token(csrf_token),
                        created_at,
                        _iso(_utc_now() + timedelta(seconds=SESSION_LIFETIME_SECONDS)),
                    ),
                )
            return self._safe_user(row), session_token, csrf_token
        finally:
            connection.close()

    def get_session(self, token: Optional[str]) -> Optional[tuple[dict[str, Any], str]]:
        if not token:
            return None
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT u.*, s.csrf_token, s.expires_at "
                "FROM learner_sessions s JOIN learner_users u ON u.user_id = s.user_id "
                "WHERE s.token_hash = ?",
                (self._token_hash(token),),
            ).fetchone()
            if row is None:
                return None
            if datetime.fromisoformat(row["expires_at"]) <= _utc_now():
                with connection:
                    connection.execute(
                        "DELETE FROM learner_sessions WHERE token_hash = ?",
                        (self._token_hash(token),),
                    )
                return None
            return self._safe_user(row), row["csrf_token"]
        finally:
            connection.close()

    def rotate_csrf_token(self, token: str) -> Optional[tuple[dict[str, Any], str]]:
        session = self.get_session(token)
        if session is None:
            return None
        learner, _csrf_hash = session
        csrf_token = secrets.token_urlsafe(32)
        connection = self._connect()
        try:
            with connection:
                cursor = connection.execute(
                    "UPDATE learner_sessions SET csrf_token = ? WHERE token_hash = ?",
                    (self.hash_csrf_token(csrf_token), self._token_hash(token)),
                )
                if cursor.rowcount != 1:
                    return None
            return learner, csrf_token
        finally:
            connection.close()

    def revoke_session(self, token: str) -> None:
        connection = self._connect()
        try:
            with connection:
                connection.execute(
                    "DELETE FROM learner_sessions WHERE token_hash = ?",
                    (self._token_hash(token),),
                )
        finally:
            connection.close()

    @staticmethod
    def _new_session_values() -> tuple[str, str]:
        return secrets.token_urlsafe(32), secrets.token_urlsafe(32)
