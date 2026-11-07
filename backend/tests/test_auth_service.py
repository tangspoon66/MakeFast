"""
认证服务单元测试

测试 AuthService 的核心功能：
- 密码哈希和验证
- JWT token 生成和验证
- 登录频率限制
- 账户锁定机制
"""

import os
import pytest
from datetime import datetime, timedelta
from app.auth_service import AuthService, hash_password, verify_password


@pytest.fixture
def auth_service():
    """创建测试用的 AuthService 实例"""
    # 设置测试环境变量
    os.environ["ADMIN_USERNAME"] = "testadmin"
    os.environ["ADMIN_PASSWORD_HASH"] = hash_password("testpassword123")
    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing"
    
    service = AuthService()
    # 清空登录尝试记录
    service._login_attempts = {}
    
    return service


class TestPasswordHashing:
    """测试密码哈希功能"""
    
    def test_hash_password_creates_valid_hash(self):
        """测试密码哈希生成"""
        password = "SyntheticTestPassword2!"
        hashed = hash_password(password)
        
        # bcrypt 哈希应该以 $2b$ 开头
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60  # bcrypt 哈希固定长度
    
    def test_verify_password_with_correct_password(self):
        """测试正确密码验证"""
        password = "SyntheticTestPassword2!"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_with_incorrect_password(self):
        """测试错误密码验证"""
        password = "SyntheticTestPassword2!"
        hashed = hash_password(password)
        
        assert verify_password("wrongpassword", hashed) is False
    
    def test_different_passwords_produce_different_hashes(self):
        """测试不同密码产生不同哈希"""
        hash1 = hash_password("password1")
        hash2 = hash_password("password2")
        
        assert hash1 != hash2
    
    def test_same_password_produces_different_hashes(self):
        """测试相同密码产生不同哈希（salt）"""
        password = "SyntheticTestPassword2!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # 由于 salt，相同密码应该产生不同哈希
        assert hash1 != hash2
        # 但都应该能验证通过
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestAuthentication:
    """测试认证功能"""
    
    def test_authenticate_with_valid_credentials(self, auth_service):
        """测试有效凭证认证"""
        token = auth_service.authenticate("testadmin", "testpassword123")
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_authenticate_with_invalid_username(self, auth_service):
        """测试无效用户名"""
        token = auth_service.authenticate("wronguser", "testpassword123")
        
        assert token is None
    
    def test_authenticate_with_invalid_password(self, auth_service):
        """测试无效密码"""
        token = auth_service.authenticate("testadmin", "wrongpassword")
        
        assert token is None
    
    def test_authenticate_with_short_username(self, auth_service):
        """测试用户名过短（< 3 字符）"""
        token = auth_service.authenticate("ab", "testpassword123")
        
        assert token is None
    
    def test_authenticate_with_long_username(self, auth_service):
        """测试用户名过长（> 50 字符）"""
        long_username = "a" * 51
        token = auth_service.authenticate(long_username, "testpassword123")
        
        assert token is None
    
    def test_authenticate_with_short_password(self, auth_service):
        """测试密码过短（< 8 字符）"""
        token = auth_service.authenticate("testadmin", "short")
        
        assert token is None
    
    def test_authenticate_with_long_password(self, auth_service):
        """测试密码过长（> 128 字符）"""
        long_password = "a" * 129
        token = auth_service.authenticate("testadmin", long_password)
        
        assert token is None
    
    def test_authenticate_clears_failed_attempts_on_success(self, auth_service):
        """测试成功登录清除失败记录"""
        # 先失败几次
        auth_service.authenticate("testadmin", "wrongpassword")
        auth_service.authenticate("testadmin", "wrongpassword")
        
        assert "testadmin" in auth_service._login_attempts
        
        # 成功登录
        token = auth_service.authenticate("testadmin", "testpassword123")
        
        assert token is not None
        assert "testadmin" not in auth_service._login_attempts


class TestTokenVerification:
    """测试 Token 验证功能"""
    
    def test_verify_valid_token(self, auth_service):
        """测试验证有效 token"""
        token = auth_service.authenticate("testadmin", "testpassword123")
        
        user_info = auth_service.verify_token(token)
        
        assert user_info is not None
        assert user_info["username"] == "testadmin"
        assert "exp" in user_info
    
    def test_verify_invalid_token(self, auth_service):
        """测试验证无效 token"""
        invalid_token = "invalid.token.string"
        
        user_info = auth_service.verify_token(invalid_token)
        
        assert user_info is None
    
    def test_verify_expired_token(self, auth_service):
        """测试验证过期 token"""
        # 生成一个已过期的 token
        import jwt
        
        expire = datetime.utcnow() - timedelta(hours=1)  # 1 小时前过期
        payload = {
            "sub": "testadmin",
            "exp": expire,
            "iat": datetime.utcnow() - timedelta(hours=2)
        }
        
        expired_token = jwt.encode(
            payload,
            auth_service.jwt_secret_key,
            algorithm=auth_service.jwt_algorithm
        )
        
        user_info = auth_service.verify_token(expired_token)
        
        assert user_info is None
    
    def test_verify_token_without_username(self, auth_service):
        """测试验证缺少用户名的 token"""
        import jwt
        
        expire = datetime.utcnow() + timedelta(hours=1)
        payload = {
            "exp": expire,
            "iat": datetime.utcnow()
            # 缺少 "sub" (username)
        }
        
        token = jwt.encode(
            payload,
            auth_service.jwt_secret_key,
            algorithm=auth_service.jwt_algorithm
        )
        
        user_info = auth_service.verify_token(token)
        
        assert user_info is None


class TestRateLimiting:
    """测试频率限制功能"""
    
    def test_account_not_locked_initially(self, auth_service):
        """测试账户初始未锁定"""
        assert auth_service.check_rate_limit("testadmin") is True
        assert auth_service._is_account_locked("testadmin") is False
    
    def test_account_locked_after_5_failures(self, auth_service):
        """测试 5 次失败后账户锁定"""
        # 失败 5 次
        for _ in range(5):
            auth_service.authenticate("testadmin", "wrongpassword")
        
        # 账户应该被锁定
        assert auth_service._is_account_locked("testadmin") is True
        assert auth_service.check_rate_limit("testadmin") is False
    
    def test_locked_account_prevents_login(self, auth_service):
        """测试锁定账户阻止登录"""
        # 失败 5 次锁定账户
        for _ in range(5):
            auth_service.authenticate("testadmin", "wrongpassword")
        
        # 尝试用正确密码登录应该抛出异常
        with pytest.raises(ValueError, match="账户已被临时锁定"):
            auth_service.authenticate("testadmin", "testpassword123")
    
    def test_lockout_duration_30_minutes(self, auth_service):
        """测试锁定时长为 30 分钟"""
        # 锁定账户
        auth_service.lock_account("testadmin", duration_minutes=30)
        
        # 检查剩余时间
        remaining = auth_service._get_lockout_remaining("testadmin")
        
        # 应该接近 30 分钟（允许几秒误差）
        assert 29 <= remaining <= 30
    
    def test_failed_attempts_reset_after_15_minutes(self, auth_service):
        """测试 15 分钟后失败计数重置"""
        # 失败 3 次
        for _ in range(3):
            auth_service.authenticate("testadmin", "wrongpassword")
        
        assert auth_service._login_attempts["testadmin"]["count"] == 3
        
        # 模拟 15 分钟后
        auth_service._login_attempts["testadmin"]["first_attempt"] = (
            datetime.utcnow() - timedelta(minutes=16)
        )
        
        # 再次失败，应该重置计数
        auth_service.authenticate("testadmin", "wrongpassword")
        
        # 计数应该重置为 1
        assert auth_service._login_attempts["testadmin"]["count"] == 1
    
    def test_lockout_expires_after_duration(self, auth_service):
        """测试锁定过期后可以登录"""
        # 锁定账户 1 秒
        auth_service.lock_account("testadmin", duration_minutes=0)
        auth_service._login_attempts["testadmin"]["locked_until"] = (
            datetime.utcnow() - timedelta(seconds=1)  # 已过期
        )
        
        # 应该不再锁定
        assert auth_service._is_account_locked("testadmin") is False
        
        # 应该能成功登录
        token = auth_service.authenticate("testadmin", "testpassword123")
        assert token is not None


class TestAccountLocking:
    """测试账户锁定功能"""
    
    def test_lock_account_manually(self, auth_service):
        """测试手动锁定账户"""
        auth_service.lock_account("testadmin", duration_minutes=10)
        
        assert auth_service._is_account_locked("testadmin") is True
    
    def test_get_lockout_remaining_time(self, auth_service):
        """测试获取锁定剩余时间"""
        auth_service.lock_account("testadmin", duration_minutes=15)
        
        remaining = auth_service._get_lockout_remaining("testadmin")
        
        # 应该接近 15 分钟
        assert 14 <= remaining <= 15
    
    def test_lockout_remaining_zero_when_not_locked(self, auth_service):
        """测试未锁定时剩余时间为 0"""
        remaining = auth_service._get_lockout_remaining("testadmin")
        
        assert remaining == 0
    
    def test_clear_failed_attempts(self, auth_service):
        """测试清除失败记录"""
        # 失败几次
        for _ in range(3):
            auth_service.authenticate("testadmin", "wrongpassword")
        
        assert "testadmin" in auth_service._login_attempts
        
        # 清除记录
        auth_service._clear_failed_attempts("testadmin")
        
        assert "testadmin" not in auth_service._login_attempts


class TestTokenExpiration:
    """测试 Token 过期功能"""
    
    def test_token_expires_in_24_hours(self, auth_service):
        """测试 token 按配置的 JWT_EXPIRE_HOURS 过期（默认 2 小时）"""
        token = auth_service.authenticate("testadmin", "testpassword123")
        user_info = auth_service.verify_token(token)
        
        # 计算过期时间
        exp_timestamp = user_info["exp"]
        exp_datetime = datetime.utcfromtimestamp(exp_timestamp)
        now = datetime.utcnow()
        
        hours_until_expiry = (exp_datetime - now).total_seconds() / 3600
        expected = auth_service.token_expire_hours
        assert expected - 1 <= hours_until_expiry <= expected
