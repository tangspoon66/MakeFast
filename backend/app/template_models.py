"""
项目模板库数据模型定义

定义了模板管理系统的所有 Pydantic 模型，用于请求验证和响应序列化。
"""

from typing import List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator


# ============================================================================
# 错误码枚举
# ============================================================================


class TemplateErrorCode(str, Enum):
    """模板系统错误码枚举"""
    TEMPLATE_NOT_FOUND = "template_not_found"
    INVALID_TEMPLATE_METADATA = "invalid_template_metadata"
    INVALID_FILE_EXTENSION = "invalid_file_extension"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    FILE_COUNT_EXCEEDED = "file_count_exceeded"
    EMPTY_FILE_CONTENT = "empty_file_content"
    INVALID_ZIP_FORMAT = "invalid_zip_format"
    ZIP_NO_SOURCE_FILES = "zip_no_source_files"
    ZIP_SIZE_EXCEEDED = "zip_size_exceeded"
    STORAGE_ERROR = "storage_error"


# ============================================================================
# 源文件模型
# ============================================================================


class TemplateSourceFile(BaseModel):
    """模板源代码文件"""
    name: str = Field(..., min_length=1, description="文件名，如 'sketch.ino'")
    content: str = Field(..., min_length=1, max_length=51200, description="文件内容 (最大 50KB)")

    @field_validator('name')
    @classmethod
    def validate_filename(cls, v: str) -> str:
        """验证文件名扩展名"""
        import os
        allowed_extensions = {".ino", ".cpp", ".h", ".c", ".hpp", ".cc"}
        _, ext = os.path.splitext(v)
        if ext.lower() not in allowed_extensions:
            raise ValueError(
                f"不支持的文件扩展名: {ext}。允许的扩展名: .ino, .cpp, .h, .c, .hpp, .cc"
            )
        return v

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


# ============================================================================
# 元数据模型
# ============================================================================


class TemplateMetadata(BaseModel):
    """模板元数据模型"""
    template_id: str = Field(..., description="模板唯一标识")
    name: str = Field(..., min_length=3, max_length=100, description="模板名称")
    description: str = Field(..., min_length=10, max_length=2000, description="模板描述")
    category: str = Field(..., min_length=2, max_length=50, description="分类")
    tags: List[str] = Field(default=[], description="标签列表（最多 10 个）")
    supported_board_ids: List[str] = Field(..., min_length=1, description="支持的开发板 ID 列表")
    published: bool = Field(default=False, description="是否已发布")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="软删除时间戳（null 表示未删除）")
    file_count: int = Field(..., ge=0, description="源文件数量")
    total_size: int = Field(..., ge=0, description="源文件总大小（字节）")
    article: Optional[str] = Field(None, description="Markdown 文章内容")
    video_url: Optional[str] = Field(None, description="视频链接（B站/抖音/小红书）")
    cover_url: Optional[str] = Field(None, description="封面图 URL（外部链接或本地路径）")
    has_thumbnail: bool = Field(default=False, description="是否有本地缩略图")
    level: Optional[int] = Field(None, ge=1, le=5, description="难度星级 1-5")
    pinned: bool = Field(default=False, description="是否置顶")
    packages: List[str] = Field(default=[], description="附件包标签列表，如 ['3d_model', 'course_material']")
    locked_resources: List[str] = Field(default=[], description="需要口令解锁的资源标签列表")
    unlock_code: Optional[str] = Field(None, description="解锁口令")

    # 统计信息
    view_count: int = Field(default=0, description="查看详情次数")
    open_project_count: int = Field(default=0, description="打开项目次数")
    download_count: int = Field(default=0, description="源代码下载次数")
    package_download_count: int = Field(default=0, description="附件包下载次数")
    flash_count: int = Field(default=0, description="烧录次数")
    unlock_count: int = Field(default=0, description="口令解锁成功次数")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """验证标签数量"""
        if len(v) > 10:
            raise ValueError("标签数量不能超过 10 个")
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
                    "template_id": "abc123-def456",
                    "name": "WiFi 温度监控模板",
                    "description": "基于 ESP32 的 WiFi 温度监控项目模板，支持实时数据上传",
                    "category": "IoT",
                    "tags": ["wifi", "sensor", "temperature"],
                    "supported_board_ids": ["esp32", "esp32s3"],
                    "published": True,
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-16T14:20:00Z",
                    "file_count": 3,
                    "total_size": 4096
                }
            ]
        }
    }


# ============================================================================
# 详情模型
# ============================================================================


class TemplateDetail(TemplateMetadata):
    """模板详情（包含源文件内容）"""
    files: List[TemplateSourceFile] = Field(..., description="源代码文件列表")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "template_id": "abc123-def456",
                    "name": "WiFi 温度监控模板",
                    "description": "基于 ESP32 的 WiFi 温度监控项目模板，支持实时数据上传",
                    "category": "IoT",
                    "tags": ["wifi", "sensor", "temperature"],
                    "supported_board_ids": ["esp32", "esp32s3"],
                    "published": True,
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-16T14:20:00Z",
                    "file_count": 3,
                    "total_size": 4096,
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
                    ]
                }
            ]
        }
    }


# ============================================================================
# 分页响应模型
# ============================================================================


class TemplateListResponse(BaseModel):
    """模板列表分页响应"""
    templates: List[TemplateMetadata] = Field(..., description="模板列表")
    page: int = Field(..., ge=1, description="当前页码")
    page_size: int = Field(..., ge=1, le=50, description="每页数量")
    total_count: int = Field(..., ge=0, description="总数量")
    total_pages: int = Field(..., ge=0, description="总页数")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "templates": [],
                    "page": 1,
                    "page_size": 12,
                    "total_count": 0,
                    "total_pages": 0
                }
            ]
        }
    }


# ============================================================================
# 请求模型
# ============================================================================


class TemplateCreateRequest(BaseModel):
    """创建模板请求"""
    name: str = Field(..., min_length=3, max_length=100, description="模板名称")
    description: str = Field(..., min_length=10, max_length=2000, description="模板描述")
    category: str = Field(..., min_length=2, max_length=50, description="分类")
    tags: List[str] = Field(default=[], description="标签列表（最多 10 个）")
    supported_board_ids: List[str] = Field(..., min_length=1, description="支持的开发板 ID 列表")
    published: bool = Field(default=False, description="是否已发布")
    files: List[TemplateSourceFile] = Field(..., min_length=1, max_length=20, description="源代码文件列表")
    article: Optional[str] = Field(None, max_length=50000, description="Markdown 文章内容")
    video_url: Optional[str] = Field(None, max_length=500, description="视频链接")
    cover_url: Optional[str] = Field(None, max_length=500, description="封面图 URL")
    level: Optional[int] = Field(None, ge=1, le=5, description="难度星级 1-5")
    pinned: bool = Field(default=False, description="是否置顶")
    packages: List[str] = Field(default=[], description="附件包标签列表")
    locked_resources: List[str] = Field(default=[], description="需要口令解锁的资源标签列表")
    unlock_code: Optional[str] = Field(None, max_length=100, description="解锁口令")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """验证标签数量"""
        if len(v) > 10:
            raise ValueError("标签数量不能超过 10 个")
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
                    "name": "WiFi 温度监控模板",
                    "description": "基于 ESP32 的 WiFi 温度监控项目模板，支持实时数据上传",
                    "category": "IoT",
                    "tags": ["wifi", "sensor"],
                    "supported_board_ids": ["esp32"],
                    "published": False,
                    "files": [
                        {
                            "name": "sketch.ino",
                            "content": "void setup() {}\nvoid loop() {}"
                        }
                    ]
                }
            ]
        }
    }


class TemplateUpdateRequest(BaseModel):
    """更新模板请求（所有字段可选，支持部分更新）"""
    name: Optional[str] = Field(None, min_length=3, max_length=100, description="模板名称")
    description: Optional[str] = Field(None, min_length=10, max_length=2000, description="模板描述")
    category: Optional[str] = Field(None, min_length=2, max_length=50, description="分类")
    tags: Optional[List[str]] = Field(None, description="标签列表（最多 10 个）")
    supported_board_ids: Optional[List[str]] = Field(None, min_length=1, description="支持的开发板 ID 列表")
    published: Optional[bool] = Field(None, description="是否已发布")
    files: Optional[List[TemplateSourceFile]] = Field(None, min_length=1, max_length=20, description="源代码文件列表")
    article: Optional[str] = Field(None, max_length=50000, description="Markdown 文章内容")
    video_url: Optional[str] = Field(None, max_length=500, description="视频链接")
    cover_url: Optional[str] = Field(None, max_length=500, description="封面图 URL")
    level: Optional[int] = Field(None, ge=1, le=5, description="难度星级 1-5")
    pinned: Optional[bool] = Field(None, description="是否置顶")
    packages: Optional[List[str]] = Field(None, description="附件包标签列表")
    locked_resources: Optional[List[str]] = Field(None, description="需要口令解锁的资源标签列表")
    unlock_code: Optional[str] = Field(None, max_length=100, description="解锁口令")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证标签数量"""
        if v is not None and len(v) > 10:
            raise ValueError("标签数量不能超过 10 个")
        return v

    @field_validator('supported_board_ids')
    @classmethod
    def validate_board_ids(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证开发板 ID（从集中配置动态获取）"""
        if v is not None:
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
                    "name": "WiFi 温度监控模板 v2",
                    "published": True
                }
            ]
        }
    }


# ============================================================================
# 错误响应模型
# ============================================================================


class TemplateErrorResponse(BaseModel):
    """模板系统错误响应模型"""
    success: bool = Field(False, description="操作是否成功")
    error_code: TemplateErrorCode = Field(..., description="错误码")
    message: str = Field(..., description="错误描述")
    details: Optional[dict] = Field(None, description="错误详情")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "error_code": "invalid_file_extension",
                    "message": "不支持的文件扩展名: .txt。允许的扩展名: .ino, .cpp, .h, .c",
                    "details": None
                }
            ]
        }
    }
