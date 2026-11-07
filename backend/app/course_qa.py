"""Course Q&A storage backed by SQLite."""

import hashlib
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator


PUBLIC_STATUSES = {"approved", "replied"}
ALL_STATUSES = {"pending", "approved", "replied", "hidden"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CourseQAQuestionCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=40)
    email: Optional[str] = Field(None, max_length=160)
    content: str = Field(..., min_length=10, max_length=1000)

    @field_validator("nickname", "content")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        cleaned = value.strip()
        if "@" not in cleaned or "." not in cleaned.rsplit("@", 1)[-1]:
            raise ValueError("邮箱格式不正确")
        return cleaned


class CourseQAAdminUpdate(BaseModel):
    status: Optional[str] = Field(None)
    admin_reply: Optional[str] = Field(None, max_length=2000)
    is_public: Optional[bool] = Field(None)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ALL_STATUSES:
            raise ValueError("无效的问答状态")
        return value

    @field_validator("admin_reply")
    @classmethod
    def trim_reply(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value is not None else value


class CourseQAItem(BaseModel):
    id: str
    template_id: str
    nickname: str
    email: str = ""
    content: str
    admin_reply: str = ""
    status: str
    is_public: bool
    ip_hash: str = ""
    user_agent: str = ""
    created_at: str
    approved_at: Optional[str] = None
    replied_at: Optional[str] = None
    updated_at: Optional[str] = None


class CourseQAStore:
    def __init__(self, data_dir: Optional[str] = None, db_path: Optional[str] = None):
        root = data_dir or os.getenv("APP_DATA_PATH") or "./data"
        self.data_dir = Path(root)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = Path(db_path or os.getenv("COURSE_QA_DB_PATH") or self.data_dir / "course_qa.sqlite3")
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS course_qa (
                    id TEXT PRIMARY KEY,
                    template_id TEXT NOT NULL,
                    nickname TEXT NOT NULL,
                    email TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL,
                    admin_reply TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    is_public INTEGER NOT NULL DEFAULT 0,
                    ip_hash TEXT NOT NULL DEFAULT '',
                    user_agent TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    approved_at TEXT,
                    replied_at TEXT,
                    updated_at TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_course_qa_template_public ON course_qa(template_id, is_public, status, created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_course_qa_status_created ON course_qa(status, created_at DESC)")

    @staticmethod
    def hash_ip(ip: str) -> str:
        salt = os.getenv("COURSE_QA_IP_SALT") or os.getenv("JWT_SECRET_KEY") or "makefast"
        return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def _row_to_item(row: sqlite3.Row) -> dict:
        item = dict(row)
        item["is_public"] = bool(item.get("is_public"))
        return item

    def add_question(self, template_id: str, request: CourseQAQuestionCreate, client_ip: str, user_agent: str) -> dict:
        item = {
            "id": uuid.uuid4().hex,
            "template_id": template_id,
            "nickname": request.nickname[:40],
            "email": str(request.email or "")[:160],
            "content": request.content[:1000],
            "status": "pending",
            "is_public": False,
            "ip_hash": self.hash_ip(client_ip),
            "user_agent": user_agent[:300],
            "created_at": utc_now(),
        }
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO course_qa (
                    id, template_id, nickname, email, content, status, is_public,
                    ip_hash, user_agent, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["template_id"],
                    item["nickname"],
                    item["email"],
                    item["content"],
                    item["status"],
                    0,
                    item["ip_hash"],
                    item["user_agent"],
                    item["created_at"],
                ),
            )
        return item

    def list_public(self, template_id: str, limit: int = 50) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, template_id, nickname, content, admin_reply, status, is_public,
                       created_at, approved_at, replied_at, updated_at
                FROM course_qa
                WHERE template_id = ?
                  AND is_public = 1
                  AND status IN ('approved', 'replied')
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (template_id, max(1, min(limit, 100))),
            ).fetchall()
        return [self._row_to_item(row) for row in rows]

    def list_admin(self, status: Optional[str] = None, template_id: Optional[str] = None, search: Optional[str] = None, limit: int = 100) -> list[dict]:
        clauses = []
        params: list[object] = []
        if status and status != "all":
            clauses.append("status = ?")
            params.append(status)
        if template_id:
            clauses.append("template_id = ?")
            params.append(template_id)
        if search:
            clauses.append("(nickname LIKE ? OR email LIKE ? OR content LIKE ? OR admin_reply LIKE ?)")
            needle = f"%{search}%"
            params.extend([needle, needle, needle, needle])
        where = "WHERE " + " AND ".join(clauses) if clauses else ""
        params.append(max(1, min(limit, 500)))
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM course_qa
                {where}
                ORDER BY
                    CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'replied' THEN 2 ELSE 3 END,
                    created_at DESC
                LIMIT ?
                """,
                params,
            ).fetchall()
        return [self._row_to_item(row) for row in rows]

    def get(self, qa_id: str) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM course_qa WHERE id = ?", (qa_id,)).fetchone()
        return self._row_to_item(row) if row else None

    def update(self, qa_id: str, update: CourseQAAdminUpdate) -> Optional[dict]:
        current = self.get(qa_id)
        if not current:
            return None

        now = utc_now()
        status = update.status if update.status is not None else current["status"]
        admin_reply = update.admin_reply if update.admin_reply is not None else current["admin_reply"]
        is_public = update.is_public if update.is_public is not None else current["is_public"]

        approved_at = current.get("approved_at")
        replied_at = current.get("replied_at")
        if status in PUBLIC_STATUSES and not approved_at:
            approved_at = now
        if admin_reply and not replied_at:
            replied_at = now
        if admin_reply and status == "approved":
            status = "replied"
        if status == "hidden":
            is_public = False
        if status in PUBLIC_STATUSES and update.is_public is None:
            is_public = True

        with self._lock, self._connect() as conn:
            conn.execute(
                """
                UPDATE course_qa
                SET status = ?, admin_reply = ?, is_public = ?, approved_at = ?,
                    replied_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, admin_reply or "", 1 if is_public else 0, approved_at, replied_at, now, qa_id),
            )
        return self.get(qa_id)

    def delete(self, qa_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cursor = conn.execute("DELETE FROM course_qa WHERE id = ?", (qa_id,))
            return cursor.rowcount > 0


course_qa_store = CourseQAStore()
