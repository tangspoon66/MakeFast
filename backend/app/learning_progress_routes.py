"""Learner progress event API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .learner_auth_routes import require_csrf, require_learner_request
from .learning_progress_store import progress_store
from .learning_project_store import project_store
from .learning_course_store import course_store

router = APIRouter(tags=["learning-progress"])


class ProgressEvent(BaseModel):
    event_type: str = Field(min_length=1, max_length=80)
    event_key: str = Field(min_length=1, max_length=180)
    project_id: Optional[str] = Field(default=None, max_length=120)
    evidence: Optional[str] = Field(default=None, max_length=120)


@router.post("/api/learning/progress/events")
def record_progress(payload: ProgressEvent, session: tuple[dict, str] = Depends(require_csrf)):
    try:
        user_id = session[0]["id"]
        if not payload.project_id:
            raise HTTPException(status_code=422, detail="积分事件必须绑定项目")
        project = project_store.get(user_id, payload.project_id)
        if not project or not project.get("course_slug") or not project.get("course_version"):
            raise HTTPException(status_code=404, detail="项目不存在或没有绑定课程")
        course = course_store.get_published(project["course_slug"], project["course_version"])
        if not course:
            raise HTTPException(status_code=409, detail="课程版本不可用")
        state = project.get("project_state") or {}
        if payload.event_type == "materials_confirmed":
            material_step = next((step for step in course["content"].get("steps", []) if step.get("type") == "materials"), None)
            confirmed = set(state.get("materialsConfirmed", []))
            required = set(material_step.get("material_ids", [])) if material_step else set()
            if not required or not required.issubset(confirmed):
                raise HTTPException(status_code=409, detail="材料尚未全部确认并保存")
        elif payload.event_type == "blocks_saved" and not state.get("blocksXml"):
            raise HTTPException(status_code=409, detail="积木工程尚未保存")
        elif payload.event_type == "code_saved" and not str(state.get("code", "")).strip():
            raise HTTPException(status_code=409, detail="代码尚未保存")
        elif payload.event_type == "quiz_passed":
            quiz_steps = [step for step in course["content"].get("steps", []) if step.get("type") == "quiz" and step.get("quiz")]
            if not payload.evidence or not any(step["quiz"].get("answer_id") == payload.evidence for step in quiz_steps):
                raise HTTPException(status_code=409, detail="知识检查答案不正确")
        elif payload.event_type == "compile_succeeded":
            if not payload.evidence or not payload.evidence.replace("-", "").replace("_", "").replace(".", "").isalnum():
                raise HTTPException(status_code=409, detail="编译奖励缺少有效的编译结果凭据")
        elif payload.event_type == "flash_succeeded":
            if payload.evidence != "user-confirmed":
                raise HTTPException(status_code=409, detail="烧录奖励需要用户确认设备已成功重启")
        elif payload.event_type == "serial_verified":
            if payload.evidence != "parsed-temperature":
                raise HTTPException(status_code=409, detail="串口奖励需要课程认可的温湿度数据标记")
        elif payload.event_type == "course_completed":
            if payload.evidence != "course-checklist":
                raise HTTPException(status_code=409, detail="课程完成奖励需要课程清单凭据")
            completed = set(project.get("completed_step_ids", []))
            required = {"materials", "wiring", "blocks", "code", "compile", "flash", "verify", "challenge", "quiz"}
            present = {step.get("type") for step in course["content"].get("steps", [])}
            missing = sorted((required & present) - completed)
            if missing:
                raise HTTPException(status_code=409, detail={"code": "course_incomplete", "message": "课程还有关键步骤没有完成，暂时不能领取完成奖励。", "missing_steps": missing})
        elif payload.event_type == "challenge_completed":
            if payload.evidence != "user-confirmed":
                raise HTTPException(status_code=409, detail="挑战奖励需要明确确认已观察到改造效果")
        result = progress_store.record(user_id, payload.event_type, payload.event_key, payload.project_id)
        # Projection is idempotent as well, so retries cannot duplicate a step.
        step_id = None
        event_to_type = {
            "materials_confirmed": "materials", "wiring_confirmed": "wiring", "blocks_saved": "blocks",
            "code_saved": "code", "compile_succeeded": "compile", "flash_succeeded": "flash",
            "serial_verified": "verify", "challenge_completed": "challenge", "quiz_passed": "quiz",
            "course_completed": "completion",
        }
        target_type = event_to_type.get(payload.event_type)
        if target_type:
            step_id = next((item.get("id") for item in course["content"].get("steps", []) if item.get("type") == target_type), None)
        project_store.project_progress_event(user_id, payload.project_id, payload.event_type, step_id)
        return result
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/api/learning/progress")
def get_progress(session: tuple[dict, str] = Depends(require_learner_request)):
    return progress_store.summary(session[0]["id"])
