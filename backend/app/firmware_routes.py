"""
用户固件浏览路由模块

提供用户端固件浏览、搜索、筛选和下载功能（无需认证）。
"""

import logging
import zipfile
from typing import Optional, List
from pathlib import Path
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse

from .models import FirmwareMetadata, ErrorCode
from .error_utils import sanitize_error
from .firmware_manager import firmware_manager
from .ops_metrics import ops_metrics
from .learner_auth_routes import require_learner_request

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/firmware", tags=["firmware"])


# ============================================================================
# 用户固件浏览端点
# ============================================================================

@router.get(
    "",
    summary="获取已发布固件列表",
    description="获取已发布的固件包列表，支持分页、按开发板、标签和关键词筛选"
)
async def get_published_firmware(
    board_id: Optional[str] = Query(None, description="按开发板 ID 筛选"),
    tags: Optional[str] = Query(None, description="按标签筛选，多个标签用逗号分隔"),
    search: Optional[str] = Query(None, description="搜索关键词（项目名称和描述）", max_length=200),
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    page_size: int = Query(12, ge=1, le=50, description="每页数量（1-50）"),
):
    """
    获取已发布固件列表（用户视图）

    无需认证
    """
    try:
        tag_list = None
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

        result = firmware_manager.get_firmware_list(
            published_only=True,
            board_id=board_id,
            tags=tag_list,
            search=search,
            page=page,
            page_size=page_size,
        )

        logger.info(
            f"User retrieved {len(result['items'])}/{result['total_count']} firmware packages "
            f"(page={page}, page_size={page_size})"
        )
        return result

    except Exception as e:
        logger.error(f"Failed to get published firmware list: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取固件列表失败")
            }
        )


@router.get(
    "/{firmware_id}",
    response_model=FirmwareMetadata,
    summary="获取固件详情",
    description="获取指定固件包的详细信息"
)
async def get_firmware_detail(firmware_id: str):
    """
    获取固件详情
    
    - **firmware_id**: 固件 ID
    
    返回固件的完整元数据，包括：
    - 项目名称、描述、版本
    - 支持的开发板列表
    - 文件列表和大小
    - 统计信息（下载次数、烧录次数）
    
    无需认证
    
    需求: 8.1-8.9
    """
    try:
        # 获取固件详情
        firmware = firmware_manager.get_firmware_detail(firmware_id)
        
        if not firmware:
            logger.warning(f"Firmware not found: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 只返回已发布的固件
        if not firmware.published:
            logger.warning(f"Firmware not published: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        logger.info(f"Firmware detail retrieved: {firmware_id}")
        return firmware
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to get firmware detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取固件详情失败")
            }
        )


@router.get(
    "/{firmware_id}/download",
    summary="下载固件包",
    description="下载固件包的所有文件（ZIP 格式）"
)
async def download_firmware_package(
    firmware_id: str,
    _learner: tuple[dict, str] = Depends(require_learner_request),
):
    """
    下载固件包（ZIP 格式）
    
    - **firmware_id**: 固件 ID
    
    返回包含所有固件文件和元数据的 ZIP 压缩包
    文件名格式: {project_name}_v{version}.zip
    
    无需认证
    
    需求: 14.1-14.11
    技术要求:
    - 验证所有必需文件存在
    - 创建 ZIP 包含 bootloader.bin, partitions.bin, boot_app0.bin, app.bin, metadata.json
    - 使用 StreamingResponse 流式传输
    - 设置正确的 Content-Type 和 Content-Disposition 头
    - 更新下载统计
    """
    try:
        # 获取固件详情
        firmware = firmware_manager.get_firmware_detail(firmware_id)
        
        if not firmware:
            logger.warning(f"Firmware not found for download: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 只允许下载已发布的固件
        if not firmware.published:
            logger.warning(f"Attempted to download unpublished firmware: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )

        package_url = firmware_manager.get_package_url(firmware_id)
        if package_url:
            firmware_manager.update_download_statistics(firmware_id)
            return RedirectResponse(package_url, status_code=302)
        
        # 验证所有必需文件存在
        missing_files = []
        for file_info in firmware.files:
            file_path = firmware_manager.get_firmware_file_path(firmware_id, file_info.name)
            if not file_path:
                missing_files.append(file_info.name)
        
        if missing_files:
            logger.error(f"Missing firmware files for {firmware_id}: {missing_files}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FILE_NOT_FOUND.value,
                    "message": f"固件文件缺失: {', '.join(missing_files)}"
                }
            )
        
        # 创建 ZIP 文件（在内存中）
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 添加所有固件文件
            for file_info in firmware.files:
                file_path = firmware_manager.get_firmware_file_path(firmware_id, file_info.name)
                if file_path:
                    zip_file.write(file_path, arcname=file_info.name)
            
            # 添加元数据文件
            metadata_path = firmware_manager.storage_path / firmware_id / "metadata.json"
            if metadata_path.exists():
                zip_file.write(metadata_path, arcname="metadata.json")
        
        # 重置缓冲区位置
        zip_buffer.seek(0)
        
        # 更新下载统计
        firmware_manager.update_download_statistics(firmware_id)
        
        # 生成文件名
        filename = f"{firmware.project_name}_v{firmware.version}.zip"
        # 清理文件名中的特殊字符
        filename = "".join(c for c in filename if c.isalnum() or c in "._-")

        try:
            from .object_storage import object_storage
            if object_storage.enabled:
                package_key = f"firmware/{firmware_id}/{filename}"
                temp_path = firmware_manager.storage_path / firmware_id / filename
                temp_path.write_bytes(zip_buffer.getvalue())
                try:
                    object_url = object_storage.upload_file(
                        temp_path,
                        package_key,
                        content_type="application/zip",
                    )
                    firmware_manager.set_package_url(
                        firmware_id,
                        object_url,
                        package_key,
                        filename,
                        temp_path.stat().st_size,
                    )
                    logger.info(f"Firmware package uploaded to object storage: {firmware_id}")
                    return RedirectResponse(object_url, status_code=302)
                finally:
                    try:
                        temp_path.unlink()
                    except OSError:
                        pass
        except Exception as e:
            logger.warning(f"Failed to upload firmware package to object storage, falling back to streaming: {e}")
        
        logger.info(f"Firmware package downloaded: {firmware_id}")
        
        # 返回 ZIP 文件
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to download firmware package: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "固件包下载失败")
            }
        )


@router.get(
    "/{firmware_id}/files/{filename}",
    summary="下载单个固件文件",
    description="下载固件包中的单个文件"
)
async def download_firmware_file(
    firmware_id: str,
    _learner: tuple[dict, str] = Depends(require_learner_request),
):
    """
    下载单个固件文件
    
    - **firmware_id**: 固件 ID
    - **filename**: 文件名（如 bootloader.bin, app.bin）
    
    返回指定的固件文件
    
    无需认证
    
    需求: 14.1-14.11
    技术要求:
    - 使用 FileResponse 返回文件
    - 设置正确的 Content-Type (application/octet-stream)
    - 设置 Content-Disposition 头
    - 处理文件不存在的情况（404）
    - 防止路径遍历攻击
    """
    try:
        # 获取固件详情（验证固件存在且已发布）
        firmware = firmware_manager.get_firmware_detail(firmware_id)
        
        if not firmware:
            logger.warning(f"Firmware not found for file download: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 获取文件路径（包含路径遍历防护）
        file_path = firmware_manager.get_firmware_file_path(firmware_id, filename)
        
        if not file_path:
            logger.warning(f"Firmware file not found: {firmware_id}/{filename}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FILE_NOT_FOUND.value,
                    "message": f"文件不存在: {filename}"
                }
            )
        
        logger.info(f"Firmware file downloaded: {firmware_id}/{filename}")
        
        # 返回文件
        return FileResponse(
            path=file_path,
            media_type="application/octet-stream",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to download firmware file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "文件下载失败")
            }
        )


@router.get(
    "/{firmware_id}/thumbnail",
    summary="获取缩略图",
    description="获取固件包的缩略图"
)
async def get_firmware_thumbnail(firmware_id: str):
    """
    获取缩略图
    
    - **firmware_id**: 固件 ID
    
    返回固件包的缩略图（PNG 格式）
    如果缩略图不存在，返回 404
    
    无需认证
    
    需求: 13.1-13.12
    技术要求:
    - 使用 FileResponse 返回图片
    - 设置正确的 Content-Type (image/png)
    - 处理缩略图不存在的情况（404）
    """
    try:
        # 获取固件详情（验证固件存在且已发布）
        firmware = firmware_manager.get_firmware_detail(firmware_id)
        
        if not firmware:
            logger.warning(f"Firmware not found for thumbnail: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 只允许访问已发布的固件
        if not firmware.published:
            logger.warning(f"Attempted to access thumbnail of unpublished firmware: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        thumbnail_url = firmware_manager.get_thumbnail_url(firmware_id)
        if thumbnail_url:
            return RedirectResponse(thumbnail_url, status_code=302)

        # 获取缩略图路径
        thumbnail_path = firmware_manager.get_thumbnail_path(firmware_id)
        
        if not thumbnail_path:
            logger.warning(f"Thumbnail not found: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FILE_NOT_FOUND.value,
                    "message": "缩略图不存在"
                }
            )
        
        logger.info(f"Thumbnail retrieved: {firmware_id}")
        
        # 返回缩略图
        return FileResponse(
            path=thumbnail_path,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600"  # 缓存 1 小时
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to get thumbnail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取缩略图失败")
            }
        )


@router.post(
    "/{firmware_id}/flash-log",
    summary="记录烧录事件",
    description="记录固件烧录事件，用于统计烧录成功/失败次数"
)
async def log_flash_event(firmware_id: str, flash_log: dict):
    """
    记录烧录事件
    
    - **firmware_id**: 固件 ID
    - **flash_log**: 烧录日志，包含 success 字段
    
    请求体示例:
    ```json
    {
        "success": true
    }
    ```
    
    响应示例:
    ```json
    {
        "success": true,
        "message": "烧录统计已更新"
    }
    ```
    
    无需认证
    
    需求: 18.1-18.7
    技术要求:
    - 使用 FastAPI 路由器
    - 接收 JSON 请求体，包含 success (bool) 字段
    - 调用 firmware_manager.update_flash_statistics() 方法
    - 返回成功确认
    - 处理固件不存在的情况（404）
    - 无需认证（用户端公开访问）
    """
    try:
        # 验证请求体包含 success 字段
        if "success" not in flash_log:
            logger.warning(f"Flash log missing 'success' field for firmware: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": "invalid_request",
                    "message": "请求体必须包含 'success' 字段"
                }
            )
        
        success = flash_log.get("success")
        
        # 验证 success 字段是布尔值
        if not isinstance(success, bool):
            logger.warning(f"Flash log 'success' field is not boolean for firmware: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": "invalid_request",
                    "message": "'success' 字段必须是布尔值"
                }
            )
        
        # 更新烧录统计
        result = firmware_manager.update_flash_statistics(firmware_id, success)
        
        if not result:
            logger.warning(f"Firmware not found for flash log: {firmware_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        ops_metrics.record_flash(success)
        logger.info(f"Flash event logged: {firmware_id}, success={success}")
        
        return {
            "success": True,
            "message": "烧录统计已更新"
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to log flash event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "记录烧录事件失败")
            }
        )
