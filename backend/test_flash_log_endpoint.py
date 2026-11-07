"""
测试固件烧录统计端点

测试 POST /api/firmware/{id}/flash-log 端点的功能
"""

import sys
import os
from pathlib import Path

# 设置测试环境变量
os.environ["FIRMWARE_STORAGE_PATH"] = "./test_firmware_storage"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$test"

# 添加 app 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.firmware_manager import firmware_manager

client = TestClient(app)


def test_flash_log_success():
    """测试记录烧录成功事件"""
    # 使用一个已存在的固件 ID（需要先创建测试固件）
    # 这里假设有一个测试固件 ID
    firmware_id = "test_firmware_123"
    
    # 创建测试固件目录和元数据
    firmware_dir = firmware_manager.storage_path / firmware_id
    firmware_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建基本的元数据文件
    metadata = {
        "firmware_id": firmware_id,
        "project_name": "Test Firmware",
        "description": "Test firmware for flash log endpoint",
        "version": "1.0.0",
        "supported_board_ids": ["esp32"],  # 使用有效的 board ID
        "tags": [],
        "published": True,
        "created_at": "2024-01-01T00:00:00Z",
        "files": [],
        "total_size": 0,
        "has_thumbnail": False,
        "download_count": 0,
        "flash_count": 0,
        "flash_success_count": 0,
        "flash_failure_count": 0
    }
    
    import json
    with open(firmware_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    # 测试记录烧录成功
    response = client.post(
        f"/api/firmware/{firmware_id}/flash-log",
        json={"success": True}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "烧录统计已更新"
    
    # 验证统计数据已更新
    firmware = firmware_manager.get_firmware_detail(firmware_id)
    assert firmware.flash_count == 1
    assert firmware.flash_success_count == 1
    assert firmware.flash_failure_count == 0
    
    # 清理测试数据
    import shutil
    shutil.rmtree(firmware_dir)


def test_flash_log_failure():
    """测试记录烧录失败事件"""
    firmware_id = "test_firmware_456"
    
    # 创建测试固件目录和元数据
    firmware_dir = firmware_manager.storage_path / firmware_id
    firmware_dir.mkdir(parents=True, exist_ok=True)
    
    metadata = {
        "firmware_id": firmware_id,
        "project_name": "Test Firmware",
        "description": "Test firmware for flash log endpoint",
        "version": "1.0.0",
        "supported_board_ids": ["esp32"],  # 使用有效的 board ID
        "tags": [],
        "published": True,
        "created_at": "2024-01-01T00:00:00Z",
        "files": [],
        "total_size": 0,
        "has_thumbnail": False,
        "download_count": 0,
        "flash_count": 0,
        "flash_success_count": 0,
        "flash_failure_count": 0
    }
    
    import json
    with open(firmware_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    # 测试记录烧录失败
    response = client.post(
        f"/api/firmware/{firmware_id}/flash-log",
        json={"success": False}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "烧录统计已更新"
    
    # 验证统计数据已更新
    firmware = firmware_manager.get_firmware_detail(firmware_id)
    assert firmware.flash_count == 1
    assert firmware.flash_success_count == 0
    assert firmware.flash_failure_count == 1
    
    # 清理测试数据
    import shutil
    shutil.rmtree(firmware_dir)


def test_flash_log_firmware_not_found():
    """测试固件不存在的情况"""
    response = client.post(
        "/api/firmware/nonexistent_firmware/flash-log",
        json={"success": True}
    )
    
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["success"] is False
    assert data["detail"]["error_code"] == "firmware_not_found"


def test_flash_log_missing_success_field():
    """测试缺少 success 字段的情况"""
    firmware_id = "test_firmware_789"
    
    # 创建测试固件
    firmware_dir = firmware_manager.storage_path / firmware_id
    firmware_dir.mkdir(parents=True, exist_ok=True)
    
    metadata = {
        "firmware_id": firmware_id,
        "project_name": "Test Firmware",
        "description": "Test firmware for flash log endpoint",
        "version": "1.0.0",
        "supported_board_ids": ["esp32"],  # 使用有效的 board ID
        "tags": [],
        "published": True,
        "created_at": "2024-01-01T00:00:00Z",
        "files": [],
        "total_size": 0,
        "has_thumbnail": False,
        "download_count": 0,
        "flash_count": 0,
        "flash_success_count": 0,
        "flash_failure_count": 0
    }
    
    import json
    with open(firmware_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    # 测试缺少 success 字段
    response = client.post(
        f"/api/firmware/{firmware_id}/flash-log",
        json={}
    )
    
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["success"] is False
    assert data["detail"]["error_code"] == "invalid_request"
    assert "success" in data["detail"]["message"]
    
    # 清理测试数据
    import shutil
    shutil.rmtree(firmware_dir)


def test_flash_log_invalid_success_type():
    """测试 success 字段类型错误的情况"""
    firmware_id = "test_firmware_101"
    
    # 创建测试固件
    firmware_dir = firmware_manager.storage_path / firmware_id
    firmware_dir.mkdir(parents=True, exist_ok=True)
    
    metadata = {
        "firmware_id": firmware_id,
        "project_name": "Test Firmware",
        "description": "Test firmware for flash log endpoint",
        "version": "1.0.0",
        "supported_board_ids": ["esp32"],  # 使用有效的 board ID
        "tags": [],
        "published": True,
        "created_at": "2024-01-01T00:00:00Z",
        "files": [],
        "total_size": 0,
        "has_thumbnail": False,
        "download_count": 0,
        "flash_count": 0,
        "flash_success_count": 0,
        "flash_failure_count": 0
    }
    
    import json
    with open(firmware_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    # 测试 success 字段类型错误（字符串而不是布尔值）
    response = client.post(
        f"/api/firmware/{firmware_id}/flash-log",
        json={"success": "true"}
    )
    
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["success"] is False
    assert data["detail"]["error_code"] == "invalid_request"
    assert "布尔值" in data["detail"]["message"]
    
    # 清理测试数据
    import shutil
    shutil.rmtree(firmware_dir)


if __name__ == "__main__":
    print("运行固件烧录统计端点测试...")
    
    # 确保存储目录存在
    firmware_manager.storage_path.mkdir(parents=True, exist_ok=True)
    
    # 运行测试
    test_flash_log_success()
    print("✓ 测试记录烧录成功事件 - 通过")
    
    test_flash_log_failure()
    print("✓ 测试记录烧录失败事件 - 通过")
    
    test_flash_log_firmware_not_found()
    print("✓ 测试固件不存在的情况 - 通过")
    
    test_flash_log_missing_success_field()
    print("✓ 测试缺少 success 字段的情况 - 通过")
    
    test_flash_log_invalid_success_type()
    print("✓ 测试 success 字段类型错误的情况 - 通过")
    
    print("\n所有测试通过！✓")
