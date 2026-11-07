"""
公共模板浏览路由模块

提供用户端模板浏览、搜索、筛选功能（无需认证）。
仅返回已发布（published=True）的模板。
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query

from .template_models import (
    TemplateListResponse,
    TemplateDetail,
    TemplateErrorCode,
    TemplateErrorResponse,
)
from .template_manager import template_manager
from .error_utils import sanitize_error
from .ops_metrics import ops_metrics
from .learner_auth_routes import require_csrf, require_learner_request

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/templates", tags=["templates"])


# ============================================================================
# 公共模板浏览端点
# ============================================================================


@router.get(
    "",
    response_model=TemplateListResponse,
    summary="获取已发布模板列表",
    description="获取所有已发布的模板列表，支持按分类、标签、开发板和关键词筛选，支持分页",
    responses={
        500: {"model": TemplateErrorResponse, "description": "服务器内部错误"},
    },
)
async def list_templates(
    category: Optional[str] = Query(
        None, description="按分类筛选", max_length=50
    ),
    tags: Optional[str] = Query(
        None, description="按标签筛选，多个标签用逗号分隔"
    ),
    board_id: Optional[str] = Query(
        None, description="按开发板 ID 筛选"
    ),
    search: Optional[str] = Query(
        None, description="搜索关键词（名称或描述）", max_length=200
    ),
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    page_size: int = Query(12, ge=1, le=50, description="每页数量（1-50）"),
):
    """
    获取已发布模板列表（用户视图）

    - **category**: 按分类筛选（可选）
    - **tags**: 按标签筛选，多个标签用逗号分隔（可选）
    - **board_id**: 按开发板 ID 筛选（可选）
    - **search**: 搜索关键词（名称或描述）（可选，最多 200 字符）
    - **page**: 页码，从 1 开始（默认 1）
    - **page_size**: 每页数量，1-50（默认 12）

    返回已发布的模板分页列表，按创建时间降序排序。

    无需认证。

    需求: 5.7, 8.2, 8.3, 9.1, 9.6
    """
    try:
        # 解析标签列表（逗号分隔字符串 → 列表）
        tag_list = None
        if tags:
            tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]

        # 获取已发布的模板（published_only=True）
        result = template_manager.get_template_list(
            published_only=True,
            category=category,
            tags=tag_list,
            board_id=board_id,
            search=search,
            page=page,
            page_size=page_size,
        )

        logger.info(
            f"User retrieved {result.total_count} published templates "
            f"(category={category}, tags={tags}, board_id={board_id}, "
            f"search={search}, page={page}, page_size={page_size})"
        )
        return result

    except Exception as e:
        logger.error(f"Failed to get published template list: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取模板列表失败"),
            },
        )


# ============================================================================
# 获取 B 站视频封面（公开）
# ============================================================================


@router.get(
    "/bilibili-cover",
    summary="获取 B 站视频封面",
    description="通过 BV 号获取 B 站视频封面图 URL（公开接口）",
)
async def get_bilibili_cover_public(
    bvid: str = Query(..., description="B 站视频 BV 号"),
):
    """代理获取 B 站视频封面图 URL"""
    import urllib.request
    import json as json_lib

    try:
        url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json_lib.loads(resp.read().decode("utf-8"))

        if data.get("code") != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": f"B 站 API 返回错误: {data.get('message', '未知错误')}"},
            )

        cover_url = data.get("data", {}).get("pic", "")
        title = data.get("data", {}).get("title", "")

        if not cover_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"success": False, "message": "未找到视频封面"},
            )

        return {"success": True, "cover_url": cover_url, "title": title}

    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"success": False, "message": sanitize_error(e, "无法访问 B 站 API")},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": sanitize_error(e, "获取封面失败")},
        )


@router.get(
    "/bilibili-cover-image",
    summary="代理获取 B 站封面图片",
    description="通过 URL 代理获取 B 站封面图片（解决防盗链问题）",
)
async def get_bilibili_cover_image(
    url: str = Query(..., description="B 站封面图片 URL"),
):
    """代理获取 B 站封面图片（仅允许 B 站域名）"""
    import urllib.request
    import urllib.parse

    # 安全校验：只允许 B 站 CDN 域名
    ALLOWED_HOSTS = [
        "i0.hdslb.com", "i1.hdslb.com", "i2.hdslb.com",
        "hdslb.com", "bilibili.com",
    ]

    try:
        parsed = urllib.parse.urlparse(url)
        if not parsed.hostname or not any(
            parsed.hostname == host or parsed.hostname.endswith("." + host)
            for host in ALLOWED_HOSTS
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": "不允许的域名，仅支持 B 站图片"},
            )

        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.bilibili.com",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            # 限制响应大小（最大 5MB）
            image_data = resp.read(5 * 1024 * 1024)
            content_type = resp.headers.get("Content-Type", "image/jpeg")

        # 校验 Content-Type
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": "URL 返回的不是图片"},
            )

        from fastapi.responses import Response
        return Response(
            content=image_data,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch bilibili cover: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": "获取图片失败"},
        )


# ============================================================================
# 获取模板缩略图（公共）
# ============================================================================


@router.get(
    "/{template_id}/thumbnail",
    summary="获取模板缩略图",
    description="获取模板的封面图片",
)
async def get_template_thumbnail(template_id: str):
    """获取模板缩略图，无需认证"""
    from fastapi.responses import FileResponse, RedirectResponse

    thumb_url = template_manager.get_thumbnail_url(template_id)
    if thumb_url:
        return RedirectResponse(thumb_url, status_code=302)

    thumb_path = template_manager.get_thumbnail_path(template_id)
    if not thumb_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "缩略图不存在"},
        )

    # 确定 MIME 类型
    ext = thumb_path.suffix.lower()
    media_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    media_type = media_types.get(ext, "image/png")

    return FileResponse(thumb_path, media_type=media_type)


@router.get(
    "/{template_id}",
    response_model=TemplateDetail,
    summary="获取模板详情",
    description="获取指定模板的详细信息，包含所有源代码文件内容",
    responses={
        404: {"model": TemplateErrorResponse, "description": "模板不存在"},
        500: {"model": TemplateErrorResponse, "description": "服务器内部错误"},
    },
)
async def get_template_detail(template_id: str, request: Request):
    """
    获取模板详情（含源文件）

    - **template_id**: 模板 ID

    返回模板的完整信息，包括：
    - 元数据（名称、描述、分类、标签、支持的开发板）
    - 所有源代码文件内容

    仅返回已发布的模板，未发布模板返回 404。

    无需认证。

    需求: 9.2, 5.7, 8.2
    """
    try:
        # 获取模板详情
        template = template_manager.get_template_detail(template_id)

        if not template:
            logger.warning(f"Template not found: {template_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )

        # 仅返回已发布的模板给未认证用户
        if not template.published:
            logger.warning(f"Template not published: {template_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )

        # 更新查看统计
        template_manager.update_view_statistics(template_id)

        # Public previews contain no source. A valid learner session may load it
        # for the authenticated editor; unlock codes alone never grant guest access.
        if request.cookies.get("makefast_session"):
            require_learner_request(request)
        else:
            template = template.model_copy(update={"files": []})

        logger.info(f"Template detail retrieved: {template_id}")
        return template

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Failed to get template detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取模板详情失败"),
            },
        )


# ============================================================================
# 下载附件包（公开）
# ============================================================================


@router.get(
    "/{template_id}/packages/{tag}",
    summary="下载附件包",
    description="下载指定标签的附件 ZIP 包",
)
async def download_package(
    template_id: str,
    tag: str,
    code: str = Query("", max_length=128),
    _learner: tuple[dict, str] = Depends(require_learner_request),
):
    from fastapi.responses import FileResponse, RedirectResponse

    detail = template_manager.get_template_detail(template_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在"},
        )
    if tag in (detail.locked_resources or []) and not template_manager.verify_unlock(template_id, code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "message": "资源已锁定，请先输入正确口令"},
        )

    package_url = template_manager.get_package_url(template_id, tag)
    if package_url:
        template_manager.update_package_download_statistics(template_id)
        return RedirectResponse(package_url, status_code=302)

    package_path = template_manager.get_package_path(template_id, tag)
    if not package_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "附件包不存在"},
        )

    # 更新附件包下载统计
    template_manager.update_package_download_statistics(template_id)

    return FileResponse(package_path, media_type="application/zip", filename=f"{tag}.zip")


# ============================================================================
# 下载源代码 ZIP（公开）
# ============================================================================


@router.get(
    "/{template_id}/download-source",
    summary="下载源代码 ZIP",
    description="将模板源文件打包为 ZIP 下载",
)
async def download_source(
    template_id: str,
    code: str = Query("", max_length=128),
    _learner: tuple[dict, str] = Depends(require_learner_request),
):
    from fastapi.responses import Response

    detail = template_manager.get_template_detail(template_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在"},
        )
    if "source_code" in (detail.locked_resources or []) and not template_manager.verify_unlock(template_id, code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "message": "源代码已锁定，请先输入正确口令"},
        )

    zip_data = template_manager.download_source_zip(template_id)
    if zip_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在或没有源文件"},
        )

    # 更新下载统计
    template_manager.update_download_statistics(template_id)

    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="source_code.zip"'},
    )


# ============================================================================
# 验证解锁口令（公开）
# ============================================================================


from pydantic import BaseModel as PydanticBaseModel


class UnlockRequest(PydanticBaseModel):
    code: str


@router.post(
    "/{template_id}/verify-unlock",
    summary="验证解锁口令",
    description="验证课程资源解锁口令",
)
async def verify_unlock(template_id: str, request: UnlockRequest):
    if template_manager.verify_unlock(template_id, request.code):
        template_manager.update_unlock_statistics(template_id)
        return {"success": True, "message": "解锁成功"}
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "口令错误"},
    )


@router.post(
    "/{template_id}/unlock-detail",
    response_model=TemplateDetail,
    summary="解锁并获取模板详情",
    description="验证课程口令后返回完整模板详情，包含被锁定的源文件内容",
)
async def unlock_template_detail(
    template_id: str,
    request: UnlockRequest,
    _learner: tuple[dict, str] = Depends(require_csrf),
):
    if not template_manager.verify_unlock(template_id, request.code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "message": "口令错误"},
        )

    template = template_manager.get_template_detail(template_id)
    if not template or not template.published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在: {template_id}",
            },
        )

    template_manager.update_unlock_statistics(template_id)
    logger.info(f"Template detail unlocked: {template_id}")
    return template


# ============================================================================
# 课程统计端点（公开）
# ============================================================================


@router.post(
    "/{template_id}/flash-log",
    summary="记录课程烧录事件",
    description="记录从课程模板触发的烧录事件，用于统计",
)
async def log_template_flash_event(template_id: str, flash_log: dict):
    """
    记录课程烧录事件

    - **template_id**: 模板 ID
    - **flash_log**: 烧录日志，包含 success 字段

    请求体示例:
    ```json
    {"success": true}
    ```

    无需认证。
    """
    if "success" not in flash_log or not isinstance(flash_log.get("success"), bool):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": "invalid_request",
                "message": "请求体必须包含布尔型 'success' 字段",
            },
        )

    success = flash_log.get("success")
    result = template_manager.update_flash_statistics(template_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在: {template_id}",
            },
        )

    ops_metrics.record_flash(success)
    logger.info(f"Template flash event logged: {template_id}, success={success}")
    return {"success": True, "message": "课程烧录统计已更新"}


@router.post(
    "/{template_id}/log-open",
    summary="记录打开项目事件",
    description="当用户将课程代码加载到编辑器时调用，用于统计",
)
async def log_template_open(template_id: str):
    """
    记录打开项目事件

    无需请求体，无需认证。
    """
    result = template_manager.update_open_project_statistics(template_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在: {template_id}",
            },
        )

    logger.info(f"Template open project logged: {template_id}")
    return {"success": True, "message": "打开项目统计已更新"}
