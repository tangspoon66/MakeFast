"""Course Q&A public and admin routes."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from .admin_routes import verify_admin_token
from .course_qa import CourseQAAdminUpdate, CourseQAItem, CourseQAQuestionCreate, course_qa_store
from .email_service import send_email
from .runtime_state import rate_limiter
from .template_manager import template_manager

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/api/templates", tags=["course-qa"])
admin_router = APIRouter(prefix="/api/admin/course-qa", tags=["admin-course-qa"])


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    return forwarded_for.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _ensure_published_template(template_id: str) -> None:
    detail = template_manager.get_template_detail(template_id)
    if not detail or not detail.published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "课程不存在"},
        )


@public_router.get("/{template_id}/qa")
async def list_course_qa(template_id: str, limit: int = Query(50, ge=1, le=100)):
    _ensure_published_template(template_id)
    return {"items": course_qa_store.list_public(template_id, limit=limit)}


@public_router.post("/{template_id}/qa")
async def submit_course_qa(template_id: str, payload: CourseQAQuestionCreate, request: Request):
    _ensure_published_template(template_id)
    client_ip = _client_ip(request)
    if not rate_limiter.allow(f"course_qa:{client_ip}", limit=3, window_seconds=600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"success": False, "message": "提交过于频繁，请稍后再试"},
        )
    item = course_qa_store.add_question(
        template_id=template_id,
        request=payload,
        client_ip=client_ip,
        user_agent=request.headers.get("user-agent", ""),
    )
    logger.info("Course QA submitted: %s for template %s", item["id"], template_id)
    return {"success": True, "id": item["id"], "message": "提交成功，审核通过后会显示在课程下方"}


@admin_router.get("")
async def admin_list_course_qa(
    status_filter: Optional[str] = Query(None, alias="status"),
    template_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    limit: int = Query(100, ge=1, le=500),
    admin: dict = Depends(verify_admin_token),
):
    return {
        "items": course_qa_store.list_admin(
            status=status_filter,
            template_id=template_id,
            search=search.strip() if search else None,
            limit=limit,
        )
    }


@admin_router.put("/{qa_id}", response_model=CourseQAItem)
async def admin_update_course_qa(
    qa_id: str,
    payload: CourseQAAdminUpdate,
    admin: dict = Depends(verify_admin_token),
):
    item = course_qa_store.update(qa_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail={"success": False, "message": "问答不存在"})
    return item


@admin_router.post("/{qa_id}/approve", response_model=CourseQAItem)
async def admin_approve_course_qa(qa_id: str, admin: dict = Depends(verify_admin_token)):
    item = course_qa_store.update(qa_id, CourseQAAdminUpdate(status="approved", is_public=True))
    if not item:
        raise HTTPException(status_code=404, detail={"success": False, "message": "问答不存在"})
    return item


@admin_router.post("/{qa_id}/hide", response_model=CourseQAItem)
async def admin_hide_course_qa(qa_id: str, admin: dict = Depends(verify_admin_token)):
    item = course_qa_store.update(qa_id, CourseQAAdminUpdate(status="hidden", is_public=False))
    if not item:
        raise HTTPException(status_code=404, detail={"success": False, "message": "问答不存在"})
    return item


@admin_router.post("/{qa_id}/reply")
async def admin_reply_course_qa(
    qa_id: str,
    payload: CourseQAAdminUpdate,
    request: Request,
    admin: dict = Depends(verify_admin_token),
):
    if not payload.admin_reply:
        raise HTTPException(status_code=400, detail={"success": False, "message": "请填写回复内容"})
    item = course_qa_store.update(
        qa_id,
        CourseQAAdminUpdate(
            status="replied",
            admin_reply=payload.admin_reply,
            is_public=True if payload.is_public is None else payload.is_public,
        ),
    )
    if not item:
        raise HTTPException(status_code=404, detail={"success": False, "message": "问答不存在"})

    email_result = {"sent": False, "message": "用户未填写邮箱"}
    if item.get("email"):
        detail = template_manager.get_template_detail(item["template_id"])
        course_name = detail.name if detail else "课程"
        base_url = str(request.base_url).rstrip("/")
        body = (
            f"你在 MakeFast 课程《{course_name}》下的提问有新回复：\n\n"
            f"你的问题：\n{item['content']}\n\n"
            f"老师回复：\n{item['admin_reply']}\n\n"
            f"打开课程：\n{base_url}/editor\n"
        )
        sent, message = send_email(item["email"], f"MakeFast 课程《{course_name}》有新回复", body)
        email_result = {"sent": sent, "message": message}
    return {"success": True, "item": item, "email": email_result}


@admin_router.delete("/{qa_id}")
async def admin_delete_course_qa(qa_id: str, admin: dict = Depends(verify_admin_token)):
    if not course_qa_store.delete(qa_id):
        raise HTTPException(status_code=404, detail={"success": False, "message": "问答不存在"})
    return {"success": True}
