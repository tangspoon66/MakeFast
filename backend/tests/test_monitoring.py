"""
监控模块单元测试

测试结构化日志、响应时间统计、错误率跟踪和存储空间监控。
"""

import os
import time
import pytest
from unittest.mock import patch
from datetime import datetime, timedelta

# 设置测试环境变量
os.environ.setdefault("FIRMWARE_STORAGE_PATH", "/tmp/test_firmware_monitoring")

from app.monitoring import (
    setup_logging,
    get_response_time_stats,
    _response_times,
    ErrorRateTracker,
    StorageMonitor,
    ResponseTimeMiddleware,
    ErrorTrackingMiddleware,
)


class TestResponseTimeStats:
    """响应时间统计测试"""

    def setup_method(self):
        """每个测试前清空全局记录"""
        _response_times.clear()

    def test_empty_stats(self):
        """空记录时返回零值"""
        stats = get_response_time_stats()
        assert stats["total_requests"] == 0
        assert stats["avg_response_time_ms"] == 0
        assert stats["max_response_time_ms"] == 0
        assert stats["min_response_time_ms"] == 0
        assert stats["slow_requests"] == 0

    def test_stats_with_records(self):
        """有记录时正确计算统计"""
        _response_times.append({
            "path": "/api/test",
            "method": "GET",
            "status_code": 200,
            "duration_ms": 50.0,
            "timestamp": datetime.utcnow().isoformat(),
        })
        _response_times.append({
            "path": "/api/test2",
            "method": "POST",
            "status_code": 201,
            "duration_ms": 150.0,
            "timestamp": datetime.utcnow().isoformat(),
        })

        stats = get_response_time_stats()
        assert stats["total_requests"] == 2
        assert stats["avg_response_time_ms"] == 100.0
        assert stats["max_response_time_ms"] == 150.0
        assert stats["min_response_time_ms"] == 50.0
        assert stats["slow_requests"] == 0

    def test_slow_request_counting(self):
        """正确统计慢请求数量"""
        _response_times.append({
            "path": "/api/fast",
            "method": "GET",
            "status_code": 200,
            "duration_ms": 100.0,
            "timestamp": datetime.utcnow().isoformat(),
        })
        _response_times.append({
            "path": "/api/slow",
            "method": "GET",
            "status_code": 200,
            "duration_ms": 3000.0,
            "timestamp": datetime.utcnow().isoformat(),
        })

        stats = get_response_time_stats()
        assert stats["slow_requests"] == 1


class TestErrorRateTracker:
    """错误率跟踪器测试"""

    def test_empty_tracker(self):
        """空跟踪器返回零值"""
        tracker = ErrorRateTracker(window_minutes=60)
        rate = tracker.get_error_rate()
        assert rate["total_requests"] == 0
        assert rate["error_count"] == 0
        assert rate["error_rate_percent"] == 0.0

    def test_record_and_calculate(self):
        """正确记录和计算错误率"""
        tracker = ErrorRateTracker(window_minutes=60)
        
        # 记录 8 个成功请求和 2 个错误请求
        for _ in range(8):
            tracker.record(200, "/api/ok")
        tracker.record(404, "/api/missing")
        tracker.record(500, "/api/error")

        rate = tracker.get_error_rate()
        assert rate["total_requests"] == 10
        assert rate["error_count"] == 2
        assert rate["error_rate_percent"] == 20.0
        assert rate["client_errors_4xx"] == 1
        assert rate["server_errors_5xx"] == 1

    def test_window_filtering(self):
        """窗口外的请求不计入统计"""
        tracker = ErrorRateTracker(window_minutes=5)
        
        # 模拟一个过期的请求
        old_request = {
            "status_code": 500,
            "path": "/api/old",
            "timestamp": datetime.utcnow() - timedelta(minutes=10),
            "is_error": True,
        }
        tracker._requests.append(old_request)
        
        # 添加一个新请求
        tracker.record(200, "/api/new")

        rate = tracker.get_error_rate()
        # 只有新请求在窗口内
        assert rate["total_requests"] == 1
        assert rate["error_count"] == 0

    def test_all_errors(self):
        """全部错误时错误率为 100%"""
        tracker = ErrorRateTracker(window_minutes=60)
        tracker.record(500, "/api/error1")
        tracker.record(503, "/api/error2")

        rate = tracker.get_error_rate()
        assert rate["error_rate_percent"] == 100.0
        assert rate["server_errors_5xx"] == 2


class TestStorageMonitor:
    """存储空间监控测试"""

    def test_get_storage_info_existing_path(self, tmp_path):
        """对存在的路径返回正确的存储信息"""
        monitor = StorageMonitor(storage_path=str(tmp_path))
        info = monitor.get_storage_info()

        assert info["storage_path"] == str(tmp_path)
        assert info["total_gb"] > 0
        assert info["free_gb"] > 0
        assert "usage_percent" in info
        assert "warning" in info
        assert "critical" in info

    def test_get_storage_info_nonexistent_path(self):
        """对不存在的路径返回错误信息"""
        monitor = StorageMonitor(storage_path="/nonexistent/path/xyz123")
        info = monitor.get_storage_info()

        assert "error" in info
        assert info["critical"] is True

    def test_firmware_storage_usage_empty(self, tmp_path):
        """空目录返回零值"""
        monitor = StorageMonitor(storage_path=str(tmp_path))
        usage = monitor.get_firmware_storage_usage()

        assert usage["firmware_count"] == 0
        assert usage["file_count"] == 0
        assert usage["total_size_mb"] == 0

    def test_firmware_storage_usage_with_files(self, tmp_path):
        """有固件文件时正确计算使用量"""
        # 创建模拟固件目录
        fw_dir = tmp_path / "abc123"
        fw_dir.mkdir()
        (fw_dir / "app.bin").write_bytes(b"x" * (1024 * 1024))  # 1 MB
        (fw_dir / "metadata.json").write_text("{}")

        monitor = StorageMonitor(storage_path=str(tmp_path))
        usage = monitor.get_firmware_storage_usage()

        assert usage["firmware_count"] == 1
        assert usage["file_count"] == 2
        assert usage["total_size_mb"] >= 1.0


class TestSetupLogging:
    """日志配置测试"""

    def test_setup_logging_runs(self):
        """setup_logging 不抛出异常"""
        import logging
        setup_logging(level=logging.DEBUG)
        # 验证 root logger 级别已设置
        assert logging.getLogger().level == logging.DEBUG
        # 恢复
        setup_logging(level=logging.INFO)
