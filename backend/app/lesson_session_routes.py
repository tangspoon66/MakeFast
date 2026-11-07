"""第一课会话 / 测验提交 / 学习者画像（R6 api-contracts 的精简实现，前缀 /api/lesson）。

身份：已登录学习者用 user_id；未登录用前端 localStorage 的 learner_id（哈希后存，"anon:xxxx"）。
数据放在学习库（APP_DATA_PATH/learning.sqlite3），管理员后台学习者详情读取 lesson_profiles。
"""
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .course_agent import _console, _user_ref
from .learner_identity import learner_db_path

router = APIRouter(prefix="/api/lesson", tags=["lesson"])

SCHEMA = """
CREATE TABLE IF NOT EXISTS lesson_sessions (
  session_id TEXT PRIMARY KEY, owner_ref TEXT NOT NULL, course_id TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT 'workbench', agent_state TEXT NOT NULL DEFAULT 'GUIDING',
  step_index INTEGER NOT NULL DEFAULT 0, done_steps_json TEXT NOT NULL DEFAULT '[]',
  toolchain_json TEXT NOT NULL DEFAULT '{}', mainline_completed INTEGER NOT NULL DEFAULT 0,
  quiz_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS lesson_sessions_owner ON lesson_sessions(owner_ref, updated_at DESC);
CREATE TABLE IF NOT EXISTS lesson_profiles (
  owner_ref TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _db() -> sqlite3.Connection:
    c = sqlite3.connect(str(learner_db_path()))
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


def _owner(request: Request, learner_id: Optional[str]) -> str:
    ref = _user_ref(request, (learner_id or "")[:64])
    if ref == "anon":
        raise HTTPException(status_code=400, detail="缺少 learner_id")
    return ref


def _session(row: sqlite3.Row) -> Dict[str, Any]:
    return {"sessionId": row["session_id"], "courseId": row["course_id"], "surface": row["surface"], "agentState": row["agent_state"],
            "stepIndex": row["step_index"], "doneSteps": json.loads(row["done_steps_json"]), "toolchain": json.loads(row["toolchain_json"]),
            "mainlineCompleted": bool(row["mainline_completed"]), "quiz": json.loads(row["quiz_json"]) if row["quiz_json"] else None,
            "updatedAt": row["updated_at"]}


def _get_owned(c: sqlite3.Connection, sid: str, owner: str) -> sqlite3.Row:
    row = c.execute("SELECT * FROM lesson_sessions WHERE session_id=?", (sid,)).fetchone()
    if not row or row["owner_ref"] != owner:
        raise HTTPException(status_code=404, detail="会话不存在")
    return row


class SessionIn(BaseModel):
    learner_id: str = Field(default="", max_length=64)


class ProgressIn(BaseModel):
    learner_id: str = Field(default="", max_length=64)
    surface: Optional[str] = Field(default=None, pattern="^(workbench|catalog|quiz|detail)$")
    agent_state: Optional[str] = Field(default=None, pattern="^(IDLE|GUIDING|QUIET_HELP|WRAP_UP)$")
    step_index: Optional[int] = Field(default=None, ge=0, le=100)
    done_steps: Optional[List[str]] = Field(default=None, max_length=50)
    toolchain: Optional[Dict[str, str]] = None
    mainline_completed: Optional[bool] = None


class QuizItemIn(BaseModel):
    question_id: str = Field(..., max_length=40)
    correct: bool
    ms: int = Field(..., ge=0, le=3_600_000)
    skill: str = Field(default="", max_length=30)


class QuizSubmitIn(BaseModel):
    learner_id: str = Field(default="", max_length=64)
    items: List[QuizItemIn] = Field(default_factory=list, max_length=20)
    practical_confirmed: bool = False
    passed: bool = False


class ProfileIn(BaseModel):
    learner_id: str = Field(default="", max_length=64)
    profile: Optional[Dict[str, Any]] = None
    difficulties: Dict[str, int] = Field(default_factory=dict)
    events: List[Dict[str, Any]] = Field(default_factory=list, max_length=500)
    quizAttempts: List[Dict[str, Any]] = Field(default_factory=list, max_length=100)
    ageTier: Optional[str] = Field(default=None, pattern="^(low|mid|high)$")


@router.post("/courses/{course_id}/sessions", status_code=201)
def create_session(course_id: str, body: SessionIn, request: Request) -> Dict[str, Any]:
    owner = _owner(request, body.learner_id)
    if len(course_id) > 60:
        raise HTTPException(status_code=422, detail="courseId 太长")
    sid = "ls_" + secrets.token_urlsafe(12)
    with _db() as c:
        c.execute("INSERT INTO lesson_sessions(session_id, owner_ref, course_id, created_at, updated_at) VALUES (?,?,?,?,?)",
                  (sid, owner, course_id, _now(), _now()))
        return _session(c.execute("SELECT * FROM lesson_sessions WHERE session_id=?", (sid,)).fetchone())


@router.get("/courses/{course_id}/sessions/latest")
def latest_session(course_id: str, request: Request, x_learner_id: str = Header(default="", max_length=64)) -> Dict[str, Any]:
    """本学习者在这门课上进度最靠前的一次会话（换浏览器 / 清了本地缓存时用来恢复）。"""
    owner = _owner(request, x_learner_id)
    with _db() as c:
        row = c.execute("SELECT * FROM lesson_sessions WHERE owner_ref=? AND course_id=? ORDER BY mainline_completed DESC, step_index DESC, updated_at DESC LIMIT 1",
                        (owner, course_id)).fetchone()
    return {"session": _session(row) if row else None}


@router.get("/sessions/{sid}")
def get_session(sid: str, request: Request, x_learner_id: str = Header(default="", max_length=64)) -> Dict[str, Any]:
    owner = _owner(request, x_learner_id)
    with _db() as c:
        return _session(_get_owned(c, sid, owner))


@router.patch("/sessions/{sid}")
def patch_session(sid: str, body: ProgressIn, request: Request) -> Dict[str, Any]:
    owner = _owner(request, body.learner_id)
    with _db() as c:
        row = _get_owned(c, sid, owner)
        sets = {"updated_at": _now()}
        if body.surface: sets["surface"] = body.surface
        if body.agent_state: sets["agent_state"] = body.agent_state
        if body.step_index is not None: sets["step_index"] = body.step_index
        if body.done_steps is not None: sets["done_steps_json"] = json.dumps([str(x)[:40] for x in body.done_steps])
        if body.toolchain is not None: sets["toolchain_json"] = json.dumps({str(k)[:20]: str(v)[:20] for k, v in list(body.toolchain.items())[:10]})
        if body.mainline_completed is not None: sets["mainline_completed"] = 1 if (body.mainline_completed or row["mainline_completed"]) else 0
        c.execute(f"UPDATE lesson_sessions SET {', '.join(k + '=?' for k in sets)} WHERE session_id=?", (*sets.values(), sid))
        return _session(c.execute("SELECT * FROM lesson_sessions WHERE session_id=?", (sid,)).fetchone())


@router.post("/sessions/{sid}/quiz/submit")
def submit_quiz(sid: str, body: QuizSubmitIn, request: Request) -> Dict[str, Any]:
    owner = _owner(request, body.learner_id)
    with _db() as c:
        row = _get_owned(c, sid, owner)
        if not row["mainline_completed"]:
            raise HTTPException(status_code=409, detail="主线完成后才能做课后小练习")
        correct = sum(1 for i in body.items if i.correct)
        passed = bool(body.items) and correct >= 2 and body.practical_confirmed
        result = {"passed": passed, "correct": correct, "total": len(body.items), "submittedAt": _now(),
                  "items": [i.model_dump() for i in body.items]}
        c.execute("UPDATE lesson_sessions SET quiz_json=?, surface='quiz', updated_at=? WHERE session_id=?", (json.dumps(result), _now(), sid))
    cs = _console()
    if cs is not None:
        try:
            cs.record_telemetry("quiz_attempt", {"items": result["items"], "passed": passed}, user_ref=owner, course_slug=row["course_id"])
        except Exception:
            pass
    return result


@router.get("/profile")
def get_profile(request: Request, x_learner_id: str = Header(default="", max_length=64)) -> Dict[str, Any]:
    owner = _owner(request, x_learner_id)
    with _db() as c:
        row = c.execute("SELECT data_json, updated_at FROM lesson_profiles WHERE owner_ref=?", (owner,)).fetchone()
    if not row:
        return {"profile": None, "difficulties": {}, "events": [], "quizAttempts": [], "updatedAt": None}
    return {**json.loads(row["data_json"]), "updatedAt": row["updated_at"]}


@router.put("/profile")
def put_profile(body: ProfileIn, request: Request) -> Dict[str, Any]:
    owner = _owner(request, body.learner_id)
    data = {"profile": body.profile, "difficulties": {str(k)[:30]: int(v) for k, v in list(body.difficulties.items())[:20]},
            "events": body.events[-500:], "quizAttempts": body.quizAttempts[-100:], "ageTier": body.ageTier}
    raw = json.dumps(data, ensure_ascii=False)
    if len(raw) > 400_000:
        raise HTTPException(status_code=413, detail="画像太大")
    with _db() as c:
        c.execute("INSERT INTO lesson_profiles(owner_ref, data_json, updated_at) VALUES (?,?,?) "
                  "ON CONFLICT(owner_ref) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at", (owner, raw, _now()))
    return {"ok": True, "updatedAt": _now()}
