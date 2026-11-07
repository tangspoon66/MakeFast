"""Structured course authoring and learner read endpoints."""

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from .admin_routes import verify_admin_token
from .learner_auth_routes import require_learner_request
from .learning_course_schema import CourseDefinition, publish_errors
from .learning_course_store import CourseConflict, course_store

router = APIRouter(tags=["learning-courses"])


class DraftSave(BaseModel):
    revision: int = Field(ge=1)
    content: CourseDefinition


class PublishRequest(BaseModel):
    revision: int = Field(ge=1)


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail={"code": "course_not_found", "message": "课程不存在。"})


def _conflict() -> HTTPException:
    return HTTPException(status_code=409, detail={"code": "revision_conflict", "message": "草稿已更新，请重新载入。"})


@router.post("/api/admin/learning/courses", status_code=status.HTTP_201_CREATED)
def create_course(content: CourseDefinition, admin: dict = Depends(verify_admin_token)):
    try:
        return course_store.create(content)
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail={"code": "course_exists", "message": "课程 ID 已存在。"}) from error


@router.get("/api/admin/learning/courses/{slug}/draft")
def get_draft(slug: str, admin: dict = Depends(verify_admin_token)):
    draft = course_store.get_draft(slug)
    if draft is None:
        raise _not_found()
    return draft


@router.put("/api/admin/learning/courses/{slug}/draft")
def save_draft(slug: str, payload: DraftSave, admin: dict = Depends(verify_admin_token)):
    if payload.content.slug != slug:
        raise HTTPException(status_code=422, detail={"code": "validation_error", "fields": [{"field": "content.slug", "message": "课程 ID 不能修改"}]})
    try:
        saved = course_store.update_draft(slug, payload.revision, payload.content)
    except CourseConflict as error:
        raise _conflict() from error
    if saved is None:
        raise _not_found()
    return saved


@router.post("/api/admin/learning/courses/{slug}/validate")
def validate_course(slug: str, admin: dict = Depends(verify_admin_token)):
    draft = course_store.get_draft(slug)
    if draft is None:
        raise _not_found()
    errors = publish_errors(CourseDefinition.model_validate(draft["content"]))
    return {"valid": not errors, "errors": errors, "revision": draft["revision"]}


@router.post("/api/admin/learning/courses/{slug}/publish")
def publish_course(slug: str, payload: PublishRequest, admin: dict = Depends(verify_admin_token)):
    draft = course_store.get_draft(slug)
    if draft is None:
        raise _not_found()
    if draft["revision"] != payload.revision:
        raise _conflict()
    errors = publish_errors(CourseDefinition.model_validate(draft["content"]))
    if errors:
        raise HTTPException(status_code=422, detail={"code": "validation_error", "fields": errors})
    try:
        return course_store.publish(slug, payload.revision)
    except CourseConflict as error:
        raise _conflict() from error


@router.get("/api/admin/learning/courses/{slug}/versions")
def list_versions(slug: str, admin: dict = Depends(verify_admin_token)):
    if course_store.get_draft(slug) is None:
        raise _not_found()
    return {"items": course_store.versions(slug)}


@router.get("/api/learning/courses/{slug}")
def get_course(
    slug: str,
    version: Optional[int] = Query(default=None, ge=1),
    session: tuple[dict, str] = Depends(require_learner_request),
):
    published = course_store.get_published(slug, version)
    if published is None:
        raise _not_found()
    return published
