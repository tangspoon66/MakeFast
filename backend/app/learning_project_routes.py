"""Learner-owned projects and dashboard endpoints."""

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from .learner_auth_routes import require_csrf, require_learner_request
from .learning_project_store import ProjectRevisionConflict, project_store

router = APIRouter(tags=["learning-projects"])


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    course_slug: Optional[str] = Field(default=None, max_length=100)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return value.strip()


class ProjectSave(BaseModel):
    revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=120)
    learning_mode: str = Field(default="guided", pattern="^(guided|assisted|autonomous)$")
    editor_source: str = Field(default="blocks", pattern="^(blocks|code)$")
    board_id: Optional[str] = Field(default=None, max_length=120)
    project_state: dict[str, Any] = Field(default_factory=dict)
    current_step_id: Optional[str] = Field(default=None, max_length=120)
    completed_step_ids: list[str] = Field(default_factory=list, max_length=500)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return value.strip()

    @field_validator("project_state")
    @classmethod
    def bound_state_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(value, ensure_ascii=False)) > 1_500_000:
            raise ValueError("项目内容过大")
        return value


@router.post("/api/learning/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    session: tuple[dict, str] = Depends(require_csrf),
):
    return project_store.create(session[0]["id"], payload.title, payload.course_slug)


@router.get("/api/learning/projects")
def list_projects(session: tuple[dict, str] = Depends(require_learner_request)):
    return {"items": project_store.list_for_user(session[0]["id"])}


@router.get("/api/learning/projects/{project_id}")
def get_project(project_id: str, session: tuple[dict, str] = Depends(require_learner_request)):
    project = project_store.get(session[0]["id"], project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "项目不存在。"})
    return project


@router.put("/api/learning/projects/{project_id}")
def save_project(
    project_id: str,
    payload: ProjectSave,
    session: tuple[dict, str] = Depends(require_csrf),
):
    try:
        project = project_store.save(session[0]["id"], project_id, payload.revision, payload.model_dump(exclude={"revision"}))
    except ProjectRevisionConflict as error:
        raise HTTPException(
            status_code=409,
            detail={"code": "revision_conflict", "current_revision": error.current_revision, "message": "项目已有更新版本，请先重新载入。"},
        ) from error
    if not project:
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "项目不存在。"})
    return project


@router.post("/api/learning/projects/{project_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    project_id: str,
    session: tuple[dict, str] = Depends(require_csrf),
):
    if not project_store.archive(session[0]["id"], project_id):
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "项目不存在。"})


@router.get("/api/users/me/dashboard")
def get_learning_dashboard(session: tuple[dict, str] = Depends(require_learner_request)):
    return project_store.dashboard(session[0]["id"])
