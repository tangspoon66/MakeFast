"""Main FastAPI application"""

import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes import router
from .admin_routes import router as admin_router, verify_admin_token
from .admin_console.routes import router as admin_console_router
from .learner_auth_routes import router as learner_auth_router
from .learning_project_routes import router as learning_project_router
from .learning_course_routes import router as learning_course_router
from .learning_progress_routes import router as learning_progress_router
from .learning_agent_routes import router as learning_agent_router
from .firmware_routes import router as firmware_router
from .template_routes import router as template_router
from .template_admin_routes import router as template_admin_router
from .course_folder_routes import router as course_folder_router
from .course_qa_routes import admin_router as course_qa_admin_router, public_router as course_qa_public_router
from .course_agent import router as course_agent_router
from .lesson_session_routes import router as lesson_session_router
from .service_config import apply_service_config_to_env
from .toolchain_manager import ensure_required_platforms
from .monitoring import (
    setup_logging,
    ResponseTimeMiddleware,
    ErrorTrackingMiddleware,
    error_tracker,
    storage_monitor,
    get_response_time_stats,
)

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env'
if os.environ.get("MAKEFAST_SKIP_DOTENV") != "1":
    load_dotenv(dotenv_path=env_path)

# 配置结构化日志
setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

apply_service_config_to_env()

# 打印 API 配置状态（用于调试）
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    # 只记录是否配置，不输出实际密钥
    logger.info("AI API Key: configured")
    logger.info(f"AI API Base: {os.getenv('OPENAI_API_BASE')}")
    logger.info(f"AI Model: {os.getenv('AI_MODEL')}")
else:
    logger.warning("AI API Key not configured")

# 安全配置检查
jwt_secret = os.getenv('JWT_SECRET_KEY', '')
if not jwt_secret or jwt_secret in ('your_random_jwt_secret_here', 'insecure-default-secret-key-change-me'):
    logger.error("⚠️  JWT_SECRET_KEY 使用了不安全的默认值，请立即修改！")

admin_password_hash = os.getenv('ADMIN_PASSWORD_HASH', '')
if not admin_password_hash or admin_password_hash == 'your_bcrypt_hash_here':
    logger.error("⚠️  ADMIN_PASSWORD_HASH 未配置或使用默认值，请立即修改！")

logger.info("Monitoring enabled: response time, error rate, storage")

app = FastAPI(
    title="MakeFast API",
    description="Cloud-based ESP32 compilation and upload service",
    version="0.1.0",
    docs_url="/api/docs" if os.getenv("ENABLE_API_DOCS", "").lower() == "true" else None,
    redoc_url="/api/redoc" if os.getenv("ENABLE_API_DOCS", "").lower() == "true" else None,
    openapi_url="/api/openapi.json" if os.getenv("ENABLE_API_DOCS", "").lower() == "true" else None,
)

# 配置文件上传大小限制（500 MB）
# 注意：这个限制应该与 firmware_manager.MAX_SINGLE_FILE_SIZE 保持一致
app.state.max_upload_size = 500 * 1024 * 1024  # 500 MB

# Configure CORS (来源可通过 ALLOWED_ORIGINS 环境变量配置，逗号分隔)
_cors_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if _cors_origins_env:
    allowed_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://127.0.0.1:80",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-CSRF-Token",
    ],
)

# 添加 API 响应时间监控中间件
app.add_middleware(ResponseTimeMiddleware)

# 添加错误率追踪中间件
app.add_middleware(ErrorTrackingMiddleware, tracker=error_tracker)


# 固件定期清理后台任务
@app.on_event("startup")
async def startup_firmware_cleanup():
    """启动时确认工具链、清理过期固件，并启动定期清理任务"""
    import asyncio
    from .compilation_service import get_compilation_service

    try:
        await asyncio.to_thread(ensure_required_platforms)
    except Exception as e:
        logger.error(f"Startup Arduino toolchain check failed: {e}")

    async def periodic_cleanup():
        while True:
            await asyncio.sleep(3600)  # 每小时执行一次
            try:
                cs = get_compilation_service()
                cleaned = cs.cleanup_old_firmware(max_age_hours=24)
                if cleaned > 0:
                    logger.info(f"Periodic cleanup removed {cleaned} old firmware files")
            except Exception as e:
                logger.warning(f"Periodic firmware cleanup failed: {e}")

    # 启动时立即清理一次
    try:
        cs = get_compilation_service()
        cs.cleanup_old_firmware(max_age_hours=24)
    except Exception as e:
        logger.warning(f"Startup firmware cleanup failed: {e}")

    # 启动后台定期任务
    asyncio.create_task(periodic_cleanup())

    # 回收站自动清理：每小时检查并永久删除超过30天的项目
    from .template_manager import template_manager
    from .firmware_manager import firmware_manager

    async def periodic_trash_purge():
        while True:
            await asyncio.sleep(3600)  # 每小时执行一次
            try:
                t_count = template_manager.purge_expired_trash(max_age_days=30)
                f_count = firmware_manager.purge_expired_trash(max_age_days=30)
                if t_count > 0 or f_count > 0:
                    logger.info(f"Trash auto-purge: removed {t_count} templates, {f_count} firmwares")
            except Exception as e:
                logger.warning(f"Trash auto-purge failed: {e}")

    asyncio.create_task(periodic_trash_purge())


# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """处理所有未捕获的异常"""
    logger.error(f"Unhandled exception: {exc}", exc_info=os.getenv("DEBUG", "").lower() == "true")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_type": "system_error",
            "message": "服务器内部错误，请稍后重试。如果问题持续，请联系技术支持。",
        }
    )


# 注册路由
# 注意：firmware_router 必须在 router 之前注册，
# 因为 firmware_router 有更具体的路由（如 /download, /thumbnail），
# 而 router 有通用的 /firmware/{firmware_id}/{filename} 路由
app.include_router(firmware_router)
app.include_router(template_router)
app.include_router(course_qa_public_router)
app.include_router(course_agent_router)
app.include_router(lesson_session_router)
app.include_router(template_admin_router)
app.include_router(course_qa_admin_router)
app.include_router(course_folder_router)
app.include_router(admin_router)
app.include_router(admin_console_router)
app.include_router(learner_auth_router)
app.include_router(learning_project_router)
app.include_router(learning_course_router)
app.include_router(learning_progress_router)
app.include_router(learning_agent_router)
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "MakeFast API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/api/docs"
    }


@app.get("/api/monitoring")
async def get_monitoring_info(admin: dict = Depends(verify_admin_token)):
    """
    获取系统监控信息
    
    返回 API 响应时间统计、错误率和存储空间信息。
    用于管理员仪表板和运维监控。
    需要管理员认证。
    """
    return {
        "response_time": get_response_time_stats(),
        "error_rate": error_tracker.get_error_rate(),
        "storage": storage_monitor.get_storage_info(),
        "firmware_usage": storage_monitor.get_firmware_storage_usage(),
    }
