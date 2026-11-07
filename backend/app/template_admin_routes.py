"""
管理员模板管理路由模块

提供管理员对项目模板的 CRUD 操作 API 端点。
所有端点需要有效的管理员 JWT 认证。
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse

from .admin_routes import verify_admin_token
from .template_manager import template_manager
from .error_utils import sanitize_error
from .template_models import (
    TemplateMetadata,
    TemplateListResponse,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateErrorCode,
)

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/admin/templates", tags=["admin-templates"])


# ============================================================================
# 管理员模板列表
# ============================================================================


@router.get(
    "",
    response_model=TemplateListResponse,
    summary="管理员列出所有模板",
    description="列出所有模板（包含未发布），支持分页和筛选",
)
async def admin_list_templates(
    category: Optional[str] = Query(None, description="按分类筛选"),
    tags: Optional[str] = Query(None, description="按标签筛选（逗号分隔）"),
    board_id: Optional[str] = Query(None, description="按开发板 ID 筛选"),
    search: Optional[str] = Query(None, max_length=200, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(12, ge=1, le=50, description="每页数量"),
    admin: dict = Depends(verify_admin_token),
):
    """
    管理员列出所有模板（含未发布）

    支持按分类、标签、开发板和关键词筛选，返回分页结果。
    """
    # 解析 tags 参数（逗号分隔字符串转列表）
    tag_list = None
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    result = template_manager.get_template_list(
        published_only=False,
        category=category,
        tags=tag_list,
        board_id=board_id,
        search=search,
        page=page,
        page_size=page_size,
    )

    return result


# ============================================================================
# B 站封面代理
# ============================================================================


@router.get(
    "/bilibili-cover",
    summary="获取 B 站视频封面",
    description="通过 BV 号获取 B 站视频封面图 URL",
)
async def get_bilibili_cover(
    bvid: str = Query(..., description="B 站视频 BV 号"),
    admin: dict = Depends(verify_admin_token),
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
            detail={"success": False, "message": sanitize_error(e, "无法连接 B 站 API")},
        )


# ============================================================================
# 解析 MD 文档
# ============================================================================


@router.post(
    "/parse-md",
    summary="解析 Markdown 文档",
    description="解析带有 YAML Front Matter 的 Markdown 文件，返回结构化数据",
)
async def parse_markdown_frontmatter(
    md_file: UploadFile = File(..., description="Markdown 文件"),
    admin: dict = Depends(verify_admin_token),
):
    """
    解析 MD 文件的 Front Matter 和正文内容。

    Front Matter 格式：
    ---
    title: 项目名称
    category: IoT
    tags: wifi, sensor
    boards: esp32, esp32s3
    cover: BV1xxxxxx 或 https://...
    video_bilibili: BV1xxxxxx
    video_douyin: https://...
    video_xiaohongshu: https://...
    ---
    """
    try:
        content = (await md_file.read()).decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "文件编码错误，请使用 UTF-8 编码"},
        )

    # 解析 Front Matter（手动解析，不依赖 yaml 库）
    front_matter = {}
    article = content

    def _clean_value(v: str) -> str:
        """去掉首尾引号、空白，并处理 YAML 列表格式"""
        v = v.strip()
        # 去掉外层引号
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1].strip()
        # 处理 YAML 列表 ["a", "b"] → a, b
        if v.startswith("[") and v.endswith("]"):
            inner = v[1:-1]
            items = []
            for item in inner.split(","):
                item = item.strip()
                if (item.startswith('"') and item.endswith('"')) or (item.startswith("'") and item.endswith("'")):
                    item = item[1:-1]
                items.append(item.strip())
            return ", ".join(items)
        return v

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1].strip()
            article = parts[2].strip()

            for line in fm_text.split("\n"):
                line = line.strip()
                if ":" in line:
                    key, value = line.split(":", 1)
                    front_matter[key.strip()] = _clean_value(value)

    # 构建结果
    # 从正文第一段提取 description（取前 200 字符）
    desc = ""
    if article:
        lines = article.strip().split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith(">"):
                desc = stripped[:200]
                break

    level_raw = front_matter.get("level", "")
    level = None
    try:
        lv = int(level_raw)
        if 1 <= lv <= 5:
            level = lv
    except (ValueError, TypeError):
        pass

    result = {
        "success": True,
        "title": front_matter.get("title", ""),
        "category": front_matter.get("category", ""),
        "tags": front_matter.get("tags", ""),
        "boards": front_matter.get("boards", ""),
        "cover": front_matter.get("cover", ""),
        "video_bilibili": front_matter.get("video_bilibili", ""),
        "video_douyin": front_matter.get("video_douyin", ""),
        "video_xiaohongshu": front_matter.get("video_xiaohongshu", ""),
        "level": level,
        "description": desc,
        "article": article,
    }

    return result


# ============================================================================
# 上传模板缩略图
# ============================================================================


@router.post(
    "/{template_id}/thumbnail",
    summary="上传模板缩略图",
    description="为模板上传封面图片",
)
async def upload_template_thumbnail(
    template_id: str,
    thumbnail: UploadFile = File(..., description="图片文件（PNG/JPEG/WebP）"),
    admin: dict = Depends(verify_admin_token),
):
    """上传模板缩略图，支持 PNG、JPEG、WebP 格式，最大 2MB"""
    # 验证文件类型
    valid_types = ["image/png", "image/jpeg", "image/webp"]
    if thumbnail.content_type and thumbnail.content_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "只支持 PNG、JPEG、WebP 格式"},
        )

    # 读取文件内容
    file_content = await thumbnail.read()

    # 验证大小（最大 2MB）
    if len(file_content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "图片大小不能超过 2MB"},
        )

    # 上传
    success = template_manager.upload_thumbnail(
        template_id, file_content, thumbnail.filename or "thumbnail.png"
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在: {template_id}",
            },
        )

    return {"success": True, "message": "缩略图上传成功"}


# ============================================================================
# 回收站
# ============================================================================


@router.get(
    "/trash",
    summary="获取回收站列表",
    description="获取所有已删除的模板",
)
async def get_trash_list(
    admin: dict = Depends(verify_admin_token),
):
    trashed = template_manager.get_trashed_templates()
    return {"success": True, "trashed": trashed, "count": len(trashed)}


@router.post(
    "/trash/empty",
    summary="清空回收站",
    description="永久删除回收站中的所有模板",
)
async def empty_trash(
    admin: dict = Depends(verify_admin_token),
):
    count = template_manager.empty_trash()
    logger.info(f"Admin '{admin.get('username')}' emptied template trash ({count} items)")
    return {"success": True, "message": f"已永久删除 {count} 个模板", "deleted_count": count}


# ============================================================================
# 单个模板操作（restore/permanent-delete 使用固定路径段，不会与 {template_id} 冲突）
# ============================================================================


@router.post(
    "/{template_id}/restore",
    summary="恢复模板",
    description="从回收站恢复已删除的模板",
)
async def restore_template(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    success = template_manager.restore_template(template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在或未被删除: {template_id}",
            },
        )
    logger.info(f"Admin '{admin.get('username')}' restored template from trash: {template_id}")
    return {"success": True, "message": "模板已恢复"}


@router.delete(
    "/{template_id}/permanent",
    summary="永久删除模板",
    description="永久删除模板及其所有文件，此操作不可逆",
)
async def permanent_delete_template(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    try:
        success = template_manager.permanently_delete_template(template_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )
        logger.info(f"Admin '{admin.get('username')}' permanently deleted template: {template_id}")
        return {"success": True, "message": "模板已永久删除"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


# ============================================================================
# 获取模板详情（管理员，含未发布）
# ============================================================================


@router.get(
    "/{template_id}",
    summary="管理员获取模板详情",
    description="获取指定模板的详细信息（包含未发布模板）",
)
async def admin_get_template_detail(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    """管理员获取模板详情（含源文件），不限制发布状态"""
    detail = template_manager.get_template_detail(template_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                "message": f"模板不存在: {template_id}",
            },
        )
    return detail


# ============================================================================
# 创建模板（JSON 方式）
# ============================================================================


@router.post(
    "",
    response_model=TemplateMetadata,
    status_code=status.HTTP_201_CREATED,
    summary="创建模板",
    description="通过 JSON 请求体创建新模板",
)
async def create_template(
    request: TemplateCreateRequest,
    admin: dict = Depends(verify_admin_token),
):
    """
    创建模板（JSON 方式）

    请求体包含模板元数据和源代码文件列表。
    """
    try:
        metadata = template_manager.create_template(request)
        logger.info(
            f"Admin '{admin.get('username')}' created template: {metadata.template_id}"
        )
        return metadata
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.INVALID_TEMPLATE_METADATA.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


# ============================================================================
# ZIP 上传创建模板
# ============================================================================


@router.post(
    "/upload-zip",
    response_model=TemplateMetadata,
    status_code=status.HTTP_201_CREATED,
    summary="ZIP 上传创建模板",
    description="通过上传 ZIP 文件创建新模板，元数据通过表单字段提供",
)
async def upload_zip_template(
    zip_file: UploadFile = File(..., description="ZIP 文件"),
    name: str = Form(..., min_length=3, max_length=100, description="模板名称"),
    description: str = Form(..., min_length=10, max_length=2000, description="模板描述"),
    category: str = Form(..., min_length=2, max_length=50, description="分类"),
    tags: str = Form("", description="标签（逗号分隔）"),
    supported_board_ids: str = Form(..., description="支持的开发板 ID（逗号分隔）"),
    published: bool = Form(False, description="是否发布"),
    admin: dict = Depends(verify_admin_token),
):
    """
    ZIP 上传创建模板

    通过 multipart/form-data 上传 ZIP 文件和元数据。
    ZIP 文件中的 .ino, .cpp, .h, .c 文件将被提取为模板源文件。
    tags 和 supported_board_ids 使用逗号分隔的字符串格式。
    """
    # 解析 tags（逗号分隔字符串转列表）
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    # 解析 supported_board_ids（逗号分隔字符串转列表）
    board_id_list = [
        b.strip() for b in supported_board_ids.split(",") if b.strip()
    ]

    if not board_id_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.INVALID_TEMPLATE_METADATA.value,
                "message": "至少需要指定一个支持的开发板",
            },
        )

    try:
        metadata = template_manager.create_from_zip(
            zip_data=zip_file.file,
            name=name,
            description=description,
            category=category,
            tags=tag_list,
            supported_board_ids=board_id_list,
            published=published,
        )
        logger.info(
            f"Admin '{admin.get('username')}' created template from ZIP: {metadata.template_id}"
        )
        return metadata
    except ValueError as e:
        raw_msg = str(e)
        # 根据错误消息确定错误码
        if "ZIP" in raw_msg or "zip" in raw_msg:
            if "没有有效的源文件" in raw_msg:
                error_code = TemplateErrorCode.ZIP_NO_SOURCE_FILES.value
            elif "大小超过" in raw_msg:
                error_code = TemplateErrorCode.ZIP_SIZE_EXCEEDED.value
            else:
                error_code = TemplateErrorCode.INVALID_ZIP_FORMAT.value
        else:
            error_code = TemplateErrorCode.INVALID_TEMPLATE_METADATA.value

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": error_code,
                "message": sanitize_error(e, "模板创建失败"),
            },
        )


# ============================================================================
# 更新模板
# ============================================================================


@router.put(
    "/{template_id}",
    response_model=TemplateMetadata,
    summary="更新模板",
    description="更新指定模板的元数据和/或源文件（部分更新）",
)
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    admin: dict = Depends(verify_admin_token),
):
    """
    更新模板（部分更新）

    只需提供需要更新的字段，未提供的字段保持不变。
    template_id 和 created_at 不可修改。
    """
    try:
        metadata = template_manager.update_template(template_id, request)
        if metadata is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )
        logger.info(
            f"Admin '{admin.get('username')}' updated template: {template_id}"
        )
        return metadata
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.INVALID_TEMPLATE_METADATA.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


# ============================================================================
# 删除模板
# ============================================================================


@router.delete(
    "/{template_id}",
    summary="删除模板（移至回收站）",
    description="将模板移至回收站，30天内可恢复",
)
async def delete_template(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    """
    软删除模板

    模板将被移至回收站，30天内可通过 /trash 接口恢复或永久删除。
    """
    try:
        success = template_manager.delete_template(template_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )
        logger.info(
            f"Admin '{admin.get('username')}' moved template to trash: {template_id}"
        )
        return {"success": True, "message": f"模板已移至回收站"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


# ============================================================================
# 复制模板
# ============================================================================


@router.post(
    "/{template_id}/copy",
    summary="复制模板",
    description="复制指定模板及其所有源代码文件，新模板默认未发布",
)
async def copy_template(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    """复制模板"""
    try:
        new_meta = template_manager.duplicate_template(template_id)
        logger.info(f"Admin '{admin.get('username')}' copied template: {template_id} -> {new_meta.template_id}")
        return {"success": True, "template": new_meta}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": str(e)},
        )


# ============================================================================
# 切换发布状态
# ============================================================================


@router.patch(
    "/{template_id}/publish",
    response_model=TemplateMetadata,
    summary="切换发布状态",
    description="切换指定模板的发布/取消发布状态",
)
async def toggle_publish(
    template_id: str,
    published: bool = Query(..., description="目标发布状态"),
    admin: dict = Depends(verify_admin_token),
):
    """
    切换模板发布状态

    设置模板的 published 字段为指定值。
    已发布的模板对公共用户可见，未发布的模板仅管理员可见。
    """
    update_request = TemplateUpdateRequest(published=published)

    try:
        metadata = template_manager.update_template(template_id, update_request)
        if metadata is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": TemplateErrorCode.TEMPLATE_NOT_FOUND.value,
                    "message": f"模板不存在: {template_id}",
                },
            )

        action = "发布" if published else "取消发布"
        logger.info(
            f"Admin '{admin.get('username')}' {action} template: {template_id}"
        )
        return metadata
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": TemplateErrorCode.INVALID_TEMPLATE_METADATA.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


# ============================================================================
# 附件包管理（管理员）
# ============================================================================


@router.post(
    "/{template_id}/packages",
    summary="上传附件包",
    description="上传 ZIP 附件包并关联标签",
)
async def upload_package(
    template_id: str,
    file: UploadFile = File(..., description="ZIP 文件"),
    tag: str = Form(..., description="附件标签，如 3d_model / course_material"),
    filename: str = Form("", description="展示文件名"),
    admin: dict = Depends(verify_admin_token),
):
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "只支持 ZIP 格式"},
        )

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "文件大小不能超过 50MB"},
        )

    success = template_manager.upload_package(
        template_id,
        tag.strip(),
        content,
        filename.strip() or file.filename,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": f"模板不存在: {template_id}"},
        )
    return {"success": True, "message": f"附件包 {tag} 上传成功"}


@router.put(
    "/{template_id}/packages/{tag}/filename",
    summary="重命名附件包文件",
    description="修改指定附件包展示的文件名或文件夹名",
)
async def rename_package_file(
    template_id: str,
    tag: str,
    filename: str = Form(..., description="新的展示文件名"),
    admin: dict = Depends(verify_admin_token),
):
    try:
        success = template_manager.rename_package_file(template_id, tag, filename)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": sanitize_error(e, "重命名失败")},
        )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在"},
        )
    return {"success": True, "message": f"附件包 {tag} 文件名已更新"}


@router.delete(
    "/{template_id}/packages/{tag}",
    summary="删除附件包",
    description="删除指定标签的附件包",
)
async def delete_package(
    template_id: str,
    tag: str,
    admin: dict = Depends(verify_admin_token),
):
    success = template_manager.delete_package(template_id, tag)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在"},
        )
    return {"success": True, "message": f"附件包 {tag} 已删除"}


@router.put(
    "/{template_id}/packages/{tag}/rename",
    summary="重命名附件包",
    description="将指定附件包改为新的资源类型标签",
)
async def rename_package(
    template_id: str,
    tag: str,
    new_tag: str = Form(..., description="新的附件标签"),
    admin: dict = Depends(verify_admin_token),
):
    try:
        success = template_manager.rename_package(template_id, tag, new_tag.strip())
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": sanitize_error(e, "重命名失败")},
        )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模板不存在"},
        )
    return {"success": True, "message": f"附件包 {tag} 已重命名为 {new_tag}"}


@router.get(
    "/{template_id}/packages",
    summary="列出附件包",
    description="列出模板的所有附件包",
)
async def list_packages(
    template_id: str,
    admin: dict = Depends(verify_admin_token),
):
    packages = template_manager.list_packages(template_id)
    return {"success": True, "packages": packages}
