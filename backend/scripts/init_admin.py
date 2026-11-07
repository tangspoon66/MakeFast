#!/usr/bin/env python3
"""
管理员账户初始化脚本

此脚本用于：
1. 交互式设置管理员用户名和密码
2. 生成 bcrypt 密码哈希
3. 生成随机 JWT 密钥
4. 将配置写入 .env 文件
"""

import os
import sys
import secrets
import getpass
import re
from pathlib import Path

# 将 backend 目录添加到 Python 路径
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from passlib.context import CryptContext

# 密码哈希上下文 (bcrypt, cost factor 12)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 配置常量
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 50
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def validate_username(username: str) -> bool:
    """
    验证用户名格式

    Args:
        username: 用户名

    Returns:
        True 如果用户名有效
    """
    if not (MIN_USERNAME_LENGTH <= len(username) <= MAX_USERNAME_LENGTH):
        print(f"  ✗ 用户名长度必须在 {MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH} 个字符之间")
        return False
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        print("  ✗ 用户名只能包含字母、数字、下划线和连字符")
        return False
    return True


def validate_password(password: str) -> bool:
    """
    验证密码强度

    Args:
        password: 密码

    Returns:
        True 如果密码有效
    """
    if not (MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH):
        print(f"  ✗ 密码长度必须在 {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} 个字符之间")
        return False
    if not re.search(r'[a-zA-Z]', password):
        print("  ✗ 密码必须包含至少一个字母")
        return False
    if not re.search(r'[0-9]', password):
        print("  ✗ 密码必须包含至少一个数字")
        return False
    return True


def generate_jwt_secret() -> str:
    """
    生成安全的 JWT 密钥

    Returns:
        64 字符的随机十六进制字符串
    """
    return secrets.token_hex(32)


def update_env_file(env_path: Path, config: dict) -> bool:
    """
    更新 .env 文件中的配置项

    Args:
        env_path: .env 文件路径
        config: 要更新的配置字典 {key: value}

    Returns:
        True 如果更新成功
    """
    # 读取现有内容
    existing_lines = []
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            existing_lines = f.readlines()

    # 更新或添加配置项
    updated_keys = set()
    new_lines = []

    for line in existing_lines:
        stripped = line.strip()
        # 检查是否是需要更新的配置项
        key_matched = False
        for key in config:
            if stripped.startswith(f"{key}=") or stripped.startswith(f"# {key}="):
                new_lines.append(f"{key}={config[key]}\n")
                updated_keys.add(key)
                key_matched = True
                break
        if not key_matched:
            new_lines.append(line)

    # 添加未找到的配置项
    remaining_keys = set(config.keys()) - updated_keys
    if remaining_keys:
        # 确保文件末尾有换行
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        new_lines.append('\n# 管理员认证配置 (由 init_admin.py 生成)\n')
        for key in remaining_keys:
            new_lines.append(f"{key}={config[key]}\n")

    # 写入文件
    try:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        return True
    except IOError as e:
        print(f"  ✗ 写入 .env 文件失败: {e}")
        return False


def init_admin():
    """主函数：交互式初始化管理员账户"""
    print("=" * 60)
    print("  固件管理系统 - 管理员账户初始化")
    print("=" * 60)
    print()

    env_path = BACKEND_DIR / ".env"

    # 检查是否已有管理员配置
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'ADMIN_PASSWORD_HASH=' in content:
            existing_hash = ""
            for line in content.split('\n'):
                if line.startswith('ADMIN_PASSWORD_HASH='):
                    existing_hash = line.split('=', 1)[1].strip()
                    break
            if existing_hash and existing_hash != "":
                print("⚠  检测到已有管理员配置。")
                confirm = input("是否覆盖现有配置？(y/N): ").strip().lower()
                if confirm != 'y':
                    print("\n已取消操作。")
                    return 0
                print()

    # 1. 输入用户名
    print("步骤 1/3: 设置管理员用户名")
    print(f"  (长度 {MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH}，仅字母、数字、下划线、连字符)")
    while True:
        username = input("  用户名: ").strip()
        if validate_username(username):
            break
    print()

    # 2. 输入密码
    print("步骤 2/3: 设置管理员密码")
    print(f"  (长度 {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH}，需包含字母和数字)")
    while True:
        password = getpass.getpass("  密码: ")
        if not validate_password(password):
            continue
        password_confirm = getpass.getpass("  确认密码: ")
        if password != password_confirm:
            print("  ✗ 两次输入的密码不一致，请重新输入")
            continue
        break
    print()

    # 3. 生成密码哈希和 JWT 密钥
    print("步骤 3/3: 生成安全配置")
    password_hash = pwd_context.hash(password)
    jwt_secret = generate_jwt_secret()
    print(f"  ✓ 密码哈希已生成 (bcrypt, cost factor 12)")
    print(f"  ✓ JWT 密钥已生成 (64 字符随机密钥)")
    print()

    # 4. 写入 .env 文件
    print("正在写入配置...")
    config = {
        "ADMIN_USERNAME": username,
        "ADMIN_PASSWORD_HASH": password_hash,
        "JWT_SECRET_KEY": jwt_secret,
    }

    if update_env_file(env_path, config):
        print(f"  ✓ 配置已写入: {env_path}")
    else:
        # 如果写入失败，打印配置供手动添加
        print("\n  请手动将以下内容添加到 .env 文件:")
        print(f"  ADMIN_USERNAME={username}")
        print(f"  ADMIN_PASSWORD_HASH={password_hash}")
        print(f"  JWT_SECRET_KEY={jwt_secret}")
        return 1

    # 5. 显示摘要
    print()
    print("=" * 60)
    print("  ✓ 管理员账户初始化完成!")
    print("=" * 60)
    print()
    print(f"  用户名: {username}")
    print(f"  密码哈希: {password_hash[:20]}...")
    print(f"  JWT 密钥: {jwt_secret[:16]}...")
    print()
    print("  ⚠  请妥善保管密码，系统不存储明文密码。")
    print("  ⚠  生产环境请确保 .env 文件权限为 600。")
    print()

    return 0


if __name__ == '__main__':
    sys.exit(init_admin())
