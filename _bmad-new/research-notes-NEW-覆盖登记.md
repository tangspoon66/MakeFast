# Research Notes — NEW 覆盖登记（R0）

> 状态：草稿（回传协调位，尚未落盘）  
> 日期：2026-10-10  
> 作者：MakeFast 需求（需求/产品架构）  
> 目的：把 NEW 硬约束写成可执行的「旧结论 → 新结论 → 覆盖原因」，作为 R1 `product-brief` 及后续 PRD/架构/故事重梳的唯一冲突真源。  
> 范围：只登记决策覆盖；不改实现、不改仓库路径外的代码。

---

## 1. 覆盖原则

1. **NEW 覆盖旧 BMAD**：凡与下列硬约束冲突的旧结论，一律作废或整段改写，不得用「sprint 已 done」对抗。
2. **重梳姿态**：决策作废 → 意图锁定 → 体验/架构对齐 → 故事重切；不是在旧 sprint 上打补丁。
3. **命名与真源分层**（连线）：
   - 对外：`连线图`（可并列英文 Wiring Diagram）
   - 对内：`ConnectionGraph` + AWS + pinmap
   - 引脚能力真源：`board.json`
   - **禁止**对外使用 `Wiring Graph` 作为产品名或 SoT 自称
4. **GPL**：可复用 aily 的约定与行为；**不**硬抄受 GPL 约束的壳、资源或逐行实现。
5. **视觉/布局已冻结**：亮色儿童向；工作台顶栏 `板型 → 连接 → 编译 → 烧录`；底栏串口；Agent 右下；赛博猫 Rive。本登记不重开视觉争议。

### NEW 硬约束（锁定）

| ID | 约束 |
|---|---|
| HC-1 | 第一课：`XIAO ESP32-S3` + 温湿度传感器 + 蜂鸣器 |
| HC-2 | 主线完成前持续逐步引导，并讲清 WHY；**过程中不提问**；**完成后再测验** |
| HC-3 | 连线对标 aily 连线图 / `ConnectionGraph` / `board.json`；不对外叫 Wiring Graph；注意 GPL |
| HC-4 | 视觉与工作台布局按已定方案（见上），不得推翻 |

---

## 2. 冲突条目登记

### OBS-01 — 引导淡出（assisted → autonomous）

| 项 | 内容 |
|---|---|
| 旧结论 | 主路径含 assisted → autonomous 引导淡出，随进度减少协助 |
| 新结论 | 主线（第一课闭环）完成前：**持续引导**，每步讲清 WHY；不把「减少协助」当作阶段目标 |
| 覆盖原因 | HC-2 |
| 影响文档 | product-brief、prd、experience、ux-design-specification、epics-and-stories |
| 处置 | **作废**旧淡出主路径；若保留「课后自由探索」须标为课后可选，不得挤占主线 |

### OBS-02 — 过程中 quiz / 提问

| 项 | 内容 |
|---|---|
| 旧结论 | 学习过程可穿插提问或 quiz |
| 新结论 | **过程零提问、零 quiz**；测验仅发生在主线步骤与硬件成功完成之后 |
| 覆盖原因 | HC-2 |
| 影响文档 | prd、experience、rewards-and-pilot-metrics、epics-and-stories |
| 处置 | **作废**过程内测评；新增「课后测验」故事与验收 |

### OBS-03 — Wiring Graph 对外命名与 SoT

| 项 | 内容 |
|---|---|
| 旧结论 | 产品/文档自称 Wiring Graph，并把它当作连线单一真源（SoT） |
| 新结论 | 对外只说 **连线图**；对内模型名可用 ConnectionGraph；**引脚能力真源是 board.json**；连线实例不得凌驾于板级能力描述之上 |
| 覆盖原因 | HC-3；aily 约定 |
| 影响文档 | architecture、api-contracts、data-model、ux 文案、epics（含 ST-403） |
| 处置 | **作废**对外名与「Wiring Graph = SoT」声称；全文替换术语 |

### OBS-04 — 自研连线语义可脱离 aily

| 项 | 内容 |
|---|---|
| 旧结论 | 可自建 wiring 语义，不必对标 aily |
| 新结论 | 行为与约定对标 aily 连线图 / ConnectionGraph / board.json（板包 pinmap 为辅助）；XIAO ESP32-S3 板包约定可复用 |
| 覆盖原因 | HC-3 |
| 影响文档 | architecture、implementation-readiness |
| 处置 | **改写**连线子系统目标与验收为「对标 aily 行为」 |

### OBS-05 — 硬抄 aily 壳层

| 项 | 内容 |
|---|---|
| 旧结论 | （隐含风险）直接复用/拷贝 aily 壳或资源以加快交付 |
| 新结论 | **只**复用约定、行为与可独立实现的接口形状；不复制 GPL 壳、主题资源或受约束源码 |
| 覆盖原因 | HC-3 / GPL |
| 影响文档 | architecture、implementation-readiness、current-phase-guide |
| 处置 | **作废**任何「搬壳」路径；架构文必须写清「可参考边界」 |

### OBS-06 — 旧 PED（过程练习 / 测评 / 淡出节奏）

| 项 | 内容 |
|---|---|
| 旧结论 | PED 围绕过程练习、穿插测评、协助淡出设计学习节奏 |
| 新结论 | 新 PED 固定为：**逐步引导 + WHY → 硬件成功（编译/烧录/串口可验证）→ 课后测验** |
| 覆盖原因 | HC-2 |
| 影响文档 | experience、prd、rewards-and-pilot-metrics |
| 处置 | **整段改写**；旧 PED 章节标记 superseded |

### OBS-07 — ST-403 接线查看器

| 项 | 内容 |
|---|---|
| 旧结论 | 按旧 Wiring Graph SoT 继续实现/验收接线查看器 |
| 新结论 | 暂停；按「连线图查看器、对标 aily、board.json 真源」重写故事后再入 sprint |
| 覆盖原因 | OBS-03 / OBS-04 |
| 影响文档 | epics-and-stories、sprint-status.yaml |
| 处置 | **暂停并重写**；原 done/review 状态降为 superseded |

### OBS-08 — ST-303 首课硬件核验

| 项 | 内容 |
|---|---|
| 旧结论 | 按旧首课硬件假设做核验 |
| 新结论 | 第一课固定为 **XIAO ESP32-S3 + 温湿度 + 蜂鸣器**；核验故事按此重写 |
| 覆盖原因 | HC-1 |
| 影响文档 | product-brief、prd、epics-and-stories、sprint-status |
| 处置 | **暂停并重写**；传感器/蜂鸣器具体型号若未定时，产品层可写「课程包指定型号」，实现前由协调位补齐 |

### OBS-09 — 视觉与顶栏信息架构

| 项 | 内容 |
|---|---|
| 旧结论 | 视觉/顶栏仍可争议或并行方案 |
| 新结论 | **冻结**：色 `#74B0E1` / `#F4C65C` / `#C0E2F9`；顶栏板型→连接→编译→烧录；底串口；Agent 右下；赛博猫 Rive |
| 覆盖原因 | HC-4（已定方案） |
| 影响文档 | design、ux-design-specification |
| 处置 | **冻结**；重梳中只做文案与连线命名对齐，不重开视觉 |

### OBS-10 — Sprint done/review 当作当前基线

| 项 | 内容 |
|---|---|
| 旧结论 | 多数条目 done/review，可作为继续开发基线 |
| 新结论 | 与 NEW 冲突的 done/review **降级为历史参考（superseded）**；新 sprint 只收录重切后的故事 |
| 覆盖原因 | 覆盖原则 1–2 |
| 影响文档 | sprint-status.yaml、current-phase-guide、implementation-readiness |
| 处置 | R9 由协调位统一刷新状态机 |

---

## 3. 产品角色（沿用，不在本登记推翻）

- 访客
- 学习者
- 课程管理员
- 平台管理员

本登记不改变角色集合；改变的是学习者主线体验节奏与第一课硬件范围。

---

## 4. 待补输入（不阻塞 R0/R1，阻塞 R5/R7）

| 缺口 | 用途 | 建议负责人 |
|---|---|---|
| 第一课温湿度传感器与蜂鸣器的具体型号 / 官方接线示例，或书面「以课程包为准」 | 硬件核验故事、连线实例 | 协调位向用户收集 |
| aily：可参考的约定/行为边界 vs 因 GPL 不可复制的部分 | architecture R5 | 协调位 + 功能 |
| 课后测验：题型、题量、通过标准（产品级） | PRD / experience / 故事 | 协调位向用户收集；需求位写入 R2 |

---

## 5. 下游门禁

- **R1 product-brief**：必须显式引用本文件 OBS-01…10，并写入 HC-1…4。
- **R2 prd**：不得重新引入淡出主路径或过程 quiz。
- **R5 architecture**：不得出现对外 Wiring Graph SoT；必须写 board.json 真源与 GPL 边界。
- **R7 epics**：ST-303 / ST-403 必须以新故事 ID 替换，旧 ID 仅保留 superseded 追溯。

---

## 6. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 初稿：NEW 覆盖登记 R0，供协调位审阅后落盘 |
