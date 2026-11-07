"""
固件管理服务模块

提供固件包的 CRUD 操作、元数据管理、文件系统存储和缩略图处理功能。
"""

import os
import json
import math
import shutil
import logging
import zipfile
import uuid
import time
from pathlib import Path as _EnvPath
from datetime import datetime, timezone
from typing import List, Optional, Dict, BinaryIO, Tuple

# 确保 .env 在模块级实例化之前加载
from dotenv import load_dotenv
_env_path = _EnvPath(__file__).parent.parent / '.env'
if os.environ.get("MAKEFAST_SKIP_DOTENV") != "1":
    load_dotenv(dotenv_path=_env_path)
from pathlib import Path
from io import BytesIO

from fastapi import UploadFile
from PIL import Image

from .models import FirmwareMetadata, FirmwareFileInfo, ErrorCode, FirmwareErrorResponse

logger = logging.getLogger(__name__)


class FirmwareManager:
    """固件管理服务类"""
    
    # ESP32 固件必需文件
    REQUIRED_ESP32_FILES = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "app.bin"]
    
    # 文件大小限制
    MAX_FIRMWARE_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    MAX_TOTAL_PACKAGE_SIZE = 100 * 1024 * 1024  # 100 MB
    MAX_ZIP_UNCOMPRESSED_SIZE = 200 * 1024 * 1024  # 200 MB (解压后)
    MAX_THUMBNAIL_SIZE = 500 * 1024  # 500 KB
    MAX_SINGLE_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
    
    # 缩略图配置
    THUMBNAIL_MAX_SIZE = (400, 400)
    THUMBNAIL_MIN_SIZE = (200, 200)
    THUMBNAIL_MAX_DIMENSIONS = (1000, 1000)
    THUMBNAIL_FORMATS = ["PNG", "JPEG", "WEBP"]
    
    # 存储空间要求
    MIN_FREE_SPACE_GB = 1.0
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        初始化固件管理服务
        
        Args:
            storage_path: 固件存储根目录，默认从环境变量读取
        """
        self.storage_path = Path(storage_path or os.getenv("FIRMWARE_STORAGE_PATH", "/opt/firmware"))
        
        # 固件列表缓存 (TTL 5 分钟)
        self._cache: Dict[str, Tuple[float, List[FirmwareMetadata]]] = {}
        self._cache_ttl = 300  # 5 minutes in seconds
        
        # 确保存储目录存在
        try:
            self.storage_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Firmware storage initialized at: {self.storage_path}")
        except Exception as e:
            logger.error(f"Failed to create firmware storage directory: {e}")
            raise

    def _validate_firmware_id(self, firmware_id: str) -> None:
        """校验 firmware_id，防止路径遍历攻击"""
        if not firmware_id or '..' in firmware_id or '/' in firmware_id or '\\' in firmware_id:
            raise ValueError(f"非法固件 ID: {firmware_id}")

    def _assets_path(self, firmware_dir: Path) -> Path:
        return firmware_dir / "assets.json"

    def _load_assets(self, firmware_dir: Path) -> dict:
        path = self._assets_path(firmware_dir)
        if not path.exists():
            return {"thumbnail": None, "package": None}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {"thumbnail": None, "package": None}

    def _save_assets(self, firmware_dir: Path, assets: dict) -> None:
        tmp_path = self._assets_path(firmware_dir).with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.replace(self._assets_path(firmware_dir))

    def check_version_conflict(
        self,
        project_name: str,
        version: str
    ) -> Optional[FirmwareMetadata]:
        """
        检测版本冲突：同一项目名称 + 同一版本号
        
        Args:
            project_name: 项目名称
            version: 版本号
        
        Returns:
            如果存在冲突，返回冲突的固件元数据；否则返回 None
        """
        all_firmwares = self._get_all_firmwares_cached()
        for firmware in all_firmwares:
            if firmware.project_name == project_name and firmware.version == version:
                return firmware
        return None

    def get_project_versions(self, project_name: str) -> List[FirmwareMetadata]:
        """
        获取指定项目的所有版本，按版本号降序排序
        
        Args:
            project_name: 项目名称
        
        Returns:
            该项目的所有固件版本列表（按版本降序）
        """
        all_firmwares = self._get_all_firmwares_cached()
        project_firmwares = [
            f for f in all_firmwares if f.project_name == project_name
        ]
        
        # 按版本号降序排序
        project_firmwares.sort(
            key=lambda f: self._parse_version(f.version),
            reverse=True
        )
        
        return project_firmwares

    @staticmethod
    def _parse_version(version: str) -> tuple:
        """
        解析语义化版本号为可比较的元组
        
        Args:
            version: 版本字符串 (如 "1.2.3")
        
        Returns:
            (major, minor, patch) 元组，解析失败返回 (0, 0, 0)
        """
        import re
        match = re.match(r'^(\d+)\.(\d+)\.(\d+)$', version)
        if match:
            return (int(match.group(1)), int(match.group(2)), int(match.group(3)))
        return (0, 0, 0)

    def upload_firmware(
        self,
        zip_file: UploadFile,
        metadata: FirmwareMetadata
    ) -> str:
        """
        上传固件包
        
        Args:
            zip_file: ZIP 格式的固件包文件
            metadata: 固件元数据
        
        Returns:
            firmware_id: 生成的固件 ID
        
        Raises:
            ValueError: 验证失败时抛出异常
        """
        # 0. 检查版本冲突
        conflict = self.check_version_conflict(metadata.project_name, metadata.version)
        if conflict:
            raise ValueError(
                f"版本冲突: 项目 '{metadata.project_name}' 已存在版本 {metadata.version} "
                f"(固件 ID: {conflict.firmware_id})"
            )
        
        # 1. 检查存储空间
        self._check_storage_space()
        
        # 2. 生成唯一的 firmware_id
        firmware_id = self._generate_firmware_id()
        firmware_dir = self.storage_path / firmware_id
        
        # 3. 检查 firmware_id 是否已存在（极小概率）
        if firmware_dir.exists():
            logger.error(f"Duplicate firmware_id detected: {firmware_id}")
            raise ValueError(f"固件 ID 冲突，请重试")
        
        try:
            # 4. 创建固件目录
            firmware_dir.mkdir(parents=True, exist_ok=False)
            
            # 5. 验证和解压 ZIP 文件
            firmware_files = self._extract_and_validate_zip(zip_file, firmware_dir)
            
            # 6. 更新元数据中的文件信息
            metadata.firmware_id = firmware_id
            metadata.files = firmware_files
            metadata.total_size = sum(f.size for f in firmware_files)
            metadata.created_at = datetime.now(timezone.utc)
            metadata.updated_at = None
            
            # 7. 保存元数据
            self._save_metadata(firmware_dir, metadata)
            
            # 8. 清除缓存
            self._invalidate_cache()
            
            logger.info(f"Firmware uploaded successfully: {firmware_id}")
            return firmware_id
        
        except Exception as e:
            # 清理部分上传的文件
            if firmware_dir.exists():
                try:
                    shutil.rmtree(firmware_dir)
                    logger.info(f"Cleaned up partial upload: {firmware_id}")
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup partial upload: {cleanup_error}")
            
            logger.error(f"Firmware upload failed: {e}")
            raise
    
    def _invalidate_cache(self):
        """清除固件列表缓存"""
        self._cache.clear()
    
    def _get_all_firmwares_cached(self, include_deleted: bool = False) -> List[FirmwareMetadata]:
        """
        获取所有固件元数据（带缓存）

        使用内存缓存，TTL 5 分钟，减少文件系统 I/O

        Args:
            include_deleted: 是否包含已删除的固件
        """
        cache_key = f"all_firmwares:{include_deleted}"
        now = time.time()

        # 检查缓存是否有效
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if now - cached_time < self._cache_ttl:
                return cached_data

        # 缓存失效或不存在，重新加载
        firmwares = []

        if not self.storage_path.exists():
            return []

        for firmware_dir in self.storage_path.iterdir():
            if not firmware_dir.is_dir():
                continue

            try:
                metadata = self._load_metadata(firmware_dir)
                if metadata:
                    firmwares.append(metadata)
            except Exception as e:
                logger.warning(f"Failed to load firmware metadata from {firmware_dir}: {e}")
                continue

        # 按创建时间降序排序（兼容 naive/aware datetime 混用）
        def _sort_key(fw):
            dt = fw.created_at
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        firmwares.sort(key=_sort_key, reverse=True)

        # 过滤已删除项
        if not include_deleted:
            firmwares = [f for f in firmwares if f.deleted_at is None]

        # 更新缓存
        self._cache[cache_key] = (now, firmwares)

        return firmwares
    
    def get_firmware_list(
        self,
        published_only: bool = True,
        board_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> dict:
        """
        获取固件列表，支持筛选和分页

        Args:
            published_only: 是否只返回已发布的固件
            board_id: 按开发板 ID 筛选
            tags: 按标签筛选（OR 逻辑）
            search: 搜索关键词（项目名称和描述）
            page: 页码（从 1 开始）
            page_size: 每页数量

        Returns:
            dict: {items, total_count, page, page_size, total_pages}
        """
        all_firmwares = self._get_all_firmwares_cached()

        # 应用筛选条件
        firmwares = []
        for metadata in all_firmwares:
            if published_only and not metadata.published:
                continue
            if board_id and board_id not in metadata.supported_board_ids:
                continue
            if tags:
                if not any(tag in metadata.tags for tag in tags):
                    continue
            if search:
                search_lower = search.lower()
                if (search_lower not in metadata.project_name.lower() and
                    search_lower not in metadata.description.lower()):
                    continue
            firmwares.append(metadata)

        total_count = len(firmwares)
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

        start = (page - 1) * page_size
        end = start + page_size
        page_items = firmwares[start:end]

        return {
            "items": page_items,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    
    def get_firmware_detail(self, firmware_id: str) -> Optional[FirmwareMetadata]:
        """
        获取固件详情
        
        Args:
            firmware_id: 固件 ID
        
        Returns:
            固件元数据，如果不存在返回 None
        """
        firmware_dir = self.storage_path / firmware_id
        
        if not firmware_dir.exists():
            return None
        
        return self._load_metadata(firmware_dir)
    
    def update_metadata(
        self,
        firmware_id: str,
        metadata: FirmwareMetadata
    ) -> bool:
        """
        更新固件元数据
        
        Args:
            firmware_id: 固件 ID
            metadata: 新的元数据
        
        Returns:
            True 如果更新成功，False 如果固件不存在
        
        Raises:
            ValueError: 验证失败时抛出异常
        """
        firmware_dir = self.storage_path / firmware_id
        
        if not firmware_dir.exists():
            return False
        
        # 加载现有元数据
        existing_metadata = self._load_metadata(firmware_dir)
        if not existing_metadata:
            return False
        
        # 保留不可修改的字段
        metadata.firmware_id = firmware_id
        metadata.created_at = existing_metadata.created_at
        metadata.files = existing_metadata.files
        metadata.total_size = existing_metadata.total_size
        metadata.has_thumbnail = existing_metadata.has_thumbnail
        metadata.download_count = existing_metadata.download_count
        metadata.flash_count = existing_metadata.flash_count
        metadata.flash_success_count = existing_metadata.flash_success_count
        metadata.flash_failure_count = existing_metadata.flash_failure_count
        
        # 更新时间戳
        metadata.updated_at = datetime.now(timezone.utc)
        
        # 保存元数据（带备份）
        self._save_metadata(firmware_dir, metadata, create_backup=True)
        
        # 清除缓存
        self._invalidate_cache()
        
        logger.info(f"Firmware metadata updated: {firmware_id}")
        return True
    
    def delete_firmware(self, firmware_id: str) -> bool:
        """
        软删除固件包（移至回收站）

        Args:
            firmware_id: 固件 ID

        Returns:
            True 如果删除成功，False 如果固件不存在
        """
        firmware_dir = self.storage_path / firmware_id

        if not firmware_dir.exists():
            return False

        metadata = self._load_metadata(firmware_dir)
        if not metadata:
            return False

        metadata.deleted_at = datetime.now(timezone.utc)
        self._save_metadata(firmware_dir, metadata)
        self._invalidate_cache()

        logger.info(f"Firmware soft-deleted (moved to trash): {firmware_id}")
        return True

    def restore_firmware(self, firmware_id: str) -> bool:
        """从回收站恢复固件包"""
        firmware_dir = self.storage_path / firmware_id

        if not firmware_dir.exists():
            return False

        metadata = self._load_metadata(firmware_dir)
        if not metadata or not metadata.deleted_at:
            return False

        metadata.deleted_at = None
        self._save_metadata(firmware_dir, metadata)
        self._invalidate_cache()

        logger.info(f"Firmware restored from trash: {firmware_id}")
        return True

    def permanently_delete_firmware(self, firmware_id: str) -> bool:
        """永久删除固件包（从磁盘清除）"""
        firmware_dir = self.storage_path / firmware_id

        if not firmware_dir.exists():
            return False

        try:
            shutil.rmtree(firmware_dir)
            self._invalidate_cache()
            logger.info(f"Firmware permanently deleted: {firmware_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to permanently delete firmware {firmware_id}: {e}")
            raise ValueError(f"永久删除固件失败: {str(e)}")

    def get_trashed_firmwares(self) -> List[FirmwareMetadata]:
        """获取所有已删除的固件包"""
        all_firmwares = self._get_all_firmwares_cached(include_deleted=True)
        return [f for f in all_firmwares if f.deleted_at is not None]

    def empty_trash(self) -> int:
        """永久删除回收站中所有固件包，返回删除数量"""
        trashed = self.get_trashed_firmwares()
        count = 0
        for f in trashed:
            try:
                self.permanently_delete_firmware(f.firmware_id)
                count += 1
            except Exception as e:
                logger.error(f"Failed to empty trash for firmware {f.firmware_id}: {e}")
        return count

    def purge_expired_trash(self, max_age_days: int = 30) -> int:
        """永久删除超过 max_age_days 天的回收站固件"""
        trashed = self.get_trashed_firmwares()
        cutoff = datetime.now(timezone.utc)
        count = 0
        for f in trashed:
            if f.deleted_at:
                dt = f.deleted_at.replace(tzinfo=timezone.utc) if f.deleted_at.tzinfo is None else f.deleted_at
                age = cutoff - dt
                if age.days >= max_age_days:
                    try:
                        self.permanently_delete_firmware(f.firmware_id)
                        count += 1
                    except Exception as e:
                        logger.error(f"Failed to purge firmware {f.firmware_id}: {e}")
        return count
    
    def upload_thumbnail(
        self,
        firmware_id: str,
        image_file: UploadFile
    ) -> bool:
        """
        上传缩略图
        
        Args:
            firmware_id: 固件 ID
            image_file: 图片文件
        
        Returns:
            True 如果上传成功，False 如果固件不存在
        
        Raises:
            ValueError: 验证失败时抛出异常
        """
        firmware_dir = self.storage_path / firmware_id
        
        if not firmware_dir.exists():
            return False
        
        # 1. 验证文件大小
        image_file.file.seek(0, 2)  # 移动到文件末尾
        file_size = image_file.file.tell()
        image_file.file.seek(0)  # 重置到文件开头
        
        if file_size > self.MAX_THUMBNAIL_SIZE:
            raise ValueError(
                f"缩略图文件大小超过限制: {file_size / 1024:.1f} KB > "
                f"{self.MAX_THUMBNAIL_SIZE / 1024:.1f} KB"
            )
        
        try:
            # 2. 读取图片
            image_data = image_file.file.read()
            image = Image.open(BytesIO(image_data))
            
            # 3. 验证图片格式
            if image.format not in self.THUMBNAIL_FORMATS:
                raise ValueError(
                    f"不支持的图片格式: {image.format}. "
                    f"支持的格式: {', '.join(self.THUMBNAIL_FORMATS)}"
                )
            
            # 4. 验证图片尺寸
            width, height = image.size
            if (width < self.THUMBNAIL_MIN_SIZE[0] or height < self.THUMBNAIL_MIN_SIZE[1] or
                width > self.THUMBNAIL_MAX_DIMENSIONS[0] or height > self.THUMBNAIL_MAX_DIMENSIONS[1]):
                raise ValueError(
                    f"图片尺寸不符合要求: {width}x{height}. "
                    f"要求: {self.THUMBNAIL_MIN_SIZE[0]}x{self.THUMBNAIL_MIN_SIZE[1]} 到 "
                    f"{self.THUMBNAIL_MAX_DIMENSIONS[0]}x{self.THUMBNAIL_MAX_DIMENSIONS[1]}"
                )
            
            # 5. 调整图片大小（保持宽高比）
            image.thumbnail(self.THUMBNAIL_MAX_SIZE, Image.Resampling.LANCZOS)
            
            # 6. 保存为 PNG 格式
            thumbnail_path = firmware_dir / "thumbnail.png"
            image.save(thumbnail_path, format="PNG", optimize=True)

            try:
                from .object_storage import object_storage
                if object_storage.enabled:
                    object_url = object_storage.upload_file(
                        thumbnail_path,
                        f"firmware/{firmware_id}/thumbnail.png",
                        content_type="image/png",
                    )
                    assets = self._load_assets(firmware_dir)
                    assets["thumbnail"] = {
                        "url": object_url,
                        "key": f"firmware/{firmware_id}/thumbnail.png",
                    }
                    self._save_assets(firmware_dir, assets)
            except Exception as e:
                logger.warning(f"Failed to upload firmware thumbnail to object storage: {e}")
            
            # 7. 更新元数据中的 has_thumbnail 标志
            metadata = self._load_metadata(firmware_dir)
            if metadata:
                metadata.has_thumbnail = True
                self._save_metadata(firmware_dir, metadata, create_backup=False)
            
            logger.info(f"Thumbnail uploaded for firmware: {firmware_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to upload thumbnail for {firmware_id}: {e}")
            raise ValueError(f"缩略图上传失败: {str(e)}")
    
    def get_thumbnail_path(self, firmware_id: str) -> Optional[Path]:
        """
        获取缩略图路径
        
        Args:
            firmware_id: 固件 ID
        
        Returns:
            缩略图路径，如果不存在返回 None
        """
        thumbnail_path = self.storage_path / firmware_id / "thumbnail.png"
        
        if thumbnail_path.exists():
            return thumbnail_path
        
        return None

    def get_thumbnail_url(self, firmware_id: str) -> Optional[str]:
        self._validate_firmware_id(firmware_id)
        firmware_dir = self.storage_path / firmware_id
        if not firmware_dir.exists():
            return None
        assets = self._load_assets(firmware_dir)
        thumb = assets.get("thumbnail") or {}
        return thumb.get("url")

    def set_package_url(self, firmware_id: str, url: str, key: str, filename: str, size: int) -> None:
        self._validate_firmware_id(firmware_id)
        firmware_dir = self.storage_path / firmware_id
        assets = self._load_assets(firmware_dir)
        assets["package"] = {
            "url": url,
            "key": key,
            "filename": filename,
            "size": size,
        }
        self._save_assets(firmware_dir, assets)

    def get_package_url(self, firmware_id: str) -> Optional[str]:
        self._validate_firmware_id(firmware_id)
        firmware_dir = self.storage_path / firmware_id
        if not firmware_dir.exists():
            return None
        assets = self._load_assets(firmware_dir)
        package = assets.get("package") or {}
        return package.get("url")
    
    def get_firmware_file_path(self, firmware_id: str, filename: str) -> Optional[Path]:
        """
        获取固件文件路径

        Args:
            firmware_id: 固件 ID
            filename: 文件名

        Returns:
            文件路径，如果不存在返回 None
        """
        # 防止路径遍历攻击
        try:
            self._validate_firmware_id(firmware_id)
        except ValueError:
            logger.warning(f"Invalid firmware_id in path: {firmware_id}")
            return None
        if ".." in filename or "/" in filename or "\\" in filename:
            logger.warning(f"Path traversal attempt detected: {filename}")
            return None
        
        file_path = self.storage_path / firmware_id / filename
        
        if file_path.exists() and file_path.is_file():
            return file_path
        
        return None
    
    def get_statistics(self) -> Dict:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        firmwares = self._get_all_firmwares_cached()
        
        # 计算总存储空间
        total_size = sum(f.total_size for f in firmwares)
        
        # 计算 30 天内的下载和烧录次数
        total_downloads = sum(f.download_count for f in firmwares)
        total_flashes = sum(f.flash_count for f in firmwares)
        
        # 获取热门固件 Top 10（按下载次数）
        popular_firmwares = sorted(
            firmwares,
            key=lambda x: x.download_count,
            reverse=True
        )[:10]
        
        # 检查存储空间使用率
        storage_warning = False
        try:
            stat = os.statvfs(self.storage_path)
            free_space = stat.f_bavail * stat.f_frsize
            total_space = stat.f_blocks * stat.f_frsize
            usage_percent = (1 - free_space / total_space) * 100
            
            if usage_percent > 80:
                storage_warning = True
        except Exception as e:
            logger.warning(f"Failed to check storage space: {e}")
        
        return {
            "total_firmwares": len(firmwares),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "total_downloads": total_downloads,
            "total_flashes": total_flashes,
            "popular_firmwares": [
                {
                    "firmware_id": f.firmware_id,
                    "project_name": f.project_name,
                    "version": f.version,
                    "download_count": f.download_count
                }
                for f in popular_firmwares
            ],
            "storage_warning": storage_warning
        }
    
    def update_flash_statistics(
        self,
        firmware_id: str,
        success: bool
    ) -> bool:
        """
        更新烧录统计信息
        
        Args:
            firmware_id: 固件 ID
            success: 烧录是否成功
        
        Returns:
            True 如果更新成功，False 如果固件不存在
        """
        firmware_dir = self.storage_path / firmware_id
        
        if not firmware_dir.exists():
            return False
        
        metadata = self._load_metadata(firmware_dir)
        if not metadata:
            return False
        
        # 更新统计信息
        metadata.flash_count += 1
        if success:
            metadata.flash_success_count += 1
        else:
            metadata.flash_failure_count += 1
        
        # 保存元数据（不创建备份，避免频繁备份）
        self._save_metadata(firmware_dir, metadata, create_backup=False)
        
        # 清除缓存（统计数据已变更）
        self._invalidate_cache()
        
        return True
    
    def update_download_statistics(self, firmware_id: str) -> bool:
        """
        更新下载统计信息
        
        Args:
            firmware_id: 固件 ID
        
        Returns:
            True 如果更新成功，False 如果固件不存在
        """
        firmware_dir = self.storage_path / firmware_id
        
        if not firmware_dir.exists():
            return False
        
        metadata = self._load_metadata(firmware_dir)
        if not metadata:
            return False
        
        # 更新下载次数
        metadata.download_count += 1
        
        # 保存元数据（不创建备份）
        self._save_metadata(firmware_dir, metadata, create_backup=False)
        
        # 清除缓存（统计数据已变更）
        self._invalidate_cache()
        
        return True
    
    # ========== 私有方法 ==========
    
    def _generate_firmware_id(self) -> str:
        """生成唯一的固件 ID"""
        return uuid.uuid4().hex
    
    def _check_storage_space(self):
        """
        检查存储空间是否充足
        
        Raises:
            ValueError: 如果存储空间不足
        """
        try:
            stat = os.statvfs(self.storage_path)
            free_space_gb = (stat.f_bavail * stat.f_frsize) / (1024 ** 3)
            
            if free_space_gb < self.MIN_FREE_SPACE_GB:
                raise ValueError(
                    f"存储空间不足: {free_space_gb:.2f} GB < {self.MIN_FREE_SPACE_GB} GB"
                )
        
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Storage space check failed, blocking upload: {e}")
            raise ValueError("存储空间检查失败，无法确保有足够空间")
    
    def _extract_and_validate_zip(
        self,
        zip_file: UploadFile,
        firmware_dir: Path
    ) -> List[FirmwareFileInfo]:
        """
        解压和验证 ZIP 文件
        
        Args:
            zip_file: ZIP 文件
            firmware_dir: 固件目录
        
        Returns:
            固件文件信息列表
        
        Raises:
            ValueError: 验证失败时抛出异常
        """
        try:
            # 读取 ZIP 文件内容
            zip_content = zip_file.file.read()
            
            # 验证是否为有效的 ZIP 文件
            if not zipfile.is_zipfile(BytesIO(zip_content)):
                raise ValueError("上传的文件不是有效的 ZIP 格式")
            
            # 打开 ZIP 文件
            with zipfile.ZipFile(BytesIO(zip_content), 'r') as zf:
                # 获取 ZIP 中的文件列表
                zip_files = zf.namelist()

                # 检查解压后总大小，防止 ZIP 炸弹
                total_uncompressed = sum(info.file_size for info in zf.infolist())
                if total_uncompressed > self.MAX_ZIP_UNCOMPRESSED_SIZE:
                    raise ValueError(
                        f"ZIP 解压后大小超过限制: "
                        f"{total_uncompressed / (1024 * 1024):.2f} MB > "
                        f"{self.MAX_ZIP_UNCOMPRESSED_SIZE / (1024 * 1024):.2f} MB"
                    )

                # 验证必需文件是否存在
                missing_files = []
                for required_file in self.REQUIRED_ESP32_FILES:
                    if required_file not in zip_files:
                        missing_files.append(required_file)

                if missing_files:
                    raise ValueError(
                        f"ZIP 文件缺少必需文件: {', '.join(missing_files)}"
                    )

                # 解压和验证文件
                firmware_files = []

                for filename in self.REQUIRED_ESP32_FILES:
                    # 获取文件信息
                    file_info = zf.getinfo(filename)
                    file_size = file_info.file_size

                    # 验证文件大小
                    if file_size > self.MAX_FIRMWARE_FILE_SIZE:
                        raise ValueError(
                            f"文件 {filename} 大小超过限制: "
                            f"{file_size / (1024 * 1024):.2f} MB > "
                            f"{self.MAX_FIRMWARE_FILE_SIZE / (1024 * 1024):.2f} MB"
                        )

                    if file_size > self.MAX_SINGLE_FILE_SIZE:
                        raise ValueError(
                            f"文件 {filename} 大小超过单文件限制: "
                            f"{file_size / (1024 * 1024):.2f} MB > "
                            f"{self.MAX_SINGLE_FILE_SIZE / (1024 * 1024):.2f} MB"
                        )

                    # 解压文件（带大小限制，防止 ZIP 头欺诈）
                    file_path = firmware_dir / filename
                    max_write = file_size * 2  # 允许一定膨胀，但防止无限写入
                    with zf.open(filename) as source, open(file_path, 'wb') as target:
                        written = 0
                        while True:
                            chunk = source.read(8192)
                            if not chunk:
                                break
                            written += len(chunk)
                            if written > max_write:
                                raise ValueError(
                                    f"文件 {filename} 解压后大小异常: 已写入 {written} 字节，"
                                    f"声称为 {file_size} 字节"
                                )
                            target.write(chunk)
                    
                    # 验证文件完整性（比较大小）
                    actual_size = file_path.stat().st_size
                    if actual_size != file_size:
                        raise ValueError(
                            f"文件 {filename} 完整性验证失败: "
                            f"期望 {file_size} 字节，实际 {actual_size} 字节"
                        )
                    
                    # 确定烧录地址和角色
                    address, role = self._get_file_address_and_role(filename)
                    
                    # 添加到文件列表
                    firmware_files.append(FirmwareFileInfo(
                        name=filename,
                        size=file_size,
                        address=address,
                        role=role
                    ))
                
                return firmware_files
        
        except zipfile.BadZipFile:
            raise ValueError("上传的文件不是有效的 ZIP 格式")
        except Exception as e:
            logger.error(f"Failed to extract ZIP file: {e}")
            raise ValueError(f"ZIP 文件解压失败: {str(e)}")
    
    def _get_file_address_and_role(self, filename: str) -> tuple[int, str]:
        """
        获取文件的烧录地址和角色
        
        Args:
            filename: 文件名
        
        Returns:
            (address, role) 元组
        """
        # ESP32 标准烧录地址
        address_map = {
            "bootloader.bin": (0x1000, "bootloader"),
            "partitions.bin": (0x8000, "partitions"),
            "boot_app0.bin": (0xe000, "boot_app0"),
            "app.bin": (0x10000, "app")
        }
        
        return address_map.get(filename, (0x0, "unknown"))
    
    def _save_metadata(
        self,
        firmware_dir: Path,
        metadata: FirmwareMetadata,
        create_backup: bool = False
    ):
        """
        保存元数据到 JSON 文件（原子写入）
        
        Args:
            firmware_dir: 固件目录
            metadata: 元数据
            create_backup: 是否创建备份
        
        Raises:
            ValueError: 保存失败时抛出异常
        """
        metadata_path = firmware_dir / "metadata.json"
        backup_path = firmware_dir / "metadata.json.bak"
        temp_path = firmware_dir / "metadata.json.tmp"
        
        try:
            # 1. 如果需要，创建备份
            if create_backup and metadata_path.exists():
                shutil.copy2(metadata_path, backup_path)
            
            # 2. 写入临时文件
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(
                    metadata.model_dump(mode='json'),
                    f,
                    ensure_ascii=False,
                    indent=2
                )
            
            # 3. 原子重命名（覆盖旧文件）
            temp_path.replace(metadata_path)
            
        except Exception as e:
            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()
            
            logger.error(f"Failed to save metadata: {e}")
            raise ValueError(f"元数据保存失败: {str(e)}")
    
    def _load_metadata(self, firmware_dir: Path) -> Optional[FirmwareMetadata]:
        """
        从 JSON 文件加载元数据
        
        Args:
            firmware_dir: 固件目录
        
        Returns:
            元数据对象，如果加载失败返回 None
        """
        metadata_path = firmware_dir / "metadata.json"
        
        if not metadata_path.exists():
            logger.warning(f"Metadata file not found: {metadata_path}")
            return None
        
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 验证必需字段
            required_fields = ["firmware_id", "project_name", "version", "supported_board_ids", "created_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                logger.error(f"Metadata missing required fields: {missing_fields}")
                return None
            
            # 解析为 Pydantic 模型
            return FirmwareMetadata(**data)
        
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse metadata JSON: {e}")
            return None
        
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            return None


# 全局固件管理服务实例
firmware_manager = FirmwareManager()
