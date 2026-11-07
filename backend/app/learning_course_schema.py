"""Validated, versioned learning-course content; drafts may be incomplete."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
IDENTIFIER_PATTERN = r"^[a-z][a-z0-9_-]*$"
PIN_ID_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"
STEP_TYPES = (
    "intro", "materials", "wiring", "blocks", "code", "compile", "flash",
    "verify", "challenge", "quiz", "completion",
)
AGENT_ANCHORS = {
    "step.overview", "step.materials", "step.wiring", "editor.blocks",
    "editor.code", "debug.compile", "debug.upload", "debug.serial",
    "debug.toggle", "debug.restore", "agent.toggle",
}
EVENT_TYPES = {
    "materials_confirmed", "wiring_confirmed", "blocks_saved", "code_saved",
    "compile_succeeded", "flash_succeeded", "serial_verified", "challenge_completed",
    "quiz_passed", "course_completed",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CourseMedia(StrictModel):
    asset_id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    url: Optional[str] = Field(default=None, max_length=500)
    source: Optional[str] = Field(default=None, max_length=300)
    license: Optional[str] = Field(default=None, max_length=120)
    exact_variant: Optional[str] = Field(default=None, max_length=200)
    alt: Optional[str] = Field(default=None, max_length=300)
    verification_status: Literal["missing", "pending", "verified"] = "missing"
    is_real_photo: bool = False
    visual_kind: Literal["missing", "photo", "technical_render"] = "missing"
    variant_check: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def check_media(self):
        if self.verification_status == "verified" and not all((
            self.url, self.source, self.license, self.exact_variant, self.alt,
            self.is_real_photo or self.visual_kind == "technical_render",
        )):
            raise ValueError("已核验图片必须填写图片、来源、许可、准确型号、替代文字及照片或渲染类型")
        if self.verification_status == "verified" and self.visual_kind == "technical_render" and not self.variant_check:
            raise ValueError("技术渲染图须记录与真实模块型号和引脚位置的比对依据")
        return self


class CoursePin(StrictModel):
    id: str = Field(pattern=PIN_ID_PATTERN, max_length=80)
    label: str = Field(min_length=1, max_length=80)
    kind: Literal["power", "ground", "digital", "analog", "i2c", "spi", "uart", "pwm"]
    # Coordinates are normalized to the component media (0..1). They let the
    # renderer draw a wire from the actual pin marker instead of inventing a
    # generic line between cards. They remain optional until a variant is
    # measured.
    x: Optional[float] = Field(default=None, ge=0, le=1)
    y: Optional[float] = Field(default=None, ge=0, le=1)
    side: Optional[Literal["top", "right", "bottom", "left"]] = None
    aliases: list[str] = Field(default_factory=list, max_length=12)


class CourseComponent(StrictModel):
    id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["board", "sensor", "actuator", "accessory"]
    exact_variant: Optional[str] = Field(default=None, max_length=200)
    quantity: int = Field(default=1, ge=1, le=100)
    purpose: str = Field(default="", max_length=500)
    compatibility_note: str = Field(default="", max_length=500)
    media: CourseMedia
    pins: list[CoursePin] = Field(default_factory=list, max_length=80)
    pinmap_status: Literal["missing", "pending", "verified"] = "missing"
    pinmap_evidence: Optional[str] = Field(default=None, max_length=500)
    pinmap_source: Optional[str] = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def unique_pins(self):
        ids = [pin.id for pin in self.pins]
        if len(ids) != len(set(ids)):
            raise ValueError("元件引脚 ID 不能重复")
        if any((pin.x is None) != (pin.y is None) for pin in self.pins):
            raise ValueError("引脚坐标必须同时提供 x 和 y")
        return self


class WireEndpoint(StrictModel):
    component_id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    pin_id: str = Field(pattern=PIN_ID_PATTERN, max_length=80)


class CourseConnection(StrictModel):
    id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    from_pin: WireEndpoint
    to_pin: WireEndpoint
    kind: Literal["power", "ground", "digital", "analog", "i2c", "spi", "uart", "pwm"]
    direction: Literal["source_to_sink", "sink_to_source", "bidirectional", "static"] = "static"
    label: Optional[str] = Field(default=None, max_length=120)
    wire_color: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=500)
    verified: bool = False
    verification_evidence: Optional[str] = Field(default=None, max_length=500)


class CompletionRule(StrictModel):
    kind: Literal["manual", "event", "quiz", "all_materials"]
    event_type: Optional[str] = None

    @model_validator(mode="after")
    def check_event(self):
        if self.kind == "event" and self.event_type not in EVENT_TYPES:
            raise ValueError("事件完成规则需要支持的 event_type")
        if self.kind != "event" and self.event_type is not None:
            raise ValueError("仅事件完成规则可以填写 event_type")
        return self


class RewardRule(StrictModel):
    event_type: str
    points: int = Field(ge=0, le=200)
    first_time_only: bool = True

    @model_validator(mode="after")
    def check_event(self):
        if self.event_type not in EVENT_TYPES:
            raise ValueError("未知的积分事件")
        return self


class QuizOption(StrictModel):
    id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    text: str = Field(min_length=1, max_length=500)


class QuizContent(StrictModel):
    question: str = Field(min_length=1, max_length=1000)
    options: list[QuizOption] = Field(min_length=2, max_length=6)
    answer_id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    explanation: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def check_answer(self):
        option_ids = [item.id for item in self.options]
        if len(option_ids) != len(set(option_ids)) or self.answer_id not in option_ids:
            raise ValueError("答案必须引用唯一的选项 ID")
        return self


class ChallengeContent(StrictModel):
    task: str = Field(min_length=1, max_length=2000)
    success_observation: str = Field(min_length=1, max_length=1000)


class CourseStep(StrictModel):
    id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    type: Literal[
        "intro", "materials", "wiring", "blocks", "code", "compile", "flash",
        "verify", "challenge", "quiz", "completion",
    ]
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=20000)
    prerequisite_ids: list[str] = Field(default_factory=list, max_length=20)
    agent_anchor: Optional[str] = None
    material_ids: list[str] = Field(default_factory=list, max_length=50)
    connection_ids: list[str] = Field(default_factory=list, max_length=100)
    starter_code: Optional[str] = Field(default=None, max_length=100000)
    starter_blocks_xml: Optional[str] = Field(default=None, max_length=200000)
    expected_observation: Optional[str] = Field(default=None, max_length=2000)
    quiz: Optional[QuizContent] = None
    challenge: Optional[ChallengeContent] = None
    completion: Optional[CompletionRule] = None
    reward: Optional[RewardRule] = None

    @model_validator(mode="after")
    def check_step(self):
        if self.agent_anchor and self.agent_anchor not in AGENT_ANCHORS:
            raise ValueError(f"未知 Agent 锚点: {self.agent_anchor}")
        if self.material_ids and self.type != "materials":
            raise ValueError("material_ids 只能用于材料步骤")
        if self.connection_ids and self.type != "wiring":
            raise ValueError("connection_ids 只能用于接线步骤")
        if self.quiz and self.type != "quiz":
            raise ValueError("quiz 只能用于知识检查步骤")
        if self.challenge and self.type != "challenge":
            raise ValueError("challenge 只能用于挑战步骤")
        if self.starter_code and self.type != "code":
            raise ValueError("starter_code 只能用于代码步骤")
        if self.starter_blocks_xml and self.type != "blocks":
            raise ValueError("starter_blocks_xml 只能用于积木步骤")
        return self


class CourseDefinition(StrictModel):
    schema_version: Literal[1] = 1
    slug: str = Field(pattern=SLUG_PATTERN, max_length=100)
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(default="", max_length=1000)
    board_component_id: str = Field(pattern=IDENTIFIER_PATTERN, max_length=80)
    finished_media: CourseMedia
    components: list[CourseComponent] = Field(default_factory=list, max_length=50)
    connections: list[CourseConnection] = Field(default_factory=list, max_length=150)
    steps: list[CourseStep] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def check_references(self):
        components = {part.id: part for part in self.components}
        if len(components) != len(self.components):
            raise ValueError("components: 元件 ID 不能重复")
        if self.board_component_id not in components or components[self.board_component_id].kind != "board":
            raise ValueError("board_component_id: 必须引用一个开发板元件")
        connections = {wire.id: wire for wire in self.connections}
        if len(connections) != len(self.connections):
            raise ValueError("connections: 连线 ID 不能重复")
        for wire in self.connections:
            if wire.from_pin == wire.to_pin:
                raise ValueError(f"connections.{wire.id}: 连线两端不能是同一引脚")
            for endpoint in (wire.from_pin, wire.to_pin):
                part = components.get(endpoint.component_id)
                if not part or endpoint.pin_id not in {pin.id for pin in part.pins}:
                    raise ValueError(f"connections.{wire.id}: 找不到 {endpoint.component_id}.{endpoint.pin_id} 引脚")
                pin = next(pin for pin in part.pins if pin.id == endpoint.pin_id)
                if pin.kind != wire.kind and not (
                    wire.kind in {"power", "ground"} and pin.kind in {"power", "ground"}
                ):
                    raise ValueError(f"connections.{wire.id}: {endpoint.component_id}.{endpoint.pin_id} 不支持 {wire.kind} 类型")
        for issue in validate_wiring_graph(self):
            raise ValueError(f"connections.{issue['connection_id']}: {issue['message']}")
        seen_steps = set()
        for step in self.steps:
            if step.id in seen_steps:
                raise ValueError(f"steps.{step.id}: 步骤 ID 不能重复")
            if any(item not in seen_steps for item in step.prerequisite_ids):
                raise ValueError(f"steps.{step.id}.prerequisite_ids: 只能引用前面的步骤")
            if any(item not in components for item in step.material_ids):
                raise ValueError(f"steps.{step.id}.material_ids: 找不到元件")
            if any(item not in connections for item in step.connection_ids):
                raise ValueError(f"steps.{step.id}.connection_ids: 找不到连线")
            seen_steps.add(step.id)
        return self


def validate_wiring_graph(course: CourseDefinition) -> list[dict[str, str]]:
    """Return deterministic electrical/graph issues for a course definition.

    This is deliberately small and course-oriented. It validates the graph
    contract used by the UI; it does not pretend to replace an oscilloscope,
    continuity test, or a board-specific ERC implementation.
    """
    components = {item.id: item for item in course.components}
    issues: list[dict[str, str]] = []
    connected: dict[tuple[str, str], list[CourseConnection]] = {}
    for wire in course.connections:
        for endpoint in (wire.from_pin, wire.to_pin):
            connected.setdefault((endpoint.component_id, endpoint.pin_id), []).append(wire)
        from_pin = components[wire.from_pin.component_id].pins
        to_pin = components[wire.to_pin.component_id].pins
        from_kind = next(pin.kind for pin in from_pin if pin.id == wire.from_pin.pin_id)
        to_kind = next(pin.kind for pin in to_pin if pin.id == wire.to_pin.pin_id)
        if {from_kind, to_kind} == {"power", "ground"}:
            issues.append({"connection_id": wire.id, "message": "电源脚和地线脚不能直接相连"})
    for (component_id, pin_id), wires in connected.items():
        component = components[component_id]
        pin = next(pin for pin in component.pins if pin.id == pin_id)
        # Power/GND and explicitly bidirectional buses may fan out. A normal
        # GPIO/signal marker must have one graph edge so a typo is visible.
        if len(wires) > 1 and pin.kind not in {"power", "ground", "i2c", "spi", "uart"}:
            issues.append({"connection_id": wires[1].id, "message": f"{component.name} 的 {pin.label} 引脚出现多根信号线"})
    return issues


def publish_errors(course: CourseDefinition) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    def issue(field: str, message: str) -> None:
        errors.append({"field": field, "message": message})

    if course.finished_media.verification_status != "verified":
        issue("finished_media", "成品实拍尚未核验")
    for index, part in enumerate(course.components):
        if not part.exact_variant:
            issue(f"components.{index}.exact_variant", "请填写确切型号")
        if part.media.verification_status != "verified":
            issue(f"components.{index}.media", "材料实拍尚未核验")
        if part.kind != "accessory" and part.pinmap_status != "verified":
            issue(f"components.{index}.pinmap_status", "引脚位置尚未实物核验")
        if part.kind != "accessory" and (not part.pins or not part.pinmap_evidence):
            issue(f"components.{index}.pinmap_evidence", "请记录引脚实测依据")
    if not course.connections:
        issue("connections", "缺少经过实物核验的接线")
    for index, wire in enumerate(course.connections):
        if not wire.verified or not wire.verification_evidence:
            issue(f"connections.{index}.verification_evidence", "这根接线尚未记录实测依据")
    step_types = {step.type for step in course.steps}
    for required in STEP_TYPES:
        if required not in step_types:
            issue("steps", f"缺少 {required} 步骤")
    for index, step in enumerate(course.steps):
        if step.completion is None:
            issue(f"steps.{index}.completion", "发布前须定义完成条件")
        if step.type == "materials" and not step.material_ids:
            issue(f"steps.{index}.material_ids", "材料步骤须列出物料")
        if step.type == "wiring" and not step.connection_ids:
            issue(f"steps.{index}.connection_ids", "接线步骤须列出连线")
        if step.type == "quiz" and not step.quiz:
            issue(f"steps.{index}.quiz", "知识检查须提供题目、选项和答案解释")
        if step.type == "challenge" and not step.challenge:
            issue(f"steps.{index}.challenge", "挑战须描述任务和成功现象")
        if step.type == "verify" and not step.expected_observation:
            issue(f"steps.{index}.expected_observation", "验证步骤须说明预期观察结果")
    return errors
