"""
认证服务模块

提供管理员身份验证、JWT Token 管理、登录频率限制和账户锁定功能。
"""

import os
import json
import logging
from pathlib import Path as _EnvPath
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from passlib.context import CryptContext
import jwt

# 确保 .env 在模块级实例化之前加载
from dotenv import load_dotenv
_env_path = _EnvPath(__file__).parent.parent / '.env'
if os.environ.get("MAKEFAST_SKIP_DOTENV") != "1":
    load_dotenv(dotenv_path=_env_path)

logger = logging.getLogger(__name__)

# 密码哈希上下文 (bcrypt, cost factor 12)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")



def _as_utc(dt):
    """把 naive datetime（旧数据 / utcnow()）视为 UTC，统一成 aware，避免比较时 TypeError。"""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class AuthService:
    """认证服务类"""
    
    def __init__(self):
        """初始化认证服务"""
        # 从环境变量加载配置
        self.admin_username = os.getenv("ADMIN_USERNAME", "admin")
        self.admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", "")
        self.jwt_algorithm = "HS256"
        self.token_expire_hours = int(os.getenv("JWT_EXPIRE_HOURS", "2"))

        # Token 黑名单（登出后失效）
        self._token_blacklist: set = set()

        # 登录失败跟踪 (内存存储)
        # 格式: {username: {"count": int, "locked_until": datetime}}
        self._login_attempts: Dict[str, Dict] = {}
        self._login_attempts_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "login_attempts.json"
        )
        self._load_login_attempts()  # 启动时恢复持久化状态

        # 配置验证
        if not self.jwt_secret_key:
            logger.error("JWT_SECRET_KEY not configured! Refusing to start with insecure default.")
            raise RuntimeError("JWT_SECRET_KEY 环境变量未配置，拒绝使用不安全的默认密钥启动")
        
        if not self.admin_password_hash:
            logger.warning("ADMIN_PASSWORD_HASH not configured! Admin login will fail.")
    
    def authenticate(self, username: str, password: str) -> Optional[str]:
        """
        验证用户名密码，返回 JWT token
        
        Args:
            username: 用户名 (3-50 字符)
            password: 密码 (8-128 字符)
        
        Returns:
            JWT token 字符串，如果认证失败返回 None
        
        Raises:
            ValueError: 如果账户被锁定或频率限制
        """
        # 验证输入长度
        if not (3 <= len(username) <= 50):
            logger.warning(f"Invalid username length: {len(username)}")
            self._record_failed_attempt(username)
            return None
        
        if not (8 <= len(password) <= 128):
            logger.warning(f"Invalid password length for user {username}")
            self._record_failed_attempt(username)
            return None
        
        # 检查账户是否被锁定
        if self._is_account_locked(username):
            remaining = self._get_lockout_remaining(username)
            raise ValueError(
                f"账户已被临时锁定，请在 {remaining} 分钟后重试。"
            )
        
        # 管理员后台账户（SQLite admin_users，带角色）。环境变量超级管理员优先。
        env_ok = (
            username == self.admin_username
            and bool(self.admin_password_hash)
            and pwd_context.verify(password, self.admin_password_hash)
        )
        if not env_ok:
            console_user = self._authenticate_console(username, password)
            if console_user:
                self._clear_failed_attempts(username)
                return self._generate_token(console_user["username"], role=console_user["role"], source="console")

        # 验证用户名
        if username != self.admin_username:
            logger.warning(f"Invalid username attempt: {username}")
            self._record_failed_attempt(username)
            return None
        
        # 验证密码
        if not self.admin_password_hash:
            logger.error("Admin password hash not configured")
            return None
        
        if not pwd_context.verify(password, self.admin_password_hash):
            logger.warning(f"Invalid password for user: {username}")
            self._record_failed_attempt(username)
            return None
        
        # 认证成功，清除失败记录
        self._clear_failed_attempts(username)
        
        # 生成 JWT token
        token = self._generate_token(username)
        logger.info(f"User authenticated successfully: {username}")
        
        return token
    
    def revoke_token(self, token: str) -> None:
        """将 token 加入黑名单（登出时调用）"""
        self._token_blacklist.add(token)
        logger.info("Token revoked (added to blacklist)")

    def verify_token(self, token: str) -> Optional[dict]:
        """
        验证 token 有效性，返回用户信息

        Args:
            token: JWT token 字符串

        Returns:
            包含用户信息的字典，如果 token 无效返回 None
            格式: {"username": str, "exp": int}
        """
        # 检查黑名单
        if token in self._token_blacklist:
            logger.warning("Token rejected: in blacklist")
            return None

        try:
            payload = jwt.decode(
                token,
                self.jwt_secret_key,
                algorithms=[self.jwt_algorithm]
            )
            
            # 检查 token 是否过期
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                logger.warning("Token expired")
                return None
            
            username = payload.get("sub")
            if not username:
                logger.warning("Token missing username")
                return None
            
            return {
                "username": username,
                "exp": exp,
                "role": payload.get("role") or "admin",
                "source": payload.get("src") or "env",
            }
        
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired (ExpiredSignatureError)")
            return None
        
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    def check_rate_limit(self, username: str) -> bool:
        """
        检查登录频率限制
        
        Args:
            username: 用户名
        
        Returns:
            True 如果未超过频率限制，False 如果超过限制
        """
        return not self._is_account_locked(username)
    
    def lock_account(self, username: str, duration_minutes: int = 30):
        """
        锁定账户
        
        Args:
            username: 用户名
            duration_minutes: 锁定时长（分钟）
        """
        locked_until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        
        if username not in self._login_attempts:
            self._login_attempts[username] = {"count": 0, "locked_until": None}
        
        self._login_attempts[username]["locked_until"] = locked_until
        self._persist_login_attempts()
        logger.warning(f"Account locked: {username} until {locked_until}")
    
    def _authenticate_console(self, username: str, password: str) -> Optional[dict]:
        """Check the admin console user table (role-based accounts)."""
        try:
            from .admin_console.store import console_store
            row = console_store.get_user_row(username)
        except Exception as exc:  # pragma: no cover - database unavailable
            logger.warning(f"Admin console user lookup failed: {exc}")
            return None
        if not row or row["disabled"]:
            return None
        try:
            if not pwd_context.verify(password, row["password_hash"]):
                return None
        except Exception:
            return None
        console_store.touch_login(row["username"])
        return {"username": row["username"], "role": row["role"]}

    def _generate_token(self, username: str, role: str = "admin", source: str = "env") -> str:
        """
        生成 JWT token
        
        Args:
            username: 用户名
        
        Returns:
            JWT token 字符串
        """
        expire = datetime.now(timezone.utc) + timedelta(hours=self.token_expire_hours)
        
        payload = {
            "sub": username,
            "role": role,
            "src": source,
            "exp": expire,
            "iat": datetime.now(timezone.utc)
        }
        
        token = jwt.encode(
            payload,
            self.jwt_secret_key,
            algorithm=self.jwt_algorithm
        )
        
        return token
    
    def _load_login_attempts(self):
        """从 JSON 文件恢复登录失败记录（持久化）"""
        try:
            if os.path.exists(self._login_attempts_file):
                with open(self._login_attempts_file, "r") as f:
                    data = json.load(f)
                for username, record in data.items():
                    entry = {"count": record.get("count", 0)}
                    if record.get("locked_until"):
                        entry["locked_until"] = _as_utc(datetime.fromisoformat(record["locked_until"]))
                    else:
                        entry["locked_until"] = None
                    if record.get("first_attempt"):
                        entry["first_attempt"] = _as_utc(datetime.fromisoformat(record["first_attempt"]))
                    self._login_attempts[username] = entry
                logger.info(f"Loaded {len(data)} login attempt records from disk")
        except Exception as e:
            logger.warning(f"Failed to load login attempts: {e}")

    def _persist_login_attempts(self):
        """将登录失败记录写入 JSON 文件"""
        try:
            data = {}
            for username, record in self._login_attempts.items():
                entry = {"count": record.get("count", 0)}
                if record.get("locked_until"):
                    entry["locked_until"] = record["locked_until"].isoformat()
                if record.get("first_attempt"):
                    entry["first_attempt"] = record["first_attempt"].isoformat()
                data[username] = entry
            with open(self._login_attempts_file, "w") as f:
                json.dump(data, f)
        except Exception as e:
            logger.warning(f"Failed to persist login attempts: {e}")

    def _record_failed_attempt(self, username: str):
        """
        记录登录失败尝试
        
        Args:
            username: 用户名
        """
        now = datetime.now(timezone.utc)
        
        # 初始化或获取记录
        if username not in self._login_attempts:
            self._login_attempts[username] = {
                "count": 0,
                "locked_until": None,
                "first_attempt": now
            }
        
        attempt = self._login_attempts[username]
        
        # 如果距离第一次失败超过 15 分钟，重置计数
        if "first_attempt" in attempt:
            time_since_first = (now - _as_utc(attempt["first_attempt"])).total_seconds()
            if time_since_first > 15 * 60:  # 15 分钟
                attempt["count"] = 0
                attempt["first_attempt"] = now
        
        # 增加失败计数
        attempt["count"] += 1
        
        # 如果失败 5 次，锁定账户 30 分钟
        if attempt["count"] >= 5:
            self.lock_account(username, duration_minutes=30)
            logger.warning(
                f"Account locked due to 5 failed attempts: {username}"
            )

        self._persist_login_attempts()
    
    def _clear_failed_attempts(self, username: str):
        """
        清除登录失败记录

        Args:
            username: 用户名
        """
        if username in self._login_attempts:
            del self._login_attempts[username]
            self._persist_login_attempts()
    
    def _is_account_locked(self, username: str) -> bool:
        """
        检查账户是否被锁定
        
        Args:
            username: 用户名
        
        Returns:
            True 如果账户被锁定，False 否则
        """
        if username not in self._login_attempts:
            return False
        
        attempt = self._login_attempts[username]
        locked_until = attempt.get("locked_until")
        
        if not locked_until:
            return False
        
        # 检查锁定是否已过期
        if datetime.now(timezone.utc) >= _as_utc(locked_until):
            # 锁定已过期，清除记录
            self._clear_failed_attempts(username)
            return False
        
        return True
    
    def _get_lockout_remaining(self, username: str) -> int:
        """
        获取账户锁定剩余时间（分钟）
        
        Args:
            username: 用户名
        
        Returns:
            剩余锁定时间（分钟）
        """
        if username not in self._login_attempts:
            return 0
        
        attempt = self._login_attempts[username]
        locked_until = attempt.get("locked_until")
        
        if not locked_until:
            return 0
        
        remaining = (_as_utc(locked_until) - datetime.now(timezone.utc)).total_seconds()
        return max(0, int(remaining / 60))


# 全局认证服务实例
auth_service = AuthService()


def hash_password(password: str) -> str:
    """
    生成密码哈希（用于初始化脚本）
    
    Args:
        password: 明文密码
    
    Returns:
        bcrypt 哈希字符串
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    
    Args:
        plain_password: 明文密码
        hashed_password: 哈希密码
    
    Returns:
        True 如果密码匹配，False 否则
    """
    return pwd_context.verify(plain_password, hashed_password)
