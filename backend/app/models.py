"""
数据模型定义

定义了编译服务的所有 Pydantic 模型，用于请求验证和响应序列化。
"""

from typing import List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class ProjectFile(BaseModel):
    """项目文件模型"""
    name: str = Field(..., description="文件名，如 'sketch.ino', 'helper.cpp'")
    content: str = Field(..., min_length=1, max_length=50000, description="文件内容")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "sketch.ino",
                    "content": "void setup() {}\nvoid loop() {}"
                }
            ]
        }
    }


class CompileRequest(BaseModel):
    """编译请求模型"""
    code: Optional[str] = Field(
        None,
        min_length=1,
        max_length=50000,
        description="单文件代码（与 files 二选一）"
    )
    files: Optional[List[ProjectFile]] = Field(
        None,
        description="多文件项目（与 code 二选一）"
    )
    board_id: str = Field(
        ...,
        description="开发板 ID，如 'esp32dev'"
    )

    @field_validator('board_id')
    @classmethod
    def validate_board_id(cls, v: str) -> str:
        """验证开发板 ID（从集中配置动态获取）"""
        from .board_config import get_boards_by_id
        boards = get_boards_by_id()
        if v not in boards:
            allowed = ', '.join(boards.keys())
            raise ValueError(
                f"Invalid board_id '{v}'. Allowed values: {allowed}"
            )
        return v
    
    def model_post_init(self, __context) -> None:
        """验证 code 和 files 必须提供其中一个"""
        if not self.code and not self.files:
            raise ValueError("Either 'code' or 'files' must be provided")
        if self.code and self.files:
            raise ValueError("Cannot provide both 'code' and 'files'")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "code": "void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  Serial.println(\"Hello ESP32\");\n  delay(1000);\n}",
                    "board_id": "esp32dev"
                },
                {
                    "files": [
                        {
                            "name": "sketch.ino",
                            "content": "#include \"helper.h\"\nvoid setup() {}\nvoid loop() {}"
                        },
                        {
                            "name": "helper.h",
                            "content": "void helperFunction();"
                        },
                        {
                            "name": "helper.cpp",
                            "content": "#include \"helper.h\"\nvoid helperFunction() {}"
                        }
                    ],
                    "board_id": "esp32dev"
                }
            ]
        }
    }


class CompileError(BaseModel):
    """编译错误模型"""
    type: str = Field(..., description="错误类型，如 'error' 或 'warning'")
    line: int = Field(..., description="错误行号")
    message: str = Field(..., description="错误描述")
    hint: Optional[str] = Field(None, description="友好提示（可选）")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "type": "error",
                    "line": 15,
                    "message": "'WiFi' was not declared in this scope",
                    "hint": "缺少 WiFi 库，请检查是否包含 #include <WiFi.h>"
                }
            ]
        }
    }


class CompileResult(BaseModel):
    """编译结果模型"""
    success: bool = Field(..., description="编译是否成功")
    firmware_id: Optional[str] = Field(None, description="固件 ID（成功时）")
    firmware_size: Optional[int] = Field(None, description="固件大小（字节，成功时）")
    firmware_files: Optional[List["FirmwareFileInfo"]] = Field(
        None,
        description="烧录文件清单（成功时），包含地址和文件名"
    )
    errors: Optional[List[CompileError]] = Field(None, description="错误列表（失败时）")
    warnings: Optional[List[str]] = Field(None, description="警告列表")
    duration: float = Field(..., description="编译耗时（秒）")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "firmware_id": "abc123def456",
                    "firmware_size": 245760,
                    "warnings": [],
                    "duration": 12.5
                },
                {
                    "success": False,
                    "errors": [
                        {
                            "type": "error",
                            "line": 15,
                            "message": "'WiFi' was not declared in this scope",
                            "hint": "缺少 WiFi 库，请检查是否包含 #include <WiFi.h>"
                        }
                    ],
                    "duration": 5.2
                }
            ]
        }
    }


class BoardInfo(BaseModel):
    """开发板信息模型"""
    id: str = Field(..., description="开发板 ID")
    name: str = Field(..., description="显示名称")
    fqbn: str = Field(..., description="完全限定的开发板名称（用于编译）")
    description: Optional[str] = Field(None, description="开发板描述")
    platform: str = Field(..., description="平台类型：esp32 / esp8266 / arduino-avr")
    flashable: bool = Field(..., description="是否支持 Web Serial 烧录")
    chip_family: Optional[str] = Field(None, description="芯片系列")
    output_format: str = Field("bin", description="固件输出格式：bin / hex")
    upload_protocol: str = Field("esptool", description="网页烧录协议")
    upload_speed: int = Field(115200, description="默认烧录波特率")
    reset_method: str = Field("dtr-rts", description="复位方式")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "id": "esp32",
                    "name": "ESP32 Dev Module",
                    "fqbn": "esp32:esp32:esp32",
                    "description": "通用 ESP32 开发板（推荐）",
                    "platform": "esp32",
                    "flashable": True,
                }
            ]
        }
    }


class BoardListResponse(BaseModel):
    """开发板列表响应模型"""
    boards: List[BoardInfo] = Field(..., description="支持的开发板列表")


class FirmwareFileInfo(BaseModel):
    """固件文件信息"""
    name: str = Field(..., description="固件文件名")
    address: int = Field(..., description="烧录地址")
    size: int = Field(..., description="文件大小（字节）")
    role: str = Field(..., description="文件角色：bootloader, partitions, boot_app0, app, firmware")
    format: str = Field("bin", description="文件格式：bin / hex")


class LibraryInfo(BaseModel):
    """库信息模型"""
    name: str = Field(..., description="库名称")
    version: Optional[str] = Field(None, description="版本号")
    is_preinstalled: bool = Field(..., description="是否预装")
    install_path: Optional[str] = Field(None, description="安装路径")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "WiFi",
                    "version": "2.0.0",
                    "is_preinstalled": True,
                    "install_path": "/root/.arduino15/packages/esp32/hardware/esp32/2.0.17/libraries/WiFi"
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    """健康检查响应模型"""
    status: str = Field(..., description="服务状态：'ok' 或 'degraded'")
    service: str = Field(..., description="服务名称")
    version: str = Field(..., description="服务版本")
    arduino_cli: Optional[dict] = Field(None, description="Arduino CLI 信息")
    libraries: Optional[dict] = Field(None, description="库信息")
    disk: Optional[dict] = Field(None, description="磁盘信息")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "ok",
                    "service": "makefast-platform",
                    "version": "0.1.0",
                    "arduino_cli": {
                        "ok": True,
                        "version": "arduino-cli Version: 1.4.1"
                    },
                    "libraries": {
                        "preinstalled_count": 18
                    },
                    "disk": {
                        "free_gb": 45.2
                    }
                }
            ]
        }
    }


class FeedbackRequest(BaseModel):
    """用户问题反馈"""
    category: str = Field("故障反馈", max_length=50, description="反馈类型")
    message: str = Field(..., min_length=5, max_length=3000, description="反馈内容")
    contact: Optional[str] = Field("", max_length=120, description="联系方式")
    page_url: Optional[str] = Field("", max_length=500, description="当前页面")
    logs: Optional[List[str]] = Field(default=None, description="可选执行日志")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    success: bool = Field(False, description="操作是否成功")
    error_type: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误描述")
    details: Optional[dict] = Field(None, description="错误详情")
    error_id: Optional[str] = Field(None, description="错误追踪 ID")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "error_type": "validation_error",
                    "message": "代码长度超过限制",
                    "details": {
                        "code_length": 60000,
                        "max_length": 50000
                    }
                }
            ]
        }
    }


# ============================================================================
# 固件管理系统数据模型
# ============================================================================


class ErrorCode(str, Enum):
    """错误码枚举"""
    # 认证错误 (401)
    INVALID_CREDENTIALS = "invalid_credentials"
    TOKEN_EXPIRED = "token_expired"
    ACCOUNT_LOCKED = "account_locked"
    
    # 权限错误 (403)
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions"
    
    # 资源错误 (404)
    FIRMWARE_NOT_FOUND = "firmware_not_found"
    FILE_NOT_FOUND = "file_not_found"
    
    # 验证错误 (400)
    INVALID_ZIP_FORMAT = "invalid_zip_format"
    MISSING_REQUIRED_FILES = "missing_required_files"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    INVALID_METADATA = "invalid_metadata"
    INVALID_VERSION_FORMAT = "invalid_version_format"
    VERSION_CONFLICT = "version_conflict"
    INVALID_BOARD_ID = "invalid_board_id"
    INVALID_IMAGE_FORMAT = "invalid_image_format"
    IMAGE_SIZE_EXCEEDED = "image_size_exceeded"
    INVALID_IMAGE_DIMENSIONS = "invalid_image_dimensions"
    INVALID_REQUEST = "invalid_request"
    
    # 存储错误 (500)
    STORAGE_ERROR = "storage_error"
    INSUFFICIENT_STORAGE = "insufficient_storage"
    METADATA_WRITE_ERROR = "metadata_write_error"
    
    # 业务逻辑错误 (409)
    FIRMWARE_IN_USE = "firmware_in_use"
    DUPLICATE_FIRMWARE_ID = "duplicate_firmware_id"


class FirmwareErrorResponse(BaseModel):
    """固件管理系统错误响应模型"""
    success: bool = Field(False, description="操作是否成功")
    error_code: ErrorCode = Field(..., description="错误码")
    message: str = Field(..., description="错误描述")
    details: Optional[dict] = Field(None, description="错误详情")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "error_code": "invalid_zip_format",
                    "message": "上传的文件不是有效的 ZIP 格式",
                    "details": {
                        "filename": "firmware.zip"
                    }
                }
            ]
        }
    }


class FirmwareMetadata(BaseModel):
    """固件元数据模型"""
    firmware_id: str = Field(..., description="固件唯一标识")
    project_name: str = Field(..., min_length=3, max_length=100, description="项目名称")
    description: str = Field(..., min_length=10, max_length=2000, description="项目描述")
    version: str = Field(..., pattern=r'^\d+\.\d+\.\d+$', description="语义化版本号")
    supported_board_ids: List[str] = Field(..., min_length=1, description="支持的开发板 ID 列表")
    tags: List[str] = Field(default=[], max_length=5, description="标签列表（最多 5 个）")
    published: bool = Field(default=False, description="是否已发布")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="软删除时间戳（null 表示未删除）")

    # 文件信息
    files: List[FirmwareFileInfo] = Field(..., description="固件文件列表")
    total_size: int = Field(..., description="总大小（字节）")
    has_thumbnail: bool = Field(default=False, description="是否有缩略图")
    
    # 统计信息
    download_count: int = Field(default=0, description="下载次数")
    flash_count: int = Field(default=0, description="烧录次数")
    flash_success_count: int = Field(default=0, description="烧录成功次数")
    flash_failure_count: int = Field(default=0, description="烧录失败次数")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """验证标签格式"""
        import re
        for tag in v:
            if not (2 <= len(tag) <= 20):
                raise ValueError(f"标签 '{tag}' 长度必须在 2-20 字符之间")
            if not re.match(r'^[a-zA-Z0-9_-]+$', tag):
                raise ValueError(f"标签 '{tag}' 只能包含字母、数字、下划线和连字符")
        # 检查重复标签
        if len(v) != len(set(v)):
            raise ValueError("标签不能重复")
        return v

    @field_validator('supported_board_ids')
    @classmethod
    def validate_board_ids(cls, v: List[str]) -> List[str]:
        """验证开发板 ID（从集中配置动态获取）"""
        from .board_config import get_boards_by_id
        boards = get_boards_by_id()
        invalid_boards = [board_id for board_id in v if board_id not in boards]
        if invalid_boards:
            allowed = ', '.join(boards.keys())
            raise ValueError(
                f"无效的开发板 ID: {', '.join(invalid_boards)}. "
                f"允许的值: {allowed}"
            )
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "firmware_id": "abc123def456",
                    "project_name": "WiFi 温度监控",
                    "description": "基于 ESP32 的 WiFi 温度监控系统，支持实时数据上传到云端",
                    "version": "1.0.0",
                    "supported_board_ids": ["esp32dev", "esp32"],
                    "tags": ["wifi", "sensor", "iot"],
                    "published": True,
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-16T14:20:00Z",
                    "files": [
                        {
                            "name": "bootloader.bin",
                            "size": 16384,
                            "address": 0x1000,
                            "role": "bootloader"
                        },
                        {
                            "name": "partitions.bin",
                            "size": 4096,
                            "address": 0x8000,
                            "role": "partitions"
                        },
                        {
                            "name": "boot_app0.bin",
                            "size": 4096,
                            "address": 0xe000,
                            "role": "boot_app0"
                        },
                        {
                            "name": "app.bin",
                            "size": 524288,
                            "address": 0x10000,
                            "role": "app"
                        }
                    ],
                    "total_size": 548864,
                    "has_thumbnail": True,
                    "download_count": 150,
                    "flash_count": 120,
                    "flash_success_count": 115,
                    "flash_failure_count": 5
                }
            ]
        }
    }


class AdminCredentials(BaseModel):
    """管理员凭证模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    password: str = Field(..., min_length=8, max_length=128, description="密码")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "username": "admin",
                    "password": "SecurePassword123!"
                }
            ]
        }
    }


class AdminToken(BaseModel):
    """管理员 Token 模型"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(default=86400, description="过期时间（秒），默认 24 小时")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 86400
                }
            ]
        }
    }


class AIConfig(BaseModel):
    """AI API 配置模型"""
    api_key: str = Field(..., description="API 密钥")
    api_base: str = Field(..., description="API 基础 URL")
    model: str = Field(..., max_length=200, description="模型名称")
    temperature: float = Field(..., ge=0.0, le=2.0, description="温度参数（0.0-2.0）")
    max_tokens: int = Field(..., ge=100, le=8000, description="最大 token 数（100-8000）")

    @field_validator('api_base')
    @classmethod
    def validate_api_base(cls, v: str) -> str:
        """验证 API Base URL 必须是 HTTPS"""
        if not v.startswith('https://'):
            raise ValueError("API Base URL 必须使用 HTTPS 协议")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "api_key": "EXAMPLE_API_KEY_NOT_A_CREDENTIAL",
                    "api_base": "https://api.openai.com/v1",
                    "model": "gpt-4",
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            ]
        }
    }


class ASRConfig(BaseModel):
    """腾讯云一句话识别配置模型"""
    enabled: bool = Field(False, description="是否启用语音识别")
    provider: str = Field("tencent", description="服务商")
    secret_id: str = Field("", description="腾讯云 SecretId")
    secret_key: str = Field("", description="腾讯云 SecretKey")
    app_id: str = Field("", description="腾讯云 AppId")
    region: str = Field("ap-guangzhou", description="地域")
    engine_model_type: str = Field("16k_zh", description="一句话识别模型")


class OSSConfig(BaseModel):
    """对象存储配置模型"""
    enabled: bool = Field(False, description="是否启用对象存储")
    bucket: str = Field("", description="Bucket")
    endpoint: str = Field("", description="Endpoint")
    region: str = Field("auto", description="Region")
    access_key_id: str = Field("", description="Access Key ID")
    secret_access_key: str = Field("", description="Secret Access Key")
    public_base_url: str = Field("", description="公开访问基础 URL")
    prefix: str = Field("makefast", description="对象前缀")


class ObjectStorageAdminConfig(BaseModel):
    """对象存储后台配置模型"""
    enabled: bool = Field(False, description="是否启用对象存储")
    bucket: str = Field("", description="Bucket")
    endpoint: str = Field("", description="S3 兼容 Endpoint")
    region: str = Field("auto", description="Region")
    access_key_id: str = Field("", description="Access Key ID")
    secret_access_key: str = Field("", description="Secret Access Key")
    public_base_url: str = Field("", description="公开访问基础 URL")
    prefix: str = Field("makefast", description="对象前缀")
