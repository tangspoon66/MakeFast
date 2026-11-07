"""
模板管理服务模块

提供项目模板的 CRUD 操作、元数据管理、文件系统存储和缓存功能。
遵循 FirmwareManager 的设计模式：文件系统存储 + JSON 元数据 + 内存缓存。
"""

import os
import io
import json
import shutil
import logging
import uuid
import time
import math
import zipfile
from pathlib import Path as _EnvPath
from datetime import datetime, timezone
from typing import List, Optional, Dict, Tuple, BinaryIO

# 确保 .env 在模块级实例化之前加载
from dotenv import load_dotenv
_env_path = _EnvPath(__file__).parent.parent / '.env'
if os.environ.get("MAKEFAST_SKIP_DOTENV") != "1":
    load_dotenv(dotenv_path=_env_path)
from pathlib import Path

from .template_models import (
    TemplateSourceFile,
    TemplateMetadata,
    TemplateDetail,
    TemplateListResponse,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateErrorCode,
)
from .board_config import get_boards_by_id

logger = logging.getLogger(__name__)


class TemplateManager:
    """模板管理服务类"""

    # 允许的文件扩展名
    ALLOWED_EXTENSIONS = {".ino", ".cpp", ".h", ".c"}

    # 文件大小限制
    MAX_FILE_SIZE = 50 * 1024  # 50 KB per file
    MAX_FILES_PER_TEMPLATE = 20

    # ZIP 上传限制
    MAX_ZIP_UNCOMPRESSED_SIZE = 1 * 1024 * 1024  # 1 MB

    def __init__(self, storage_path: Optional[str] = None):
        """
        初始化模板管理服务

        Args:
            storage_path: 模板存储根目录，默认从环境变量读取
        """
        self.storage_path = Path(
            storage_path or os.getenv("TEMPLATE_STORAGE_PATH", "./template_storage")
        )

        # 模板列表缓存 (TTL 5 分钟)
        self._cache: Dict[str, Tuple[float, List[TemplateMetadata]]] = {}
        self._cache_ttl = 300  # 5 minutes in seconds

        # 确保存储目录存在
        try:
            self.storage_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Template storage initialized at: {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to create template storage directory: {e}")
            raise

    def _validate_template_id(self, template_id: str) -> None:
        """校验 template_id，防止路径遍历攻击"""
        if not template_id or '..' in template_id or '/' in template_id or '\\' in template_id:
            raise ValueError(f"非法模板 ID: {template_id}")
        # 校验路径在存储目录内
        template_dir = (self.storage_path / template_id).resolve()
        if not str(template_dir).startswith(str(self.storage_path.resolve())):
            raise ValueError(f"模板路径超出存储目录: {template_id}")

    def _validate_tag(self, tag: str) -> None:
        """校验 tag，防止路径遍历攻击"""
        if not tag or '..' in tag or '/' in tag or '\\' in tag:
            raise ValueError(f"非法 tag: {tag}")

    # ========== CRUD 操作 ==========

    def create_template(self, request: TemplateCreateRequest) -> TemplateMetadata:
        """
        创建模板

        Args:
            request: 创建模板请求

        Returns:
            创建的模板元数据

        Raises:
            ValueError: 验证失败时抛出异常
        """
        # 1. 验证元数据
        self._validate_metadata(
            name=request.name,
            description=request.description,
            category=request.category,
            tags=request.tags,
            board_ids=request.supported_board_ids,
        )

        # 2. 验证文件
        self._validate_files(request.files)

        # 3. 生成唯一 template_id
        template_id = self._generate_template_id()
        template_dir = self.storage_path / template_id

        # 4. 检查 template_id 是否已存在（极小概率）
        if template_dir.exists():
            logger.error(f"Duplicate template_id detected: {template_id}")
            raise ValueError("模板 ID 冲突，请重试")

        try:
            # 5. 创建模板目录和 sources 子目录
            template_dir.mkdir(parents=True, exist_ok=False)
            sources_dir = template_dir / "sources"
            sources_dir.mkdir(parents=True, exist_ok=True)

            # 6. 存储源文件
            total_size = 0
            for file in request.files:
                file_path = sources_dir / file.name
                file_path.write_text(file.content, encoding="utf-8")
                total_size += len(file.content.encode("utf-8"))

            # 7. 构建元数据
            now = datetime.now(timezone.utc)
            metadata = TemplateMetadata(
                template_id=template_id,
                name=request.name,
                description=request.description,
                category=request.category,
                tags=request.tags,
                supported_board_ids=request.supported_board_ids,
                published=request.published,
                created_at=now,
                updated_at=None,
                file_count=len(request.files),
                total_size=total_size,
                article=request.article,
                video_url=request.video_url,
                cover_url=request.cover_url,
                has_thumbnail=False,
                level=request.level,
                pinned=request.pinned,
                packages=request.packages,
                locked_resources=request.locked_resources,
                unlock_code=request.unlock_code,
            )

            # 8. 保存元数据
            self._save_metadata(template_dir, metadata)

            # 9. 清除缓存
            self._invalidate_cache()

            logger.info(f"Template created successfully: {template_id}")
            return metadata

        except Exception as e:
            # 清理部分创建的文件
            if template_dir.exists():
                try:
                    shutil.rmtree(template_dir)
                    logger.info(f"Cleaned up partial template: {template_id}")
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup partial template: {cleanup_error}")

            logger.error(f"Template creation failed: {e}")
            raise

    def duplicate_template(self, template_id: str) -> TemplateMetadata:
        """复制模板（包含源文件）"""
        detail = self.get_template_detail(template_id)
        if not detail:
            raise ValueError(f"模板不存在: {template_id}")

        new_id = self._generate_template_id()
        template_dir = self.storage_path / new_id
        template_dir.mkdir(parents=True, exist_ok=False)
        sources_dir = template_dir / "sources"
        sources_dir.mkdir(parents=True, exist_ok=True)

        try:
            total_size = 0
            for file in detail.files:
                file_path = sources_dir / file.name
                file_path.write_text(file.content, encoding="utf-8")
                total_size += len(file.content.encode("utf-8"))

            now = datetime.now(timezone.utc)
            metadata = TemplateMetadata(
                template_id=new_id,
                name=f"{detail.name}（副本）",
                description=detail.description,
                category=detail.category,
                tags=detail.tags,
                supported_board_ids=detail.supported_board_ids,
                published=False,
                created_at=now,
                updated_at=None,
                file_count=len(detail.files),
                total_size=total_size,
                article=detail.article,
                video_url=detail.video_url,
                cover_url=detail.cover_url,
                has_thumbnail=detail.has_thumbnail,
                level=detail.level,
                pinned=detail.pinned,
                packages=detail.packages,
                locked_resources=detail.locked_resources,
                unlock_code=detail.unlock_code,
            )
            self._save_metadata(template_dir, metadata)
            self._invalidate_cache()
            logger.info(f"Template duplicated: {template_id} -> {new_id}")
            return metadata
        except Exception:
            if template_dir.exists():
                shutil.rmtree(template_dir)
            raise

    def get_template_detail(self, template_id: str) -> Optional[TemplateDetail]:
        """
        获取模板详情（包含源文件内容）

        Args:
            template_id: 模板 ID

        Returns:
            模板详情，如果不存在返回 None
        """
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id

        if not template_dir.exists():
            return None

        # 加载元数据
        metadata = self._load_metadata(template_dir)
        if not metadata:
            return None

        # 读取源文件
        sources_dir = template_dir / "sources"
        files: List[TemplateSourceFile] = []

        if sources_dir.exists():
            for file_path in sorted(sources_dir.iterdir()):
                if file_path.is_file():
                    try:
                        content = file_path.read_text(encoding="utf-8")
                        files.append(TemplateSourceFile(
                            name=file_path.name,
                            content=content,
                        ))
                    except Exception as e:
                        logger.warning(
                            f"Failed to read source file {file_path}: {e}"
                        )

        # 构建详情对象
        detail = TemplateDetail(
            template_id=metadata.template_id,
            name=metadata.name,
            description=metadata.description,
            category=metadata.category,
            tags=metadata.tags,
            supported_board_ids=metadata.supported_board_ids,
            published=metadata.published,
            created_at=metadata.created_at,
            updated_at=metadata.updated_at,
            file_count=metadata.file_count,
            total_size=metadata.total_size,
            article=metadata.article,
            video_url=metadata.video_url,
            cover_url=metadata.cover_url,
            has_thumbnail=metadata.has_thumbnail,
            level=metadata.level,
            pinned=metadata.pinned,
            packages=metadata.packages,
            locked_resources=metadata.locked_resources,
            files=files,
        )

        return detail

    def update_template(
        self, template_id: str, request: TemplateUpdateRequest
    ) -> Optional[TemplateMetadata]:
        """
        更新模板（部分更新）

        Args:
            template_id: 模板 ID
            request: 更新请求

        Returns:
            更新后的元数据，如果模板不存在返回 None

        Raises:
            ValueError: 验证失败时抛出异常
        """
        template_dir = self.storage_path / template_id

        if not template_dir.exists():
            return None

        # 加载现有元数据
        existing_metadata = self._load_metadata(template_dir)
        if not existing_metadata:
            return None

        # 获取更新字段（排除 None 值）
        update_data = request.model_dump(exclude_none=True)

        if not update_data:
            return existing_metadata

        # 验证更新的元数据字段
        name = update_data.get("name", existing_metadata.name)
        description = update_data.get("description", existing_metadata.description)
        category = update_data.get("category", existing_metadata.category)
        tags = update_data.get("tags", existing_metadata.tags)
        board_ids = update_data.get(
            "supported_board_ids", existing_metadata.supported_board_ids
        )

        self._validate_metadata(
            name=name,
            description=description,
            category=category,
            tags=tags,
            board_ids=board_ids,
        )

        # 如果有文件更新，验证并存储新文件
        files = update_data.get("files")
        total_size = existing_metadata.total_size
        file_count = existing_metadata.file_count

        if files is not None:
            # 将 dict 列表转换为 TemplateSourceFile 对象
            file_objects = [
                TemplateSourceFile(**f) if isinstance(f, dict) else f
                for f in files
            ]
            self._validate_files(file_objects)

            # 清除旧的源文件并写入新文件
            sources_dir = template_dir / "sources"
            if sources_dir.exists():
                shutil.rmtree(sources_dir)
            sources_dir.mkdir(parents=True, exist_ok=True)

            total_size = 0
            for file in file_objects:
                file_path = sources_dir / file.name
                file_path.write_text(file.content, encoding="utf-8")
                total_size += len(file.content.encode("utf-8"))

            file_count = len(file_objects)

        # 处理新增的内容字段
        article = update_data.get("article", existing_metadata.article)
        video_url = update_data.get("video_url", existing_metadata.video_url)
        cover_url = update_data.get("cover_url", existing_metadata.cover_url)
        level = update_data.get("level", existing_metadata.level)
        pinned = update_data.get("pinned", existing_metadata.pinned)
        packages = update_data.get("packages", existing_metadata.packages)
        locked_resources = update_data.get("locked_resources", existing_metadata.locked_resources)
        unlock_code = update_data.get("unlock_code", existing_metadata.unlock_code)

        # 构建更新后的元数据（保留 template_id 和 created_at）
        updated_metadata = TemplateMetadata(
            template_id=template_id,
            name=name,
            description=description,
            category=category,
            tags=tags,
            supported_board_ids=board_ids,
            published=update_data.get("published", existing_metadata.published),
            created_at=existing_metadata.created_at,
            updated_at=datetime.now(timezone.utc),
            file_count=file_count,
            total_size=total_size,
            article=article,
            video_url=video_url,
            cover_url=cover_url,
            has_thumbnail=existing_metadata.has_thumbnail,
            level=level,
            pinned=pinned,
            packages=packages,
            locked_resources=locked_resources,
            unlock_code=unlock_code,
        )

        # 保存元数据
        self._save_metadata(template_dir, updated_metadata)

        # 清除缓存
        self._invalidate_cache()

        logger.info(f"Template updated: {template_id}")
        return updated_metadata

    def delete_template(self, template_id: str) -> bool:
        """
        软删除模板（移至回收站）

        Args:
            template_id: 模板 ID

        Returns:
            True 如果删除成功，False 如果模板不存在
        """
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id

        if not template_dir.exists():
            return False

        metadata = self._load_metadata(template_dir)
        if not metadata:
            return False

        metadata.deleted_at = datetime.now(timezone.utc)
        self._save_metadata(template_dir, metadata)
        self._invalidate_cache()

        logger.info(f"Template soft-deleted (moved to trash): {template_id}")
        return True

    def restore_template(self, template_id: str) -> bool:
        """从回收站恢复模板"""
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id

        if not template_dir.exists():
            return False

        metadata = self._load_metadata(template_dir)
        if not metadata or not metadata.deleted_at:
            return False

        metadata.deleted_at = None
        self._save_metadata(template_dir, metadata)
        self._invalidate_cache()

        logger.info(f"Template restored from trash: {template_id}")
        return True

    def permanently_delete_template(self, template_id: str) -> bool:
        """永久删除模板（从磁盘清除）"""
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id

        if not template_dir.exists():
            return False

        try:
            shutil.rmtree(template_dir)
            self._invalidate_cache()
            logger.info(f"Template permanently deleted: {template_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to permanently delete template {template_id}: {e}")
            raise ValueError(f"永久删除模板失败: {str(e)}")

    def get_trashed_templates(self) -> List[TemplateMetadata]:
        """获取所有已删除的模板"""
        all_templates = self._get_all_templates_cached(include_deleted=True)
        return [t for t in all_templates if t.deleted_at is not None]

    def empty_trash(self) -> int:
        """永久删除回收站中所有模板，返回删除数量"""
        trashed = self.get_trashed_templates()
        count = 0
        for t in trashed:
            try:
                self.permanently_delete_template(t.template_id)
                count += 1
            except Exception as e:
                logger.error(f"Failed to empty trash for template {t.template_id}: {e}")
        return count

    def purge_expired_trash(self, max_age_days: int = 30) -> int:
        """永久删除超过 max_age_days 天的回收站模板"""
        trashed = self.get_trashed_templates()
        cutoff = datetime.now(timezone.utc)
        count = 0
        for t in trashed:
            if t.deleted_at:
                dt = t.deleted_at.replace(tzinfo=timezone.utc) if t.deleted_at.tzinfo is None else t.deleted_at
                age = cutoff - dt
                if age.days >= max_age_days:
                    try:
                        self.permanently_delete_template(t.template_id)
                        count += 1
                    except Exception as e:
                        logger.error(f"Failed to purge template {t.template_id}: {e}")
        return count

    # ========== ZIP 上传 ==========

    def create_from_zip(
        self,
        zip_data: BinaryIO,
        name: str,
        description: str,
        category: str,
        tags: List[str],
        supported_board_ids: List[str],
        published: bool = False,
    ) -> TemplateMetadata:
        """
        从 ZIP 文件创建模板

        Args:
            zip_data: ZIP 文件的二进制数据（file-like object）
            name: 模板名称
            description: 模板描述
            category: 分类
            tags: 标签列表
            supported_board_ids: 支持的开发板 ID 列表
            published: 是否发布

        Returns:
            创建的模板元数据

        Raises:
            ValueError: 验证失败时抛出异常
        """
        # 1. 读取 ZIP 数据到内存
        try:
            zip_bytes = zip_data.read()
        except Exception as e:
            logger.error(f"Failed to read ZIP data: {e}")
            raise ValueError("读取 ZIP 文件失败")

        # 2. 验证 ZIP 格式
        if not zipfile.is_zipfile(io.BytesIO(zip_bytes)):
            raise ValueError("无效的 ZIP 文件格式")

        # 3. 打开 ZIP 文件并检查内容
        try:
            with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
                # 4. 检查总解压大小
                total_uncompressed_size = sum(
                    info.file_size for info in zf.infolist() if not info.is_dir()
                )
                if total_uncompressed_size > self.MAX_ZIP_UNCOMPRESSED_SIZE:
                    raise ValueError(
                        f"ZIP 解压后总大小超过限制: "
                        f"{total_uncompressed_size / 1024 / 1024:.2f} MB > "
                        f"{self.MAX_ZIP_UNCOMPRESSED_SIZE / 1024 / 1024:.0f} MB"
                    )

                # 5. 提取有效源文件（扁平化目录结构）
                extracted_files: List[TemplateSourceFile] = []
                seen_basenames: set = set()

                for info in zf.infolist():
                    # 跳过目录
                    if info.is_dir():
                        continue

                    # 获取文件基名（扁平化）
                    basename = os.path.basename(info.filename)
                    if not basename:
                        continue

                    # 检查文件扩展名
                    _, ext = os.path.splitext(basename)
                    if ext.lower() not in self.ALLOWED_EXTENSIONS:
                        continue

                    # 处理重复文件名（保留第一个）
                    if basename.lower() in seen_basenames:
                        logger.debug(
                            f"Skipping duplicate file: {info.filename} "
                            f"(basename: {basename})"
                        )
                        continue
                    seen_basenames.add(basename.lower())

                    # 读取文件内容
                    try:
                        content = zf.read(info.filename).decode("utf-8")
                    except UnicodeDecodeError:
                        logger.warning(
                            f"Skipping non-UTF-8 file: {info.filename}"
                        )
                        continue

                    extracted_files.append(
                        TemplateSourceFile(name=basename, content=content)
                    )

        except zipfile.BadZipFile:
            raise ValueError("无效的 ZIP 文件格式")
        except ValueError:
            # 重新抛出我们自己的 ValueError
            raise
        except Exception as e:
            logger.error(f"Failed to process ZIP file: {e}")
            raise ValueError(f"处理 ZIP 文件失败: {str(e)}")

        # 6. 检查是否有有效源文件
        if not extracted_files:
            raise ValueError("ZIP 文件中没有有效的源文件（.ino, .cpp, .h, .c）")

        # 7. 使用 create_template 创建模板
        create_request = TemplateCreateRequest(
            name=name,
            description=description,
            category=category,
            tags=tags,
            supported_board_ids=supported_board_ids,
            published=published,
            files=extracted_files,
        )

        return self.create_template(create_request)

    # ========== 列表与筛选 ==========

    def get_template_list(
        self,
        published_only: bool = True,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        board_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> TemplateListResponse:
        """
        获取模板列表，支持分页和筛选

        Args:
            published_only: 是否只返回已发布的模板
            category: 按分类筛选
            tags: 按标签筛选（任一匹配）
            board_id: 按开发板 ID 筛选
            search: 搜索关键词（名称或描述）
            page: 页码（从 1 开始）
            page_size: 每页数量

        Returns:
            分页的模板列表响应
        """
        # 从缓存获取所有模板
        all_templates = self._get_all_templates_cached()

        # 应用筛选条件
        filtered = []
        for metadata in all_templates:
            # 筛选：发布状态
            if published_only and not metadata.published:
                continue

            # 筛选：分类
            if category and metadata.category != category:
                continue

            # 筛选：标签（任一匹配）
            if tags:
                if not any(tag in metadata.tags for tag in tags):
                    continue

            # 筛选：开发板 ID
            if board_id and board_id not in metadata.supported_board_ids:
                continue

            # 筛选：搜索关键词（不区分大小写）
            if search:
                search_lower = search.lower()
                if (
                    search_lower not in metadata.name.lower()
                    and search_lower not in metadata.description.lower()
                ):
                    continue

            filtered.append(metadata)

        # 计算分页
        total_count = len(filtered)
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

        # 分页切片
        start = (page - 1) * page_size
        end = start + page_size
        page_items = filtered[start:end]

        return TemplateListResponse(
            templates=page_items,
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
        )

    # ========== 验证方法 ==========

    def _validate_metadata(
        self,
        name: str,
        description: str,
        category: str,
        tags: List[str],
        board_ids: List[str],
    ) -> None:
        """
        验证模板元数据

        Args:
            name: 模板名称
            description: 模板描述
            category: 分类
            tags: 标签列表
            board_ids: 支持的开发板 ID 列表

        Raises:
            ValueError: 验证失败时抛出异常
        """
        # 验证名称长度
        if not name or len(name) < 3 or len(name) > 100:
            raise ValueError("模板名称长度必须在 3-100 个字符之间")

        # 验证描述长度
        if not description or len(description) < 10 or len(description) > 2000:
            raise ValueError("模板描述长度必须在 10-2000 个字符之间")

        # 验证分类长度
        if not category or len(category) < 2 or len(category) > 50:
            raise ValueError("分类长度必须在 2-50 个字符之间")

        # 验证标签数量
        if len(tags) > 10:
            raise ValueError("标签数量不能超过 10 个")

        # 验证开发板 ID
        if not board_ids:
            raise ValueError("至少需要指定一个支持的开发板")

        boards = get_boards_by_id()
        invalid_boards = [bid for bid in board_ids if bid not in boards]
        if invalid_boards:
            allowed = ", ".join(boards.keys())
            raise ValueError(
                f"无效的开发板 ID: {', '.join(invalid_boards)}. "
                f"允许的值: {allowed}"
            )

    def _validate_files(self, files: List[TemplateSourceFile]) -> None:
        """
        验证模板源文件

        Args:
            files: 源文件列表

        Raises:
            ValueError: 验证失败时抛出异常
        """
        if not files:
            raise ValueError("至少需要一个源文件")

        # 验证文件数量
        if len(files) > self.MAX_FILES_PER_TEMPLATE:
            raise ValueError(
                f"文件数量超过限制: {len(files)} > {self.MAX_FILES_PER_TEMPLATE}"
            )

        for file in files:
            # 验证文件名非空
            if not file.name or not file.name.strip():
                raise ValueError("文件名不能为空")

            # 验证文件名不含路径遍历字符
            if '..' in file.name or '/' in file.name or '\\' in file.name:
                raise ValueError(f"文件名包含非法字符: {file.name}")

            # 验证文件扩展名
            _, ext = os.path.splitext(file.name)
            if ext.lower() not in self.ALLOWED_EXTENSIONS:
                raise ValueError(
                    f"不支持的文件扩展名: {ext}。"
                    f"允许的扩展名: {', '.join(self.ALLOWED_EXTENSIONS)}"
                )

            # 验证文件内容非空
            if not file.content or not file.content.strip():
                raise ValueError(f"文件 '{file.name}' 内容不能为空")

            # 验证文件大小
            file_size = len(file.content.encode("utf-8"))
            if file_size > self.MAX_FILE_SIZE:
                raise ValueError(
                    f"文件 '{file.name}' 大小超过限制: "
                    f"{file_size / 1024:.1f} KB > {self.MAX_FILE_SIZE / 1024:.1f} KB"
                )

    # ========== 缓存方法 ==========

    def _invalidate_cache(self):
        """清除模板列表缓存"""
        self._cache.clear()

    def _get_all_templates_cached(self, include_deleted: bool = False) -> List[TemplateMetadata]:
        """
        获取所有模板元数据（带缓存）

        使用内存缓存，TTL 5 分钟，减少文件系统 I/O

        Args:
            include_deleted: 是否包含已删除的模板
        """
        cache_key = f"all_templates:{include_deleted}"
        now = time.time()

        # 检查缓存是否有效
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if now - cached_time < self._cache_ttl:
                return cached_data

        # 缓存失效或不存在，重新加载
        templates: List[TemplateMetadata] = []

        if not self.storage_path.exists():
            return []

        for template_dir in self.storage_path.iterdir():
            if not template_dir.is_dir():
                continue

            try:
                metadata = self._load_metadata(template_dir)
                if metadata:
                    templates.append(metadata)
            except Exception as e:
                logger.warning(
                    f"Failed to load template metadata from {template_dir}: {e}"
                )
                continue

        # 置顶优先，再按创建时间降序排序（兼容 naive/aware datetime 混用）
        def _sort_key(t):
            dt = t.created_at
            normalized = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            return (0 if t.pinned else 1, -normalized.timestamp())
        templates.sort(key=_sort_key)

        # 过滤已删除项
        if not include_deleted:
            templates = [t for t in templates if t.deleted_at is None]

        # 更新缓存
        self._cache[cache_key] = (now, templates)

        return templates

    # ========== 私有辅助方法 ==========

    def _generate_template_id(self) -> str:
        """生成唯一的模板 ID"""
        return uuid.uuid4().hex

    def _save_metadata(self, template_dir: Path, metadata: TemplateMetadata) -> None:
        """
        保存元数据到 JSON 文件（原子写入）

        Args:
            template_dir: 模板目录
            metadata: 元数据

        Raises:
            ValueError: 保存失败时抛出异常
        """
        metadata_path = template_dir / "metadata.json"
        temp_path = template_dir / "metadata.json.tmp"

        try:
            # 写入临时文件
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(
                    metadata.model_dump(mode="json"),
                    f,
                    ensure_ascii=False,
                    indent=2,
                )

            # 原子重命名（覆盖旧文件）
            temp_path.replace(metadata_path)

        except Exception as e:
            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()

            logger.error(f"Failed to save metadata: {e}")
            raise ValueError(f"元数据保存失败: {str(e)}")

    def _load_metadata(self, template_dir: Path) -> Optional[TemplateMetadata]:
        """
        从 JSON 文件加载元数据

        Args:
            template_dir: 模板目录

        Returns:
            元数据对象，如果加载失败返回 None
        """
        metadata_path = template_dir / "metadata.json"

        if not metadata_path.exists():
            logger.warning(f"Metadata file not found: {metadata_path}")
            return None

        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 验证必需字段
            required_fields = [
                "template_id",
                "name",
                "description",
                "category",
                "supported_board_ids",
                "created_at",
            ]
            missing_fields = [
                field for field in required_fields if field not in data
            ]

            if missing_fields:
                logger.error(
                    f"Metadata missing required fields: {missing_fields}"
                )
                return None

            # 解析为 Pydantic 模型
            return TemplateMetadata(**data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse metadata JSON: {e}")
            return None

        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            return None

    # ========== 缩略图管理 ==========

    def _assets_path(self, template_dir: Path) -> Path:
        return template_dir / "assets.json"

    def _load_assets(self, template_dir: Path) -> dict:
        path = self._assets_path(template_dir)
        if not path.exists():
            return {"thumbnail": None, "packages": {}}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {"thumbnail": None, "packages": {}}

    def _save_assets(self, template_dir: Path, assets: dict) -> None:
        tmp_path = self._assets_path(template_dir).with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.replace(self._assets_path(template_dir))

    def upload_thumbnail(self, template_id: str, file_content: bytes, filename: str) -> bool:
        """
        上传模板缩略图

        Args:
            template_id: 模板 ID
            file_content: 图片文件内容
            filename: 原始文件名（用于确定扩展名）

        Returns:
            True 如果上传成功

        Raises:
            ValueError: 图片验证失败时抛出异常
        """
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        # 文件大小限制
        max_size = 500 * 1024  # 500 KB
        if len(file_content) > max_size:
            raise ValueError(
                f"缩略图文件大小超过限制: {len(file_content) / 1024:.1f} KB > "
                f"{max_size / 1024:.1f} KB"
            )

        # 用 PIL 验证图片格式（魔数校验）
        try:
            from PIL import Image
            image = Image.open(io.BytesIO(file_content))
            if image.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError(
                    f"不支持的图片格式: {image.format}. 支持的格式: PNG, JPEG, WEBP"
                )
        except Exception:
            raise ValueError("无效的图片文件")

        # 确定扩展名（用 PIL 检测到的格式）
        format_ext = {
            "PNG": ".png",
            "JPEG": ".jpg",
            "WEBP": ".webp",
        }
        ext = format_ext.get(image.format, ".png")

        # 保存缩略图
        thumbnail_path = template_dir / f"thumbnail{ext}"

        # 删除旧的缩略图
        for old_thumb in template_dir.glob("thumbnail.*"):
            old_thumb.unlink()

        thumbnail_path.write_bytes(file_content)

        object_url = None
        try:
            from .object_storage import object_storage
            if object_storage.enabled:
                object_url = object_storage.upload_file(
                    thumbnail_path,
                    f"templates/{template_id}/thumbnail{ext}",
                    content_type={
                        ".png": "image/png",
                        ".jpg": "image/jpeg",
                        ".webp": "image/webp",
                    }.get(ext, "image/png"),
                )
                assets = self._load_assets(template_dir)
                assets["thumbnail"] = {"url": object_url, "key": f"templates/{template_id}/thumbnail{ext}"}
                self._save_assets(template_dir, assets)
        except Exception as e:
            logger.warning(f"Failed to upload template thumbnail to object storage: {e}")

        # 更新元数据
        metadata = self._load_metadata(template_dir)
        if metadata:
            metadata.has_thumbnail = True
            if object_url:
                metadata.cover_url = object_url
            self._save_metadata(template_dir, metadata)
            self._invalidate_cache()

        logger.info(f"Thumbnail uploaded for template: {template_id}")
        return True

    def get_thumbnail_path(self, template_id: str) -> Optional[Path]:
        """
        获取模板缩略图路径

        Args:
            template_id: 模板 ID

        Returns:
            缩略图文件路径，如果不存在返回 None
        """
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return None

        for ext in ('.png', '.jpg', '.jpeg', '.webp'):
            thumb_path = template_dir / f"thumbnail{ext}"
            if thumb_path.exists():
                return thumb_path

        return None

    def get_thumbnail_url(self, template_id: str) -> Optional[str]:
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return None
        assets = self._load_assets(template_dir)
        thumb = assets.get("thumbnail") or {}
        return thumb.get("url")


    # ========== 附件包管理 ==========

    def upload_package(
        self,
        template_id: str,
        tag: str,
        file_content: bytes,
        display_name: Optional[str] = None,
    ) -> bool:
        self._validate_template_id(template_id)
        self._validate_tag(tag)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        packages_dir = template_dir / "packages"
        packages_dir.mkdir(exist_ok=True)

        package_path = packages_dir / f"{tag}.zip"
        package_path.write_bytes(file_content)

        object_url = None
        assets = self._load_assets(template_dir)
        packages_assets = assets.setdefault("packages", {})
        package_asset = {
            "filename": display_name or f"{tag}.zip",
            "size": len(file_content),
        }
        try:
            from .object_storage import object_storage
            if object_storage.enabled:
                object_url = object_storage.upload_file(
                    package_path,
                    f"templates/{template_id}/packages/{tag}.zip",
                    content_type="application/zip",
                )
                package_asset.update({
                    "url": object_url,
                    "key": f"templates/{template_id}/packages/{tag}.zip",
                })
        except Exception as e:
            logger.warning(f"Failed to upload template package to object storage: {e}")

        packages_assets[tag] = package_asset
        self._save_assets(template_dir, assets)

        metadata = self._load_metadata(template_dir)
        if metadata:
            packages = list(metadata.packages) if metadata.packages else []
            if tag not in packages:
                packages.append(tag)
            metadata.packages = packages
            self._save_metadata(template_dir, metadata)
            self._invalidate_cache()

        logger.info(f"Package uploaded for template {template_id}: {tag}")
        return True

    def rename_package_file(self, template_id: str, tag: str, display_name: str) -> bool:
        self._validate_template_id(template_id)
        self._validate_tag(tag)
        clean_name = display_name.strip()
        if not clean_name:
            raise ValueError("文件名不能为空")
        if "/" in clean_name or "\\" in clean_name:
            raise ValueError("文件名不能包含路径分隔符")
        if len(clean_name) > 120:
            raise ValueError("文件名不能超过 120 个字符")

        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        package_path = template_dir / "packages" / f"{tag}.zip"
        assets = self._load_assets(template_dir)
        packages_assets = assets.setdefault("packages", {})
        if not package_path.exists() and tag not in packages_assets:
            raise ValueError("资源包不存在")

        current = packages_assets.get(tag, {})
        current["filename"] = clean_name
        if package_path.exists():
            current["size"] = package_path.stat().st_size
        packages_assets[tag] = current
        self._save_assets(template_dir, assets)
        return True

    def delete_package(self, template_id: str, tag: str) -> bool:
        self._validate_template_id(template_id)
        self._validate_tag(tag)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        package_path = template_dir / "packages" / f"{tag}.zip"
        if package_path.exists():
            package_path.unlink()

        assets = self._load_assets(template_dir)
        if assets.get("packages", {}).pop(tag, None) is not None:
            self._save_assets(template_dir, assets)

        metadata = self._load_metadata(template_dir)
        if metadata and metadata.packages:
            new_packages = [p for p in metadata.packages if p != tag]
            if len(new_packages) != len(metadata.packages):
                metadata.packages = new_packages
                self._save_metadata(template_dir, metadata)
                self._invalidate_cache()

        return True

    def rename_package(self, template_id: str, old_tag: str, new_tag: str) -> bool:
        self._validate_template_id(template_id)
        self._validate_tag(old_tag)
        self._validate_tag(new_tag)
        if old_tag == new_tag:
            return True

        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        packages_dir = template_dir / "packages"
        old_path = packages_dir / f"{old_tag}.zip"
        new_path = packages_dir / f"{new_tag}.zip"
        if old_path.exists():
            if new_path.exists():
                raise ValueError(f"资源类型已存在: {new_tag}")
            old_path.rename(new_path)

        assets = self._load_assets(template_dir)
        package_assets = assets.get("packages", {})
        if old_tag in package_assets:
            package_assets[new_tag] = package_assets.pop(old_tag)
            package_assets[new_tag]["filename"] = f"{new_tag}.zip"
            if "key" in package_assets[new_tag]:
                package_assets[new_tag]["key"] = f"templates/{template_id}/packages/{new_tag}.zip"
            assets["packages"] = package_assets
            self._save_assets(template_dir, assets)

        metadata = self._load_metadata(template_dir)
        if metadata:
            if metadata.packages:
                metadata.packages = [new_tag if tag == old_tag else tag for tag in metadata.packages]
                if new_tag not in metadata.packages:
                    metadata.packages.append(new_tag)
            if metadata.locked_resources:
                metadata.locked_resources = [new_tag if tag == old_tag else tag for tag in metadata.locked_resources]
            self._save_metadata(template_dir, metadata)
            self._invalidate_cache()

        return True

    def list_packages(self, template_id: str) -> List[dict]:
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return []

        packages_dir = template_dir / "packages"
        assets = self._load_assets(template_dir)
        package_assets = assets.get("packages", {}) if isinstance(assets.get("packages"), dict) else {}

        result = []
        metadata = self._load_metadata(template_dir)
        seen_tags = set()
        if packages_dir.exists():
            for pkg in packages_dir.iterdir():
                if pkg.suffix == '.zip':
                    tag = pkg.stem
                    seen_tags.add(tag)
                    locked = tag in (metadata.locked_resources or []) if metadata else False
                    asset_info = package_assets.get(tag, {})
                    result.append({
                        "tag": tag,
                        "filename": asset_info.get("filename", pkg.name),
                        "size": pkg.stat().st_size,
                        "locked": locked,
                        "url": asset_info.get("url"),
                    })
        for tag, info in package_assets.items():
            if tag in seen_tags:
                continue
            locked = tag in (metadata.locked_resources or []) if metadata else False
            result.append({
                "tag": tag,
                "filename": info.get("filename", f"{tag}.zip"),
                "size": int(info.get("size", 0) or 0),
                "locked": locked,
                "url": info.get("url"),
            })
        return result

    def get_package_path(self, template_id: str, tag: str) -> Optional[Path]:
        self._validate_template_id(template_id)
        self._validate_tag(tag)
        template_dir = self.storage_path / template_id
        package_path = template_dir / "packages" / f"{tag}.zip"
        if package_path.exists():
            return package_path
        return None

    def get_package_url(self, template_id: str, tag: str) -> Optional[str]:
        self._validate_template_id(template_id)
        self._validate_tag(tag)
        template_dir = self.storage_path / template_id
        assets = self._load_assets(template_dir)
        return (assets.get("packages") or {}).get(tag, {}).get("url")

    # ========== 源代码 ZIP 下载 ==========

    def download_source_zip(self, template_id: str) -> Optional[bytes]:
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return None

        sources_dir = template_dir / "sources"
        if not sources_dir.exists() or not any(sources_dir.iterdir()):
            return None

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_path in sorted(sources_dir.iterdir()):
                if file_path.is_file():
                    zf.write(file_path, file_path.name)
        return buf.getvalue()

    # ========== 解锁验证 ==========

    def verify_unlock(self, template_id: str, code: str) -> bool:
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False

        metadata = self._load_metadata(template_dir)
        if not metadata or not metadata.unlock_code:
            return False

        return metadata.unlock_code == code.strip()

    # ========== 统计方法 ==========

    def _update_stat(self, template_id: str, field: str) -> bool:
        """通用统计字段递增"""
        self._validate_template_id(template_id)
        template_dir = self.storage_path / template_id
        if not template_dir.exists():
            return False
        metadata = self._load_metadata(template_dir)
        if not metadata:
            return False
        current = getattr(metadata, field, 0)
        setattr(metadata, field, current + 1)
        self._save_metadata(template_dir, metadata)
        self._invalidate_cache()
        return True

    def update_view_statistics(self, template_id: str) -> bool:
        """查看详情 +1"""
        return self._update_stat(template_id, 'view_count')

    def update_open_project_statistics(self, template_id: str) -> bool:
        """打开项目 +1"""
        return self._update_stat(template_id, 'open_project_count')

    def update_download_statistics(self, template_id: str) -> bool:
        """源代码下载 +1"""
        return self._update_stat(template_id, 'download_count')

    def update_package_download_statistics(self, template_id: str) -> bool:
        """附件包下载 +1"""
        return self._update_stat(template_id, 'package_download_count')

    def update_flash_statistics(self, template_id: str) -> bool:
        """烧录 +1"""
        return self._update_stat(template_id, 'flash_count')

    def update_unlock_statistics(self, template_id: str) -> bool:
        """口令解锁 +1"""
        return self._update_stat(template_id, 'unlock_count')

    def get_template_statistics(self) -> dict:
        """获取模板汇总统计"""
        all_templates = self._get_all_templates_cached()
        total = len(all_templates)
        published = sum(1 for t in all_templates if t.published)

        def safe_sum(field: str) -> int:
            return sum(getattr(t, field, 0) for t in all_templates)

        popular = sorted(
            [
                {
                    "template_id": t.template_id,
                    "name": t.name,
                    "category": t.category,
                    "view_count": getattr(t, 'view_count', 0),
                    "download_count": getattr(t, 'download_count', 0),
                    "flash_count": getattr(t, 'flash_count', 0),
                }
                for t in all_templates
            ],
            key=lambda x: (x['flash_count'], x['download_count'], x['view_count']),
            reverse=True
        )[:10]

        return {
            "total_templates": total,
            "published_templates": published,
            "total_views": safe_sum('view_count'),
            "total_open_projects": safe_sum('open_project_count'),
            "total_downloads": safe_sum('download_count'),
            "total_package_downloads": safe_sum('package_download_count'),
            "total_flashes": safe_sum('flash_count'),
            "total_unlocks": safe_sum('unlock_count'),
            "popular_templates": popular,
        }


# 全局模板管理服务实例
template_manager = TemplateManager()
