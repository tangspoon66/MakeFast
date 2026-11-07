# Experience Artifact Index

The detailed journey and interaction rules are maintained in [UX Design Specification](ux-design-specification.md) and [PRD](prd.md).

## Core experience loop

```text
明确产出 → 当前步骤目标 → 用户操作 → 平台/设备反馈 → Agent 解释或指引 → 用户确认 → 进度/奖励 → 下一步
```

## Mode behavior

- `guided`: Agent can proactively point to one next target and wait for the learner.
- `assisted`: Agent gives contextual hints after hesitation or failure.
- `autonomous`: Agent stays quiet unless explicitly summoned or a meaningful error/safety condition occurs.

MVP first-course copy uses the `child` expression baseline. Expression remains orthogonal to mode: observed ability and behavior determine `guided | assisted | autonomous`; exact age is not collected for this purpose.

## Entry contexts

- Personal: username/password registration and personal project overview.
- School education (post-MVP): planned to reuse the same project workbench with teacher-issued student identity and a separate class/course/progress console.

## Hard boundaries

- Agent never silently edits files, clicks compile/flash, installs libraries or confirms a physical-world observation.
- A page visit is not a completed learning action.
- Serial data is an observed platform fact, not proof that a physical buzzer/LED worked.
- A detected chip is not automatically a confirmed board variant.
