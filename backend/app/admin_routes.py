"""
管理员认证路由模块

提供管理员登录、登出、Token 验证和认证中间件功能。
"""

import logging
import os
import re
import json
import zipfile
import shutil
import uuid
from datetime import datetime, timezone
from io import BytesIO
import wave
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse as FastAPIJSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse, StreamingResponse

from .models import (
    AdminCredentials, AdminToken, FirmwareErrorResponse, ErrorCode,
    FirmwareMetadata, AIConfig, ASRConfig, OSSConfig
)
from .board_config import (
    BoardConfig, get_all_boards, save_board, delete_board, is_builtin_board, is_overridden, reset_board,
    save_board_order
)
from .auth_service import auth_service
from .firmware_manager import firmware_manager
from .template_manager import template_manager
from .library_manager import get_library_manager
from .ops_metrics import ops_metrics
from .security_config import cookie_secure_enabled
from .asr_service import transcribe_once, TencentASRConfig
from .object_storage import ObjectStorageConfig
from .email_service import test_email_connection
from .service_config import (
    apply_service_config_to_env,
    load_service_config,
    mask_secret,
    save_service_config,
)

logger = logging.getLogger(__name__)


from .error_utils import sanitize_error

# 创建路由器
router = APIRouter(prefix="/api/admin", tags=["admin"])

# HTTP Bearer 认证方案
security = HTTPBearer(auto_error=False)


# ============================================================================
# 认证中间件
# ============================================================================

async def verify_admin_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    认证中间件：验证 JWT token（优先 httpOnly cookie，其次 Bearer header）

    Args:
        request: FastAPI Request 对象（用于读取 cookie）
        credentials: HTTP Bearer 认证凭证

    Returns:
        包含用户信息的字典

    Raises:
        HTTPException: 如果 token 无效或过期
    """
    # 优先从 httpOnly cookie 读取 token
    token = request.cookies.get("admin_token")
    if not token and credentials:
        # 兼容旧的 Bearer header 方式
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error_code": ErrorCode.TOKEN_EXPIRED.value,
                "message": "未登录或登录已过期"
            }
        )

    # 验证 token
    user_info = auth_service.verify_token(token)

    if not user_info:
        logger.warning("Invalid or expired token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error_code": ErrorCode.TOKEN_EXPIRED.value,
                "message": "Token 已过期或无效，请重新登录"
            },
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 管理员后台角色：旧版管理接口只对 admin 角色开放（editor / viewer 只能用新后台对应模块）
    if user_info.get("role", "admin") != "admin" and not request.url.path.startswith(("/api/admin/verify", "/api/admin/logout")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "error_code": "FORBIDDEN", "message": "当前角色无权访问此功能"},
        )

    return user_info


# ============================================================================
# 认证端点
# ============================================================================

@router.post(
    "/login",
    response_model=AdminToken,
    summary="管理员登录",
    description="使用用户名和密码进行管理员登录，返回 JWT token"
)
async def admin_login(credentials: AdminCredentials):
    """
    管理员登录
    
    - **username**: 用户名 (3-50 字符)
    - **password**: 密码 (8-128 字符)
    
    返回 JWT token，有效期 24 小时
    
    错误场景:
    - 401: 用户名或密码错误
    - 429: 账户被锁定（5 次失败后锁定 30 分钟）
    """
    # 检查账户锁定（在认证之前）
    try:
        # 尝试认证
        token = auth_service.authenticate(
            credentials.username,
            credentials.password
        )
        
        if not token:
            # 认证失败
            logger.warning(f"Login failed for user: {credentials.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_CREDENTIALS.value,
                    "message": "用户名或密码错误"
                }
            )
        
        # 认证成功
        logger.info(f"Admin logged in: {credentials.username}")
        response = FastAPIJSONResponse(
            content=AdminToken(
                access_token=token,
                token_type="bearer",
                expires_in=auth_service.token_expire_hours * 3600
            ).model_dump()
        )
        # 设置 httpOnly cookie（防 XSS 窃取）
        response.set_cookie(
            key="admin_token",
            value=token,
            httponly=True,
            secure=cookie_secure_enabled(),
            samesite="lax",
            max_age=auth_service.token_expire_hours * 3600,
        )
        return response
    
    except ValueError as e:
        # 账户锁定错误
        logger.warning(f"Account locked: {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "error_code": ErrorCode.ACCOUNT_LOCKED.value,
                "message": sanitize_error(e, "操作失败，请检查输入")
            }
        )
    except HTTPException:
        # 重新抛出 HTTPException
        raise


@router.post(
    "/logout",
    summary="管理员登出",
    description="管理员登出，服务端将 token 加入黑名单使其失效"
)
async def admin_logout(
    request: Request,
    user_info: dict = Depends(verify_admin_token),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    管理员登出

    Token 将被加入服务端黑名单，httpOnly cookie 将被清除。
    """
    username = user_info.get("username")
    # 从 cookie 或 header 获取 token
    token = request.cookies.get("admin_token") or (credentials.credentials if credentials else None)
    if token:
        auth_service.revoke_token(token)
    logger.info(f"Admin logged out: {username}")

    response = FastAPIJSONResponse(
        content={"success": True, "message": "登出成功"}
    )
    response.delete_cookie(
        "admin_token",
        secure=cookie_secure_enabled(),
        samesite="lax",
    )
    return response


@router.get(
    "/verify",
    summary="验证 Token",
    description="验证 JWT token 是否有效"
)
async def verify_token(user_info: dict = Depends(verify_admin_token)):
    """
    验证 Token
    
    需要提供有效的 JWT token（通过 Authorization: Bearer <token> 头）
    
    返回用户信息和 token 过期时间
    """
    return {
        "success": True,
        "username": user_info.get("username"),
        "role": user_info.get("role", "admin"),
        "expires_at": user_info.get("exp")
    }


# ============================================================================
# 健康检查端点（无需认证）
# ============================================================================

@router.get(
    "/health",
    summary="管理员服务健康检查",
    description="检查管理员认证服务是否正常运行"
)
async def admin_health():
    """
    管理员服务健康检查
    
    返回服务状态（不暴露配置细节）
    """
    return {
        "success": True,
        "service": "admin-auth",
        "status": "ok"
    }


# ============================================================================
# 固件管理端点
# ============================================================================

@router.get(
    "/firmware",
    summary="获取所有固件",
    description="获取所有固件包列表（包括未发布的），支持筛选和分页"
)
async def get_all_firmware(
    board_id: Optional[str] = None,
    tags: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量（1-100）"),
    user_info: dict = Depends(verify_admin_token)
):
    """
    获取所有固件包列表（管理员视图）

    需要管理员认证
    """
    try:
        tag_list = tags.split(',') if tags else None

        result = firmware_manager.get_firmware_list(
            published_only=False,
            board_id=board_id,
            tags=tag_list,
            search=search,
            page=page,
            page_size=page_size,
        )

        logger.info(f"Admin retrieved {len(result['items'])}/{result['total_count']} firmware packages")
        return result

    except Exception as e:
        logger.error(f"Failed to get firmware list: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取固件列表失败")
            }
        )


@router.post(
    "/firmware",
    response_model=dict,
    summary="上传固件包",
    description="上传新的固件包（ZIP 格式）和元数据"
)
async def upload_firmware(
    zip_file: UploadFile = File(..., description="固件包 ZIP 文件"),
    project_name: str = Form(..., min_length=3, max_length=100),
    description: str = Form(..., min_length=10, max_length=2000),
    version: str = Form(..., pattern=r'^\d+\.\d+\.\d+$'),
    supported_board_ids: str = Form(..., description="支持的开发板 ID，逗号分隔"),
    tags: str = Form(default="", description="标签，逗号分隔，最多 5 个"),
    published: bool = Form(default=False),
    user_info: dict = Depends(verify_admin_token)
):
    """
    上传固件包
    
    - **zip_file**: ZIP 格式的固件包，必须包含 bootloader.bin, partitions.bin, boot_app0.bin, app.bin
    - **project_name**: 项目名称（3-100 字符）
    - **description**: 项目描述（10-2000 字符）
    - **version**: 语义化版本号（如 1.0.0）
    - **supported_board_ids**: 支持的开发板 ID，逗号分隔
    - **tags**: 标签，逗号分隔，最多 5 个（可选）
    - **published**: 是否发布（默认 false）
    
    需要管理员认证
    """
    try:
        # 解析开发板 ID 列表
        board_id_list = [bid.strip() for bid in supported_board_ids.split(',') if bid.strip()]
        if not board_id_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_METADATA.value,
                    "message": "至少需要指定一个支持的开发板 ID"
                }
            )
        
        # 解析标签列表
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        if len(tag_list) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_METADATA.value,
                    "message": "标签数量不能超过 5 个"
                }
            )
        
        # 创建元数据对象
        metadata = FirmwareMetadata(
            firmware_id="",  # 将由 firmware_manager 生成
            project_name=project_name,
            description=description,
            version=version,
            supported_board_ids=board_id_list,
            tags=tag_list,
            published=published,
            created_at=None,  # 将由 firmware_manager 设置
            files=[],  # 将由 firmware_manager 填充
            total_size=0  # 将由 firmware_manager 计算
        )
        
        # 上传固件
        firmware_id = firmware_manager.upload_firmware(zip_file, metadata)
        
        logger.info(f"Firmware uploaded by {user_info.get('username')}: {firmware_id}")
        
        return {
            "success": True,
            "firmware_id": firmware_id,
            "message": "固件包上传成功"
        }
    
    except ValueError as e:
        # 验证错误
        logger.warning(f"Firmware upload validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": ErrorCode.INVALID_METADATA.value,
                "message": sanitize_error(e, "操作失败，请检查输入")
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to upload firmware: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "固件包上传失败")
            }
        )


@router.put(
    "/firmware/{firmware_id}",
    response_model=dict,
    summary="更新固件元数据",
    description="更新固件包的元数据（不包括固件文件）"
)
async def update_firmware_metadata(
    firmware_id: str,
    project_name: str = Form(..., min_length=3, max_length=100),
    description: str = Form(..., min_length=10, max_length=2000),
    version: str = Form(..., pattern=r'^\d+\.\d+\.\d+$'),
    supported_board_ids: str = Form(..., description="支持的开发板 ID，逗号分隔"),
    tags: str = Form(default="", description="标签，逗号分隔，最多 5 个"),
    published: bool = Form(default=False),
    user_info: dict = Depends(verify_admin_token)
):
    """
    更新固件元数据
    
    - **firmware_id**: 固件 ID
    - **project_name**: 项目名称（3-100 字符）
    - **description**: 项目描述（10-2000 字符）
    - **version**: 语义化版本号（如 1.0.0）
    - **supported_board_ids**: 支持的开发板 ID，逗号分隔
    - **tags**: 标签，逗号分隔，最多 5 个（可选）
    - **published**: 是否发布
    
    需要管理员认证
    """
    try:
        # 检查固件是否存在
        existing = firmware_manager.get_firmware_detail(firmware_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 解析开发板 ID 列表
        board_id_list = [bid.strip() for bid in supported_board_ids.split(',') if bid.strip()]
        if not board_id_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_METADATA.value,
                    "message": "至少需要指定一个支持的开发板 ID"
                }
            )
        
        # 解析标签列表
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        if len(tag_list) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_METADATA.value,
                    "message": "标签数量不能超过 5 个"
                }
            )
        
        # 创建更新的元数据对象
        metadata = FirmwareMetadata(
            firmware_id=firmware_id,
            project_name=project_name,
            description=description,
            version=version,
            supported_board_ids=board_id_list,
            tags=tag_list,
            published=published,
            created_at=existing.created_at,
            files=existing.files,
            total_size=existing.total_size
        )
        
        # 更新元数据
        success = firmware_manager.update_metadata(firmware_id, metadata)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        logger.info(f"Firmware metadata updated by {user_info.get('username')}: {firmware_id}")
        
        return {
            "success": True,
            "message": "固件元数据更新成功"
        }
    
    except ValueError as e:
        # 验证错误
        logger.warning(f"Firmware metadata update validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": ErrorCode.INVALID_METADATA.value,
                "message": sanitize_error(e, "操作失败，请检查输入")
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to update firmware metadata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.METADATA_WRITE_ERROR.value,
                "message": sanitize_error(e, "更新失败")
            }
        )


@router.delete(
    "/firmware/{firmware_id}",
    response_model=dict,
    summary="删除固件包（移至回收站）",
    description="将固件包移至回收站，30天内可恢复"
)
async def delete_firmware(
    firmware_id: str,
    user_info: dict = Depends(verify_admin_token)
):
    """
    软删除固件包

    固件包将被移至回收站，30天内可恢复或永久删除。

    需要管理员认证
    """
    try:
        # 检查固件是否存在
        existing = firmware_manager.get_firmware_detail(firmware_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )

        # 软删除固件
        success = firmware_manager.delete_firmware(firmware_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )

        logger.info(f"Firmware moved to trash by {user_info.get('username')}: {firmware_id}")

        return {
            "success": True,
            "message": "固件包已移至回收站"
        }

    except ValueError as e:
        logger.warning(f"Firmware deletion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "error_code": ErrorCode.FIRMWARE_IN_USE.value,
                "message": sanitize_error(e, "操作失败，请检查输入")
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Failed to delete firmware: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "删除失败")
            }
        )


# ============================================================================
# 固件回收站
# ============================================================================


@router.post(
    "/firmware/{firmware_id}/restore",
    response_model=dict,
    summary="恢复固件包",
    description="从回收站恢复已删除的固件包",
)
async def restore_firmware(
    firmware_id: str,
    user_info: dict = Depends(verify_admin_token),
):
    success = firmware_manager.restore_firmware(firmware_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                "message": f"固件包不存在或未被删除: {firmware_id}",
            },
        )
    logger.info(f"Firmware restored from trash by {user_info.get('username')}: {firmware_id}")
    return {"success": True, "message": "固件包已恢复"}


@router.delete(
    "/firmware/{firmware_id}/permanent",
    response_model=dict,
    summary="永久删除固件包",
    description="永久删除固件包及其所有文件，此操作不可逆",
)
async def permanent_delete_firmware(
    firmware_id: str,
    user_info: dict = Depends(verify_admin_token),
):
    try:
        success = firmware_manager.permanently_delete_firmware(firmware_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}",
                },
            )
        logger.info(
            f"Firmware permanently deleted by {user_info.get('username')}: {firmware_id}"
        )
        return {"success": True, "message": "固件包已永久删除"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "操作失败"),
            },
        )


@router.get(
    "/firmware/trash",
    response_model=dict,
    summary="获取固件回收站列表",
    description="获取所有已删除的固件包",
)
async def get_firmware_trash(
    user_info: dict = Depends(verify_admin_token),
):
    trashed = firmware_manager.get_trashed_firmwares()
    return {"success": True, "items": trashed, "count": len(trashed)}


@router.post(
    "/firmware/trash/empty",
    response_model=dict,
    summary="清空固件回收站",
    description="永久删除回收站中的所有固件包",
)
async def empty_firmware_trash(
    user_info: dict = Depends(verify_admin_token),
):
    count = firmware_manager.empty_trash()
    logger.info(
        f"Firmware trash emptied by {user_info.get('username')} ({count} items)"
    )
    return {
        "success": True,
        "message": f"已永久删除 {count} 个固件包",
        "deleted_count": count,
    }


@router.post(
    "/firmware/{firmware_id}/thumbnail",
    response_model=dict,
    summary="上传缩略图",
    description="为固件包上传缩略图"
)
async def upload_firmware_thumbnail(
    firmware_id: str,
    thumbnail: UploadFile = File(..., description="缩略图文件（PNG/JPEG/WebP）"),
    user_info: dict = Depends(verify_admin_token)
):
    """
    上传缩略图
    
    - **firmware_id**: 固件 ID
    - **thumbnail**: 缩略图文件
    
    支持的格式: PNG, JPEG, WebP
    文件大小限制: 500 KB
    尺寸要求: 200x200 到 1000x1000 像素
    
    缩略图将自动调整为 400x400 以内（保持宽高比）
    
    需要管理员认证
    """
    try:
        # 检查固件是否存在
        existing = firmware_manager.get_firmware_detail(firmware_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 上传缩略图
        success = firmware_manager.upload_thumbnail(firmware_id, thumbnail)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        logger.info(f"Thumbnail uploaded by {user_info.get('username')} for firmware: {firmware_id}")
        
        return {
            "success": True,
            "message": "缩略图上传成功"
        }
    
    except ValueError as e:
        # 验证错误
        logger.warning(f"Thumbnail upload validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error_code": ErrorCode.INVALID_IMAGE_FORMAT.value,
                "message": sanitize_error(e, "操作失败，请检查输入")
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to upload thumbnail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "上传失败")
            }
        )


@router.patch(
    "/firmware/{firmware_id}/publish",
    response_model=dict,
    summary="发布/取消发布固件",
    description="切换固件包的发布状态"
)
async def toggle_firmware_publish(
    firmware_id: str,
    published: bool = Form(..., description="发布状态"),
    user_info: dict = Depends(verify_admin_token)
):
    """
    发布/取消发布固件
    
    - **firmware_id**: 固件 ID
    - **published**: 发布状态（true 为发布，false 为取消发布）
    
    需要管理员认证
    """
    try:
        # 检查固件是否存在
        existing = firmware_manager.get_firmware_detail(firmware_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 更新发布状态
        existing.published = published
        success = firmware_manager.update_metadata(firmware_id, existing)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        action = "发布" if published else "取消发布"
        logger.info(f"Firmware {action} by {user_info.get('username')}: {firmware_id}")
        
        return {
            "success": True,
            "published": published,
            "message": f"固件包已{action}"
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to toggle firmware publish status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.METADATA_WRITE_ERROR.value,
                "message": sanitize_error(e, "更新失败")
            }
        )


# ============================================================================
# 版本管理端点
# ============================================================================

@router.get(
    "/firmware/check-version",
    summary="检查版本冲突",
    description="检查指定项目名称和版本号是否已存在"
)
async def check_version_conflict(
    project_name: str,
    version: str,
    user_info: dict = Depends(verify_admin_token)
):
    """
    检查版本冲突
    
    - **project_name**: 项目名称
    - **version**: 版本号
    
    返回是否存在冲突以及冲突的固件信息
    
    需要管理员认证
    
    需求: 11.1-11.11
    """
    try:
        conflict = firmware_manager.check_version_conflict(project_name, version)
        
        if conflict:
            return {
                "success": True,
                "conflict": True,
                "message": f"版本冲突: 项目 '{project_name}' 已存在版本 {version}",
                "existing_firmware_id": conflict.firmware_id,
                "existing_version": conflict.version
            }
        
        return {
            "success": True,
            "conflict": False,
            "message": "无版本冲突"
        }
    
    except Exception as e:
        logger.error(f"Failed to check version conflict: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "检查失败")
            }
        )


@router.get(
    "/firmware/project-versions/{project_name}",
    response_model=List[FirmwareMetadata],
    summary="获取项目版本历史",
    description="获取指定项目的所有版本，按版本号降序排序"
)
async def get_project_versions(
    project_name: str,
    user_info: dict = Depends(verify_admin_token)
):
    """
    获取项目版本历史
    
    - **project_name**: 项目名称
    
    返回该项目的所有版本列表，按版本号降序排序
    
    需要管理员认证
    
    需求: 11.1-11.11
    """
    try:
        versions = firmware_manager.get_project_versions(project_name)
        
        logger.info(f"Project versions retrieved: {project_name} ({len(versions)} versions)")
        return versions
    
    except Exception as e:
        logger.error(f"Failed to get project versions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取失败")
            }
        )


# ============================================================================
# 统计端点
# ============================================================================

@router.get(
    "/statistics",
    summary="获取统计信息",
    description="获取固件管理系统的统计信息，包括固件总数、存储空间、下载/烧录次数和热门固件"
)
async def get_statistics(user_info: dict = Depends(verify_admin_token)):
    """
    获取统计信息
    
    需要提供有效的 JWT token（通过 Authorization: Bearer <token> 头）
    
    返回统计信息:
    - **total_firmwares**: 固件包总数
    - **total_size_mb**: 总存储空间使用（MB）
    - **total_downloads**: 30 天内下载次数
    - **total_flashes**: 30 天内烧录次数
    - **popular_firmwares**: 热门固件 Top 10（按下载次数）
    - **storage_warning**: 存储空间警告（使用率 > 80%）
    
    需求: 15.1-15.10, 18.1-18.7
    """
    try:
        # 获取固件、模板和运行统计信息
        firmware_stats = firmware_manager.get_statistics()
        template_stats = template_manager.get_template_statistics()
        ops_stats = ops_metrics.get_metrics()
        storage_stats = ops_metrics.get_storage_usage({
            "course_resources": template_manager.storage_path,
            "published_firmware": firmware_manager.storage_path,
            "compiled_firmware_cache": Path(os.getenv("FIRMWARE_STORAGE_PATH", "/opt/firmware")),
            "ops_data": ops_metrics.data_dir,
        })
        feedback_items = ops_metrics.list_feedback(limit=10)

        logger.info(f"Statistics retrieved by admin: {user_info.get('username')}")

        return {
            "success": True,
            "data": {
                # 固件统计
                "total_firmwares": firmware_stats["total_firmwares"],
                "total_size_mb": firmware_stats["total_size_mb"],
                "total_downloads": firmware_stats["total_downloads"],
                "total_flashes": firmware_stats["total_flashes"],
                "popular_firmwares": firmware_stats["popular_firmwares"],
                "storage_warning": firmware_stats["storage_warning"],
                # 模板统计
                "total_templates": template_stats["total_templates"],
                "published_templates": template_stats["published_templates"],
                "total_template_views": template_stats["total_views"],
                "total_template_open_projects": template_stats["total_open_projects"],
                "total_template_downloads": template_stats["total_downloads"],
                "total_template_package_downloads": template_stats["total_package_downloads"],
                "total_template_flashes": template_stats["total_flashes"],
                "total_template_unlocks": template_stats["total_unlocks"],
                "popular_templates": template_stats["popular_templates"],
                # 运行统计
                "compile_stats": ops_stats["compile"],
                "flash_stats": ops_stats["flash"],
                "storage": storage_stats,
                "recent_feedback": feedback_items,
            },
        }
    
    except Exception as e:
        logger.error(f"Failed to get statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": "获取统计信息失败"
            }
        )


@router.get("/system/status", summary="获取系统部署状态")
async def get_system_status(user_info: dict = Depends(verify_admin_token)):
    from .system_status import collect_system_status

    return {
        "success": True,
        "data": collect_system_status(),
    }


# ============================================================================
# AI 配置管理端点
# ============================================================================

@router.get(
    "/ai-config",
    summary="获取 AI 配置",
    description="获取当前的 AI API 配置（API key 会被脱敏）"
)
async def get_ai_config(user_info: dict = Depends(verify_admin_token)):
    """
    获取 AI 配置
    
    需要提供有效的 JWT token（通过 Authorization: Bearer <token> 头）
    
    返回当前的 AI API 配置，其中 API key 会被脱敏显示
    """
    try:
        # 从环境变量读取配置
        api_key = os.getenv('OPENAI_API_KEY', '')
        api_base = os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
        model = os.getenv('AI_MODEL', 'gpt-4')
        
        # 从环境变量读取 temperature 和 max_tokens（如果存在）
        temperature_str = os.getenv('AI_TEMPERATURE', '0.7')
        max_tokens_str = os.getenv('AI_MAX_TOKENS', '2000')
        
        try:
            temperature = float(temperature_str)
        except ValueError:
            temperature = 0.7
            
        try:
            max_tokens = int(max_tokens_str)
        except ValueError:
            max_tokens = 2000
        
        # 脱敏 API key（只显示前8个字符和后4个字符）
        masked_api_key = ""
        if api_key:
            if len(api_key) > 12:
                masked_api_key = api_key[:8] + "..." + api_key[-4:]
            else:
                masked_api_key = api_key[:4] + "..." if len(api_key) > 4 else "***"
        
        logger.info(f"AI config retrieved by: {user_info.get('username')}")
        
        return {
            "success": True,
            "config": {
                "api_key": masked_api_key,
                "api_base": api_base,
                "model": model,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
        }
    
    except Exception as e:
        logger.error(f"Failed to get AI config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取配置失败")
            }
        )


@router.get(
    "/service-config",
    summary="获取服务配置",
    description="获取 AI、ASR 和对象存储配置（敏感字段会被脱敏）"
)
async def get_service_config(user_info: dict = Depends(verify_admin_token)):
    try:
        config = load_service_config()
        ai = config["ai"]
        asr = config["asr"]
        oss = config["oss"]
        email = config.get("email", {})

        return {
            "success": True,
            "config": {
                "ai": {
                    "api_key": mask_secret(ai.get("api_key", "")),
                    "api_base": ai.get("api_base", "https://api.openai.com/v1"),
                    "model": ai.get("model", "gpt-4"),
                    "temperature": ai.get("temperature", 0.7),
                    "max_tokens": ai.get("max_tokens", 2000),
                },
                "asr": {
                    "enabled": asr.get("enabled", False),
                    "provider": asr.get("provider", "tencent"),
                    "secret_id": mask_secret(asr.get("secret_id", ""), 6, 4),
                    "secret_key": "",
                    "app_id": asr.get("app_id", ""),
                    "region": asr.get("region", "ap-guangzhou"),
                    "engine_model_type": asr.get("engine_model_type", "16k_zh"),
                },
                "oss": {
                    "enabled": oss.get("enabled", False),
                    "bucket": oss.get("bucket", ""),
                    "endpoint": oss.get("endpoint", ""),
                    "region": oss.get("region", "auto"),
                    "access_key_id": mask_secret(oss.get("access_key_id", ""), 6, 4),
                    "secret_access_key": "",
                    "public_base_url": oss.get("public_base_url", ""),
                    "prefix": oss.get("prefix", "makefast"),
                },
                "email": {
                    "enabled": email.get("enabled", False),
                    "smtp_host": email.get("smtp_host", ""),
                    "smtp_port": email.get("smtp_port", 465),
                    "username": email.get("username", ""),
                    "password": "",
                    "from_email": email.get("from_email", ""),
                    "from_name": email.get("from_name", "MakeFast"),
                    "use_ssl": email.get("use_ssl", True),
                    "use_tls": email.get("use_tls", False),
                },
            }
        }
    except Exception as e:
        logger.error(f"Failed to get service config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "获取服务配置失败")
            }
        )


@router.put(
    "/ai-config",
    summary="更新 AI 配置",
    description="更新 AI API 配置并测试连接"
)
async def update_ai_config(
    config: AIConfig,
    user_info: dict = Depends(verify_admin_token)
):
    """
    更新 AI 配置
    
    需要提供有效的 JWT token（通过 Authorization: Bearer <token> 头）
    
    步骤：
    1. 验证配置参数
    2. 测试 API 连接（30秒超时）
    3. 如果测试成功，更新 .env 文件
    4. 返回成功确认
    
    错误场景:
    - 400: 配置参数验证失败
    - 500: API 测试失败或 .env 文件更新失败
    """
    try:
        # 配置参数已经通过 Pydantic 模型验证
        logger.info(f"Updating AI config by: {user_info.get('username')}")
        
        # 步骤 1: 测试 API 连接
        logger.info("Testing AI API connection...")
        test_success, test_message = await _test_ai_api_connection(
            api_key=config.api_key,
            api_base=config.api_base,
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens
        )
        
        if not test_success:
            logger.warning(f"AI API test failed: {test_message}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error_code": ErrorCode.STORAGE_ERROR.value,
                    "message": f"API 测试失败：{test_message}"
                }
            )
        
        logger.info("AI API test successful")

        if os.getenv("ENV", "").lower() == "production" and os.getenv("ALLOW_RUNTIME_ENV_WRITE", "false").lower() != "true":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "success": False,
                    "error_code": ErrorCode.STORAGE_ERROR.value,
                    "message": "生产环境禁止通过后台写入 .env。请在服务器环境变量或 Secret 中修改 AI 配置后重启服务。"
                }
            )
        
        # 步骤 2: 更新 .env 文件
        logger.info("Updating .env file...")
        update_success, update_message = _update_env_file(
            api_key=config.api_key,
            api_base=config.api_base,
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens
        )
        
        if not update_success:
            logger.error(f"Failed to update .env file: {update_message}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error_code": ErrorCode.METADATA_WRITE_ERROR.value,
                    "message": f"更新配置文件失败：{update_message}"
                }
            )
        
        logger.info(f"AI config updated successfully by: {user_info.get('username')}")
        
        return {
            "success": True,
            "message": "AI 配置更新成功",
            "test_result": test_message
        }
    
    except HTTPException:
        # 重新抛出 HTTPException
        raise
    except Exception as e:
        logger.error(f"Failed to update AI config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "更新配置失败")
            }
        )


@router.put(
    "/service-config",
    summary="更新服务配置",
    description="更新 AI、ASR 和对象存储配置"
)
async def update_service_config(
    payload: dict,
    user_info: dict = Depends(verify_admin_token)
):
    try:
        ai = payload.get("ai") or {}
        asr = payload.get("asr") or {}
        oss = payload.get("oss") or {}
        email = payload.get("email") or {}
        save_service_config({"ai": ai, "asr": asr, "oss": oss, "email": email})

        return {"success": True, "message": "服务配置更新成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update service config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "更新服务配置失败")
            }
        )


@router.post(
    "/service-config/test",
    summary="测试服务连接",
    description="测试 AI、ASR 或对象存储连接"
)
async def test_service_config(
    payload: dict,
    user_info: dict = Depends(verify_admin_token)
):
    try:
        service = (payload.get("service") or "").strip().lower()
        config = payload.get("config") or {}
        if service == "ai":
            ok, message = await _test_service_ai_connection(config)
        elif service == "asr":
            ok, message = await _test_service_asr_connection(config)
        elif service == "oss":
            ok, message = await _test_service_oss_connection(config)
        elif service == "email":
            ok, message = test_email_connection(config)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_REQUEST.value,
                    "message": "未知的服务类型"
                }
            )
        return {"success": ok, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test service config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "测试连接失败")
            }
        )


# ============================================================================
# AI 配置辅助函数
# ============================================================================

async def _test_ai_api_connection(
    api_key: str,
    api_base: str,
    model: str,
    temperature: float,
    max_tokens: int
) -> tuple[bool, str]:
    """
    测试 AI API 连接
    
    Args:
        api_key: API 密钥
        api_base: API 基础 URL
        model: 模型名称
        temperature: 温度参数
        max_tokens: 最大 token 数
    
    Returns:
        (成功标志, 消息)
    """
    try:
        import httpx
        
        # 构建 API URL
        api_url = f"{api_base}/chat/completions"
        
        # 构建测试请求
        test_messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, this is a test message. Please respond with 'OK'."}
        ]
        
        # 发送测试请求（30秒超时）
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": test_messages,
                    "temperature": temperature,
                    "max_tokens": min(max_tokens, 100)  # 测试时只用少量 tokens
                },
                timeout=30.0
            )
            
            # 检查响应状态
            if response.status_code == 200:
                data = response.json()
                # 验证响应格式
                if 'choices' in data and len(data['choices']) > 0:
                    return True, "API 连接测试成功"
                else:
                    return False, "API 响应格式不正确"
            elif response.status_code == 401:
                return False, "API 密钥无效或已过期"
            elif response.status_code == 404:
                return False, f"模型 '{model}' 不存在或 API URL 不正确"
            elif response.status_code == 429:
                return False, "API 请求频率超限，请稍后再试"
            else:
                logger.warning(f"AI API returned error {response.status_code}: {response.text[:200]}")
                return False, f"API 返回错误，状态码: {response.status_code}"
    
    except httpx.TimeoutException:
        return False, "API 请求超时（30秒），请检查网络连接或 API URL"
    except httpx.ConnectError:
        return False, "无法连接到 API 服务器，请检查 API URL 是否正确"
    except ImportError:
        return False, "缺少 httpx 库，无法测试 API 连接"
    except Exception as e:
        return False, sanitize_error(e, "API 连接测试失败")


# ============================================================================
# 固件包导入导出端点
# ============================================================================

@router.get(
    "/firmware/{firmware_id}/export",
    summary="导出固件包",
    description="导出固件包为 ZIP 文件，包含固件二进制文件、metadata.json 和缩略图（如果有）"
)
async def export_firmware(
    firmware_id: str,
    user_info: dict = Depends(verify_admin_token)
):
    """
    导出固件包
    
    - **firmware_id**: 固件 ID
    
    创建包含固件二进制文件、metadata.json 和缩略图的 ZIP 文件
    
    需要管理员认证
    
    需求: 19.1-19.3
    """
    try:
        # 检查固件是否存在
        existing = firmware_manager.get_firmware_detail(firmware_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FIRMWARE_NOT_FOUND.value,
                    "message": f"固件包不存在: {firmware_id}"
                }
            )
        
        # 获取固件目录
        firmware_dir = firmware_manager.storage_path / firmware_id
        
        # 创建 ZIP 文件到内存
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 添加 metadata.json
            metadata_path = firmware_dir / "metadata.json"
            if metadata_path.exists():
                zf.write(metadata_path, "metadata.json")
            
            # 添加固件二进制文件
            for file_info in existing.files:
                file_path = firmware_dir / file_info.name
                if file_path.exists():
                    zf.write(file_path, file_info.name)
            
            # 添加缩略图（如果存在）
            thumbnail_path = firmware_dir / "thumbnail.png"
            if thumbnail_path.exists():
                zf.write(thumbnail_path, "thumbnail.png")
        
        zip_buffer.seek(0)
        
        # 生成文件名
        safe_name = re.sub(r'[^\w\-.]', '_', existing.project_name)
        filename = f"{safe_name}_v{existing.version}.zip"
        
        logger.info(f"Firmware exported by {user_info.get('username')}: {firmware_id}")
        
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
        logger.error(f"Failed to export firmware {firmware_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "导出失败")
            }
        )


@router.post(
    "/firmware/import",
    response_model=dict,
    summary="导入固件包",
    description="从 ZIP 文件导入固件包，支持版本冲突检测"
)
async def import_firmware(
    zip_file: UploadFile = File(..., description="固件包 ZIP 文件"),
    overwrite: bool = Form(default=False, description="是否覆盖已存在的同名同版本固件"),
    user_info: dict = Depends(verify_admin_token)
):
    """
    导入固件包
    
    - **zip_file**: ZIP 格式的固件包，必须包含 metadata.json 和至少一个固件二进制文件
    - **overwrite**: 如果存在同名同版本固件，是否覆盖（默认 false）
    
    导入流程:
    1. 验证 ZIP 文件大小（不超过 100 MB）
    2. 验证 ZIP 文件格式
    3. 提取并验证 metadata.json
    4. 验证固件二进制文件存在
    5. 检测版本冲突
    6. 存储固件包
    
    需要管理员认证
    
    需求: 19.4-19.15
    """
    try:
        # 1. 读取 ZIP 文件内容
        zip_content = await zip_file.read()
        
        # 2. 验证文件大小（不超过 100 MB）
        max_import_size = 100 * 1024 * 1024  # 100 MB
        if len(zip_content) > max_import_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.FILE_SIZE_EXCEEDED.value,
                    "message": f"ZIP 文件大小超过限制: {len(zip_content) / (1024*1024):.2f} MB > 100 MB"
                }
            )
        
        # 3. 验证是否为有效的 ZIP 文件
        if not zipfile.is_zipfile(BytesIO(zip_content)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error_code": ErrorCode.INVALID_ZIP_FORMAT.value,
                    "message": "上传的文件不是有效的 ZIP 格式"
                }
            )
        
        # 4. 打开 ZIP 文件并验证内容
        with zipfile.ZipFile(BytesIO(zip_content), 'r') as zf:
            zip_files = zf.namelist()
            
            # 验证 metadata.json 存在
            if "metadata.json" not in zip_files:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "error_code": ErrorCode.INVALID_METADATA.value,
                        "message": "ZIP 文件缺少 metadata.json"
                    }
                )
            
            # 读取并验证 metadata.json
            try:
                metadata_content = zf.read("metadata.json")
                metadata_dict = json.loads(metadata_content.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "error_code": ErrorCode.INVALID_METADATA.value,
                        "message": sanitize_error(e, "metadata.json 格式无效")
                    }
                )
            
            # 验证 metadata.json 必需字段
            required_fields = ["project_name", "version"]
            missing_fields = [f for f in required_fields if f not in metadata_dict]
            if missing_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "error_code": ErrorCode.INVALID_METADATA.value,
                        "message": f"metadata.json 缺少必需字段: {', '.join(missing_fields)}"
                    }
                )
            
            # 检查解压后总大小，防止 ZIP 炸弹
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            max_uncompressed_import = 200 * 1024 * 1024  # 200MB
            if total_uncompressed > max_uncompressed_import:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "error_code": ErrorCode.FILE_SIZE_EXCEEDED.value,
                        "message": f"ZIP 解压后大小 ({total_uncompressed / 1024 / 1024:.1f}MB) 超过限制 (200MB)"
                    }
                )

            # 验证至少有一个固件二进制文件
            bin_files = [f for f in zip_files if f.endswith('.bin')]
            if not bin_files:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "success": False,
                        "error_code": ErrorCode.MISSING_REQUIRED_FILES.value,
                        "message": "ZIP 文件中没有固件二进制文件 (.bin)"
                    }
                )
            
            # 5. 检测版本冲突
            project_name = metadata_dict.get("project_name", "")
            version = metadata_dict.get("version", "")
            
            existing_firmware = None
            all_firmwares = firmware_manager._get_all_firmwares_cached()
            for fw in all_firmwares:
                if fw.project_name == project_name and fw.version == version:
                    existing_firmware = fw
                    break
            
            if existing_firmware and not overwrite:
                # 返回冲突信息，让前端显示确认对话框
                return {
                    "success": False,
                    "conflict": True,
                    "message": f"固件包 '{project_name}' v{version} 已存在",
                    "existing_firmware_id": existing_firmware.firmware_id,
                    "project_name": project_name,
                    "version": version
                }
            
            # 6. 如果覆盖，删除已有固件
            if existing_firmware and overwrite:
                firmware_manager.delete_firmware(existing_firmware.firmware_id)
                logger.info(f"Overwriting existing firmware: {existing_firmware.firmware_id}")
            
            # 7. 生成新的 firmware_id 并创建目录
            new_firmware_id = uuid.uuid4().hex
            firmware_dir = firmware_manager.storage_path / new_firmware_id
            firmware_dir.mkdir(parents=True, exist_ok=False)
            
            try:
                # 8. 解压文件到固件目录
                firmware_files_info = []
                
                for filename in zip_files:
                    # 跳过目录
                    if filename.endswith('/'):
                        continue
                    
                    # 防止路径遍历
                    if '..' in filename or filename.startswith('/'):
                        continue
                    
                    # 只提取根级别的文件（不含子目录）
                    if '/' in filename:
                        continue
                    
                    # 解压文件
                    file_data = zf.read(filename)
                    file_path = firmware_dir / filename
                    with open(file_path, 'wb') as f:
                        f.write(file_data)
                    
                    # 记录 .bin 文件信息
                    if filename.endswith('.bin'):
                        address, role = firmware_manager._get_file_address_and_role(filename)
                        firmware_files_info.append({
                            "name": filename,
                            "size": len(file_data),
                            "address": address,
                            "role": role
                        })
                
                # 9. 更新 metadata.json 中的 firmware_id 和时间戳
                metadata_dict["firmware_id"] = new_firmware_id
                metadata_dict["created_at"] = metadata_dict.get("created_at", datetime.now(timezone.utc).isoformat())
                metadata_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
                
                # 更新文件信息
                if firmware_files_info:
                    metadata_dict["files"] = firmware_files_info
                    metadata_dict["total_size"] = sum(f["size"] for f in firmware_files_info)
                
                # 确保必需字段存在
                if "supported_board_ids" not in metadata_dict:
                    metadata_dict["supported_board_ids"] = ["esp32dev"]
                if "description" not in metadata_dict:
                    metadata_dict["description"] = f"导入的固件包: {project_name}"
                if "tags" not in metadata_dict:
                    metadata_dict["tags"] = []
                if "published" not in metadata_dict:
                    metadata_dict["published"] = False
                if "has_thumbnail" not in metadata_dict:
                    # 检查是否有缩略图
                    metadata_dict["has_thumbnail"] = (firmware_dir / "thumbnail.png").exists()
                
                # 保存更新后的 metadata.json
                metadata_path = firmware_dir / "metadata.json"
                with open(metadata_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata_dict, f, ensure_ascii=False, indent=2, default=str)
                
                logger.info(f"Firmware imported by {user_info.get('username')}: {new_firmware_id} ({project_name} v{version})")
                
                return {
                    "success": True,
                    "firmware_id": new_firmware_id,
                    "project_name": project_name,
                    "version": version,
                    "message": f"固件包导入成功: {project_name} v{version}"
                }
            
            except Exception as e:
                # 清理部分导入的文件
                if firmware_dir.exists():
                    shutil.rmtree(firmware_dir)
                raise
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Failed to import firmware: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error_code": ErrorCode.STORAGE_ERROR.value,
                "message": sanitize_error(e, "导入失败")
            }
        )


def _update_env_file(
    api_key: str,
    api_base: str,
    model: str,
    temperature: float,
    max_tokens: int
) -> tuple[bool, str]:
    """
    更新 .env 文件中的 AI 配置
    
    Args:
        api_key: API 密钥
        api_base: API 基础 URL
        model: 模型名称
        temperature: 温度参数
        max_tokens: 最大 token 数
    
    Returns:
        (成功标志, 消息)
    """
    try:
        # 获取 .env 文件路径
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        env_path = os.path.abspath(env_path)
        
        # 检查文件是否存在
        if not os.path.exists(env_path):
            return False, f".env 文件不存在：{env_path}"
        
        # 读取现有内容
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # 更新配置项
        updated_lines = []
        keys_to_update = {
            'OPENAI_API_KEY': api_key,
            'OPENAI_API_BASE': api_base,
            'AI_MODEL': model,
            'AI_TEMPERATURE': str(temperature),
            'AI_MAX_TOKENS': str(max_tokens)
        }
        keys_found = set()
        
        for line in lines:
            # 跳过空行和注释
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                updated_lines.append(line)
                continue
            
            # 检查是否是要更新的配置项
            updated = False
            for key, value in keys_to_update.items():
                if line.startswith(f"{key}="):
                    updated_lines.append(f"{key}={value}\n")
                    keys_found.add(key)
                    updated = True
                    break
            
            if not updated:
                updated_lines.append(line)
        
        # 添加缺失的配置项
        for key, value in keys_to_update.items():
            if key not in keys_found:
                updated_lines.append(f"{key}={value}\n")
        
        # 写入更新后的内容（原子写入）
        temp_path = env_path + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)
        
        # 原子替换
        os.replace(temp_path, env_path)
        
        # 更新当前进程的环境变量
        os.environ['OPENAI_API_KEY'] = api_key
        os.environ['OPENAI_API_BASE'] = api_base
        os.environ['AI_MODEL'] = model
        os.environ['AI_TEMPERATURE'] = str(temperature)
        os.environ['AI_MAX_TOKENS'] = str(max_tokens)
        
        return True, "配置文件更新成功"
    
    except Exception as e:
        return False, sanitize_error(e, "更新配置文件失败")


def _update_service_env_file(ai: dict, asr: dict, oss: dict) -> tuple[bool, str]:
    """更新 .env 文件中的 AI/ASR/OSS 配置。"""
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
        if not os.path.exists(env_path):
            return False, f".env 文件不存在：{env_path}"

        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        keys_to_update = {
            'OPENAI_API_KEY': ai.get('api_key', ''),
            'OPENAI_API_BASE': ai.get('api_base', ''),
            'AI_MODEL': ai.get('model', ''),
            'AI_TEMPERATURE': str(ai.get('temperature', 0.7)),
            'AI_MAX_TOKENS': str(ai.get('max_tokens', 2000)),
            'TENCENT_ASR_ENABLED': 'true' if asr.get('enabled') else 'false',
            'TENCENT_ASR_SECRET_ID': asr.get('secret_id', ''),
            'TENCENT_ASR_SECRET_KEY': asr.get('secret_key', ''),
            'TENCENT_ASR_APP_ID': asr.get('app_id', ''),
            'TENCENT_ASR_REGION': asr.get('region', 'ap-guangzhou'),
            'TENCENT_ASR_ENGINE_MODEL_TYPE': asr.get('engine_model_type', '16k_zh'),
            'OBJECT_STORAGE_ENABLED': 'true' if oss.get('enabled') else 'false',
            'OBJECT_STORAGE_BUCKET': oss.get('bucket', ''),
            'OBJECT_STORAGE_ENDPOINT': oss.get('endpoint', ''),
            'OBJECT_STORAGE_REGION': oss.get('region', 'auto'),
            'OBJECT_STORAGE_ACCESS_KEY_ID': oss.get('access_key_id', ''),
            'OBJECT_STORAGE_SECRET_ACCESS_KEY': oss.get('secret_access_key', ''),
            'OBJECT_STORAGE_PUBLIC_BASE_URL': oss.get('public_base_url', ''),
            'OBJECT_STORAGE_PREFIX': oss.get('prefix', 'makefast'),
        }

        updated_lines = []
        keys_found = set()
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                updated_lines.append(line)
                continue

            updated = False
            for key, value in keys_to_update.items():
                if line.startswith(f"{key}="):
                    updated_lines.append(f"{key}={value}\n")
                    keys_found.add(key)
                    updated = True
                    break
            if not updated:
                updated_lines.append(line)

        for key, value in keys_to_update.items():
            if key not in keys_found:
                updated_lines.append(f"{key}={value}\n")

        temp_path = env_path + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)
        os.replace(temp_path, env_path)

        os.environ.update({
            'OPENAI_API_KEY': keys_to_update['OPENAI_API_KEY'],
            'OPENAI_API_BASE': keys_to_update['OPENAI_API_BASE'],
            'AI_MODEL': keys_to_update['AI_MODEL'],
            'AI_TEMPERATURE': keys_to_update['AI_TEMPERATURE'],
            'AI_MAX_TOKENS': keys_to_update['AI_MAX_TOKENS'],
            'TENCENT_ASR_ENABLED': keys_to_update['TENCENT_ASR_ENABLED'],
            'TENCENT_ASR_SECRET_ID': keys_to_update['TENCENT_ASR_SECRET_ID'],
            'TENCENT_ASR_SECRET_KEY': keys_to_update['TENCENT_ASR_SECRET_KEY'],
            'TENCENT_ASR_APP_ID': keys_to_update['TENCENT_ASR_APP_ID'],
            'TENCENT_ASR_REGION': keys_to_update['TENCENT_ASR_REGION'],
            'TENCENT_ASR_ENGINE_MODEL_TYPE': keys_to_update['TENCENT_ASR_ENGINE_MODEL_TYPE'],
            'OBJECT_STORAGE_ENABLED': keys_to_update['OBJECT_STORAGE_ENABLED'],
            'OBJECT_STORAGE_BUCKET': keys_to_update['OBJECT_STORAGE_BUCKET'],
            'OBJECT_STORAGE_ENDPOINT': keys_to_update['OBJECT_STORAGE_ENDPOINT'],
            'OBJECT_STORAGE_REGION': keys_to_update['OBJECT_STORAGE_REGION'],
            'OBJECT_STORAGE_ACCESS_KEY_ID': keys_to_update['OBJECT_STORAGE_ACCESS_KEY_ID'],
            'OBJECT_STORAGE_SECRET_ACCESS_KEY': keys_to_update['OBJECT_STORAGE_SECRET_ACCESS_KEY'],
            'OBJECT_STORAGE_PUBLIC_BASE_URL': keys_to_update['OBJECT_STORAGE_PUBLIC_BASE_URL'],
            'OBJECT_STORAGE_PREFIX': keys_to_update['OBJECT_STORAGE_PREFIX'],
        })

        return True, "配置文件更新成功"
    except Exception as e:
        return False, sanitize_error(e, "更新配置文件失败")


def _merge_service_env(service: str, payload: dict) -> dict:
    apply_service_config_to_env()
    if service == "ai":
        return {
            "api_key": payload.get("api_key") or os.getenv("OPENAI_API_KEY", ""),
            "api_base": payload.get("api_base") or os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1"),
            "model": payload.get("model") or os.getenv("AI_MODEL", "gpt-4"),
            "temperature": payload.get("temperature", float(os.getenv("AI_TEMPERATURE", "0.7"))),
            "max_tokens": payload.get("max_tokens", int(os.getenv("AI_MAX_TOKENS", "2000"))),
        }
    if service == "asr":
        return {
            "enabled": bool(payload.get("enabled", os.getenv("TENCENT_ASR_ENABLED", "false").lower() == "true")),
            "secret_id": payload.get("secret_id") or os.getenv("TENCENT_ASR_SECRET_ID", ""),
            "secret_key": payload.get("secret_key") or os.getenv("TENCENT_ASR_SECRET_KEY", ""),
            "app_id": payload.get("app_id") or os.getenv("TENCENT_ASR_APP_ID", ""),
            "region": payload.get("region") or os.getenv("TENCENT_ASR_REGION", "ap-guangzhou"),
            "engine_model_type": payload.get("engine_model_type") or os.getenv("TENCENT_ASR_ENGINE_MODEL_TYPE", "16k_zh"),
        }
    return {
        "enabled": bool(payload.get("enabled", os.getenv("OBJECT_STORAGE_ENABLED", "false").lower() == "true")),
        "bucket": payload.get("bucket") or os.getenv("OBJECT_STORAGE_BUCKET", ""),
        "endpoint": payload.get("endpoint") or os.getenv("OBJECT_STORAGE_ENDPOINT", ""),
        "region": payload.get("region") or os.getenv("OBJECT_STORAGE_REGION", "auto"),
        "access_key_id": payload.get("access_key_id") or os.getenv("OBJECT_STORAGE_ACCESS_KEY_ID", ""),
        "secret_access_key": payload.get("secret_access_key") or os.getenv("OBJECT_STORAGE_SECRET_ACCESS_KEY", ""),
        "public_base_url": payload.get("public_base_url") or os.getenv("OBJECT_STORAGE_PUBLIC_BASE_URL", ""),
        "prefix": payload.get("prefix") or os.getenv("OBJECT_STORAGE_PREFIX", "makefast"),
    }


async def _test_service_ai_connection(config: dict) -> tuple[bool, str]:
    merged = _merge_service_env("ai", config)
    return await _test_ai_api_connection(
        api_key=merged["api_key"],
        api_base=merged["api_base"],
        model=merged["model"],
        temperature=float(merged["temperature"]),
        max_tokens=int(merged["max_tokens"]),
    )


def _build_silence_wav(duration_ms: int = 900, sample_rate: int = 16000) -> bytes:
    buf = BytesIO()
    frames = int(sample_rate * duration_ms / 1000)
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frames)
    return buf.getvalue()


async def _test_service_asr_connection(config: dict) -> tuple[bool, str]:
    merged = _merge_service_env("asr", config)
    if not merged["enabled"]:
        return False, "语音识别未启用"

    try:
        from .asr_service import TencentASRConfig, transcribe_once

        test_cfg = TencentASRConfig(
            enabled=True,
            secret_id=merged["secret_id"],
            secret_key=merged["secret_key"],
            app_id=merged["app_id"],
            region=merged["region"],
            engine_model_type=merged["engine_model_type"],
        )
        test_cfg.validate()
        os.environ.update({
            "TENCENT_ASR_ENABLED": "true",
            "TENCENT_ASR_SECRET_ID": test_cfg.secret_id,
            "TENCENT_ASR_SECRET_KEY": test_cfg.secret_key,
            "TENCENT_ASR_APP_ID": test_cfg.app_id,
            "TENCENT_ASR_REGION": test_cfg.region,
            "TENCENT_ASR_ENGINE_MODEL_TYPE": test_cfg.engine_model_type,
        })
        await transcribe_once(_build_silence_wav(), "audio/wav", "test.wav")
        return True, "ASR 连接测试成功"
    except Exception as e:
        logger.warning(f"ASR connection test failed: {e}")
        return False, f"ASR 连接测试失败：{e}"


async def _test_service_oss_connection(config: dict) -> tuple[bool, str]:
    merged = _merge_service_env("oss", config)
    if not merged["enabled"]:
        return False, "对象存储未启用"

    try:
        import boto3
        client = boto3.client(
            "s3",
            endpoint_url=merged["endpoint"],
            region_name=merged["region"],
            aws_access_key_id=merged["access_key_id"],
            aws_secret_access_key=merged["secret_access_key"],
        )
        client.head_bucket(Bucket=merged["bucket"])
        return True, "对象存储连接测试成功"
    except Exception as e:
        logger.warning(f"OSS connection test failed: {e}")
        return False, sanitize_error(e, "对象存储连接测试失败")


# ============================================================================
# 库管理端点（管理员）
# ============================================================================


@router.get(
    "/libraries",
    summary="获取已安装库列表",
    description="获取 Arduino CLI 已安装的所有库",
)
async def get_installed_libraries(admin: dict = Depends(verify_admin_token)):
    """获取已安装库列表"""
    try:
        lib_manager = get_library_manager()
        libs = lib_manager.get_installed_libraries()
        return {"success": True, "libraries": libs}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": sanitize_error(e, "获取库列表失败")},
        )


from pydantic import BaseModel


class InstallLibraryRequest(BaseModel):
    name: str


@router.get(
    "/libraries/conflicts",
    summary="检测库冲突",
    description="扫描已安装库，检测哪些头文件被多个库提供",
)
async def detect_library_conflicts(admin: dict = Depends(verify_admin_token)):
    """检测库冲突 —— 例如 AsyncTCP.h 同时被旧版 AsyncTCP 和新版 Async TCP 提供"""
    try:
        search_dirs = [
            Path(os.getenv("ARDUINO_LIBRARIES_DIR", "/opt/libraries/arduino")) / "libraries",
            Path(os.getenv("ARDUINO_DATA_DIR", "/opt/libraries/arduino15")) / "libraries",
        ]
        header_map: dict[str, list[str]] = {}  # header_name → [lib_names]

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue
            for entry in search_dir.iterdir():
                if not entry.is_dir():
                    continue
                lib_name = entry.name
                # 扫描 src/ 和根目录下的 .h 文件
                for src_dir in [entry / "src", entry]:
                    if not src_dir.exists():
                        continue
                    for hf in src_dir.rglob("*.h"):
                        hname = hf.name
                        if hname not in header_map:
                            header_map[hname] = []
                        if lib_name not in header_map[hname]:
                            header_map[hname].append(lib_name)

        conflicts = {h: libs for h, libs in header_map.items() if len(libs) > 1}
        return {"success": True, "conflicts": conflicts, "total_headers": len(header_map)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": sanitize_error(e, "检测失败")},
        )


@router.post(
    "/libraries/install",
    summary="在线安装库",
    description="通过 arduino-cli lib install 在线安装 Arduino 库",
)
async def install_library(
    request: InstallLibraryRequest,
    admin: dict = Depends(verify_admin_token),
):
    """在线安装 Arduino 库"""
    name = request.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "库名不能为空"},
        )

    try:
        lib_manager = get_library_manager()
        installed = lib_manager.download_library(name)
        installed_name = installed.get("name") or name
        logger.info(f"Admin '{admin.get('username')}' installed library: {installed_name}")
        return {
            "success": True,
            "message": f"库 {installed_name} 安装成功",
            "name": installed_name,
            "version": installed.get("version", ""),
        }
    except Exception as e:
        logger.error(f"Library install failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": sanitize_error(e, "库安装失败")},
        )


@router.delete(
    "/libraries/{name}",
    summary="卸载库",
    description="通过 arduino-cli lib uninstall 卸载 Arduino 库",
)
async def uninstall_library(
    name: str,
    admin: dict = Depends(verify_admin_token),
):
    """卸载 Arduino 库"""
    try:
        lib_manager = get_library_manager()
        ok = lib_manager.clear_cache(name)
        if not ok:
            raise Exception(f"卸载库 {name} 失败")
        logger.info(f"Admin '{admin.get('username')}' uninstalled library: {name}")
        return {"success": True, "message": f"库 {name} 已卸载"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": sanitize_error(e, "库卸载失败")},
        )


# ============================================================================
# 自定义库管理（管理员）
# ============================================================================

CUSTOM_LIBS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "custom_libraries.json")
CUSTOM_LIBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "custom_libraries")
os.makedirs(CUSTOM_LIBS_DIR, exist_ok=True)


def _load_custom_libs():
    if os.path.exists(CUSTOM_LIBS_FILE):
        try:
            with open(CUSTOM_LIBS_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_custom_libs(data):
    with open(CUSTOM_LIBS_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.post(
    "/libraries/custom",
    summary="上传自定义库",
    description="管理员上传自定义库 ZIP 并记录到列表",
)
async def upload_custom_library(
    file: UploadFile = File(...),
    name: str = Form(""),
    admin: dict = Depends(verify_admin_token),
):
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail={"success": False, "message": "只支持 ZIP 格式"})

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"success": False, "message": "文件大小不能超过 10MB"})

    lib_name = (name.strip() or Path(file.filename).stem).strip()
    lib_manager = get_library_manager()
    if not lib_name or not lib_manager.validate_library_name(lib_name):
        raise HTTPException(status_code=400, detail={"success": False, "message": "库名称不合法"})

    # 校验 ZIP 有效性
    try:
        with zipfile.ZipFile(BytesIO(content), 'r') as zf:
            names = zf.namelist()
            has_source = any(
                n.endswith(('.h', '.hpp', '.c', '.cpp', '.ino'))
                for n in names if not n.endswith('/')
            )
            if not has_source:
                raise HTTPException(status_code=400, detail={"success": False, "message": "ZIP 中没有找到 .h/.cpp 等库文件"})
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            if total_uncompressed > 50 * 1024 * 1024:
                raise HTTPException(status_code=400, detail={"success": False, "message": f"解压后大小 ({total_uncompressed / 1024 / 1024:.1f}MB) 超过限制 (50MB)"})
            if len(names) > 500:
                raise HTTPException(status_code=400, detail={"success": False, "message": f"ZIP 文件数量 ({len(names)}) 超过限制 (500)"})
    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail={"success": False, "message": "无效的 ZIP 文件"})

    # Save the ZIP file
    zip_path = os.path.join(CUSTOM_LIBS_DIR, f"{lib_name}.zip")
    with open(zip_path, 'wb') as f:
        f.write(content)

    # Store the ZIP reference
    libs = _load_custom_libs()
    existing = next((l for l in libs if l["name"] == lib_name), None)
    if existing:
        libs.remove(existing)
    libs.append({
        "name": lib_name,
        "filename": file.filename,
        "size": len(content),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _save_custom_libs(libs)

    logger.info(f"Admin '{admin.get('username')}' uploaded custom library: {lib_name}")
    return {"success": True, "message": f"自定义库 {lib_name} 已添加"}


@router.delete(
    "/libraries/custom/{name}",
    summary="删除自定义库",
    description="管理员删除自定义库",
)
async def delete_custom_library(
    name: str,
    admin: dict = Depends(verify_admin_token),
):
    if not get_library_manager().validate_library_name(name):
        raise HTTPException(status_code=400, detail={"success": False, "message": "库名称不合法"})
    libs = _load_custom_libs()
    new_libs = [l for l in libs if l["name"] != name]
    if len(new_libs) == len(libs):
        raise HTTPException(status_code=404, detail={"success": False, "message": f"自定义库 {name} 不存在"})
    _save_custom_libs(new_libs)
    zip_path = os.path.join(CUSTOM_LIBS_DIR, f"{name}.zip")
    if os.path.exists(zip_path):
        os.remove(zip_path)
    logger.info(f"Admin '{admin.get('username')}' deleted custom library: {name}")
    return {"success": True, "message": f"自定义库 {name} 已删除"}


# ============================================================================
# 自定义积木管理（管理员）
# ============================================================================

CUSTOM_BLOCKS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "custom_blocks.json")


def _load_custom_blocks():
    if os.path.exists(CUSTOM_BLOCKS_FILE):
        try:
            with open(CUSTOM_BLOCKS_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_custom_blocks(data):
    with open(CUSTOM_BLOCKS_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get(
    "/blocks",
    summary="获取自定义积木列表",
    description="管理员获取所有自定义积木",
)
async def get_custom_blocks(admin: dict = Depends(verify_admin_token)):
    blocks = _load_custom_blocks()
    return {"success": True, "blocks": blocks}


class CustomBlockRequest(BaseModel):
    name: str
    category: str
    json_definition: dict  # Blockly JSON block definition
    generator_code: str  # JavaScript generator function body


@router.post(
    "/blocks",
    summary="创建/更新自定义积木",
    description="管理员创建或更新自定义积木（同名则覆盖）",
)
async def save_custom_block(request: CustomBlockRequest, admin: dict = Depends(verify_admin_token)):
    if not request.name or not request.category:
        raise HTTPException(status_code=400, detail={"success": False, "message": "积木名称和分类不能为空"})

    blocks = _load_custom_blocks()
    existing = next((b for b in blocks if b["name"] == request.name), None)
    if existing:
        existing["category"] = request.category
        existing["json_definition"] = request.json_definition
        existing["generator_code"] = request.generator_code
        _save_custom_blocks(blocks)
        logger.info(f"Admin '{admin.get('username')}' updated custom block: {request.name}")
        return {"success": True, "message": f"积木 {request.name} 已更新"}
    else:
        blocks.append({
            "name": request.name,
            "category": request.category,
            "json_definition": request.json_definition,
            "generator_code": request.generator_code,
        })
        _save_custom_blocks(blocks)
        logger.info(f"Admin '{admin.get('username')}' created custom block: {request.name}")
        return {"success": True, "message": f"积木 {request.name} 已创建"}


@router.delete(
    "/blocks/{name}",
    summary="删除自定义积木",
    description="管理员删除自定义积木",
)
async def delete_custom_block(name: str, admin: dict = Depends(verify_admin_token)):
    blocks = _load_custom_blocks()
    new_blocks = [b for b in blocks if b["name"] != name]
    if len(new_blocks) == len(blocks):
        raise HTTPException(status_code=404, detail={"success": False, "message": f"自定义积木 {name} 不存在"})
    _save_custom_blocks(new_blocks)
    logger.info(f"Admin '{admin.get('username')}' deleted custom block: {name}")
    return {"success": True, "message": f"积木 {name} 已删除"}


# ============================================================================
# 开发板管理端点
# ============================================================================

class BoardConfigRequest(BaseModel):
    board_id: str
    name: str
    fqbn: str
    description: str = ""
    platform: str = "esp32"
    flashable: bool = True
    bootloader_addr: Optional[int] = None
    output_format: str = "bin"
    chip_family: str = ""
    upload_protocol: str = "esptool"
    upload_speed: int = 115200
    reset_method: str = "dtr-rts"


def _board_full(b: BoardConfig) -> dict:
    return {
        "board_id": b.board_id, "name": b.name, "fqbn": b.fqbn,
        "description": b.description, "platform": b.platform,
        "flashable": b.flashable, "bootloader_addr": b.bootloader_addr,
        "output_format": b.output_format, "chip_family": b.chip_family,
        "upload_protocol": b.upload_protocol,
        "upload_speed": b.upload_speed,
        "reset_method": b.reset_method,
        "builtin": is_builtin_board(b.board_id),
        "overridden": is_overridden(b.board_id),
        "created_at": b.created_at,
    }


@router.get("/boards", summary="获取所有开发板（管理员视图）")
async def admin_get_boards(admin: dict = Depends(verify_admin_token)):
    boards = get_all_boards()
    return {"success": True, "boards": [_board_full(b) for b in boards]}


@router.post("/boards/search", summary="搜索可用的开发板")
async def admin_search_boards(
    request: dict,
    admin: dict = Depends(verify_admin_token),
):
    """通过 arduino-cli board listall --format json 搜索开发板"""
    keyword = (request.get("keyword") or "").strip()
    try:
        import subprocess
        cmd = ["arduino-cli", "board", "listall", "--format", "json"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise Exception(result.stderr[:500])

        data = json.loads(result.stdout)
        boards_raw = data.get("boards", [])

        matches = []
        for b in boards_raw:
            fqbn = b.get("fqbn", "")
            name = b.get("name", "")
            if keyword:
                kw = keyword.lower()
                if kw not in fqbn.lower() and kw not in name.lower():
                    continue
            # 从 FQBN 提取平台、板子 ID 和常用编译/烧录配置
            first_part = fqbn.split(":")[0] if fqbn else ""
            if "esp32" in fqbn:
                platform = "esp32"
                output_format = "bin"
                flashable = True
                upload_protocol = "esptool"
                upload_speed = 115200
                reset_method = "dtr-rts"
            elif "esp8266" in fqbn:
                platform = "esp8266"
                output_format = "bin"
                flashable = True
                upload_protocol = "esptool"
                upload_speed = 115200
                reset_method = "dtr-rts"
            elif first_part == "arduino":
                platform = "arduino-avr"
                output_format = "hex"
                flashable = True
                if ":mega" in fqbn:
                    upload_protocol = "stk500v2"
                    upload_speed = 115200
                    reset_method = "dtr-rts"
                elif ":leonardo" in fqbn or ":micro" in fqbn:
                    upload_protocol = "avr109"
                    upload_speed = 57600
                    reset_method = "touch-1200bps"
                else:
                    upload_protocol = "stk500v1"
                    upload_speed = 115200
                    reset_method = "dtr-rts"
            else:
                platform = ""
                output_format = "bin"
                flashable = False
                upload_protocol = "none"
                upload_speed = 115200
                reset_method = "none"

            # 用 FQBN 第三段作为 board_id，比整段拼接更简洁：esp32:esp32:XIAO_ESP32S3 → xiao_esp32s3
            fqbn_parts = fqbn.split(":")
            board_id_base = fqbn_parts[2] if len(fqbn_parts) > 2 else fqbn_parts[-1]
            board_id = re.sub(r"[^a-z0-9_-]+", "-", board_id_base.lower()).strip("-")

            board_id_l = board_id.lower()
            if "esp32s2" in board_id_l:
                chip_family = "esp32-s2"
            elif "esp32s3" in board_id_l:
                chip_family = "esp32-s3"
            elif "esp32c3" in board_id_l:
                chip_family = "esp32-c3"
            elif "esp32c6" in board_id_l:
                chip_family = "esp32-c6"
            elif "esp32h2" in board_id_l:
                chip_family = "esp32-h2"
            elif platform == "esp32":
                chip_family = "esp32"
            elif platform == "esp8266":
                chip_family = "esp8266"
            elif platform == "arduino-avr":
                chip_family = "avr"
            else:
                chip_family = ""

            bootloader_addr = None if platform == "arduino-avr" else (0x0 if chip_family in {"esp32-s2", "esp32-s3", "esp32-c3", "esp32-c6", "esp32-h2"} else 0x1000)
            matches.append({
                "fqbn": fqbn,
                "name": name,
                "platform": platform,
                "board_id": board_id,
                "chip_family": chip_family,
                "flashable": flashable,
                "bootloader_addr": bootloader_addr,
                "output_format": output_format,
                "upload_protocol": upload_protocol,
                "upload_speed": upload_speed,
                "reset_method": reset_method,
            })

        return {"success": True, "boards": matches[:30]}
    except Exception as e:
        logger.error(f"Board search failed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "message": str(e)[:500]})


@router.post("/boards/deploy", summary="安装开发板平台核心（流式输出）")
async def admin_deploy_board(
    request: dict,
    admin: dict = Depends(verify_admin_token),
):
    """安装开发板所需平台，流式输出进度"""
    fqbn = (request.get("fqbn") or "").strip()
    if not fqbn:
        raise HTTPException(status_code=400, detail={"success": False, "message": "fqbn 为必填项"})

    # 从 FQBN 提取包名：esp32:esp32:esp32c3 → esp32:esp32
    parts = fqbn.split(":")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail={"success": False, "message": f"无效的 FQBN: {fqbn}"})
    core = f"{parts[0]}:{parts[1]}"

    import subprocess
    from fastapi.responses import StreamingResponse

    async def generate():
        try:
            # 阶段 1：更新索引
            yield json.dumps({"type": "progress", "message": f"正在更新平台索引..."}) + "\n"
            proc1 = subprocess.Popen(
                ["arduino-cli", "core", "update-index"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            for line in proc1.stdout:
                line = line.strip()
                if line:
                    yield json.dumps({"type": "progress", "message": line}) + "\n"
            rc1 = proc1.wait(timeout=120)
            if rc1 != 0:
                yield json.dumps({"type": "error", "message": f"更新索引失败 (exit code: {rc1})"}) + "\n"
                return

            # 阶段 2：安装核心
            yield json.dumps({"type": "progress", "message": f"正在安装 {core}（可能需要几分钟）..."}) + "\n"
            proc2 = subprocess.Popen(
                ["arduino-cli", "core", "install", core],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            for line in proc2.stdout:
                line = line.strip()
                if line:
                    yield json.dumps({"type": "progress", "message": line}) + "\n"
            rc2 = proc2.wait(timeout=300)
            if rc2 != 0:
                yield json.dumps({"type": "error", "message": f"安装失败 (exit code: {rc2})"}) + "\n"
                return

            yield json.dumps({"type": "complete", "message": f"平台 {core} 安装完成"}) + "\n"
            logger.info(f"Core installed by admin '{admin.get('username')}': {core}")

        except subprocess.TimeoutExpired:
            yield json.dumps({"type": "error", "message": "操作超时，请重试"}) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)[:500]}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/boards", summary="保存开发板配置")
async def admin_save_board(
    request: BoardConfigRequest,
    admin: dict = Depends(verify_admin_token),
):
    board_id = request.board_id.strip().lower()
    name = request.name.strip()
    fqbn = request.fqbn.strip()
    chip_family = request.chip_family.strip()

    if not board_id or not name or not fqbn:
        raise HTTPException(status_code=400, detail={"success": False, "message": "board_id, name, fqbn 为必填项"})
    if not re.match(r"^[a-z0-9][a-z0-9_-]*$", board_id):
        raise HTTPException(status_code=400, detail={"success": False, "message": "board_id 只能包含小写字母、数字、横线和下划线"})

    board = BoardConfig(
        board_id=board_id,
        name=name,
        fqbn=fqbn,
        description=request.description.strip(),
        platform=request.platform,
        flashable=request.flashable,
        bootloader_addr=request.bootloader_addr,
        output_format=request.output_format,
        chip_family=chip_family,
        upload_protocol=request.upload_protocol,
        upload_speed=request.upload_speed,
        reset_method=request.reset_method,
    )
    save_board(board)
    action = "覆盖" if is_builtin_board(board_id) else "添加"
    logger.info(f"Admin '{admin.get('username')}' {action} board: {board_id}")
    return {"success": True, "message": f"开发板 {name} 已保存"}


class BoardOrderRequest(BaseModel):
    ordered_ids: list[str]
    board_updates: Optional[list[dict]] = None


@router.post("/boards/reorder", summary="保存开发板排序")
async def admin_reorder_boards(
    request: BoardOrderRequest,
    admin: dict = Depends(verify_admin_token),
):
    if request.board_updates:
        boards_by_id = {b.board_id: b for b in get_all_boards()}
        for item in request.board_updates:
            board_id = (item.get("board_id") or "").strip()
            chip_family = (item.get("chip_family") or "").strip()
            board = boards_by_id.get(board_id)
            if not board or board.chip_family == chip_family:
                continue
            save_board(BoardConfig(
                board_id=board.board_id,
                name=board.name,
                fqbn=board.fqbn,
                description=board.description,
                platform=board.platform,
                flashable=board.flashable,
                bootloader_addr=board.bootloader_addr,
                output_format=board.output_format,
                chip_family=chip_family,
                upload_protocol=board.upload_protocol,
                upload_speed=board.upload_speed,
                reset_method=board.reset_method,
                created_at=board.created_at,
            ))
    save_board_order(request.ordered_ids)
    logger.info(f"Admin '{admin.get('username')}' reordered boards")
    return {"success": True, "message": "开发板排序已保存"}


@router.delete("/boards/{board_id}", summary="删除开发板")
async def admin_delete_board(
    board_id: str,
    admin: dict = Depends(verify_admin_token),
):
    ok = delete_board(board_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"success": False, "message": f"开发板 {board_id} 不存在或已删除"})
    logger.info(f"Admin '{admin.get('username')}' deleted board: {board_id}")
    return {"success": True, "message": f"开发板 {board_id} 已删除"}


@router.post("/boards/{board_id}/reset", summary="恢复开发板为内置默认")
async def admin_reset_board(
    board_id: str,
    admin: dict = Depends(verify_admin_token),
):
    ok = reset_board(board_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"success": False, "message": f"开发板 {board_id} 无需恢复"})
    logger.info(f"Admin '{admin.get('username')}' reset board: {board_id}")
    return {"success": True, "message": f"开发板 {board_id} 已恢复默认"}


@router.post("/backups", summary="创建 SQLite 备份")
async def create_sqlite_backup(admin: dict = Depends(verify_admin_token)):
    from .backup_service import backup_service

    try:
        path = backup_service.create_backup()
        logger.info(f"Admin '{admin.get('username')}' created backup: {path.name}")
        return {"success": True, "name": path.name, "size": path.stat().st_size}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail={"success": False, "message": str(e)})


@router.get("/backups", summary="列出 SQLite 备份")
async def list_sqlite_backups(admin: dict = Depends(verify_admin_token)):
    from .backup_service import backup_service

    return {"success": True, "backups": backup_service.list_backups()}


@router.get("/backups/{name}", summary="下载 SQLite 备份")
async def download_sqlite_backup(name: str, admin: dict = Depends(verify_admin_token)):
    from .backup_service import backup_service

    try:
        path = backup_service.get_backup_path(name)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail={"success": False, "message": str(e)})

    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=path.name,
    )
