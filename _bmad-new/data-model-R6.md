# MakeFast Data Model（R6）

| 字段 | 值 |
|---|---|
| 状态 | 草稿 · **未落盘** |
| 日期 | 2026-10-10 |
| 作者 | MakeFast 产品经理 |
| 基线 | Architecture R5；PRD R2 |
| 实现 | MakeFast 功能 bot |

---

## 1. 原则

1. 引脚能力真源在 **BoardDocument（board.json）**；连线实例在 **ConnectionGraph**。  
2. 对外 API/字段名避免 `wiringGraph`；用 `wiringDiagram`（对外）或 `connectionGraph`（对内）。  
3. Agent 会话绑定 **courseSession**，非全局单例。  
4. 进度与测验不编码「淡出等级」。

---

## 2. 核心实体

### 2.1 BoardDocument

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 如 `xiao-esp32-s3` |
| name | string | 显示名 |
| mcu | string | |
| vendor | string | |
| pins[] | PinDef | id, labels[], capabilities[] |
| constraints[] | optional | |
| toolchain | object | fqbn / uploadProtocol / … |
| schemaVersion | string | |

### 2.2 ComponentDef（课包元件库条目）

| 字段 | 说明 |
|---|---|
| type | `dht22` \| `active_buzzer` \| … |
| ports[] | 逻辑端口名 + 所需 capability |
| displayName | 儿童可读名 |

### 2.3 ConnectionGraph

| 字段 | 说明 |
|---|---|
| id | |
| coursePackId | |
| boardId | 必须引用 BoardDocument.id |
| nodes[] | { id, kind: board\|component\|power, ref, ports } |
| edges[] | { id, from: {nodeId, port}, to: {nodeId, port} } |
| stepAnchors[] | 可选，供 Agent 高亮 |
| schemaVersion | |

**Invariant：** `validate(graph, board).ok == true` 方可进入编译（可配置警告级，P0 建议 error 阻断明显非法）。

### 2.4 CoursePack

| 字段 | 说明 |
|---|---|
| id | `first-lesson` |
| title, coverUrl, starDifficulty, tags[], category | 目录六要素 |
| boardId | |
| components[] | 实例化的 ComponentDef + 参数 |
| connectionGraph | 内嵌或 ref |
| guideScript | GuideStep[] |
| quiz | QuizSpec |
| firmwareRef / blocksRef | |

### 2.5 GuideStep

| 字段 | 说明 |
|---|---|
| id | |
| do | 现在做 |
| why | 为什么 |
| success | 成功时 |
| highlight | UI 锚点（stepper / wiring node / …） |
| order | int |

### 2.6 QuizSpec

| 字段 | 说明 |
|---|---|
| mcq[] | 3 题：{ id, prompt, choices[], answerIndex } |
| practical | { id, prompt, kind: serial_temp_seen \| buzzer_heard \| either } |
| passRule | mcqCorrectMin=2 AND practicalRequired=true |

### 2.7 CourseSession（学习者进度）

| 字段 | 说明 |
|---|---|
| id | |
| userId | |
| coursePackId | |
| agentState | IDLE\|GUIDING\|WRAP_UP\|QUIET_HELP |
| surface | catalog\|detail\|workbench\|quiz |
| guideStepIndex | |
| toolchain | { boardConfirmed, connection, build, flash, serial } 状态枚举 |
| graphSnapshot | 可选用户改线 |
| phenomenonSuccess | bool |
| mainlineCompletedAt | |
| quiz | { status, mcqResults, practicalOk, passedAt } |
| badges[] | `mainline_complete` \| `understanding` |
| updatedAt | |

**Forbidden fields：** `autonomyLevel`, `fadeStage`, `inLessonQuizScore`.

### 2.8 AgentSession（可与 CourseSession 1:1）

| 字段 | 说明 |
|---|---|
| courseSessionId | |
| state | 同上 agentState |
| lastUtterance | |
| allowed | surface==workbench 才可 GUIDING |

---

## 3. 枚举

```text
PinCapability: digital_in, digital_out, adc, i2c_sda, i2c_scl, power_3v3, gnd, …
ToolchainPhaseStatus: todo, current, done, error
AgentState: IDLE, GUIDING, WRAP_UP, QUIET_HELP
QuizStatus: locked, available, in_progress, passed, failed
```

---

## 4. 变更

| 2026-10-10 | R6 data-model 初稿 |
