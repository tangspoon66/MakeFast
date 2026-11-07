"""Admin console API: /api/admin/console/* (role protected)."""
from __future__ import annotations

import os
import re
from typing import Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..auth_service import auth_service, hash_password
from . import store as store_module
from .schemas import (CoursePackIn, CourseUpdate, FaqIn, GuardListIn, GuardTestIn, HardwareIn, SettingsIn,
                      UserCreate, UserUpdate)
from .store import GUARD_LISTS, redact, validate_hardware

router = APIRouter(prefix="/api/admin/console", tags=["admin-console"])
_bearer = HTTPBearer(auto_error=False)


def _store():
    return store_module.console_store


def _err(code: int, message: str):
    raise HTTPException(status_code=code, detail={"success": False, "message": message})


async def current_admin(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    token = request.cookies.get("admin_token") or (credentials.credentials if credentials else None)
    info = auth_service.verify_token(token) if token else None
    if not info:
        _err(status.HTTP_401_UNAUTHORIZED, "未登录或登录已过期")
    if info.get("source") == "console":
        row = _store().get_user(info["username"])
        if not row or row["disabled"]:
            _err(status.HTTP_401_UNAUTHORIZED, "账户已停用")
        info["role"] = row["role"]
        info["display_name"] = row["display_name"]
    else:
        info.setdefault("display_name", info["username"])
    return info


def require(*roles: str) -> Callable:
    async def dep(user: dict = Depends(current_admin)) -> dict:
        if user.get("role") not in roles:
            _err(status.HTTP_403_FORBIDDEN, "当前角色无权执行此操作")
        return user
    return dep


ANY = require("admin", "editor", "viewer")
EDIT = require("admin", "editor")
ADMIN = require("admin")


@router.get("/me")
async def me(user: dict = Depends(ANY)):
    return {"username": user["username"], "role": user["role"], "display_name": user.get("display_name"),
            "source": user.get("source", "env"), "expires_at": user.get("exp")}


# -- dashboard ---------------------------------------------------------------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(ANY)):
    try:
        from ..ops_metrics import ops_metrics
        ops = ops_metrics.get_metrics()
    except Exception:
        ops = None
    return _store().dashboard(ops)


# -- courses -----------------------------------------------------------------
@router.get("/courses")
async def list_courses(user: dict = Depends(ANY)):
    return {"items": _store().list_courses()}


@router.get("/courses/{slug}")
async def get_course(slug: str, user: dict = Depends(ANY)):
    c = _store().get_course(slug)
    if not c:
        _err(404, "课程不存在")
    return c


def _check_prereqs(course: CoursePackIn) -> None:
    known = {c["slug"] for c in _store().list_courses()}
    missing = [p for p in course.prerequisites if p not in known]
    if missing:
        _err(422, "先修课程不存在：" + ", ".join(missing))


@router.post("/courses", status_code=201)
async def create_course(body: CoursePackIn, user: dict = Depends(EDIT)):
    _check_prereqs(body)
    c = _store().create_course(body.model_dump(), user["username"])
    if not c:
        _err(409, "课程标识已存在")
    _store().audit(user["username"], "course.create", body.slug)
    return c


@router.put("/courses/{slug}")
async def update_course(slug: str, body: CourseUpdate, user: dict = Depends(EDIT)):
    _check_prereqs(body.course)
    try:
        c = _store().update_course(slug, body.course.model_dump(), body.revision, user["username"])
    except ValueError as e:
        _err(409, str(e))
    if not c:
        _err(404, "课程不存在")
    _store().audit(user["username"], "course.update", slug)
    return c


@router.post("/courses/{slug}/publish")
async def publish_course(slug: str, user: dict = Depends(EDIT)):
    c = _store().get_course(slug)
    if not c:
        _err(404, "课程不存在")
    problems = []
    if not c.get("steps"):
        problems.append("至少需要 1 个步骤")
    if not c.get("quiz"):
        problems.append("至少需要 1 道测验题")
    if problems:
        _err(422, "无法发布：" + "；".join(problems))
    _store().audit(user["username"], "course.publish", slug)
    return _store().set_course_status(slug, "published", user["username"])


@router.post("/courses/{slug}/unpublish")
async def unpublish_course(slug: str, user: dict = Depends(EDIT)):
    c = _store().set_course_status(slug, "draft", user["username"])
    if not c:
        _err(404, "课程不存在")
    _store().audit(user["username"], "course.unpublish", slug)
    return c


@router.delete("/courses/{slug}")
async def delete_course(slug: str, user: dict = Depends(ADMIN)):
    if not _store().delete_course(slug):
        _err(409, "只能删除存在的草稿课程（已发布课程请先下架）")
    _store().audit(user["username"], "course.delete", slug)
    return {"success": True}


# -- hardware ----------------------------------------------------------------
def _kind(kind: str) -> str:
    if kind not in ("board", "component"):
        _err(404, "未知类型")
    return kind


@router.get("/hardware")
async def list_hardware(user: dict = Depends(ANY)):
    return {"items": _store().list_hardware()}


@router.get("/hardware/{kind}/{item_id}")
async def get_hardware(kind: str, item_id: str, user: dict = Depends(ANY)):
    h = _store().get_hardware(_kind(kind), item_id)
    if not h:
        _err(404, "未找到")
    return h


@router.post("/hardware/{kind}/validate")
async def validate_hw(kind: str, body: HardwareIn, user: dict = Depends(ANY)):
    errors = validate_hardware(_kind(kind), body.data, body.pinmap)
    return {"valid": not errors, "errors": errors}


@router.put("/hardware/{kind}/{item_id}")
async def save_hardware(kind: str, item_id: str, body: HardwareIn, user: dict = Depends(EDIT)):
    _kind(kind)
    if not re.match(r"^[a-z0-9][a-z0-9_-]{0,79}$", item_id):
        _err(422, "ID 只能包含小写字母、数字、- 和 _")
    if body.data.get("id") != item_id:
        _err(422, "data.id 必须与路径中的 ID 一致")
    errors = validate_hardware(kind, body.data, body.pinmap)
    if errors:
        raise HTTPException(status_code=422, detail={"success": False, "message": "校验未通过", "errors": errors})
    _store().audit(user["username"], f"hardware.save.{kind}", item_id)
    return _store().save_hardware(kind, item_id, body.data, body.pinmap, user["username"])


@router.delete("/hardware/{kind}/{item_id}")
async def delete_hardware(kind: str, item_id: str, user: dict = Depends(ADMIN)):
    if not _store().delete_hardware(_kind(kind), item_id):
        _err(404, "未找到")
    _store().audit(user["username"], f"hardware.delete.{kind}", item_id)
    return {"success": True}


# -- learners ----------------------------------------------------------------
@router.get("/learners")
async def learners(q: str = Query(default="", max_length=50), user: dict = Depends(ANY)):
    return {"items": _store().learners(q)}


@router.get("/learners/{user_id}")
async def learner_detail(user_id: str, user: dict = Depends(ANY)):
    d = _store().learner_detail(user_id)
    if not d:
        _err(404, "学习者不存在")
    return d


# -- agent -------------------------------------------------------------------
@router.get("/agent/conversations")
async def conversations(limit: int = Query(default=50, ge=1, le=200), user: dict = Depends(ANY)):
    return {"items": _store().conversations(limit), "events": _store().agent_events("chat", limit)}


@router.get("/agent/refusals")
async def refusals(limit: int = Query(default=100, ge=1, le=500), user: dict = Depends(ANY)):
    return {"items": _store().agent_events("refusal", limit)}


@router.get("/agent/faq")
async def faq_list(user: dict = Depends(ANY)):
    return {"items": _store().list_faq()}


@router.post("/agent/faq", status_code=201)
async def faq_create(body: FaqIn, user: dict = Depends(EDIT)):
    _store().audit(user["username"], "faq.create", body.question[:40])
    return _store().create_faq(body.model_dump())


@router.put("/agent/faq/{faq_id}")
async def faq_update(faq_id: int, body: FaqIn, user: dict = Depends(EDIT)):
    f = _store().update_faq(faq_id, body.model_dump())
    if not f:
        _err(404, "FAQ 不存在")
    _store().audit(user["username"], "faq.update", str(faq_id))
    return f


@router.delete("/agent/faq/{faq_id}")
async def faq_delete(faq_id: int, user: dict = Depends(EDIT)):
    if not _store().delete_faq(faq_id):
        _err(404, "FAQ 不存在")
    _store().audit(user["username"], "faq.delete", str(faq_id))
    return {"success": True}


@router.get("/agent/guard")
async def guard_lists(user: dict = Depends(ANY)):
    return {"lists": _store().guard_lists()}


REGEX_LISTS = ("injection", "unsafe", "pii")


@router.put("/agent/guard/{name}")
async def guard_update(name: str, body: GuardListIn, user: dict = Depends(EDIT)):
    if name not in GUARD_LISTS:
        _err(404, "未知列表")
    if name in REGEX_LISTS:
        for k in body.keywords:
            try:
                re.compile(k)
            except re.error:
                _err(422, f"不是合法的正则表达式：{k}")
    _store().audit(user["username"], "guard.update", name)
    return {"name": name, "keywords": _store().replace_guard_list(name, body.keywords)}


@router.post("/agent/guard/test")
async def guard_test(body: GuardTestIn, user: dict = Depends(ANY)):
    """Dry-run the configured lists against a message (same precedence as the live course agent)."""
    lists = _store().guard_lists()
    text = body.message
    low = text.lower()
    has = lambda pats: [p for p in pats if _safe_search(p, text)]
    hits: Dict[str, List[str]] = {"injection": has(lists["injection"]), "unsafe": has(lists["unsafe"]),
                                  "pii": has(lists["pii"]),
                                  "course": [k for k in lists["course"] if k.lower() in low],
                                  "off_topic": [k for k in lists["off_topic"] if k.lower() in low]}
    if hits["injection"]:
        verdict = "injection"
    elif hits["unsafe"]:
        verdict = "unsafe"
    elif hits["off_topic"] and not hits["course"]:
        verdict = "off_topic"
    elif hits["course"]:
        verdict = "on_topic"
    else:
        verdict = "off_topic"
    return {"verdict": verdict, "allowed": verdict == "on_topic", "pii": bool(hits["pii"]), "hits": hits,
            "redacted": redact(text)}


def _safe_search(pattern: str, text: str) -> bool:
    try:
        return re.search(pattern, text, re.IGNORECASE) is not None
    except re.error:
        return False


PROVIDERS = [
    ("openai", "OpenAI 兼容（AIService）", ("OPENAI_API_KEY", "AI_API_KEY"), "AI_MODEL"),
    ("deepseek", "DeepSeek", ("DEEPSEEK_API_KEY",), "DEEPSEEK_MODEL"),
]


@router.get("/agent/providers")
async def providers(user: dict = Depends(ANY)):
    """Only reports whether a key is configured — never the key itself."""
    items = []
    for pid, label, key_envs, model_env in PROVIDERS:
        configured = any(bool((os.getenv(k) or "").strip()) for k in key_envs)
        items.append({"id": pid, "label": label, "key_configured": configured,
                      "key_env": " / ".join(key_envs), "model": os.getenv(model_env) or None})
    settings = _store().get_settings()
    any_key = any(i["key_configured"] for i in items)
    mode = "disabled" if not settings["agent_enabled"] else ("offline" if settings["agent_offline_only"] or not any_key else "online")
    return {"items": items, "mode": mode}


# -- users & roles -----------------------------------------------------------
@router.get("/users")
async def list_users(user: dict = Depends(ADMIN)):
    return {"items": _store().list_users(), "env_admin": auth_service.admin_username,
            "env_admin_configured": bool(auth_service.admin_password_hash)}


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, user: dict = Depends(ADMIN)):
    if body.username.lower() == (auth_service.admin_username or "").lower():
        _err(409, "该用户名为环境变量超级管理员保留")
    u = _store().create_user(body.username, hash_password(body.password), body.role, body.display_name)
    if not u:
        _err(409, "用户名已存在")
    _store().audit(user["username"], "user.create", f"{body.username}:{body.role}")
    return u


@router.patch("/users/{username}")
async def update_user(username: str, body: UserUpdate, user: dict = Depends(ADMIN)):
    target = _store().get_user(username)
    if not target:
        _err(404, "用户不存在")
    demote = (body.role is not None and body.role != "admin") or body.disabled is True
    if demote and target["role"] == "admin" and _store().count_active_admins(exclude=username) == 0:
        _err(409, "至少保留一个启用中的管理员")
    if username.lower() == user["username"].lower() and demote:
        _err(409, "不能降级或停用自己")
    u = _store().update_user(username, role=body.role, display_name=body.display_name, disabled=body.disabled,
                             password_hash=hash_password(body.password) if body.password else None)
    _store().audit(user["username"], "user.update", username)
    return u


@router.delete("/users/{username}")
async def delete_user(username: str, user: dict = Depends(ADMIN)):
    target = _store().get_user(username)
    if not target:
        _err(404, "用户不存在")
    if username.lower() == user["username"].lower():
        _err(409, "不能删除自己")
    if target["role"] == "admin" and _store().count_active_admins(exclude=username) == 0:
        _err(409, "至少保留一个启用中的管理员")
    _store().delete_user(username)
    _store().audit(user["username"], "user.delete", username)
    return {"success": True}


# -- settings ----------------------------------------------------------------
@router.get("/settings")
async def get_settings(user: dict = Depends(ANY)):
    return {"settings": _store().get_settings()}


@router.put("/settings")
async def put_settings(body: SettingsIn, user: dict = Depends(ADMIN)):
    values = {k: v for k, v in body.model_dump().items() if v is not None}
    if "default_course" in values and not _store().get_course(values["default_course"]):
        _err(422, "默认课程不存在")
    s = _store().save_settings(values, user["username"])
    _store().audit(user["username"], "settings.update", ",".join(sorted(values)))
    return {"settings": s}


@router.get("/audit")
async def audit(limit: int = Query(default=50, ge=1, le=500), user: dict = Depends(ADMIN)):
    return {"items": _store().audit_log(limit)}



@router.post("/courses/{slug}/resources/upload")
async def upload_course_resource(
    slug: str,
    kind: str = Query(default="pdf", pattern="^(pdf|stl)$"),
    name: str = Query(default="", max_length=120),
    file: UploadFile = File(...),
    user: dict = Depends(EDIT),
):
    """上传 PDF / STL，挂到课程 resources[]，文件落在 APP_DATA_PATH/course-resources/{slug}/。"""
    course = _store().get_course(slug)
    if not course:
        _err(404, "课程不存在")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        _err(413, "文件不能超过 25MB")
    ext = ".pdf" if kind == "pdf" else ".stl"
    fname = (file.filename or f"resource{ext}").rsplit("/", 1)[-1]
    if not fname.lower().endswith(ext):
        fname = fname + ext
    import secrets, pathlib
    root = pathlib.Path(os.environ.get("APP_DATA_PATH") or "data") / "course-resources" / slug
    root.mkdir(parents=True, exist_ok=True)
    safe = f"{secrets.token_hex(4)}_{fname}"
    path = root / safe
    path.write_bytes(raw)
    url = f"/api/course-agent/courses/{slug}/files/{safe}"
    rid = secrets.token_hex(4)
    res = {"id": rid, "name": name or fname, "kind": kind, "url": url, "note": ""}
    resources = list(course.get("resources") or [])
    resources.append(res)
    saved = _store().update_course_resources(slug, resources, user["username"])
    if not saved:
        _err(500, "保存失败")
    return {"ok": True, "resource": res, "resources": resources}


@router.delete("/courses/{slug}/resources/{rid}")
async def delete_course_resource(slug: str, rid: str, user: dict = Depends(EDIT)):
    course = _store().get_course(slug)
    if not course:
        _err(404, "课程不存在")
    resources = [r for r in (course.get("resources") or []) if r.get("id") != rid]
    if not _store().update_course_resources(slug, resources, user["username"]):
        _err(500, "保存失败")
    return {"ok": True, "resources": resources}


@router.get("/courses/{slug}/article")
async def get_course_article(slug: str, user: dict = Depends(ANY)):
    c = _store().get_course(slug)
    if not c:
        _err(404, "课程不存在")
    return {"slug": slug, "article": c.get("article"), "revision": c.get("revision"), "status": c.get("status")}


@router.put("/courses/{slug}/article")
async def put_course_article(slug: str, request: Request, user: dict = Depends(EDIT)):
    """保存图文课文章节（body: { article: {...} }）。"""
    body = await request.json()
    article = body.get("article")
    if not isinstance(article, dict):
        _err(400, "article 必须是对象")
    # 轻量体积限制
    import json as _json
    if len(_json.dumps(article, ensure_ascii=False)) > 800_000:
        _err(413, "文章过大")
    saved = _store().update_course_article(slug, article, user["username"])
    if not saved:
        _err(404, "课程不存在")
    return {"ok": True, "slug": slug, "article": saved.get("article"), "revision": saved.get("revision")}


@router.post("/courses/{slug}/article/images")
async def upload_article_image(
    slug: str,
    file: UploadFile = File(...),
    user: dict = Depends(EDIT),
):
    """上传文章配图（png/jpg/webp/svg），返回可公开访问的 URL。"""
    if not _store().get_course(slug):
        _err(404, "课程不存在")
    raw = await file.read()
    if len(raw) > 8 * 1024 * 1024:
        _err(413, "图片不能超过 8MB")
    name = (file.filename or "img.png").rsplit("/", 1)[-1]
    import pathlib, secrets, re
    ext = pathlib.Path(name).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}:
        _err(400, "仅支持 png/jpg/webp/svg/gif")
    root = pathlib.Path(os.environ.get("APP_DATA_PATH") or "data") / "course-resources" / slug / "images"
    root.mkdir(parents=True, exist_ok=True)
    safe = f"{secrets.token_hex(4)}_{re.sub(r'[^A-Za-z0-9._-]', '_', name)}"
    (root / safe).write_bytes(raw)
    url = f"/api/course-agent/courses/{slug}/files/{safe}"
    # files endpoint looks under course-resources/{slug}/ — also put a copy or adjust path
    # Serve from images/ subfolder: extend file route OR flatten
    flat = pathlib.Path(os.environ.get("APP_DATA_PATH") or "data") / "course-resources" / slug / safe
    flat.write_bytes(raw)
    return {"ok": True, "url": url, "filename": safe}
