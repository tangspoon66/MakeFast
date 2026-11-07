#!/usr/bin/env python3
"""
Arduino 工具链初始化脚本

此脚本负责：
1. 安装 Arduino CLI
2. 配置开发板索引
3. 安装项目开放开发板需要的核心包
"""

import subprocess
import os
import sys
import logging
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.toolchain_manager import build_arduino_env, ensure_required_platforms

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_command(cmd, check=True, shell=False):
    """执行命令并记录输出"""
    logger.info(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    try:
        result = subprocess.run(
            cmd,
            check=check,
            capture_output=True,
            text=True,
            shell=shell,
            env=build_arduino_env()
        )
        if result.stdout:
            logger.debug(result.stdout)
        return result
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e}")
        logger.error(f"stderr: {e.stderr}")
        raise


def check_arduino_cli_installed():
    """检查 Arduino CLI 是否已安装"""
    try:
        result = subprocess.run(
            ['arduino-cli', 'version'],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info(f"Arduino CLI already installed: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass
    return False


def install_arduino_cli():
    """安装 Arduino CLI"""
    logger.info("Installing Arduino CLI...")
    
    # 下载安装脚本
    install_script = "curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh"
    
    try:
        run_command(install_script, shell=True)
        
        # 将 arduino-cli 移动到 /usr/local/bin（如果需要）
        if os.path.exists('./bin/arduino-cli'):
            run_command(['sudo', 'mv', './bin/arduino-cli', '/usr/local/bin/'])
            run_command(['sudo', 'chmod', '+x', '/usr/local/bin/arduino-cli'])
        
        logger.info("✓ Arduino CLI installed successfully")
    except Exception as e:
        logger.error(f"Failed to install Arduino CLI: {e}")
        raise


def init_arduino_config():
    """初始化 Arduino CLI 配置"""
    logger.info("Initializing Arduino CLI config...")

    arduino_data_dir = os.environ.get("ARDUINO_DATA_DIR", "/opt/libraries/arduino15")
    os.environ.setdefault("ARDUINO_DATA_DIR", arduino_data_dir)
    os.environ.setdefault("ARDUINO_DIRECTORIES_DATA", arduino_data_dir)
    os.environ.setdefault("ARDUINO_DIRECTORIES_USER", os.environ.get("ARDUINO_LIBRARIES_DIR", "/opt/libraries/arduino"))

    arduino_cli_config_dir = os.path.join(arduino_data_dir, "config")
    os.makedirs(arduino_cli_config_dir, exist_ok=True)
    os.environ.setdefault("ARDUINO_CLI_CONFIG_DIR", arduino_cli_config_dir)
    os.environ.setdefault("XDG_CONFIG_HOME", arduino_cli_config_dir)
    
    # 初始化配置
    run_command(['arduino-cli', 'config', 'init'])
    
    logger.info("✓ Arduino CLI config initialized")


def update_board_index():
    """更新开发板索引"""
    logger.info("Updating board index...")
    start = time.time()
    run_command(['arduino-cli', 'core', 'update-index'])
    logger.info(f"Board index updated in {time.time() - start:.2f}s")
    logger.info("✓ Board index updated")


def verify_installation():
    """验证安装"""
    logger.info("Verifying installation...")
    
    # 检查 Arduino CLI 版本
    result = run_command(['arduino-cli', 'version'])
    logger.info(f"Arduino CLI version: {result.stdout.strip()}")
    
    # 检查已安装的核心
    result = run_command(['arduino-cli', 'core', 'list'])
    logger.info("Installed cores:")
    logger.info(result.stdout)
    
    logger.info("✓ Installation verified")


def init_toolchain():
    """主函数：初始化工具链"""
    try:
        logger.info("=" * 60)
        logger.info("ESP32 Toolchain Initialization")
        logger.info("=" * 60)
        
        # 1. 检查并安装 Arduino CLI
        if not check_arduino_cli_installed():
            install_arduino_cli()
        
        # 2. 初始化配置
        init_arduino_config()
        
        # 3. 安装当前项目开放开发板需要的核心包
        start = time.time()
        installed = ensure_required_platforms()
        logger.info(f"Required Arduino platforms ensured in {time.time() - start:.2f}s: {installed or 'already installed'}")
        
        # 5. 验证安装
        verify_installation()
        
        logger.info("=" * 60)
        logger.info("✓ Toolchain initialization complete!")
        logger.info("=" * 60)
        
        return 0
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"✗ Toolchain initialization failed: {e}")
        logger.error("=" * 60)
        return 1


if __name__ == '__main__':
    sys.exit(init_toolchain())
