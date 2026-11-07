"""Learner registration and cookie-session endpoints."""

import ipaddress
import re
import secrets
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from .learner_identity import (
    EXPERIENCE_MARKERS,
    LEARNER_SESSION_COOKIE,
    SESSION_LIFETIME_SECONDS,
    LearnerIdentityStore,
)
from .security_config import cookie_secure_enabled


router = APIRouter(prefix="/api/auth", tags=["learner-auth"])
identity_store = LearnerIdentityStore()


class LearnerRegistration(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=48)
    experience_markers: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9_\-.\u4e00-\u9fff]{3,50}", normalized):
            raise ValueError("用户名需为 3 到 50 位汉字、字母、数字或 _ - .")
        return normalized

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        clean_value = value.strip()
        return clean_value or None

    @field_validator("experience_markers")
    @classmethod
    def validate_experience_markers(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)) or any(value not in EXPERIENCE_MARKERS for value in values):
            raise ValueError("能力经验选项无效")
        if "none" in values and len(values) > 1:
            raise ValueError("未接触过不能和其他经验同时选择")
        return values


class LearnerCredentials(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class LearnerProfile(BaseModel):
    id: str
    username: str
    display_name: str
    experience_markers: list[str]
    created_at: str


class SessionResponse(BaseModel):
    learner: LearnerProfile
    csrf_token: str
    expires_in: int


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=LEARNER_SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=cookie_secure_enabled(),
        samesite="lax",
        max_age=SESSION_LIFETIME_SECONDS,
        path="/",
    )


def _issue_session(response: Response, session_data: tuple[dict, str, str]) -> SessionResponse:
    learner, token, csrf_token = session_data
    _set_session_cookie(response, token)
    return SessionResponse(
        learner=learner,
        csrf_token=csrf_token,
        expires_in=SESSION_LIFETIME_SECONDS,
    )


def _client_ip(request: Request) -> str:
    # The bundled nginx proxy overwrites X-Real-IP and the backend is not public-facing.
    proxy_ip = request.headers.get("x-real-ip")
    if proxy_ip:
        try:
            return str(ipaddress.ip_address(proxy_ip.strip()))
        except ValueError:
            pass
    return request.client.host if request.client else "unknown"


def _check_rate_limit(action: str, key: str, limit: int) -> None:
    if not identity_store.check_rate_limit(action, key, limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "rate_limited", "message": "操作太频繁，请稍后再试。"},
            headers={"Retry-After": "900"},
        )


def current_learner(request: Request) -> tuple[dict, str]:
    session = identity_store.get_session(request.cookies.get(LEARNER_SESSION_COOKIE))
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "session_expired", "message": "登录状态已失效，请重新登录。"},
        )
    return session


def require_learner_request(request: Request) -> tuple[dict, str]:
    """Require a learner session for private workbench/resource operations."""
    return current_learner(request)


def require_csrf(
    session: tuple[dict, str] = Depends(current_learner),
    csrf_header: Optional[str] = Header(default=None, alias="X-CSRF-Token"),
) -> tuple[dict, str]:
    expected = session[1]
    actual_hash = identity_store.hash_csrf_token(csrf_header) if csrf_header else ""
    if not csrf_header or not secrets.compare_digest(expected, actual_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "csrf_failed", "message": "请求验证失败，请刷新页面后重试。"},
        )
    return session


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register_learner(
    request: Request,
    response: Response,
    payload: LearnerRegistration,
) -> SessionResponse:
    _check_rate_limit("register", _client_ip(request), 5)
    try:
        session_data = identity_store.create_user(
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
            experience_markers=payload.experience_markers,
        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "username_unavailable", "message": "这个用户名暂时不能使用，请换一个。"},
        ) from error
    return _issue_session(response, session_data)


@router.post("/session", response_model=SessionResponse)
def create_learner_session(
    request: Request,
    response: Response,
    payload: LearnerCredentials,
) -> SessionResponse:
    client_ip = _client_ip(request)
    _check_rate_limit("login_ip", client_ip, 60)
    rate_key = f"{client_ip}:{payload.username.casefold()}"
    _check_rate_limit("login", rate_key, 10)
    session_data = identity_store.authenticate(payload.username.strip(), payload.password)
    if session_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "用户名或密码不正确。"},
        )
    return _issue_session(response, session_data)


@router.get("/me", response_model=SessionResponse)
def get_current_learner_profile(
    request: Request,
) -> SessionResponse:
    token = request.cookies.get(LEARNER_SESSION_COOKIE)
    session = identity_store.rotate_csrf_token(token or "")
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "session_expired", "message": "登录状态已失效，请重新登录。"},
        )
    learner, csrf_token = session
    return SessionResponse(
        learner=learner,
        csrf_token=csrf_token,
        expires_in=SESSION_LIFETIME_SECONDS,
    )


@router.get("/session-status")
def get_session_status(request: Request) -> dict:
    """游客访问时不报 401（浏览器控制台不刷红），已登录时返回与 /me 相同的会话。"""
    token = request.cookies.get(LEARNER_SESSION_COOKIE)
    session = identity_store.rotate_csrf_token(token) if token else None
    if session is None:
        return {"authenticated": False}
    learner, csrf_token = session
    return {"authenticated": True, **SessionResponse(learner=learner, csrf_token=csrf_token, expires_in=SESSION_LIFETIME_SECONDS).model_dump(mode="json")}


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
def delete_learner_session(
    request: Request,
    response: Response,
    session: tuple[dict, str] = Depends(require_csrf),
) -> Response:
    token = request.cookies.get(LEARNER_SESSION_COOKIE)
    if token:
        identity_store.revoke_session(token)
    response.delete_cookie(
        key=LEARNER_SESSION_COOKIE,
        secure=cookie_secure_enabled(),
        httponly=True,
        samesite="lax",
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
