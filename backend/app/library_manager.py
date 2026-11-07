"""
库管理器

负责管理 ESP32 库的预装、检测、下载和缓存。
"""

import logging
import subprocess
import os
import json
import re
import time
from typing import Dict, List, Optional, Set
from pathlib import Path

logger = logging.getLogger(__name__)


class LibraryNotFoundError(Exception):
    """库未找到异常"""
    pass


class LibraryDownloadError(Exception):
    """库下载失败异常"""
    pass


class LibraryManager:
    """
    库管理器
    
    管理预装库和按需下载的库。
    - 预装库：服务器启动时安装的常用库
    - 缓存库：按需下载并缓存的库
    """
    
    # ESP32 核心自带的库（无需安装）
    CORE_LIBRARIES = {
        'WiFi',
        'Bluetooth',
        'BluetoothSerial',
        'SPIFFS',
        'SD',
        'Wire',
        'SPI',
        'HTTPClient',
        'WebServer',
        'Preferences',
        'ESPmDNS',
        'Update',
        'FS',
        'EEPROM',
    }
    
    # 预装库列表（通过 arduino-cli 安装的）
    PREINSTALLED_LIBRARIES = {
        'PubSubClient',
        'ArduinoJson',
        'ESP Async WebServer',   # ESP32Async 分支（兼容 mbedTLS 3.x）
        'Async TCP',             # ESP32Async 分支（兼容 mbedTLS 3.x）
        'Adafruit GFX Library',
        'Adafruit SSD1306',
        'TFT_eSPI',
        'U8g2',
        'DHT sensor library',
        'Adafruit BME280 Library',
        'OneWire',
        'DallasTemperature',
        'Adafruit Unified Sensor',
        'FastLED',
        'Servo',
        'ESP32Servo',
        'Adafruit NeoPixel',
        'Adafruit BusIO',
    }
    
    # 库名映射：从 include 文件名到实际库名
    # 用于处理 include 文件名和库名不一致的情况
    LIBRARY_NAME_MAPPING = {
        'Adafruit_NeoPixel': 'Adafruit NeoPixel',
        'Adafruit_SSD1306': 'Adafruit SSD1306',
        'Adafruit_GFX': 'Adafruit GFX Library',
        'Adafruit_BME280': 'Adafruit BME280 Library',
        'Adafruit_Sensor': 'Adafruit Unified Sensor',
        'Adafruit_BusIO': 'Adafruit BusIO',
        'DHT': 'DHT sensor library',
        'PubSubClient': 'PubSubClient',
        'ArduinoJson': 'ArduinoJson',
        'FastLED': 'FastLED',
        'OneWire': 'OneWire',
        'DallasTemperature': 'DallasTemperature',
        'TFT_eSPI': 'TFT_eSPI',
        'ESPAsyncWebServer': 'ESPAsyncWebServer',
        'AsyncTCP': 'Async TCP',
        'ESPAsyncTCP': 'Async TCP',
        'ESP Async TCP': 'Async TCP',
        'WebSockets': 'WebSockets',
        'NTPClient': 'NTPClient',
        'U8g2lib': 'U8g2',
        'Servo': 'Servo',
        'ESP32Servo': 'ESP32Servo',
        'esp_camera': 'ESP32 Camera',
        'camera': 'ESP32 Camera',
        'EloquentTinyML': 'EloquentTinyML',
        'lvgl': 'lvgl',
        'SD_MMC': 'SD_MMC',
        'LittleFS': 'LittleFS',
    }
    
    def __init__(self, cache_dir: str = None):
        """
        初始化库管理器
        
        Args:
            cache_dir: 库缓存目录，默认为 /opt/libraries/cache（生产环境）或 /tmp/libraries/cache（开发环境）
        """
        if cache_dir is None:
            cache_dir = self._first_writable_dir([
                os.getenv("ARDUINO_CACHE_DIR"),
                "/opt/libraries/cache",
                "/tmp/libraries/cache",
            ], "cache")
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        data_candidates = [
            os.getenv("ARDUINO_DATA_DIR"),
            os.getenv("ARDUINO_DIRECTORIES_DATA"),
        ]
        library_candidates = [
            os.getenv("ARDUINO_LIBRARIES_DIR"),
            os.getenv("ARDUINO_DIRECTORIES_USER"),
        ]
        if os.getenv("ENV", "").lower() == "production":
            data_candidates.extend([str(Path.home() / "Library" / "Arduino15"), "/opt/libraries/arduino15"])
            library_candidates.extend([str(Path.home() / "Documents" / "Arduino"), "/opt/libraries/arduino"])
        else:
            data_candidates.extend([str(Path.home() / "Library" / "Arduino15"), "/opt/libraries/arduino15"])
            library_candidates.extend([str(Path.home() / "Documents" / "Arduino"), "/opt/libraries/arduino"])
        data_candidates.append("/tmp/libraries/arduino15")
        library_candidates.append("/tmp/libraries/arduino")

        self.data_dir = Path(self._first_writable_dir(data_candidates, "Arduino data"))
        self.library_root = Path(self._first_writable_dir(library_candidates, "Arduino libraries"))
        (self.library_root / "libraries").mkdir(parents=True, exist_ok=True)

        self._arduino_env = os.environ.copy()
        self._arduino_env["ARDUINO_DATA_DIR"] = str(self.data_dir)
        self._arduino_env["ARDUINO_DIRECTORIES_DATA"] = str(self.data_dir)
        self._arduino_env["ARDUINO_DIRECTORIES_USER"] = str(self.library_root)
        self._arduino_env["HOME"] = str(Path.home())
        for proxy_var in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"):
            if proxy_var in os.environ:
                self._arduino_env[proxy_var] = os.environ[proxy_var]
        
        # 缓存已安装的库列表
        self._installed_libs_cache: Dict[str, str] = {}
        self._refresh_installed_libs()
        
        logger.info(f"LibraryManager initialized with cache_dir: {cache_dir}")
        logger.info(f"Found {len(self._installed_libs_cache)} installed libraries")

    @staticmethod
    def _first_writable_dir(candidates: List[Optional[str]], label: str) -> str:
        """Pick the first writable directory, falling back for local macOS dev."""
        last_error: Exception | None = None
        for candidate in candidates:
            if not candidate:
                continue
            path = Path(candidate).expanduser()
            try:
                path.mkdir(parents=True, exist_ok=True)
                probe = path / ".makefast_write_test"
                probe.write_text("ok", encoding="utf-8")
                probe.unlink(missing_ok=True)
                return str(path)
            except Exception as exc:
                last_error = exc
                logger.debug("Skipping unwritable %s dir %s: %s", label, path, exc)

        fallback = Path("/tmp/libraries") / label.lower().replace(" ", "_")
        fallback.mkdir(parents=True, exist_ok=True)
        logger.warning("Using fallback %s dir %s after error: %s", label, fallback, last_error)
        return str(fallback)
    
    def _normalize_library_name(self, lib_name: str) -> str:
        """
        规范化库名
        
        将 include 文件名转换为实际的库名。
        例如：Adafruit_NeoPixel -> Adafruit NeoPixel
        
        Args:
            lib_name: 原始库名（通常来自 include 语句）
            
        Returns:
            str: 规范化后的库名
        """
        # 如果在映射表中，返回映射后的名称
        if lib_name in self.LIBRARY_NAME_MAPPING:
            normalized = self.LIBRARY_NAME_MAPPING[lib_name]
            logger.debug(f"Normalized library name: {lib_name} -> {normalized}")
            return normalized
        
        # 否则返回原名
        return lib_name
    
    @staticmethod
    def _parse_installed_libraries_json(output: str) -> Dict[str, str]:
        """Parse `arduino-cli lib list --json` output."""
        parsed = json.loads(output or "{}")
        installed = parsed.get("installed_libraries", [])
        libs: Dict[str, str] = {}
        for item in installed:
            if not isinstance(item, dict):
                continue
            library = item.get("library", {})
            if not isinstance(library, dict):
                continue
            name = library.get("name")
            if not name:
                continue
            libs[str(name)] = str(library.get("version") or "")
        return libs

    @staticmethod
    def _parse_installed_libraries_text(output: str) -> Dict[str, str]:
        """Fallback parser for older Arduino CLI text output."""
        libs: Dict[str, str] = {}
        for line in (output or "").strip().splitlines()[1:]:
            stripped = line.strip()
            if not stripped:
                continue
            match = re.search(r"\s(\d+(?:\.\d+)*(?:[-+][^\s]+)?)\s", f" {stripped} ")
            if match:
                name = stripped[:max(match.start() - 1, 0)].strip()
                if name:
                    libs[name] = match.group(1).strip()
            else:
                libs[stripped] = ""
        return libs

    def _refresh_installed_libs(self) -> None:
        """刷新已安装库的缓存"""
        try:
            result = subprocess.run(
                ['arduino-cli', 'lib', 'list', '--json'],
                capture_output=True,
                text=True,
                timeout=10,
                env=self._arduino_env
            )
            
            if result.returncode == 0:
                self._installed_libs_cache = self._parse_installed_libraries_json(result.stdout)
                self._installed_libs_cache.update(self._scan_installed_libraries_from_paths())
                logger.debug(f"Refreshed installed libraries cache: {len(self._installed_libs_cache)} libraries")
                return

            logger.warning(f"arduino-cli lib list --json failed: {result.stderr}")
        except Exception as e:
            logger.warning(f"Failed to refresh installed libraries with JSON output: {e}")

        try:
            result = subprocess.run(
                ['arduino-cli', 'lib', 'list'],
                capture_output=True,
                text=True,
                timeout=10,
                env=self._arduino_env
            )

            if result.returncode == 0:
                self._installed_libs_cache = self._parse_installed_libraries_text(result.stdout)
                self._installed_libs_cache.update(self._scan_installed_libraries_from_paths())
                logger.debug(f"Refreshed installed libraries cache from text: {len(self._installed_libs_cache)} libraries")
            else:
                self._installed_libs_cache = self._scan_installed_libraries_from_paths()
                logger.error(f"Failed to refresh installed libraries: {result.stderr}")
        except Exception as e:
            self._installed_libs_cache = self._scan_installed_libraries_from_paths()
            logger.error(f"Failed to refresh installed libraries: {e}")

    def _scan_installed_libraries_from_paths(self) -> Dict[str, str]:
        """Scan Arduino library folders directly so locally installed libraries appear."""
        libs: Dict[str, str] = {}
        for search_dir in self._get_library_search_paths():
            if not search_dir.exists():
                continue
            for entry in search_dir.iterdir():
                if not entry.is_dir():
                    continue
                props = entry / "library.properties"
                name = entry.name.replace("_", " ")
                version = ""
                if props.exists():
                    try:
                        for line in props.read_text(encoding="utf-8", errors="ignore").splitlines():
                            key, sep, value = line.partition("=")
                            if not sep:
                                continue
                            if key.strip() == "name" and value.strip():
                                name = value.strip()
                            elif key.strip() == "version":
                                version = value.strip()
                    except Exception as exc:
                        logger.debug("Failed to parse %s: %s", props, exc)
                libs[name] = version
        return libs
    
    def is_core_library(self, lib_name: str) -> bool:
        """
        检查是否是 ESP32 核心自带的库
        
        Args:
            lib_name: 库名称
            
        Returns:
            bool: 是否是核心库
        """
        # 规范化库名
        normalized_name = self._normalize_library_name(lib_name)
        return normalized_name in self.CORE_LIBRARIES
    
    def is_preinstalled(self, lib_name: str) -> bool:
        """
        检查库是否预装
        
        Args:
            lib_name: 库名称
            
        Returns:
            bool: 是否预装
        """
        # 规范化库名
        normalized_name = self._normalize_library_name(lib_name)
        
        # 核心库视为预装
        if normalized_name in self.CORE_LIBRARIES:
            return True
        
        # 检查是否在预装库列表中
        if normalized_name in self.PREINSTALLED_LIBRARIES:
            return True
        
        # 检查是否在已安装库缓存中
        return normalized_name in self._installed_libs_cache
    
    def is_cached(self, lib_name: str) -> bool:
        """
        检查库是否已缓存（已安装）
        
        Args:
            lib_name: 库名称
            
        Returns:
            bool: 是否已缓存
        """
        # 规范化库名
        normalized_name = self._normalize_library_name(lib_name)
        
        # 刷新缓存
        self._refresh_installed_libs()
        
        return normalized_name in self._installed_libs_cache
    
    def is_header_available(self, header_name: str) -> bool:
        """
        检查任意已安装的库是否提供了指定头文件

        扫描所有已知库目录，不依赖库名称精确匹配。
        这解决了"Async TCP (有空格) 提供 AsyncTCP.h 但库名不匹配"的问题。
        """
        search_paths = self._get_library_search_paths()
        for lib_dir in search_paths:
            if not lib_dir.exists():
                continue
            for entry in lib_dir.iterdir():
                if entry.is_dir():
                    header_path = entry / "src" / header_name
                    if header_path.exists():
                        return True
                    header_path = entry / header_name
                    if header_path.exists():
                        return True
        return False

    def _get_library_search_paths(self) -> List[Path]:
        """获取所有库搜索路径"""
        paths = []
        for candidate in [
            self.library_root / "libraries",
            self.library_root,
            self.data_dir / "libraries",
            self.data_dir / "libraries" / "installed",
            Path.home() / "Documents" / "Arduino" / "libraries",
            Path.home() / "Library" / "Arduino15" / "libraries",
        ]:
            if candidate.exists():
                paths.append(candidate)
        return paths

    def get_installed_library(self, lib_name: str) -> Optional[dict]:
        """Return exact installed library metadata after normalizing the requested name."""
        normalized_name = self._normalize_library_name(lib_name)
        self._refresh_installed_libs()
        for name, version in self._installed_libs_cache.items():
            if name.lower() == normalized_name.lower() or self._library_key(name) == self._library_key(normalized_name):
                return {"name": name, "version": version}
        return None

    @staticmethod
    def _library_key(name: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", name.lower())

    def download_library(self, lib_name: str, timeout: int = 60) -> dict:
        """
        下载库到缓存目录
        
        Args:
            lib_name: 库名称
            timeout: 下载超时时间（秒）
            
        Raises:
            LibraryNotFoundError: 库不存在
            LibraryDownloadError: 下载失败或安装后校验失败
            TimeoutError: 下载超时
            ValueError: 库名不安全
        """
        # 安全校验
        if not self.validate_library_name(lib_name):
            raise ValueError(f"不安全的库名: {lib_name}")
        
        # 规范化库名
        normalized_name = self._normalize_library_name(lib_name)
        logger.info(f"Downloading library: {normalized_name}")
        start_time = time.time()
        
        # 检查是否已安装
        if self.is_cached(lib_name):
            logger.info(f"Library '{normalized_name}' already installed")
            return self.get_installed_library(normalized_name) or {"name": normalized_name, "version": ""}
        
        try:
            # 使用 arduino-cli 安装库
            result = subprocess.run(
                ['arduino-cli', 'lib', 'install', normalized_name],
                capture_output=True,
                text=True,
                timeout=timeout,
                env=self._arduino_env
            )
            
            if result.returncode == 0:
                duration = time.time() - start_time
                logger.info(f"Successfully downloaded library: {normalized_name} in {duration:.2f}s")
                installed = self.get_installed_library(normalized_name)
                if not installed:
                    raise LibraryDownloadError(
                        f"Library '{normalized_name}' install command succeeded, but it was not found in installed library list"
                    )
                installed["duration"] = round(duration, 2)
                return installed
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                duration = time.time() - start_time
                logger.error(f"Failed to download library '{normalized_name}' after {duration:.2f}s: {error_msg}")
                
                # 检查是否是库不存在
                if "not found" in error_msg.lower() or "no valid dependencies" in error_msg.lower():
                    raise LibraryNotFoundError(f"Library '{normalized_name}' not found in Arduino Library Manager")
                else:
                    raise LibraryDownloadError(f"Failed to download library '{normalized_name}': {error_msg}")
        
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            logger.error(f"Library download timed out after {duration:.2f}s: {normalized_name}")
            raise TimeoutError(f"Library '{normalized_name}' download timed out after {timeout} seconds")
        
        except (LibraryNotFoundError, LibraryDownloadError):
            raise
        
        except Exception as e:
            logger.error(f"Unexpected error downloading library '{normalized_name}': {e}")
            raise LibraryDownloadError(f"Failed to download library '{normalized_name}': {str(e)}")
    
    def ensure_libraries(self, lib_names: List[str]) -> None:
        """
        确保所有库可用，缺失的库会自动下载
        
        Args:
            lib_names: 需要的库名称列表
            
        Raises:
            LibraryNotFoundError: 库不存在或下载失败
            TimeoutError: 下载超时
        """
        if not lib_names:
            logger.debug("No libraries required")
            return
        
        logger.info(f"Ensuring libraries are available: {lib_names}")
        
        missing_libs = []
        failed_libs = []
        
        for lib_name in lib_names:
            # 跳过核心库和已安装的库
            if self.is_core_library(lib_name):
                logger.debug(f"Library '{lib_name}' is a core library, skipping")
                continue
            
            if self.is_cached(lib_name):
                logger.debug(f"Library '{lib_name}' already installed")
                continue
            
            # 尝试下载库
            try:
                self.download_library(lib_name)
            except LibraryNotFoundError as e:
                logger.warning(f"Library not found: {lib_name}")
                missing_libs.append(lib_name)
            except (LibraryDownloadError, TimeoutError) as e:
                logger.error(f"Failed to download library: {lib_name} - {e}")
                failed_libs.append((lib_name, str(e)))
        
        # 报告结果
        if missing_libs:
            error_msg = f"Libraries not found: {', '.join(missing_libs)}"
            logger.error(error_msg)
            raise LibraryNotFoundError(error_msg)
        
        if failed_libs:
            error_msg = f"Failed to download libraries: {', '.join([lib for lib, _ in failed_libs])}"
            logger.error(error_msg)
            raise LibraryDownloadError(error_msg)
        
        logger.info(f"All required libraries are available")
    
    def get_installed_libraries(self) -> List[dict]:
        """
        获取所有已安装的库列表

        Returns:
            List[dict]: 已安装的库列表，每项包含 name 和 version
        """
        self._refresh_installed_libs()
        return sorted(
            [{"name": name, "version": version} for name, version in self._installed_libs_cache.items()],
            key=lambda x: x["name"].lower()
        )
    
    def clear_cache(self, lib_name: str) -> bool:
        """
        清除指定库的缓存（卸载库）
        
        Args:
            lib_name: 库名称
            
        Returns:
            bool: 是否成功清除
            
        Raises:
            ValueError: 库名不安全
        """
        # 安全校验
        if not self.validate_library_name(lib_name):
            raise ValueError(f"不安全的库名: {lib_name}")
        
        logger.info(f"Clearing cache for library: {lib_name}")
        
        try:
            result = subprocess.run(
                ['arduino-cli', 'lib', 'uninstall', lib_name],
                capture_output=True,
                text=True,
                timeout=10,
                env=self._arduino_env
            )
            
            if result.returncode == 0:
                logger.info(f"Successfully cleared cache for library: {lib_name}")
                # 刷新缓存
                self._refresh_installed_libs()
                return True
            else:
                logger.warning(f"Failed to clear cache for library '{lib_name}': {result.stderr}")
                return False
        
        except Exception as e:
            logger.error(f"Error clearing cache for library '{lib_name}': {e}")
            return False
    
    def validate_library_name(self, lib_name: str) -> bool:
        """
        验证库名称是否安全（防止路径遍历等攻击）
        
        Args:
            lib_name: 库名称
            
        Returns:
            bool: 是否安全
        """
        # 检查是否包含路径遍历字符
        if '..' in lib_name or '/' in lib_name or '\\' in lib_name:
            logger.warning(f"Invalid library name (path traversal): {lib_name}")
            return False
        
        # 检查是否包含危险字符
        dangerous_chars = [';', '&', '|', '$', '`', '\n', '\r']
        if any(char in lib_name for char in dangerous_chars):
            logger.warning(f"Invalid library name (dangerous characters): {lib_name}")
            return False
        
        return True


# 全局库管理器实例
_library_manager: LibraryManager = None


def get_library_manager() -> LibraryManager:
    """
    获取全局库管理器实例（单例模式）
    
    Returns:
        LibraryManager: 库管理器实例
    """
    global _library_manager
    if _library_manager is None:
        _library_manager = LibraryManager()
    return _library_manager
