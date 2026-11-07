"""
监控和日志模块

提供结构化日志记录、API 响应时间监控、存储空间监控和错误率跟踪功能。
使用 Python 内置 logging 模块，无需外部监控服务。
"""

import time
import shutil
import logging
import os
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from pathlib import Path

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger(__name__)


# ============================================================================
# 结构化日志配置
# ============================================================================

def setup_logging(level: int = logging.INFO) -> None:
    """
    配置结构化日志格式
    
    日志格式包含: 时间戳, 级别, 模块名, 消息
    
    Args:
        level: 日志级别，默认 INFO
    """
    log_format = (
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    )
    date_format = "%Y-%m-%d %H:%M:%S"

    logging.basicConfig(
        level=level,
        format=log_format,
        datefmt=date_format,
        force=True,
    )

    # 降低第三方库的日志级别
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


# ============================================================================
# API 响应时间监控
# ============================================================================

# 全局响应时间记录（供中间件实例共享）
_response_times: deque = deque(maxlen=1000)



def _as_utc(dt):
    """把 naive datetime（旧数据 / utcnow()）视为 UTC，统一成 aware，避免比较时 TypeError。"""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class ResponseTimeMiddleware(BaseHTTPMiddleware):
    """
    API 响应时间监控中间件
    
    记录每个请求的响应时间，并在响应头中添加 X-Response-Time。
    同时维护最近请求的响应时间统计。
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000

        # 添加响应时间头
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        # 记录到全局历史
        _response_times.append({
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # 慢请求警告 (>2秒)
        if duration_ms > 2000:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {duration_ms:.0f}ms (status={response.status_code})"
            )

        return response


def get_response_time_stats() -> Dict:
    """获取响应时间统计"""
    if not _response_times:
        return {
            "total_requests": 0,
            "avg_response_time_ms": 0,
            "max_response_time_ms": 0,
            "min_response_time_ms": 0,
            "slow_requests": 0,
        }

    durations = [r["duration_ms"] for r in _response_times]
    return {
        "total_requests": len(durations),
        "avg_response_time_ms": round(sum(durations) / len(durations), 2),
        "max_response_time_ms": round(max(durations), 2),
        "min_response_time_ms": round(min(durations), 2),
        "slow_requests": sum(1 for d in durations if d > 2000),
    }


# ============================================================================
# 错误率监控
# ============================================================================

class ErrorRateTracker:
    """
    错误率跟踪器
    
    跟踪 API 请求的错误率 (4xx/5xx)，支持滑动窗口统计。
    """

    def __init__(self, window_minutes: int = 60, max_entries: int = 10000):
        """
        Args:
            window_minutes: 统计窗口大小（分钟）
            max_entries: 最大记录条数
        """
        self._window_minutes = window_minutes
        self._requests: deque = deque(maxlen=max_entries)

    def record(self, status_code: int, path: str) -> None:
        """记录一次请求结果"""
        self._requests.append({
            "status_code": status_code,
            "path": path,
            "timestamp": datetime.now(timezone.utc),
            "is_error": status_code >= 400,
        })

    def get_error_rate(self) -> Dict:
        """获取当前窗口内的错误率统计"""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=self._window_minutes)

        # 过滤窗口内的请求
        window_requests = [
            r for r in self._requests if _as_utc(r["timestamp"]) >= cutoff
        ]

        total = len(window_requests)
        if total == 0:
            return {
                "window_minutes": self._window_minutes,
                "total_requests": 0,
                "error_count": 0,
                "error_rate_percent": 0.0,
                "client_errors_4xx": 0,
                "server_errors_5xx": 0,
            }

        errors = [r for r in window_requests if r["is_error"]]
        client_errors = sum(1 for r in errors if 400 <= r["status_code"] < 500)
        server_errors = sum(1 for r in errors if r["status_code"] >= 500)

        error_rate = (len(errors) / total) * 100

        # 错误率超过 5% 时发出警告
        if error_rate > 5.0 and total >= 10:
            logger.warning(
                f"High error rate: {error_rate:.1f}% "
                f"({len(errors)}/{total} requests in last {self._window_minutes} min)"
            )

        return {
            "window_minutes": self._window_minutes,
            "total_requests": total,
            "error_count": len(errors),
            "error_rate_percent": round(error_rate, 2),
            "client_errors_4xx": client_errors,
            "server_errors_5xx": server_errors,
        }


# ============================================================================
# 存储空间监控
# ============================================================================

class StorageMonitor:
    """
    存储空间监控
    
    监控固件存储目录的磁盘使用情况。
    """

    def __init__(self, storage_path: Optional[str] = None):
        """
        Args:
            storage_path: 固件存储路径，默认从环境变量读取
        """
        self._storage_path = Path(
            storage_path or os.getenv("FIRMWARE_STORAGE_PATH", "/opt/firmware")
        )

    def get_storage_info(self) -> Dict:
        """
        获取存储空间信息
        
        Returns:
            包含总空间、已用空间、可用空间和使用率的字典
        """
        try:
            usage = shutil.disk_usage(self._storage_path)
            total_gb = usage.total / (1024 ** 3)
            used_gb = usage.used / (1024 ** 3)
            free_gb = usage.free / (1024 ** 3)
            usage_percent = (usage.used / usage.total) * 100

            result = {
                "storage_path": str(self._storage_path),
                "total_gb": round(total_gb, 2),
                "used_gb": round(used_gb, 2),
                "free_gb": round(free_gb, 2),
                "usage_percent": round(usage_percent, 1),
                "warning": usage_percent > 80,
                "critical": free_gb < 1.0,
            }

            # 存储空间警告
            if result["critical"]:
                logger.error(
                    f"Critical: Storage space below 1 GB! "
                    f"Free: {free_gb:.2f} GB at {self._storage_path}"
                )
            elif result["warning"]:
                logger.warning(
                    f"Storage warning: Usage at {usage_percent:.1f}% "
                    f"(Free: {free_gb:.2f} GB at {self._storage_path})"
                )

            return result

        except FileNotFoundError:
            logger.error(f"Storage path does not exist: {self._storage_path}")
            return {
                "storage_path": str(self._storage_path),
                "error": "Storage path does not exist",
                "total_gb": 0,
                "used_gb": 0,
                "free_gb": 0,
                "usage_percent": 0,
                "warning": True,
                "critical": True,
            }
        except Exception as e:
            logger.error(f"Failed to get storage info: {e}")
            return {
                "storage_path": str(self._storage_path),
                "error": str(e),
                "total_gb": 0,
                "used_gb": 0,
                "free_gb": 0,
                "usage_percent": 0,
                "warning": True,
                "critical": True,
            }

    def get_firmware_storage_usage(self) -> Dict:
        """
        获取固件目录的实际使用量
        
        Returns:
            固件存储目录的大小统计
        """
        try:
            total_size = 0
            file_count = 0
            firmware_count = 0

            if not self._storage_path.exists():
                return {
                    "firmware_count": 0,
                    "file_count": 0,
                    "total_size_mb": 0,
                }

            for item in self._storage_path.iterdir():
                if item.is_dir() and not item.name.startswith('.'):
                    firmware_count += 1
                    for file in item.rglob('*'):
                        if file.is_file():
                            total_size += file.stat().st_size
                            file_count += 1

            return {
                "firmware_count": firmware_count,
                "file_count": file_count,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
            }

        except Exception as e:
            logger.error(f"Failed to calculate firmware storage usage: {e}")
            return {
                "firmware_count": 0,
                "file_count": 0,
                "total_size_mb": 0,
                "error": str(e),
            }


# ============================================================================
# 错误率追踪中间件
# ============================================================================

class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """
    错误率追踪中间件
    
    自动记录每个请求的状态码到 ErrorRateTracker。
    """

    def __init__(self, app, tracker: ErrorRateTracker):
        super().__init__(app)
        self._tracker = tracker

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        self._tracker.record(response.status_code, request.url.path)
        return response


# ============================================================================
# 全局单例实例
# ============================================================================

# 错误率跟踪器（60 分钟窗口）
error_tracker = ErrorRateTracker(window_minutes=60)

# 存储空间监控
storage_monitor = StorageMonitor()
