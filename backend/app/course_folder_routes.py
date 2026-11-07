"""Course folder public and admin routes."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from .admin_routes import verify_admin_token
from .course_folder_manager import course_folder_manager
from .course_folder_models import (
    CourseFolder,
    CourseFolderCreateRequest,
    CourseFolderItemReorderRequest,
    CourseFolderListResponse,
    CourseFolderReorderRequest,
    CourseFolderUpdateRequest,
)

router = APIRouter(tags=["course-folders"])


@router.get("/api/course-folders", response_model=CourseFolderListResponse)
async def list_public_course_folders():
    return CourseFolderListResponse(
        folders=course_folder_manager.list_folders(published_only=True)
    )


@router.get("/api/course-folders/{folder_id}/cover")
async def get_course_folder_cover(folder_id: str):
    path = course_folder_manager.get_cover_path(folder_id)
    if not path:
        raise HTTPException(status_code=404, detail={"success": False, "message": "封面不存在"})
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type)


@router.get("/api/admin/course-folders", response_model=CourseFolderListResponse)
async def list_admin_course_folders(admin: dict = Depends(verify_admin_token)):
    return CourseFolderListResponse(
        folders=course_folder_manager.list_folders(published_only=False)
    )


@router.post(
    "/api/admin/course-folders",
    response_model=CourseFolder,
    status_code=status.HTTP_201_CREATED,
)
async def create_course_folder(
    request: CourseFolderCreateRequest,
    admin: dict = Depends(verify_admin_token),
):
    return course_folder_manager.create_folder(request)


@router.put("/api/admin/course-folders/{folder_id}", response_model=CourseFolder)
async def update_course_folder(
    folder_id: str,
    request: CourseFolderUpdateRequest,
    admin: dict = Depends(verify_admin_token),
):
    folder = course_folder_manager.update_folder(folder_id, request)
    if not folder:
        raise HTTPException(status_code=404, detail={"success": False, "message": "文件夹不存在"})
    return folder


@router.post("/api/admin/course-folders/{folder_id}/cover", response_model=CourseFolder)
async def upload_course_folder_cover(
    folder_id: str,
    cover: UploadFile = File(...),
    admin: dict = Depends(verify_admin_token),
):
    content = await cover.read()
    try:
        folder = course_folder_manager.upload_cover(folder_id, content, cover.filename or "cover.jpg")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"success": False, "message": str(exc)})
    if not folder:
        raise HTTPException(status_code=404, detail={"success": False, "message": "文件夹不存在"})
    return folder


@router.delete("/api/admin/course-folders/{folder_id}")
async def delete_course_folder(
    folder_id: str,
    admin: dict = Depends(verify_admin_token),
):
    if not course_folder_manager.delete_folder(folder_id):
        raise HTTPException(status_code=404, detail={"success": False, "message": "文件夹不存在"})
    return {"success": True}


@router.post("/api/admin/course-folders/reorder", response_model=CourseFolderListResponse)
async def reorder_course_folders(
    request: CourseFolderReorderRequest,
    admin: dict = Depends(verify_admin_token),
):
    return CourseFolderListResponse(
        folders=course_folder_manager.reorder_folders(request.folder_ids)
    )


@router.post("/api/admin/course-folders/{folder_id}/items/reorder", response_model=CourseFolder)
async def reorder_course_folder_items(
    folder_id: str,
    request: CourseFolderItemReorderRequest,
    admin: dict = Depends(verify_admin_token),
):
    folder = course_folder_manager.reorder_items(folder_id, request.template_ids)
    if not folder:
        raise HTTPException(status_code=404, detail={"success": False, "message": "文件夹不存在"})
    return folder
