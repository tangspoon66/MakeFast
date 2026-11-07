#!/usr/bin/env python3
"""
预装库安装脚本

此脚本负责安装 20-30 个常用的 ESP32 库，以提高编译成功率。
这些库将在服务器启动时预装，避免用户等待下载。
"""

import subprocess
import sys
import logging
import os
import time
from typing import List, Tuple

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def build_arduino_env() -> dict:
    env = os.environ.copy()
    for key in ("ARDUINO_DATA_DIR", "ARDUINO_DIRECTORIES_DATA", "ARDUINO_DIRECTORIES_USER", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"):
        value = os.environ.get(key)
        if value:
            env[key] = value
    return env

# 预装库列表
# 注意：WiFi, Bluetooth, SPIFFS, SD, Wire, SPI 是 ESP32 核心自带的，无需安装
PREINSTALLED_LIBRARIES = [
    # 网络库
    'PubSubClient',           # MQTT 客户端
    'ArduinoJson',            # JSON 解析
    'ESP Async WebServer',    # 异步 Web 服务器 (ESP32Async 分支，兼容 core 3.x)
    'Async TCP',              # 异步 TCP 库 (ESP32Async 分支，兼容 mbedTLS 3.x)
    
    # 显示屏库
    'Adafruit GFX Library',   # 图形库基础
    'Adafruit SSD1306',       # OLED 显示屏
    'TFT_eSPI',               # TFT 显示屏
    'U8g2',                   # 通用显示库
    
    # 传感器库
    'DHT sensor library',     # DHT 温湿度传感器
    'Adafruit BME280 Library', # BME280 传感器
    'OneWire',                # 单总线协议
    'DallasTemperature',      # DS18B20 温度传感器
    'Adafruit Unified Sensor', # 传感器统一接口
    
    # LED 和伺服库
    'FastLED',                # LED 控制
    'Servo',                  # 伺服电机（通用）
    'ESP32Servo',             # ESP32 专用伺服库
    
    # 其他常用库
    'Adafruit NeoPixel',      # NeoPixel LED
    'Adafruit BusIO',         # I2C/SPI 总线抽象
]


def run_command(cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
    """执行命令并返回结果"""
    logger.debug(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            check=check,
            capture_output=True,
            text=True,
            timeout=120,  # 2 分钟超时
            env=build_arduino_env(),
        )
        return result
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e}")
        logger.error(f"stderr: {e.stderr}")
        raise
    except subprocess.TimeoutExpired as e:
        logger.error(f"Command timed out: {e}")
        raise


def check_library_installed(lib_name: str) -> bool:
    """检查库是否已安装"""
    try:
        result = run_command(['arduino-cli', 'lib', 'list'], check=False)
        return lib_name in result.stdout
    except Exception:
        return False


def install_library(lib_name: str) -> Tuple[bool, str]:
    """
    安装单个库
    
    Returns:
        (success, message): 安装是否成功和消息
    """
    logger.info(f"Installing '{lib_name}'...")
    start_time = time.time()
    
    # 检查是否已安装
    if check_library_installed(lib_name):
        logger.info(f"  ✓ '{lib_name}' already installed")
        return True, "already installed"
    
    try:
        result = run_command(['arduino-cli', 'lib', 'install', lib_name])
        duration = time.time() - start_time
        logger.info(f"  ✓ '{lib_name}' installed successfully in {duration:.2f}s")
        return True, "installed"
    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        logger.error(f"  ✗ '{lib_name}' installation timed out after {duration:.2f}s")
        return False, "timeout"
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.strip() if e.stderr else "unknown error"
        duration = time.time() - start_time
        logger.error(f"  ✗ '{lib_name}' installation failed after {duration:.2f}s: {error_msg}")
        return False, error_msg
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"  ✗ '{lib_name}' installation failed after {duration:.2f}s: {e}")
        return False, str(e)


def install_libraries(libraries: List[str]) -> Tuple[int, int, int]:
    """
    安装所有预装库
    
    Returns:
        (installed, already_installed, failed): 安装成功、已安装、失败的数量
    """
    installed = 0
    already_installed = 0
    failed = 0
    failed_libs = []
    
    logger.info("=" * 60)
    logger.info(f"Installing {len(libraries)} preinstalled libraries...")
    logger.info("=" * 60)
    
    for i, lib in enumerate(libraries, 1):
        logger.info(f"[{i}/{len(libraries)}] Processing '{lib}'")
        success, message = install_library(lib)
        
        if success:
            if message == "already installed":
                already_installed += 1
            else:
                installed += 1
        else:
            failed += 1
            failed_libs.append((lib, message))
    
    # 打印总结
    logger.info("=" * 60)
    logger.info("Installation Summary:")
    logger.info(f"  ✓ Newly installed: {installed}")
    logger.info(f"  ✓ Already installed: {already_installed}")
    logger.info(f"  ✗ Failed: {failed}")
    logger.info("=" * 60)
    
    if failed_libs:
        logger.warning("Failed libraries:")
        for lib, error in failed_libs:
            logger.warning(f"  - {lib}: {error}")
        logger.info("=" * 60)
    
    return installed, already_installed, failed


def verify_installation():
    """验证安装的库"""
    logger.info("Verifying installed libraries...")
    
    try:
        result = run_command(['arduino-cli', 'lib', 'list'])
        logger.info("Installed libraries:")
        logger.info(result.stdout)
    except Exception as e:
        logger.error(f"Failed to verify installation: {e}")


def main():
    """主函数"""
    try:
        logger.info("=" * 60)
        logger.info("ESP32 Preinstalled Libraries Installation")
        logger.info("=" * 60)
        
        # 检查 Arduino CLI 是否可用
        try:
            result = run_command(['arduino-cli', 'version'])
            logger.info(f"Arduino CLI version: {result.stdout.strip()}")
        except FileNotFoundError:
            logger.error("Arduino CLI not found. Please run init_toolchain.py first.")
            return 1
        
        # 安装库
        installed, already_installed, failed = install_libraries(PREINSTALLED_LIBRARIES)
        
        # 验证安装
        verify_installation()
        
        # 返回状态
        if failed > 0:
            logger.warning(f"✗ Installation completed with {failed} failures")
            return 1
        else:
            logger.info("✓ All libraries installed successfully!")
            return 0
            
    except Exception as e:
        logger.error(f"✗ Installation failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
