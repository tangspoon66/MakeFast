"""Course folder storage for single-node deployments."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .course_folder_models import (
    CourseFolder,
    CourseFolderCreateRequest,
    CourseFolderItem,
    CourseFolderUpdateRequest,
)


def _detect_image_extension(file_content: bytes) -> Optional[str]:
    if file_content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if file_content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(file_content) >= 12 and file_content[:4] == b"RIFF" and file_content[8:12] == b"WEBP":
        return ".webp"
    return None


class CourseFolderManager:
    def __init__(self, data_path: Optional[str] = None):
        root = Path(os.getenv("APP_DATA_PATH") or "./data")
        self.data_path = Path(data_path or root / "course_folders.json")
        self.data_path.parent.mkdir(parents=True, exist_ok=True)

    def list_folders(self, published_only: bool = False) -> List[CourseFolder]:
        folders = self._load()
        if published_only:
            folders = [folder for folder in folders if folder.published]
        return sorted(
            folders,
            key=lambda folder: (
                0 if folder.pinned else 1,
                folder.sort_order,
                -folder.created_at.timestamp(),
            ),
        )

    def create_folder(self, request: CourseFolderCreateRequest) -> CourseFolder:
        folders = self._load()
        now = datetime.now(timezone.utc)
        folder = CourseFolder(
            folder_id=uuid.uuid4().hex,
            name=request.name.strip(),
            description=request.description.strip(),
            category=request.category.strip(),
            tags=request.tags,
            cover_url=request.cover_url.strip(),
            pinned=request.pinned,
            published=request.published,
            sort_order=request.sort_order if request.sort_order else len(folders),
            items=self._items_from_template_ids(request.template_ids),
            created_at=now,
            updated_at=None,
        )
        folders.append(folder)
        self._save(folders)
        return folder

    def update_folder(self, folder_id: str, request: CourseFolderUpdateRequest) -> Optional[CourseFolder]:
        folders = self._load()
        for index, folder in enumerate(folders):
            if folder.folder_id != folder_id:
                continue
            data = folder.model_dump()
            update = request.model_dump(exclude_unset=True)
            template_ids = update.pop("template_ids", None)
            data.update(update)
            if template_ids is not None:
                data["items"] = self._items_from_template_ids(template_ids)
            data["updated_at"] = datetime.now(timezone.utc)
            updated = CourseFolder(**data)
            folders[index] = updated
            self._save(folders)
            return updated
        return None

    def delete_folder(self, folder_id: str) -> bool:
        folders = self._load()
        next_folders = [folder for folder in folders if folder.folder_id != folder_id]
        if len(next_folders) == len(folders):
            return False
        self._save(next_folders)
        return True

    def reorder_folders(self, folder_ids: List[str]) -> List[CourseFolder]:
        folders = self._load()
        order = {folder_id: index for index, folder_id in enumerate(folder_ids)}
        next_folders = []
        for folder in folders:
            if folder.folder_id in order:
                folder = folder.model_copy(update={"sort_order": order[folder.folder_id]})
            next_folders.append(folder)
        self._save(next_folders)
        return self.list_folders(published_only=False)

    def reorder_items(self, folder_id: str, template_ids: List[str]) -> Optional[CourseFolder]:
        return self.update_folder(
            folder_id,
            CourseFolderUpdateRequest(template_ids=template_ids),
        )

    def upload_cover(self, folder_id: str, file_content: bytes, filename: str) -> Optional[CourseFolder]:
        folders = self._load()
        for index, folder in enumerate(folders):
            if folder.folder_id != folder_id:
                continue

            extension = _detect_image_extension(file_content)
            if not extension:
                raise ValueError("只支持 PNG、JPEG、WebP 图片")
            if len(file_content) > 2 * 1024 * 1024:
                raise ValueError("封面图片不能超过 2MB")

            cover_dir = self.data_path.parent / "course_folder_covers"
            cover_dir.mkdir(parents=True, exist_ok=True)
            for old_cover in cover_dir.glob(f"{folder_id}.*"):
                try:
                    old_cover.unlink()
                except OSError:
                    pass
            cover_path = cover_dir / f"{folder_id}{extension}"
            cover_path.write_bytes(file_content)

            data = folder.model_dump()
            data["cover_url"] = f"/api/course-folders/{folder_id}/cover?t={int(datetime.now(timezone.utc).timestamp())}"
            data["updated_at"] = datetime.now(timezone.utc)
            updated = CourseFolder(**data)
            folders[index] = updated
            self._save(folders)
            return updated
        return None

    def get_cover_path(self, folder_id: str) -> Optional[Path]:
        cover_dir = self.data_path.parent / "course_folder_covers"
        if not cover_dir.exists():
            return None
        for extension in (".jpg", ".jpeg", ".png", ".webp"):
            path = cover_dir / f"{folder_id}{extension}"
            if path.exists():
                return path
        return None

    def _items_from_template_ids(self, template_ids: List[str]) -> List[CourseFolderItem]:
        seen = set()
        items = []
        for index, template_id in enumerate(template_ids):
            clean_id = template_id.strip()
            if not clean_id or clean_id in seen:
                continue
            seen.add(clean_id)
            items.append(CourseFolderItem(template_id=clean_id, sort_order=index))
        return items

    def _load(self) -> List[CourseFolder]:
        if not self.data_path.exists():
            return []
        try:
            data = json.loads(self.data_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
        if not isinstance(data, list):
            return []
        folders = []
        for item in data:
            try:
                folders.append(CourseFolder(**item))
            except Exception:
                continue
        return folders

    def _save(self, folders: List[CourseFolder]) -> None:
        payload = [folder.model_dump(mode="json") for folder in folders]
        temp_path = self.data_path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(self.data_path)


course_folder_manager = CourseFolderManager()
