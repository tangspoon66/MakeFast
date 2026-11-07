"""
编译服务

负责 ESP32 代码的编译、固件生成和错误解析。
"""

import logging
import subprocess
import os
import re
import shutil
import uuid
import time
import threading
from pathlib import Path
from typing import List, Tuple, Optional

from .models import CompileResult, CompileError, FirmwareFileInfo
from .library_manager import get_library_manager, LibraryNotFoundError, LibraryDownloadError

logger = logging.getLogger(__name__)


class CompilationTimeoutError(Exception):
    """编译超时异常"""
    pass


class CompilationCancelledError(Exception):
    """编译取消异常"""
    pass


class CompilationService:
    """
    编译服务

    负责编译用户代码，生成固件文件。
    """

    # 最大并发编译数
    MAX_CONCURRENT_COMPILES = 2
    SYSTEM_HEADERS = {
        # C 标准库
        'assert', 'complex', 'ctype', 'errno', 'fenv', 'float', 'inttypes',
        'iso646', 'limits', 'locale', 'math', 'setjmp', 'signal', 'stdalign',
        'stdarg', 'stdatomic', 'stdbit', 'stdbool', 'stdckdint', 'stddef',
        'stdint', 'stdio', 'stdlib', 'stdnoreturn', 'string', 'tgmath',
        'threads', 'time', 'uchar', 'wchar', 'wctype',
        # C++ 标准库常见头
        'algorithm', 'array', 'atomic', 'bitset', 'cassert', 'cctype',
        'cerrno', 'cfloat', 'chrono', 'climits', 'cmath', 'csetjmp',
        'csignal', 'cstdarg', 'cstdbool', 'cstddef', 'cstdint', 'cstdio',
        'cstdlib', 'cstring', 'ctime', 'cwchar', 'cwctype', 'deque',
        'exception', 'functional', 'initializer_list', 'iomanip', 'ios',
        'iosfwd', 'iostream', 'istream', 'iterator', 'limits', 'list', 'map',
        'memory', 'new', 'numeric', 'optional', 'ostream', 'queue', 'set',
        'sstream', 'stack', 'stdexcept', 'streambuf', 'string', 'tuple',
        'type_traits', 'typeinfo', 'unordered_map', 'unordered_set', 'utility',
        'vector',
        # ESP-IDF / Arduino core 系统头
        'esp_system', 'esp_log', 'esp_err', 'esp_timer', 'esp_sleep',
        'esp_event', 'esp_wifi', 'esp_now', 'esp_netif', 'esp_mac',
        'esp_task_wdt', 'nvs_flash', 'sdkconfig', 'freertos', 'freertos/freertos',
        'freertos/task', 'freertos/queue', 'freertos/semphr',
        'driver/gpio', 'driver/uart', 'driver/spi_master', 'driver/i2c',
        'driver/ledc', 'driver/adc', 'driver/timer',
    }

    def __init__(
        self,
        temp_dir: str = "/tmp/compile",
        firmware_dir: Optional[str] = None,
        compile_timeout: int = 60
    ):
        """
        初始化编译服务
        
        Args:
            temp_dir: 临时编译目录
            firmware_dir: 固件存储目录，默认从环境变量读取
            compile_timeout: 编译超时时间（秒）
        """
        # 从环境变量获取固件存储路径
        if firmware_dir is None:
            firmware_dir = os.getenv("FIRMWARE_STORAGE_PATH", "/opt/firmware")
        # 尝试创建目录，如果失败则使用临时目录
        try:
            self.temp_dir = Path(temp_dir)
            self.temp_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            self.temp_dir = Path("/tmp/esp_compile")
            self.temp_dir.mkdir(parents=True, exist_ok=True)
            logger.warning(f"No permission to create {temp_dir}, using {self.temp_dir} instead")
        
        try:
            self.firmware_dir = Path(firmware_dir)
            self.firmware_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            self.firmware_dir = Path("/tmp/esp_firmware")
            self.firmware_dir.mkdir(parents=True, exist_ok=True)
            logger.warning(f"No permission to create {firmware_dir}, using {self.firmware_dir} instead")
        
        self.compile_timeout = compile_timeout
        self.library_manager = get_library_manager()
        self.arduino_data_dir = Path(getattr(self.library_manager, "data_dir", os.getenv("ARDUINO_DATA_DIR", "/tmp/libraries/arduino15")))
        self.arduino_user_dir = Path(getattr(self.library_manager, "library_root", os.getenv("ARDUINO_LIBRARIES_DIR", "/tmp/libraries/arduino")))

        logger.info(f"CompilationService initialized")
        logger.info(f"  Temp dir: {self.temp_dir}")
        logger.info(f"  Firmware dir: {self.firmware_dir}")
        logger.info(f"  Compile timeout: {compile_timeout}s")
    
    def _parse_includes(self, code: str) -> List[str]:
        """
        从代码中提取 #include 语句
        
        Args:
            code: 用户代码
            
        Returns:
            List[str]: 库名称列表
            
        示例:
            #include <WiFi.h>        -> "WiFi"
            #include <PubSubClient.h> -> "PubSubClient"
            #include "myheader.h"    -> 忽略（本地文件）
        """
        libs = []

        # 内置库列表（不需要安装）
        builtin_libs = {
            'Arduino', 'Wire', 'SPI', 'EEPROM', 'FS', 'SD', 'SD_MMC',
            'SPIFFS', 'WiFi', 'WiFiClient', 'WiFiServer', 'WebServer',
            'ESPmDNS', 'Update', 'Preferences', 'BluetoothSerial',
            'BLE', 'HTTPClient', 'HTTPUpdate', 'ArduinoOTA',
            'esp_now', 'esp_wifi', 'driver', 'freertos', 'nvs_flash',
            'Adafruit_GFX', 'GxEPD2', 'U8g2lib',
        }

        # 匹配 #include <LibName.h> 格式
        pattern = r'#include\s*<([^>]+)\.h>'
        matches = re.findall(pattern, code)

        for match in matches:
            header_name = match + '.h'
            lib_name = match.split('/')[-1]

            normalized_header = match.lower()
            normalized_lib = lib_name.lower()

            # 跳过内置库、系统头文件和已添加的库
            if (
                not lib_name
                or lib_name in builtin_libs
                or normalized_header in self.SYSTEM_HEADERS
                or normalized_lib in self.SYSTEM_HEADERS
                or lib_name in libs
            ):
                continue

            # 检查头文件是否已被任意已安装库提供（不依赖库名精确匹配）
            if self.library_manager.is_header_available(header_name):
                logger.debug(f"Header '{header_name}' already available, skipping auto-install of '{lib_name}'")
                continue

            libs.append(lib_name)

        logger.debug(f"Parsed includes: {libs}")
        return libs
    
    def _create_temp_project(self, code: str = None, files: List[dict] = None, session_id: str = None) -> Path:
        """
        创建临时项目目录
        
        Args:
            code: 单文件代码（可选）
            files: 多文件列表（可选）
            session_id: 会话 ID
            
        Returns:
            Path: 项目目录路径
        """
        project_dir = self.temp_dir / session_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        if files:
            # 多文件项目
            if len(files) > 80:
                raise ValueError("项目文件数量超过限制（最多 80 个）")
            total_content_size = sum(len(file_info.get('content', '')) for file_info in files)
            if total_content_size > 1024 * 1024:
                raise ValueError("项目源代码总大小超过限制（最多 1MB）")

            main_ino_name = f"{session_id}.ino"
            ino_file_found = None
            seen_paths = set()
            
            # 第一遍：找到 .ino 文件
            for file_info in files:
                if file_info['name'].endswith('.ino'):
                    ino_file_found = file_info
                    break
            
            # 第二遍：创建所有文件
            for file_info in files:
                file_name = file_info['name']
                
                # 安全校验：防止路径遍历攻击
                if '..' in file_name or file_name.startswith('/') or '\\' in file_name:
                    raise ValueError(f"非法文件名: {file_name}")
                normalized_name = file_name.strip().strip("/")
                if not normalized_name:
                    raise ValueError("文件名不能为空")
                normalized_key = normalized_name.lower()
                if normalized_key in seen_paths:
                    raise ValueError(f"项目中存在重复文件路径: {normalized_name}")
                seen_paths.add(normalized_key)
                
                # 如果是 .ino 文件，使用项目目录名
                if normalized_name.endswith('.ino'):
                    file_path = project_dir / main_ino_name
                    file_path.write_text(file_info['content'], encoding='utf-8')
                    logger.debug(f"Created main file: {main_ino_name} (from {normalized_name})")
                else:
                    # 其他文件保持原名，校验路径在项目目录内
                    file_path = (project_dir / normalized_name).resolve()
                    if not str(file_path).startswith(str(project_dir.resolve())):
                        raise ValueError(f"文件路径超出项目目录: {normalized_name}")
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    file_path.write_text(file_info['content'], encoding='utf-8')
                    logger.debug(f"Created file: {file_name}")
            
            # 如果没有 .ino 文件，创建一个空的主文件
            if not ino_file_found:
                main_file_path = project_dir / main_ino_name
                main_file_path.write_text("// Auto-generated main file\nvoid setup() {}\nvoid loop() {}", encoding='utf-8')
                logger.warning(f"No .ino file found, created empty main file: {main_ino_name}")
        else:
            # 单文件项目
            sketch_file = project_dir / f"{session_id}.ino"
            sketch_file.write_text(code, encoding='utf-8')
            logger.debug(f"Created sketch file: {sketch_file.name}")
        
        logger.debug(f"Created temp project: {project_dir}")
        return project_dir
    
    def _run_arduino_cli(
        self,
        project_dir: Path,
        board_id: str,
        timeout: int = 60,
        cancel_event: Optional[threading.Event] = None,
        job_id: Optional[str] = None,
    ) -> Tuple[bool, str, str]:
        """
        执行 Arduino CLI 编译命令
        
        Args:
            project_dir: 项目目录
            board_id: 开发板 ID
            timeout: 超时时间（秒）
            
        Returns:
            Tuple[bool, str, str]: (是否成功, stdout, stderr)
            
        Raises:
            CompilationTimeoutError: 编译超时
        """
        # 从集中配置获取 FQBN（使用合并列表，支持自定义板）
        from .board_config import get_boards_by_id
        boards = get_boards_by_id()
        if board_id not in boards:
            raise ValueError(f"未知开发板 ID: {board_id}")
        fqbn = boards[board_id].fqbn
        
        # 构建编译命令
        cmd = [
            'arduino-cli',
            'compile',
            '--fqbn', fqbn,
            '--output-dir', str(project_dir / 'build'),
            str(project_dir)
        ]
        
        logger.info(f"Running compile command: {' '.join(cmd)}")
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(project_dir),
            env={
                **os.environ,
                "ARDUINO_DATA_DIR": str(self.arduino_data_dir),
                "ARDUINO_DIRECTORIES_DATA": str(self.arduino_data_dir),
                "ARDUINO_DIRECTORIES_USER": str(self.arduino_user_dir),
                "HOME": str(Path.home()),
            },
        )

        start = time.time()
        while proc.poll() is None:
            redis_cancelled = False
            if job_id:
                try:
                    from .runtime_state import compile_runtime_state
                    redis_cancelled = compile_runtime_state.is_cancelled(job_id)
                except Exception:
                    redis_cancelled = False
            if (cancel_event and cancel_event.is_set()) or redis_cancelled:
                logger.info("Compilation cancellation requested; terminating arduino-cli")
                proc.terminate()
                try:
                    stdout, stderr = proc.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    stdout, stderr = proc.communicate()
                raise CompilationCancelledError("编译已取消")

            if time.time() - start > timeout:
                logger.error(f"Compilation timed out after {timeout} seconds")
                proc.kill()
                proc.communicate()
                raise CompilationTimeoutError(f"编译超时（{timeout}秒）。请尝试简化代码。")

            time.sleep(0.2)

        stdout, stderr = proc.communicate()
        success = proc.returncode == 0
        logger.info(f"Compile {'succeeded' if success else 'failed'} (exit code: {proc.returncode})")

        return success, stdout, stderr
    
    def _parse_errors(self, stderr: str) -> List[CompileError]:
        """
        解析编译错误输出
        
        Args:
            stderr: 错误输出
            
        Returns:
            List[CompileError]: 错误列表
            
        示例输入:
            sketch.ino:15:3: error: 'WiFi' was not declared in this scope
            sketch.ino:20:5: error: expected ';' before 'delay'
        """
        errors = []
        
        # 匹配错误模式
        # 格式: filename:line:col: error/warning: message
        # 支持 .ino, .cpp, .c 文件
        pattern = r'\.(?:ino|cpp|c):(\d+):\d+:\s*(error|warning):\s*(.+?)(?=\n|$)'
        
        for match in re.finditer(pattern, stderr, re.MULTILINE):
            line_num = int(match.group(1))
            error_type = match.group(2)
            message = match.group(3).strip()
            
            # 添加友好提示
            hint = self._get_error_hint(message)
            
            errors.append(CompileError(
                type=error_type,
                line=line_num,
                message=message,
                hint=hint
            ))
        
        logger.debug(f"Parsed {len(errors)} errors/warnings")
        return errors
    
    def _get_error_hint(self, message: str) -> Optional[str]:
        """
        根据错误消息生成友好提示
        
        Args:
            message: 错误消息
            
        Returns:
            Optional[str]: 友好提示
        """
        # 先检查 mbedTLS API 兼容性（精确匹配）
        if 'mbedtls_md5_starts_ret' in message or 'mbedtls_md5_update_ret' in message or 'mbedtls_md5_finish_ret' in message:
            return "ESP32 核心 3.x 使用 mbedTLS 3.x，旧 API 的 _ret 后缀已移除。将代码中 mbedtls_md5_*_ret 改为 mbedtls_md5_*（去掉 _ret）即可。这是 API 版本差异，不需要安装任何库。"
        if 'mbedtls_sha1_starts_ret' in message or 'mbedtls_sha1_update_ret' in message or 'mbedtls_sha1_finish_ret' in message:
            return "ESP32 核心 3.x 使用 mbedTLS 3.x，旧 API 的 _ret 后缀已移除。将代码中 mbedtls_sha1_*_ret 改为 mbedtls_sha1_*（去掉 _ret）即可。"

        hints = {
            "'WiFi' was not declared": "缺少 WiFi 库，请检查是否包含 #include <WiFi.h>",
            "'PubSubClient' was not declared": "缺少 MQTT 库，请检查是否包含 #include <PubSubClient.h>",
            "'Bluetooth' was not declared": "缺少 Bluetooth 库，请检查是否包含 #include <BluetoothSerial.h>",
            "expected ';'": "语法错误：缺少分号",
            "expected '}'": "语法错误：缺少右花括号",
            "expected ')'": "语法错误：缺少右括号",
            "avrdude": "AVR 烧录工具错误，请确认已安装 avrdude",
            "low memory available": "Arduino 内存不足，建议优化变量使用、减少字符串常量或使用 PROGMEM",
            "redefinition of": "重复定义，请检查是否多次定义了相同的函数或变量",
            "expected unqualified-id": "语法错误：非预期的符号，通常由大括号不匹配或多余的字符引起",
            "was not declared in this scope": "函数/变量未声明。若错误来自你的代码，请检查是否有拼写错误或缺少 #include；若错误来自库文件（路径含 libraries/），可能是库与当前 ESP32 核心版本不兼容，直接修改代码适配新版 API 或找库的更新版本",
            "undefined reference to": "链接错误：函数或变量未定义，请检查是否缺少实现文件或库",
        }
        
        for pattern, hint in hints.items():
            if pattern in message:
                return hint
        
        return None
    
    def _get_bootloader_address(self, board_id: str) -> Optional[int]:
        """
        获取开发板的 bootloader 地址

        从 BoardConfig 集中配置中获取。
        Arduino AVR 板返回 None（无需 bootloader）。
        """
        from .board_config import get_boards_by_id
        boards = get_boards_by_id()
        if board_id not in boards:
            return None
        return boards[board_id].bootloader_addr
    
    def _save_firmware(self, project_dir: Path, session_id: str, board_id: str) -> Tuple[str, int, List[FirmwareFileInfo]]:
        """
        保存固件文件（支持 ESP .bin 和 Arduino AVR .hex）

        Args:
            project_dir: 项目目录
            session_id: 会话 ID
            board_id: 开发板 ID

        Returns:
            Tuple[str, int, List[FirmwareFileInfo]]: (固件 ID, 总大小, 烧录文件清单)
        """
        from .board_config import get_boards_by_id
        boards = get_boards_by_id()
        if board_id not in boards:
            raise ValueError(f"未知开发板 ID: {board_id}")
        board_config = boards[board_id]

        build_dir = project_dir / 'build'
        firmware_id = str(uuid.uuid4())

        # 创建固件存储子目录
        firmware_dir = self.firmware_dir / firmware_id
        firmware_dir.mkdir(parents=True, exist_ok=True)

        flash_files = []
        total_size = 0

        # ── Arduino AVR 分支：处理 .hex 文件 ──
        if board_config.platform == 'arduino-avr':
            hex_files = list(build_dir.glob('*.ino.hex'))
            if not hex_files:
                raise FileNotFoundError("Arduino AVR firmware (.hex) not found after compilation")

            source = hex_files[0]
            dest = firmware_dir / 'firmware.hex'
            shutil.copy2(source, dest)
            size = dest.stat().st_size
            total_size = size
            flash_files.append(FirmwareFileInfo(
                name='firmware.hex',
                address=0,
                size=size,
                role='firmware',
                format='hex'
            ))
            logger.info(f"Saved Arduino AVR firmware: {size} bytes to firmware.hex")

            from datetime import datetime
            metadata = {
                "firmware_id": firmware_id,
                "project_name": f"firmware_{firmware_id[:8]}",
                "version": "1.0.0",
                "description": f"Compiled firmware for {board_id}",
                "supported_board_ids": [board_id],
                "files": [f.dict() for f in flash_files],
                "total_size": total_size,
                "published": False,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
                "download_count": 0,
                "flash_count": 0
            }

            import json
            metadata_path = firmware_dir / "metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved metadata: {metadata_path}")

            return firmware_id, total_size, flash_files

        # ── ESP 分支：处理 .bin 文件 ──
        # 获取正确的 bootloader 地址
        bootloader_address = board_config.bootloader_addr
        if bootloader_address is not None:
            logger.info(f"Board ID: {board_id}, Bootloader address: 0x{bootloader_address:x}")
        else:
            logger.info(f"Board ID: {board_id}, no bootloader")

        # 1. Bootloader
        bootloader_bin = list(build_dir.glob('*.ino.bootloader.bin'))
        if bootloader_bin and bootloader_address is not None:
            source = bootloader_bin[0]
            dest = firmware_dir / 'bootloader.bin'
            shutil.copy2(source, dest)
            size = dest.stat().st_size
            total_size += size
            flash_files.append(FirmwareFileInfo(
                name='bootloader.bin',
                address=bootloader_address,
                size=size,
                role='bootloader',
                format='bin'
            ))
            logger.info(f"Saved bootloader: {size} bytes @ 0x{bootloader_address:x}")

        # 2. Partition Table (0x8000)
        partitions_bin = list(build_dir.glob('*.ino.partitions.bin'))
        if partitions_bin:
            source = partitions_bin[0]
            dest = firmware_dir / 'partitions.bin'
            shutil.copy2(source, dest)
            size = dest.stat().st_size
            total_size += size
            flash_files.append(FirmwareFileInfo(
                name='partitions.bin',
                address=0x8000,
                size=size,
                role='partitions',
                format='bin'
            ))
            logger.info(f"Saved partitions: {size} bytes")

        # 3. Boot App0 (0xe000) - 从 Arduino 数据目录复制，兼容 Linux/macOS
        try:
            arduino_data_dirs = [
                Path(os.getenv("ARDUINO_DATA_DIR", "")) if os.getenv("ARDUINO_DATA_DIR") else None,
                Path.home() / ".arduino15",
                Path.home() / "Library" / "Arduino15",
                Path("/root/.arduino15"),
            ]
            boot_app0_candidates = []
            for arduino_data_dir in arduino_data_dirs:
                if not arduino_data_dir or not arduino_data_dir.exists():
                    continue
                esp32_path = arduino_data_dir / "packages" / "esp32" / "hardware" / "esp32"
                boot_app0_candidates.extend(esp32_path.glob("*/tools/partitions/boot_app0.bin"))

            if boot_app0_candidates:
                source = boot_app0_candidates[0]
                dest = firmware_dir / 'boot_app0.bin'
                shutil.copy2(source, dest)
                size = dest.stat().st_size
                total_size += size
                flash_files.append(FirmwareFileInfo(
                    name='boot_app0.bin',
                    address=0xe000,
                    size=size,
                    role='boot_app0',
                    format='bin'
                ))
                logger.info(f"Saved boot_app0: {size} bytes")
            else:
                logger.warning("boot_app0.bin not found, skipping")
        except Exception as e:
            logger.warning(f"Failed to copy boot_app0.bin: {e}")

        # 4. Application (0x10000)
        app_bin = list(build_dir.glob('*.ino.bin'))
        if not app_bin:
            raise FileNotFoundError("Application binary not found after compilation")

        source = app_bin[0]
        dest = firmware_dir / 'app.bin'
        shutil.copy2(source, dest)
        size = dest.stat().st_size
        total_size += size
        flash_files.append(FirmwareFileInfo(
            name='app.bin',
            address=0x10000,
            size=size,
            role='app',
            format='bin'
        ))
        logger.info(f"Saved app: {size} bytes")

        # 创建 metadata.json 文件
        from datetime import datetime
        metadata = {
            "firmware_id": firmware_id,
            "project_name": f"firmware_{firmware_id[:8]}",
            "version": "1.0.0",
            "description": f"Compiled firmware for {board_id}",
            "supported_board_ids": [board_id],
            "files": [f.dict() for f in flash_files],
            "total_size": total_size,
            "published": False,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "download_count": 0,
            "flash_count": 0
        }
        
        import json
        metadata_path = firmware_dir / "metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved metadata: {metadata_path}")

        logger.info(f"Saved firmware {firmware_id}: {len(flash_files)} files, {total_size} bytes total")
        return firmware_id, total_size, flash_files
    
    def _cleanup(self, project_dir: Path) -> None:
        """
        清理临时文件
        
        Args:
            project_dir: 项目目录
        """
        try:
            if project_dir.exists():
                shutil.rmtree(project_dir)
                logger.debug(f"Cleaned up temp project: {project_dir}")
        except Exception as e:
            logger.error(f"Failed to cleanup {project_dir}: {e}")
    
    def compile(
        self,
        code: str = None,
        board_id: str = None,
        files: List[dict] = None,
        cancel_event: Optional[threading.Event] = None,
        job_id: Optional[str] = None,
    ) -> CompileResult:
        """
        编译用户代码
        
        Args:
            code: 单文件代码（可选）
            board_id: 开发板 ID
            files: 多文件列表（可选）
            
        Returns:
            CompileResult: 编译结果
        """
        session_id = str(uuid.uuid4())
        project_dir = None
        start_time = time.time()
        
        try:
            logger.info(f"Starting compilation (session: {session_id}, board: {board_id})")
            
            # 1. 创建临时项目
            project_dir = self._create_temp_project(code=code, files=files, session_id=session_id)
            
            # 2. 解析库依赖（从所有文件中）
            all_code = code if code else '\n'.join([f['content'] for f in files])
            required_libs = self._parse_includes(all_code)
            logger.info(f"Required libraries: {required_libs}")

            # 限制单次编译的库安装数量，防止滥用
            max_libs = 15
            if len(required_libs) > max_libs:
                duration = time.time() - start_time
                return CompileResult(
                    success=False,
                    errors=[CompileError(
                        type="error",
                        line=0,
                        message=f"依赖库数量 ({len(required_libs)}) 超过限制 ({max_libs})",
                        hint="请减少外部库依赖"
                    )],
                    duration=duration
                )

            # 3. 确保库可用
            try:
                self.library_manager.ensure_libraries(required_libs)
            except (LibraryNotFoundError, LibraryDownloadError) as e:
                logger.error(f"Library error: {e}")
                duration = time.time() - start_time
                return CompileResult(
                    success=False,
                    errors=[CompileError(
                        type="error",
                        line=0,
                        message=str(e),
                        hint="请检查库名称是否正确，或稍后重试"
                    )],
                    duration=duration
                )
            
            # 4. 执行编译
            success, stdout, stderr = self._run_arduino_cli(
                project_dir,
                board_id,
                timeout=self.compile_timeout,
                cancel_event=cancel_event,
                job_id=job_id,
            )
            
            duration = time.time() - start_time
            
            # 5. 处理结果
            if success:
                # 编译成功，保存固件
                firmware_id, firmware_size, flash_files = self._save_firmware(project_dir, session_id, board_id)
                
                logger.info(f"Compilation succeeded in {duration:.2f}s")
                return CompileResult(
                    success=True,
                    firmware_id=firmware_id,
                    firmware_size=firmware_size,
                    firmware_files=flash_files,
                    warnings=[],
                    duration=duration
                )
            else:
                # 编译失败，解析错误
                errors = self._parse_errors(stderr)
                
                if not errors:
                    # 如果没有解析到错误，返回原始错误信息
                    errors = [CompileError(
                        type="error",
                        line=0,
                        message=stderr[:500] if stderr else "Unknown compilation error"
                    )]
                
                logger.info(f"Compilation failed in {duration:.2f}s with {len(errors)} errors")
                return CompileResult(
                    success=False,
                    errors=errors,
                    duration=duration
                )
        
        except CompilationTimeoutError as e:
            duration = time.time() - start_time
            logger.error(f"Compilation timeout: {e}")
            return CompileResult(
                success=False,
                errors=[CompileError(
                    type="error",
                    line=0,
                    message=str(e)
                )],
                duration=duration
            )

        except CompilationCancelledError as e:
            duration = time.time() - start_time
            logger.info(f"Compilation cancelled: {e}")
            return CompileResult(
                success=False,
                errors=[CompileError(
                    type="cancelled",
                    line=0,
                    message=str(e)
                )],
                duration=duration
            )
        
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Compilation error: {e}", exc_info=True)
            return CompileResult(
                success=False,
                errors=[CompileError(
                    type="error",
                    line=0,
                    message=f"编译失败: {str(e)}"
                )],
                duration=duration
            )
        
        finally:
            # 清理临时文件
            if project_dir:
                self._cleanup(project_dir)
    
    def get_firmware(self, firmware_id: str) -> Optional[bytes]:
        """
        获取编译好的固件

        Args:
            firmware_id: 固件 ID

        Returns:
            Optional[bytes]: 固件二进制数据，如果不存在则返回 None
        """
        if not firmware_id or '..' in firmware_id or '/' in firmware_id or '\\' in firmware_id:
            logger.warning(f"Invalid firmware_id: {firmware_id}")
            return None
        firmware_path = self.firmware_dir / f"{firmware_id}.bin"
        
        if not firmware_path.exists():
            logger.warning(f"Firmware not found: {firmware_id}")
            return None
        
        try:
            firmware_data = firmware_path.read_bytes()
            logger.info(f"Retrieved firmware: {firmware_id} ({len(firmware_data)} bytes)")
            return firmware_data
        except Exception as e:
            logger.error(f"Failed to read firmware {firmware_id}: {e}")
            return None

    def cleanup_old_firmware(self, max_age_hours: int = 24) -> int:
        """
        清理超过指定时间的编译固件

        Args:
            max_age_hours: 最大保留时间（小时）

        Returns:
            清理的文件数量
        """
        import time
        cleaned = 0
        cutoff = time.time() - max_age_hours * 3600

        if not self.firmware_dir.exists():
            return 0

        for fw_file in self.firmware_dir.iterdir():
            if fw_file.is_file() and fw_file.suffix == '.bin':
                try:
                    mtime = fw_file.stat().st_mtime
                    if mtime < cutoff:
                        fw_file.unlink()
                        cleaned += 1
                        logger.info(f"Cleaned up old firmware: {fw_file.name}")
                except Exception as e:
                    logger.warning(f"Failed to clean up {fw_file}: {e}")

        if cleaned > 0:
            logger.info(f"Firmware cleanup finished: removed {cleaned} files")
        return cleaned


# 全局编译服务实例
_compilation_service: CompilationService = None


def get_compilation_service() -> CompilationService:
    """
    获取全局编译服务实例（单例模式）
    
    Returns:
        CompilationService: 编译服务实例
    """
    global _compilation_service
    if _compilation_service is None:
        _compilation_service = CompilationService()
    return _compilation_service
