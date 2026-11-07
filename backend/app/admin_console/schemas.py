"""Pydantic schemas for the admin console API."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
Role = Literal["admin", "editor", "viewer"]
Level = Literal["入门", "进阶", "熟练", "高级"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CourseStep(Strict):
    id: str = Field(min_length=1, max_length=60)
    title: str = Field(min_length=1, max_length=120)
    why: str = Field(default="", max_length=500)


class CourseResource(Strict):
    id: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["pdf", "stl", "link"] = "pdf"
    url: str = Field(default="", max_length=500)
    note: str = Field(default="", max_length=200)


class QuizItem(Strict):
    id: str = Field(min_length=1, max_length=60)
    prompt: str = Field(min_length=1, max_length=500)
    choices: List[str] = Field(min_length=2, max_length=6)
    answer_index: int = Field(ge=0)
    explain: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def check(self):
        if self.answer_index >= len(self.choices):
            raise ValueError("正确答案序号超出选项范围")
        if any(not c.strip() for c in self.choices):
            raise ValueError("选项不能为空")
        return self


class CoursePackIn(Strict):
    slug: str = Field(pattern=SLUG, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    level: Level = "入门"
    summary: str = Field(default="", max_length=1000)
    skills: List[str] = Field(default_factory=list, max_length=12)
    prerequisites: List[str] = Field(default_factory=list, max_length=12)
    cover: str = Field(default="", max_length=500)
    duration_min: int = Field(default=45, ge=5, le=600)
    board_id: str = Field(default="xiao-esp32-s3", max_length=80)
    steps: List[CourseStep] = Field(default_factory=list, max_length=60)
    quiz: List[QuizItem] = Field(default_factory=list, max_length=30)
    resources: List[CourseResource] = Field(default_factory=list, max_length=20)
    # 图文课文章节（结构化块）；学生端读已发布课程的 article
    article: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def check(self):
        ids = [s.id for s in self.steps]
        if len(ids) != len(set(ids)):
            raise ValueError("步骤 ID 不能重复")
        qids = [q.id for q in self.quiz]
        if len(qids) != len(set(qids)):
            raise ValueError("测验题 ID 不能重复")
        if self.slug in self.prerequisites:
            raise ValueError("课程不能把自己设为先修")
        return self


class CourseUpdate(Strict):
    revision: int = Field(ge=1)
    course: CoursePackIn


class HardwareIn(Strict):
    data: Dict[str, Any]
    pinmap: Optional[Dict[str, Any]] = None


class FaqIn(Strict):
    question: str = Field(min_length=2, max_length=300)
    answer: str = Field(min_length=2, max_length=2000)
    tags: List[str] = Field(default_factory=list, max_length=10)
    course_slug: str = Field(default="first-lesson", pattern=SLUG, max_length=80)
    enabled: bool = True


class GuardListIn(Strict):
    keywords: List[str] = Field(max_length=500)

    @field_validator("keywords")
    @classmethod
    def clean(cls, v: List[str]) -> List[str]:
        out: List[str] = []
        for k in v:
            k = (k or "").strip()
            if not k:
                continue
            if len(k) > 120:
                raise ValueError("关键词过长（最多 120 字）")
            if k not in out:
                out.append(k)
        return out


class GuardTestIn(Strict):
    message: str = Field(min_length=1, max_length=1000)


class UserCreate(Strict):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    role: Role = "viewer"
    display_name: str = Field(default="", max_length=60)


class UserUpdate(Strict):
    role: Optional[Role] = None
    display_name: Optional[str] = Field(default=None, max_length=60)
    disabled: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class SettingsIn(Strict):
    site_name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    registration_open: Optional[bool] = None
    agent_enabled: Optional[bool] = None
    agent_offline_only: Optional[bool] = None
    agent_daily_message_limit: Optional[int] = Field(default=None, ge=0, le=1000)
    agent_max_reply_chars: Optional[int] = Field(default=None, ge=40, le=1000)
    log_retention_days: Optional[int] = Field(default=None, ge=1, le=365)
    default_course: Optional[str] = Field(default=None, pattern=SLUG, max_length=80)
    maintenance_banner: Optional[str] = Field(default=None, max_length=200)
