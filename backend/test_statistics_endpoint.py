"""
测试管理员统计端点

测试 GET /api/admin/statistics 端点的功能
"""

import os
import sys
from pathlib import Path

# 添加 app 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from app.main import app
from app.auth_service import auth_service

# 创建测试客户端
client = TestClient(app)


def get_admin_token() -> str:
    """获取管理员 token"""
    # 设置测试环境变量
    os.environ["ADMIN_USERNAME"] = "admin"
    os.environ["ADMIN_PASSWORD_HASH"] = auth_service.pwd_context.hash("admin123")
    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"
    
    # 登录获取 token
    response = client.post(
        "/api/admin/login",
        json={
            "username": "admin",
            "password": "admin123"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    return data["access_token"]


def test_statistics_endpoint_without_auth():
    """测试未认证访问统计端点"""
    response = client.get("/api/admin/statistics")
    
    # 应该返回 403 (未提供 token) 或 401 (token 无效)
    assert response.status_code in [401, 403]


def test_statistics_endpoint_with_auth():
    """测试已认证访问统计端点"""
    # 获取 token
    token = get_admin_token()
    
    # 访问统计端点
    response = client.get(
        "/api/admin/statistics",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # 验证响应
    assert response.status_code == 200
    data = response.json()
    
    # 验证响应结构
    assert data["success"] is True
    assert "data" in data
    
    statistics = data["data"]
    
    # 验证统计数据字段
    assert "total_firmwares" in statistics
    assert "total_size_mb" in statistics
    assert "total_downloads" in statistics
    assert "total_flashes" in statistics
    assert "popular_firmwares" in statistics
    assert "storage_warning" in statistics
    
    # 验证数据类型
    assert isinstance(statistics["total_firmwares"], int)
    assert isinstance(statistics["total_size_mb"], (int, float))
    assert isinstance(statistics["total_downloads"], int)
    assert isinstance(statistics["total_flashes"], int)
    assert isinstance(statistics["popular_firmwares"], list)
    assert isinstance(statistics["storage_warning"], bool)
    
    # 验证热门固件列表结构
    for firmware in statistics["popular_firmwares"]:
        assert "firmware_id" in firmware
        assert "project_name" in firmware
        assert "version" in firmware
        assert "download_count" in firmware
    
    print("\n✅ 统计端点测试通过!")
    print(f"📊 统计数据:")
    print(f"  - 固件总数: {statistics['total_firmwares']}")
    print(f"  - 存储空间: {statistics['total_size_mb']} MB")
    print(f"  - 下载次数: {statistics['total_downloads']}")
    print(f"  - 烧录次数: {statistics['total_flashes']}")
    print(f"  - 热门固件数量: {len(statistics['popular_firmwares'])}")
    print(f"  - 存储警告: {'是' if statistics['storage_warning'] else '否'}")


def test_statistics_endpoint_with_invalid_token():
    """测试使用无效 token 访问统计端点"""
    response = client.get(
        "/api/admin/statistics",
        headers={"Authorization": "Bearer invalid-token-12345"}
    )
    
    # 应该返回 401 (token 无效)
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["success"] is False
    assert "error_code" in data["detail"]


if __name__ == "__main__":
    print("🧪 开始测试管理员统计端点...\n")
    
    # 运行测试
    test_statistics_endpoint_without_auth()
    print("✅ 测试 1: 未认证访问 - 通过")
    
    test_statistics_endpoint_with_auth()
    print("✅ 测试 2: 已认证访问 - 通过")
    
    test_statistics_endpoint_with_invalid_token()
    print("✅ 测试 3: 无效 token - 通过")
    
    print("\n🎉 所有测试通过!")
