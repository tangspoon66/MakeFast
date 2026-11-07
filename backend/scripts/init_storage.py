#!/usr/bin/env python3
"""
固件存储目录初始化脚本

此脚本用于：
1. 创建固件存储根目录
2. 设置正确的目录权限
3. 验证存储路径可用性
4. 创建必要的子目录结构
"""

import os
import sys
import stat
import shutil
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 将 backend 目录添加到 Python 路径
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent

# 默认配置
DEFAULT_STORAGE_PATH = "/opt/firmware"
DIRECTORY_PERMISSIONS = 0o755  # rwxr-xr-x
MIN_FREE_SPACE_GB = 1.0


def load_env_config() -> str:
    """
    从 .env 文件加载存储路径配置

    Returns:
        固件存储路径
    """
    env_path = BACKEND_DIR / ".env"
    storage_path = DEFAULT_STORAGE_PATH

    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('FIRMWARE_STORAGE_PATH='):
                    value = line.split('=', 1)[1].strip()
                    if value:
                        storage_path = value
                    break

    return storage_path


def check_disk_space(path: Path) -> tuple:
    """
    检查磁盘可用空间

    Args:
        path: 要检查的路径

    Returns:
        (total_gb, free_gb) 总空间和可用空间（GB）
    """
    # 找到已存在的父目录来检查磁盘空间
    check_path = path
    while not check_path.exists():
        check_path = check_path.parent
        if check_path == check_path.parent:
            break

    try:
        usage = shutil.disk_usage(str(check_path))
        total_gb = usage.total / (1024 ** 3)
        free_gb = usage.free / (1024 ** 3)
        return total_gb, free_gb
    except OSError:
        return 0.0, 0.0


def create_storage_directory(storage_path: Path) -> bool:
    """
    创建固件存储目录

    Args:
        storage_path: 存储目录路径

    Returns:
        True 如果创建成功
    """
    try:
        storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ 存储目录已创建: {storage_path}")
        return True
    except PermissionError:
        logger.error(f"✗ 权限不足，无法创建目录: {storage_path}")
        logger.error("  请使用 sudo 运行此脚本，或手动创建目录")
        return False
    except OSError as e:
        logger.error(f"✗ 创建目录失败: {e}")
        return False


def set_directory_permissions(storage_path: Path) -> bool:
    """
    设置目录权限

    Args:
        storage_path: 存储目录路径

    Returns:
        True 如果设置成功
    """
    try:
        os.chmod(str(storage_path), DIRECTORY_PERMISSIONS)
        logger.info(f"✓ 目录权限已设置: {oct(DIRECTORY_PERMISSIONS)}")
        return True
    except PermissionError:
        logger.warning(f"⚠ 无法设置目录权限 (需要 root 权限)")
        return False
    except OSError as e:
        logger.error(f"✗ 设置权限失败: {e}")
        return False


def verify_storage(storage_path: Path) -> bool:
    """
    验证存储目录可用性

    Args:
        storage_path: 存储目录路径

    Returns:
        True 如果验证通过
    """
    # 检查目录是否存在
    if not storage_path.exists():
        logger.error(f"✗ 目录不存在: {storage_path}")
        return False

    # 检查是否是目录
    if not storage_path.is_dir():
        logger.error(f"✗ 路径不是目录: {storage_path}")
        return False

    # 检查读写权限
    if not os.access(str(storage_path), os.R_OK | os.W_OK):
        logger.error(f"✗ 目录没有读写权限: {storage_path}")
        return False

    # 测试写入
    test_file = storage_path / ".write_test"
    try:
        test_file.write_text("test")
        test_file.unlink()
        logger.info("✓ 目录读写权限验证通过")
    except (IOError, OSError) as e:
        logger.error(f"✗ 目录写入测试失败: {e}")
        return False

    return True


def init_storage():
    """主函数：初始化固件存储目录"""
    print("=" * 60)
    print("  固件管理系统 - 存储目录初始化")
    print("=" * 60)
    print()

    # 1. 加载配置
    storage_path_str = load_env_config()

    # 支持命令行参数覆盖
    if len(sys.argv) > 1:
        storage_path_str = sys.argv[1]
        print(f"  使用命令行指定的路径: {storage_path_str}")
    else:
        print(f"  存储路径 (来自 .env 或默认值): {storage_path_str}")

    # 解析相对路径
    storage_path = Path(storage_path_str)
    if not storage_path.is_absolute():
        storage_path = (BACKEND_DIR / storage_path).resolve()
        print(f"  解析后的绝对路径: {storage_path}")

    print()

    # 2. 检查磁盘空间
    print("步骤 1/4: 检查磁盘空间")
    total_gb, free_gb = check_disk_space(storage_path)
    print(f"  磁盘总空间: {total_gb:.1f} GB")
    print(f"  可用空间: {free_gb:.1f} GB")

    if free_gb < MIN_FREE_SPACE_GB:
        logger.error(f"✗ 可用空间不足 (需要至少 {MIN_FREE_SPACE_GB} GB)")
        return 1

    print(f"  ✓ 磁盘空间充足 (>= {MIN_FREE_SPACE_GB} GB)")
    print()

    # 3. 创建目录
    print("步骤 2/4: 创建存储目录")
    if storage_path.exists():
        print(f"  目录已存在: {storage_path}")
    else:
        if not create_storage_directory(storage_path):
            return 1
    print()

    # 4. 设置权限
    print("步骤 3/4: 设置目录权限")
    set_directory_permissions(storage_path)
    print()

    # 5. 验证存储
    print("步骤 4/4: 验证存储可用性")
    if not verify_storage(storage_path):
        return 1
    print()

    # 6. 显示摘要
    print("=" * 60)
    print("  ✓ 固件存储目录初始化完成!")
    print("=" * 60)
    print()
    print(f"  存储路径: {storage_path}")
    print(f"  目录权限: {oct(DIRECTORY_PERMISSIONS)} (rwxr-xr-x)")
    print(f"  可用空间: {free_gb:.1f} GB")
    print()
    print("  提示:")
    print(f"  - 确保 .env 中 FIRMWARE_STORAGE_PATH={storage_path_str}")
    print("  - 生产环境建议使用独立磁盘分区")
    print("  - 建议定期备份固件数据")
    print()

    return 0


if __name__ == '__main__':
    sys.exit(init_storage())
