"""Course folder models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class CourseFolderItem(BaseModel):
    template_id: str = Field(..., min_length=1, max_length=80)
    sort_order: int = Field(default=0, ge=0)


class CourseFolder(BaseModel):
    folder_id: str
    name: str = Field(..., min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)
    category: str = Field(default="", max_length=50)
    tags: List[str] = Field(default=[])
    cover_url: str = Field(default="", max_length=500)
    pinned: bool = False
    published: bool = False
    sort_order: int = Field(default=0, ge=0)
    items: List[CourseFolderItem] = Field(default=[])
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        if len(value) > 10:
            raise ValueError("标签数量不能超过 10 个")
        return [tag.strip() for tag in value if tag.strip()]


class CourseFolderCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)
    category: str = Field(default="", max_length=50)
    tags: List[str] = Field(default=[])
    cover_url: str = Field(default="", max_length=500)
    pinned: bool = False
    published: bool = False
    sort_order: int = Field(default=0, ge=0)
    template_ids: List[str] = Field(default=[])


class CourseFolderUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    cover_url: Optional[str] = Field(None, max_length=500)
    pinned: Optional[bool] = None
    published: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)
    template_ids: Optional[List[str]] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is not None and len(value) > 10:
            raise ValueError("标签数量不能超过 10 个")
        return value


class CourseFolderListResponse(BaseModel):
    folders: List[CourseFolder]


class CourseFolderReorderRequest(BaseModel):
    folder_ids: List[str]


class CourseFolderItemReorderRequest(BaseModel):
    template_ids: List[str]
