"""
API 路由定义

定义了所有的 API 端点和请求处理器。
"""

import logging
import os
import subprocess
import shutil
import json
import zipfile
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, Query, UploadFile, File, Header, Request
from fastapi.responses import FileResponse

from .models import (
    CompileRequest,
    CompileResult,
    BoardInfo,
    BoardListResponse,
    HealthResponse,
    FeedbackRequest,
)
from .ops_metrics import ops_metrics
from .compile_config import get_compile_concurrency, get_compile_queue_timeout
from .runtime_state import compile_runtime_state, rate_limiter
from .monitoring import storage_monitor
from pydantic import BaseModel
from typing import Optional
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)


from .error_utils import sanitize_error
from .asr_service import transcribe_once
from .learner_auth_routes import require_csrf, require_learner_request
router = APIRouter(prefix="/api")


from .board_config import get_all_boards


def _build_board_list():
    return [
        BoardInfo(
            id=b.board_id,
            name=b.name,
            fqbn=b.fqbn,
            description=b.description,
            platform=b.platform,
            flashable=b.flashable,
            chip_family=b.chip_family,
            output_format=b.output_format,
            upload_protocol=b.upload_protocol,
            upload_speed=b.upload_speed,
            reset_method=b.reset_method,
        )
        for b in get_all_boards()
    ]


# 编译并发控制信号量
import asyncio
_compile_semaphore = asyncio.Semaphore(get_compile_concurrency())
_compile_queue_timeout = get_compile_queue_timeout()
_compile_jobs_lock = threading.Lock()
_compile_jobs: dict[str, dict] = {}


def _cleanup_compile_jobs(max_age_seconds: int = 3600) -> None:
    now = time.time()
    with _compile_jobs_lock:
        stale_ids = [
            job_id for job_id, job in _compile_jobs.items()
            if job.get("completed_at") and now - job["completed_at"] > max_age_seconds
        ]
        for job_id in stale_ids:
            _compile_jobs.pop(job_id, None)


def _register_compile_job() -> tuple[str, threading.Event]:
    _cleanup_compile_jobs()
    job_id = uuid.uuid4().hex
    cancel_event = threading.Event()
    with _compile_jobs_lock:
        _compile_jobs[job_id] = {
            "cancel_event": cancel_event,
            "created_at": time.time(),
            "completed_at": None,
        }
    return job_id, cancel_event


def _finish_compile_job(job_id: str) -> None:
    with _compile_jobs_lock:
        job = _compile_jobs.get(job_id)
        if job:
            job["completed_at"] = time.time()


@router.post("/compile/{job_id}/cancel")
async def cancel_compile(job_id: str, _learner: tuple[dict, str] = Depends(require_csrf)):
    """取消正在运行的编译任务。"""
    with _compile_jobs_lock:
        job = _compile_jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail={"success": False, "message": "编译任务不存在或已结束"})
        job["cancel_event"].set()
    compile_runtime_state.mark_cancelled(job_id)
    return {"success": True, "message": "正在停止编译"}


@router.post("/compile", response_model=CompileResult)
async def compile_code(
    request: CompileRequest,
    x_compile_job_id: Optional[str] = Header(default=None),
    _learner: tuple[dict, str] = Depends(require_csrf),
):
    """
    编译用户代码

    接收用户代码（单文件或多文件）和开发板 ID，返回编译结果。
    成功时返回固件 ID，失败时返回错误信息。

    支持两种模式：
    1. 单文件模式：提供 code 字段
    2. 多文件模式：提供 files 数组

    并发限制：最多同时 2 个编译任务。
    """
    job_id = x_compile_job_id or uuid.uuid4().hex
    cancel_event = threading.Event()
    with _compile_jobs_lock:
        _compile_jobs[job_id] = {
            "cancel_event": cancel_event,
            "created_at": time.time(),
            "completed_at": None,
        }

    try:
        try:
            await asyncio.wait_for(_compile_semaphore.acquire(), timeout=_compile_queue_timeout)
        except asyncio.TimeoutError:
            logger.warning("Compile request rejected: all slots busy")
            raise HTTPException(
                status_code=429,
                detail={
                    "success": False,
                    "message": "编译队列已满，请稍后重试"
                }
            )

        logger.info(f"Received compile request for board: {request.board_id}")

        if request.code:
            logger.debug(f"Single file mode, code length: {len(request.code)} characters")
        else:
            logger.debug(f"Multi-file mode, {len(request.files)} files")

        # 获取编译服务
        from .compilation_service import get_compilation_service
        compilation_service = get_compilation_service()

        try:
            # 执行编译
            if request.code:
                result = await asyncio.to_thread(
                    compilation_service.compile,
                    code=request.code,
                    board_id=request.board_id,
                    cancel_event=cancel_event,
                    job_id=job_id,
                )
            else:
                files = [{"name": f.name, "content": f.content} for f in request.files]
                result = await asyncio.to_thread(
                    compilation_service.compile,
                    files=files,
                    board_id=request.board_id,
                    cancel_event=cancel_event,
                    job_id=job_id,
                )
            ops_metrics.record_compile(result.success)
            return result
        except Exception:
            ops_metrics.record_compile(False)
            raise
        finally:
            _finish_compile_job(job_id)
            _compile_semaphore.release()
    except Exception:
        _finish_compile_job(job_id)
        raise


@router.get("/firmware/{firmware_id}/{filename}")
async def download_firmware(
    firmware_id: str,
    filename: str,
    _learner: tuple[dict, str] = Depends(require_learner_request),
):
    """
    下载编译好的固件文件

    根据固件 ID 和文件名下载对应的固件文件。
    支持的文件名：bootloader.bin, partitions.bin, boot_app0.bin, app.bin, firmware.hex
    """
    logger.info(f"Firmware download requested: {firmware_id}/{filename}")
    
    # 安全校验：防止路径遍历
    if '..' in firmware_id or '/' in firmware_id or '\\' in firmware_id:
        raise HTTPException(status_code=400, detail="Invalid firmware ID")
    
    # 验证文件名（安全检查）
    allowed_files = ['bootloader.bin', 'partitions.bin', 'boot_app0.bin', 'app.bin', 'firmware.hex']
    if filename not in allowed_files:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid filename. Allowed: {', '.join(allowed_files)}"
        )
    
    # 获取编译服务
    from .compilation_service import get_compilation_service
    compilation_service = get_compilation_service()
    
    # 构建文件路径并校验在固件目录内
    firmware_path = (compilation_service.firmware_dir / firmware_id / filename).resolve()
    if not str(firmware_path).startswith(str(compilation_service.firmware_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid firmware path")
    
    if not firmware_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Firmware file not found: {firmware_id}/{filename}"
        )
    
    # 返回固件文件
    return FileResponse(
        path=str(firmware_path),
        media_type="application/octet-stream",
        filename=filename
    )


@router.get("/boards", response_model=BoardListResponse)
async def get_boards():
    """
    获取支持的开发板列表
    
    返回所有支持的 ESP32 开发板信息。
    """
    logger.info("Board list requested")
    return BoardListResponse(boards=_build_board_list())

@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest, raw_request: Request):
    """提交用户问题反馈，供管理员在仪表板查看。"""
    forwarded_for = raw_request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",")[0].strip() or (raw_request.client.host if raw_request.client else "unknown")
    if not rate_limiter.allow(f"feedback:{client_ip}", limit=5, window_seconds=600):
        raise HTTPException(
            status_code=429,
            detail={"success": False, "message": "反馈提交过于频繁，请稍后再试"}
        )

    if len(request.message.strip()) < 5:
        raise HTTPException(status_code=400, detail={"success": False, "message": "请描述遇到的问题"})

    feedback = ops_metrics.add_feedback(
        category=request.category,
        message=request.message,
        contact=request.contact or "",
        page_url=request.page_url or "",
        logs=request.logs or [],
    )
    logger.info(f"Feedback submitted: {feedback['id']} ({feedback['category']})")
    return {"success": True, "id": feedback["id"]}


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康检查端点（公开）

    仅返回基本服务状态和粗粒度资源状态，不暴露内部路径等敏感信息。
    """
    logger.info("Health check requested")

    # 仅检查 Arduino CLI 是否可用
    arduino_ok = False
    try:
        result = subprocess.run(
            ['arduino-cli', 'version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        arduino_ok = result.returncode == 0
    except Exception:
        pass

    storage_info = storage_monitor.get_storage_info()
    disk_info = {
        "free_gb": storage_info.get("free_gb", 0),
        "usage_percent": storage_info.get("usage_percent", 0),
        "warning": storage_info.get("warning", False),
        "critical": storage_info.get("critical", False),
    }

    status = "ok" if arduino_ok and not disk_info["critical"] else "degraded"
    return HealthResponse(
        status=status,
        service="makefast-platform",
        version="0.1.0",
        arduino_cli={"ok": arduino_ok, "version": None},
        libraries={"preinstalled_count": 0},
        disk=disk_info,
    )


@router.post("/asr/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """一句话语音识别。"""
    try:
        audio = await file.read()
        text = await transcribe_once(audio, file.content_type, file.filename)
        return {"success": True, "text": text}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"success": False, "message": sanitize_error(e, "语音识别失败")}
        )


# ===== AI 代码生成相关端点 =====

class AIMessage(BaseModel):
    """AI 消息模型"""
    role: str  # 'user' | 'assistant' | 'system'
    content: str


class AIGenerateRequest(BaseModel):
    """AI 代码生成请求"""
    messages: List[AIMessage]
    board: Optional[str] = None
    context: Optional[str] = None
    model: Optional[str] = None
    project_files: Optional[List[dict]] = None
    current_file: Optional[str] = None
    compile_errors: Optional[List[dict]] = None  # 编译错误列表
    project_context: Optional[str] = None  # 项目结构摘要


class AIGenerateResponse(BaseModel):
    """AI 代码生成响应"""
    success: bool
    message: str
    code: Optional[str] = None
    error: Optional[str] = None


@router.post("/ai/generate", response_model=AIGenerateResponse)
async def ai_generate_code(
    request: AIGenerateRequest,
    _learner: tuple[dict, str] = Depends(require_csrf),
):
    """
    AI 代码生成
    
    根据用户的对话历史和需求，生成 Arduino/ESP32 代码。
    """
    logger.info(f"AI generate request received, messages: {len(request.messages)}")
    
    try:
        from .ai_service import get_ai_service
        ai_service = get_ai_service()
        
        # 转换消息格式
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # 生成代码
        result = await ai_service.generate_code(
            messages=messages,
            board_id=request.board,
            context=request.context,
            project_files=request.project_files,
            current_file=request.current_file,
            compile_errors=request.compile_errors,
            project_context=request.project_context,
        )
        
        return AIGenerateResponse(**result)
        
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        return AIGenerateResponse(
            success=False,
            message="生成失败，请稍后重试",
            error=sanitize_error(e, "生成失败，请稍后重试")
        )


@router.post("/ai/generate/stream")
async def ai_generate_code_stream(
    request: AIGenerateRequest,
    _learner: tuple[dict, str] = Depends(require_csrf),
):
    """
    AI 代码生成（流式）
    
    以流式方式生成代码，支持实时输出。
    """
    logger.info(f"AI streaming request received, messages: {len(request.messages)}")
    
    try:
        from .ai_service import get_ai_service
        ai_service = get_ai_service()
        
        # 转换消息格式
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # 流式生成
        async def generate():
            try:
                async for chunk in ai_service.generate_code_stream(
                    messages=messages,
                    board_id=request.board,
                    context=request.context,
                    project_files=request.project_files,
                    current_file=request.current_file,
                    compile_errors=request.compile_errors,
                    project_context=request.project_context,
                ):
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                yield f"data: {json.dumps({'error': sanitize_error(e, '生成失败，请稍后重试')})}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )
        
    except Exception as e:
        logger.error(f"AI streaming setup failed: {e}")
        raise HTTPException(status_code=500, detail=sanitize_error(e))


# ============================================================================
# 库搜索与安装（公共，无需认证）
# ============================================================================


class InstallLibraryRequest(BaseModel):
    name: str


@router.get(
    "/libraries/search",
    summary="搜索 Arduino 库",
    description="通过 arduino-cli lib search 搜索可用的 Arduino 库",
)
async def search_libraries(q: str = Query(..., min_length=1, description="搜索关键字")):
    """搜索 Arduino 库，返回匹配列表（含描述）"""
    # 安全校验：防止命令注入
    if any(c in q for c in [';', '&', '|', '`', '$', '(', ')', '{', '}', '\n', '\r']):
        raise HTTPException(status_code=400, detail={"success": False, "message": "搜索关键字包含非法字符"})
    
    def _do_search(args: list) -> list:
        r = subprocess.run(args, capture_output=True, text=True, timeout=30)
        if r.returncode != 0: return []
        try:
            parsed = json.loads(r.stdout)
        except json.JSONDecodeError:
            return []
        raw = parsed if isinstance(parsed, list) else parsed.get("libraries", [])
        return [
            {
                "name": l.get("name", ""),
                "version": l.get("latest", {}).get("version", "") if isinstance(l.get("latest"), dict) else "",
                "description": (l.get("description", "") or "")[:100],
            }
            for l in raw if isinstance(l, dict) and l.get("name")
        ]

    try:
        # 第一步：精确搜库名
        libs = _do_search(['arduino-cli', 'lib', 'search', q, '--names', '--format', 'json'])

        # 第二步：库名搜不到再搜描述
        if len(libs) < 3:
            desc_libs = _do_search(['arduino-cli', 'lib', 'search', q, '--format', 'json'])
            existing = {l["name"].lower() for l in libs}
            for l in desc_libs:
                if l["name"].lower() not in existing:
                    libs.append(l)

        # 按关键词相关性排序
        ql = q.lower()
        qwords = ql.split()
        def _score(lib: dict) -> int:
            n = lib["name"].lower()
            d = lib.get("description", "").lower()
            if ql == n: return 100
            if n.startswith(ql): return 80
            if ql in n: return 60
            score = 0
            for w in qwords:
                if w in n: score += 30
                if w in d: score += 10
            return score
        libs.sort(key=_score, reverse=True)
        results = [l for l in libs if _score(l) > 0][:10]

        # 合并自定义库
        custom = _load_custom_libs()
        ql_lower = q.lower()
        for c in custom:
            if ql_lower in c["name"].lower():
                results.append({"name": c["name"], "version": "", "description": "自定义库"})
        return {"success": True, "libraries": results[:10]}
    except subprocess.TimeoutExpired:
        return {"success": True, "libraries": []}
    except Exception as e:
        logger.error(f"Library search failed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "message": sanitize_error(e, "搜索失败")})


@router.post(
    "/libraries/install",
    summary="安装 Arduino 库",
    description="通过 arduino-cli lib install 安装 Arduino 库（公共端点）",
)
async def install_library(request: InstallLibraryRequest):
    """安装 Arduino 库"""
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail={"success": False, "message": "库名不能为空"})

    try:
        from .library_manager import get_library_manager, LibraryNotFoundError, LibraryDownloadError
        lib_manager = get_library_manager()
        installed = lib_manager.download_library(name)
        return {
            "success": True,
            "message": f"库 {installed.get('name') or name} 已安装",
            "name": installed.get("name") or name,
            "version": installed.get("version", ""),
        }
    except LibraryNotFoundError as e:
        raise HTTPException(status_code=400, detail={"success": False, "message": sanitize_error(e, "请求参数错误")})
    except LibraryDownloadError as e:
        raise HTTPException(status_code=500, detail={"success": False, "message": sanitize_error(e, "下载失败")})
    except Exception as e:
        logger.error(f"Library install failed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "message": sanitize_error(e, "安装失败")})


# ============================================================================
# ZIP 库上传（公共，无需认证）
# ============================================================================

ARDUINO_LIB_DIR = Path(os.getenv("ARDUINO_LIBRARIES_DIR", "/opt/libraries/arduino")) / "libraries"
CUSTOM_LIBS_FILE = Path(__file__).parent.parent / "custom_libraries.json"


def _load_custom_libs() -> list:
    if CUSTOM_LIBS_FILE.exists():
        try:
            return json.loads(CUSTOM_LIBS_FILE.read_text())
        except Exception:
            return []
    return []


def _save_custom_libs(data: list):
    CUSTOM_LIBS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def _validate_library_name(lib_name: str) -> bool:
    if not lib_name or '..' in lib_name or '/' in lib_name or '\\' in lib_name:
        return False
    dangerous_chars = [';', '&', '|', '$', '`', '\n', '\r']
    return not any(char in lib_name for char in dangerous_chars)


@router.post(
    "/libraries/upload",
    summary="上传 ZIP 库文件",
    description="上传包含库代码的 ZIP 文件，自动解压安装到 Arduino libraries 目录",
)
async def upload_library_zip(file: UploadFile = File(..., description="库 ZIP 文件")):
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail={"success": False, "message": "只支持 ZIP 格式"})

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"success": False, "message": "文件大小不能超过 10MB"})

    try:
        with zipfile.ZipFile(BytesIO(content), 'r') as zf:
            names = zf.namelist()
            has_source = any(
                n.endswith(('.h', '.hpp', '.c', '.cpp', '.ino'))
                for n in names if not n.endswith('/')
            )
            if not has_source:
                raise HTTPException(status_code=400, detail={"success": False, "message": "ZIP 中没有找到 .h/.cpp 等库文件"})

            # 检查解压后总大小，防止 ZIP 炸弹
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            max_uncompressed = 50 * 1024 * 1024  # 50MB
            if total_uncompressed > max_uncompressed:
                raise HTTPException(status_code=400, detail={
                    "success": False,
                    "message": f"解压后大小 ({total_uncompressed / 1024 / 1024:.1f}MB) 超过限制 (50MB)"
                })
            if len(names) > 500:
                raise HTTPException(status_code=400, detail={
                    "success": False,
                    "message": f"ZIP 文件数量 ({len(names)}) 超过限制 (500)"
                })

            # 用 ZIP 文件名（去掉.zip）作为库目录名
            lib_name = Path(file.filename).stem
            if not _validate_library_name(lib_name):
                raise HTTPException(status_code=400, detail={"success": False, "message": "库名称不合法"})
            lib_dir = ARDUINO_LIB_DIR / lib_name

            # 检查 ZIP 内是否有一层目录包裹
            top_dirs = {n.split('/')[0] for n in names if '/' in n}
            if len(top_dirs) == 1 and all(n.startswith(list(top_dirs)[0] + '/') for n in names if '/' in n):
                # ZIP 内有一层目录，去掉这层
                prefix = list(top_dirs)[0] + '/'
                for info in zf.infolist():
                    if info.is_dir(): continue
                    rel = info.filename
                    if rel.startswith(prefix):
                        rel = rel[len(prefix):]
                    if not rel: continue
                    target = _safe_extract_path(lib_dir, rel)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(zf.read(info.filename))
            else:
                # 直接解压
                lib_dir.mkdir(parents=True, exist_ok=True)
                for info in zf.infolist():
                    if info.is_dir(): continue
                    target = _safe_extract_path(lib_dir, info.filename)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(zf.read(info.filename))

        custom_libs = _load_custom_libs()
        custom_libs = [item for item in custom_libs if item.get("name") != lib_name]
        custom_libs.append({
            "name": lib_name,
            "filename": file.filename,
            "size": len(content),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "installed": True,
        })
        _save_custom_libs(custom_libs)

        return {"success": True, "message": f"库 {lib_name} 已本地安装", "name": lib_name}
    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail={"success": False, "message": "无效的 ZIP 文件"})
    except Exception as e:
        logger.error(f"Library upload failed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "message": sanitize_error(e, "上传失败")})


# ============================================================================
# 自定义库列表（管理员维护）
# ============================================================================


CUSTOM_LIBS_DIR = Path(__file__).parent.parent / "custom_libraries"
CUSTOM_LIBS_DIR.mkdir(exist_ok=True)


def _safe_extract_path(base_dir: Path, filename: str) -> Path:
    """安全解压路径，防止 ZIP Slip 路径遍历攻击"""
    target = (base_dir / filename).resolve()
    if not str(target).startswith(str(base_dir.resolve())):
        raise ValueError(f"非法路径: {filename}")
    return target


@router.get(
    "/libraries/custom",
    summary="获取自定义库列表",
    description="获取管理员上传的自定义库列表",
)
async def get_custom_libraries():
    return {"success": True, "libraries": _load_custom_libs()}


@router.post(
    "/libraries/custom/install",
    summary="安装自定义库",
    description="从管理员上传的自定义库 ZIP 中解压安装",
)
async def install_custom_library(request: InstallLibraryRequest):
    name = request.name.strip()
    # 安全校验：防止路径遍历和 shell 元字符污染
    if not _validate_library_name(name):
        raise HTTPException(status_code=400, detail={"success": False, "message": "非法库名称"})
    
    zip_path = CUSTOM_LIBS_DIR / f"{name}.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail={"success": False, "message": f"自定义库 {name} 不存在"})

    try:
        lib_dir = ARDUINO_LIB_DIR / name
        lib_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Handle single-directory wrapping
            names = zf.namelist()
            top_dirs = {n.split('/')[0] for n in names if '/' in n}
            if len(top_dirs) == 1:
                prefix = list(top_dirs)[0] + '/'
                for info in zf.infolist():
                    if info.is_dir(): continue
                    rel = info.filename
                    if rel.startswith(prefix):
                        rel = rel[len(prefix):]
                    if not rel: continue
                    target = _safe_extract_path(lib_dir, rel)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(zf.read(info.filename))
            else:
                for info in zf.infolist():
                    if info.is_dir(): continue
                    target = _safe_extract_path(lib_dir, info.filename)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(zf.read(info.filename))
        return {"success": True, "message": f"自定义库 {name} 已安装", "version": ""}
    except Exception as e:
        logger.error(f"Custom library install failed: {e}")
        raise HTTPException(status_code=500, detail={"success": False, "message": sanitize_error(e, "安装失败")})


@router.get(
    "/libraries/installed",
    summary="获取已安装库列表",
    description="返回所有已安装的 Arduino 库名称列表（公共端点）",
)
async def get_installed_libraries():
    """获取已安装库列表（公共，用户端验证用）"""
    try:
        from .library_manager import get_library_manager
        lib_manager = get_library_manager()
        libs = lib_manager.get_installed_libraries()
        # 合并自定义库
        custom_names = {c["name"] for c in _load_custom_libs()}
        custom_libs = [{"name": n, "version": ""} for n in custom_names]
        return {"success": True, "libraries": libs + custom_libs}
    except Exception as e:
        logger.error(f"Failed to get installed libraries: {e}")
        return {"success": True, "libraries": []}


# ============================================================================
# 自定义积木（公共端点，前端加载用）
# ============================================================================

CUSTOM_BLOCKS_FILE = Path(__file__).parent.parent / "custom_blocks.json"


def _load_custom_blocks():
    if CUSTOM_BLOCKS_FILE.exists():
        try:
            return json.loads(CUSTOM_BLOCKS_FILE.read_text())
        except Exception:
            return []
    return []


@router.get(
    "/blocks/custom",
    summary="获取自定义积木列表",
    description="前端加载自定义积木（无需认证）",
)
async def get_custom_blocks():
    return {"success": True, "blocks": _load_custom_blocks()}
