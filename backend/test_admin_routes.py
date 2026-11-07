"""
测试管理员认证路由

手动测试脚本，用于验证管理员认证功能。
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient
from app.main import app

# 创建测试客户端
client = TestClient(app)


def test_admin_health():
    """测试管理员服务健康检查"""
    print("\n=== 测试管理员服务健康检查 ===")
    response = client.get("/api/admin/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["service"] == "admin-auth"
    print("✅ 健康检查通过")


def test_admin_login_invalid():
    """测试无效凭证登录"""
    print("\n=== 测试无效凭证登录 ===")
    response = client.post(
        "/api/admin/login",
        json={
            "username": "wrong_user",
            "password": "wrong_password"
        }
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error_code"] == "invalid_credentials"
    print("✅ 无效凭证测试通过")


def test_admin_login_valid():
    """测试有效凭证登录"""
    print("\n=== 测试有效凭证登录 ===")
    
    # 从环境变量获取管理员用户名
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    
    # 注意：这里使用的是明文密码 "admin123"
    # 对应的哈希值已经在 .env 文件中配置
    response = client.post(
        "/api/admin/login",
        json={
            "username": admin_username,
            "password": "admin123"
        }
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 86400
    print("✅ 有效凭证登录测试通过")
    
    return data["access_token"]


def test_verify_token(token: str):
    """测试 Token 验证"""
    print("\n=== 测试 Token 验证 ===")
    response = client.get(
        "/api/admin/verify",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "username" in data
    assert "expires_at" in data
    print("✅ Token 验证测试通过")


def test_verify_token_invalid():
    """测试无效 Token"""
    print("\n=== 测试无效 Token ===")
    response = client.get(
        "/api/admin/verify",
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error_code"] == "token_expired"
    print("✅ 无效 Token 测试通过")


def test_logout(token: str):
    """测试登出"""
    print("\n=== 测试登出 ===")
    response = client.post(
        "/api/admin/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    print("✅ 登出测试通过")


def test_logout_without_token():
    """测试未提供 Token 的登出"""
    print("\n=== 测试未提供 Token 的登出 ===")
    response = client.post("/api/admin/logout")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    assert response.status_code == 403  # Forbidden (no credentials)
    print("✅ 未提供 Token 测试通过")


def main():
    """运行所有测试"""
    print("=" * 60)
    print("管理员认证路由测试")
    print("=" * 60)
    
    try:
        # 1. 健康检查
        test_admin_health()
        
        # 2. 无效凭证登录
        test_admin_login_invalid()
        
        # 3. 有效凭证登录
        token = test_admin_login_valid()
        
        # 4. Token 验证
        test_verify_token(token)
        
        # 5. 无效 Token
        test_verify_token_invalid()
        
        # 6. 登出
        test_logout(token)
        
        # 7. 未提供 Token 的登出
        test_logout_without_token()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
