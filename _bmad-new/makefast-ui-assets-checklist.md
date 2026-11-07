# MakeFast 界面视觉资产规格清单（R8 · G-04 / G-05）

| 字段 | 值 |
|---|---|
| 文档角色 | 界面助手 · 可交付视觉资产规格（非实现代码） |
| 日期 | 2026-10-10（Asia/Shanghai） |
| 对应缺口 | R8 **G-04**（连线图视觉资产）、**G-05**（赛博猫 Rive Idle/Guiding） |
| 对齐 | `makefast-ui-hi-fi-notes.md`、`ux-design-specification-R4.md`、`design-R4.md`、`makefast-readiness-R8.md` |
| 气质 | 儿童亮色 ed-tech；大圆角、柔阴影、插画感；**禁止**照搬参考站皮肤 |
| 语言 | 全文中文；用户可见 UI 文案键与说明均为中文 |

---

## 0. 硬约束（全文适用）

| # | 约束 | 说明 |
|---|---|---|
| HC-01 | 色板三色冻结 | Primary `#74B0E1` / Accent `#F4C65C` / Surface `#C0E2F9`；不可改色号 |
| HC-02 | 禁 Wiring Graph | 任何**用户可见**位置（面板标题、图例、Tip、空态、错误短句、导出 PNG 水印文案）**禁止**出现「Wiring Graph」；面板标题固定 **「连线图」**（文案键 `wiring.title`） |
| HC-03 | 目录不抢引导 | S1/S1a：猫可为 Idle，**引导气泡默认关**；**无强制蒙层**、无自动开讲、无 `guide_step` |
| HC-04 | 无实现代码 | 本文只写资产与交互规格字段名；不附业务代码 |
| HC-05 | 儿童气质 | 亮色、大圆角（节点建议 ≥12px）、对比度足够；状态不只靠颜色（配短词/图标） |

语义色（与 hi-fi notes 对齐，相对冻结色板派生）：

| Token | 建议色号 | 用途 |
|---|---|---|
| Text/Primary | `#1A2B3C` | 标题、元件名、引脚主字 |
| Text/Secondary | `#4A6070` | 图例、辅助 Tip |
| Success | `#3CB87A` | 合法/完成高亮点缀 |
| Warning | `#E8A317` | 注意/前置未满足 |
| Error | `#E85A5A` | 非法边、加载失败 |
| Surface/Panel | `#E8F4FC` | 连线图面板内衬 |
| Surface/Card | `#FFFFFF` | 节点卡片面 |

---

## 1. G-04 连线图视觉资产规格清单

### 1.1 面板壳（文案硬约束）

| 项 | 规格 |
|---|---|
| 组件 | C-WIRING（WiringDiagramPanel） |
| **用户可见标题** | 固定 **「连线图」** |
| 文案键 | `wiring.title` = 连线图 |
| **禁止** | Wiring Graph（及任何同义英文产品标题） |
| 容器 | Radius/LG 18–20px；内衬 Surface/Panel `#E8F4FC`；白/浅卡片节点叠柔阴影 |
| 建议画布区 | 面板内容宽约 288–368px（面板总宽 320–400px 扣边距）；高度随课包图自适应，最小约 240px |

### 1.2 资产分类总表

| 分类代码 | 分类名 | 用途 | 导出建议 |
|---|---|---|---|
| WG-NODE | 板型/模块节点 | 板与外设的可识别插画节点 | SVG 优先；PNG@2x 回退 |
| WG-WIRE | 线材 | 节点间连线（含电源/信号语义色） | SVG（路径可调） |
| WG-PIN | 引脚标注 | 引脚短标签、端口点 | SVG + 文本层 |
| WG-LEGEND | 图例 | 线色/符号说明（儿童短句） | SVG 或内联矢量 |
| WG-EMPTY | 空态/错误占位 | 无图、加载中、失败 | SVG 插画 + 短句位 |
| WG-OVERLAY | 高亮/焦点态叠加层 | 步进引导高亮、选中环 | SVG 叠加或 CSS 描边规格 |

### 1.3 命名约定

| 规则 | 示例 |
|---|---|
| 前缀 | `mf-wiring-` |
| 结构 | `mf-wiring-{category}-{subject}[-{variant}][-{state}]` |
| 分类缩写 | `node` / `wire` / `pin` / `legend` / `empty` / `overlay` |
| 状态后缀 | `default` / `hover` / `focus` / `disabled` / `error`（若分文件） |
| 课包关联字段 | 文件元数据或清单表记录 `componentId`、`pinLabel`（见 §1.8） |
| **禁止** | 文件名/图层名作为**用户可见**文案出现「Wiring Graph」；内部英文 id 可保留但不得渲染到 UI |

建议资源目录（约定，非代码）：

```text
assets/wiring/
  nodes/
  wires/
  pins/
  legend/
  empty/
  overlays/
  lesson-first/   ← 第一课最小集合打包
```

### 1.4 节点资产明细（WG-NODE）

| ID | 名称 | 用途 | 建议尺寸 / 栅格 | 颜色 | 线宽 | 圆角 | 对比度 | 导出 | 命名 |
|---|---|---|---|---|---|---|---|---|---|
| WG-NODE-01 | XIAO ESP32-S3 板节点 | 第一课主板示意 | 外框约 120×72px（@1x）；栅格对齐 8px | 板体浅灰白 `#FFFFFF` + Primary 描边 `#74B0E1`；USB 区 Accent 小点缀可选用 | 描边 2px | 12–16px | 板体与面板底对比 ≥3:1；字与底 ≥4.5:1 | SVG | `mf-wiring-node-xiao-esp32s3` |
| WG-NODE-02 | DHT22 传感器节点 | 温湿度模块 | 约 72×64px；8px 栅格 | 白底 + Primary 图标色；壳体可用浅绿点缀（勿引入新主色抢板） | 描边 2px | 12px | 同上 | SVG | `mf-wiring-node-dht22` |
| WG-NODE-03 | 有源蜂鸣器节点 | 蜂鸣器模块 | 约 64×64px；圆形主体直径约 40px | 白底；振膜环用 Accent `#F4C65C` 或 Primary | 描边 2px | 12px（底座）/ 全圆（振膜） | 同上 | SVG | `mf-wiring-node-buzzer-active` |
| WG-NODE-04 | 通用模块占位 | 未识别/后续课扩展 | 72×64px | Surface 浅底 + 虚线 Secondary | 虚线 1.5px | 12px | 低对比可接受（占位） | SVG | `mf-wiring-node-generic` |
| WG-NODE-05 | 电源/GND 符号（可选） | 电源轨示意 | 24×24 图标位 | GND 深字；VCC 可用 Warning/Accent 小标 | 1.5–2px | 8px | 图标+短词，不只靠色 | SVG | `mf-wiring-node-power` |

节点通用视觉：

| 项 | 规格 |
|---|---|
| 阴影 | Shadow/Card 级弱阴影（与 hi-fi 一致意图） |
| 标题字 | Caption/Body 13–16；儿童可读中文名（如「小板」「温湿度」「蜂鸣器」） |
| 选中/焦点 | 外环 Primary 2–3px + 2px 白间隔（Focus Ring） |
| 插画风格 | 扁平+轻贴纸感；大圆角；避免深色赛博朋克 |

### 1.5 线材资产明细（WG-WIRE）

| ID | 名称 | 用途 | 建议尺寸 | 颜色 | 线宽 | 圆角/端点 | 对比度 | 导出 | 命名 |
|---|---|---|---|---|---|---|---|---|---|
| WG-WIRE-01 | 信号线默认 | 数据/GPIO 连线 | 路径自适应；最小拐点半径 8px | Primary `#74B0E1` | **3px**（桌面）；焦点 **4px** | 圆角端 cap；折线圆角 8px | 与面板底对比清晰 | SVG | `mf-wiring-wire-signal` |
| WG-WIRE-02 | 电源正极线 | VCC / 3V3 | 同上 | Accent `#F4C65C` 或 Warning `#E8A317`（图例须标注） | 3px | 同上 | 与信号线可区分；**配图例短词** | SVG | `mf-wiring-wire-vcc` |
| WG-WIRE-03 | 地线 | GND | 同上 | Text/Primary `#1A2B3C` 或深灰 | 3px | 同上 | 同上 | SVG | `mf-wiring-wire-gnd` |
| WG-WIRE-04 | 非法/错误边 | validate 失败强调 | 同上 | Error `#E85A5A` | 3px + 短划可选 | 同上 | 配「接错了」短词/图标 | SVG | `mf-wiring-wire-error` |
| WG-WIRE-05 | 预览虚线 | 引导「下一步请接」 | 同上 | Primary 40–60% 透明 | 2.5px 虚线 | 同上 | 不抢已接实线 | SVG | `mf-wiring-wire-preview` |

### 1.6 引脚标注 / 图例 / 空态 / 叠加层

| ID | 分类 | 名称 | 用途 | 建议尺寸 | 颜色 | 线宽 | 圆角 | 对比度 | 导出 | 命名 |
|---|---|---|---|---|---|---|---|---|---|---|
| WG-PIN-01 | 引脚 | 端口圆点 | 节点上可接线热点 | 直径 10–12px；命中热区 ≥24px | 白心 + Primary 描边 | 2px | 全圆 | 焦点环可见 | SVG | `mf-wiring-pin-port-dot` |
| WG-PIN-02 | 引脚 | 引脚文字标 | 如 `D4`、`3V3`、`GND`、`DATA` | 字高 12–14px；标签底可 4px 内边距 | 底白/浅；字 Text/Primary | — | 标签底 Radius/XS 8px | 字对比 ≥4.5:1 | SVG+文本 | `mf-wiring-pin-label` |
| WG-LEGEND-01 | 图例 | 线色图例条 | 解释信号/电源/地 | 条高约 28–36px；全宽或右下角 | 与对应线色一致 + Caption | — | 8–12px | 色旁必有中文短词 | SVG/内联 | `mf-wiring-legend-wires` |
| WG-LEGEND-02 | 图例 | 操作提示句 | 「点元件看名字」等 | 一行 Caption | Text/Secondary | — | — | 可读 | 文案位 | `mf-wiring-legend-hint` |
| WG-EMPTY-01 | 空态 | 无课包图 | 尚未绑定连线示意 | 插画约 120×100 | Surface + Secondary 线稿 | 1.5px | 16px | 非报警感 | SVG | `mf-wiring-empty-none` |
| WG-EMPTY-02 | 空态 | 骨架屏 | 加载中 | 与节点位对齐的灰块 | `#D7EAF7` / `#E8F4FC` 脉冲 | — | 12px | 低对比可 | SVG/CSS 规格 | `mf-wiring-empty-skeleton` |
| WG-EMPTY-03 | 错误 | 加载失败 | 失败短句 +「重试」 | 图标 48px + 文案区 | Error 图标 + Text | — | 16px | 图标+短句，不只靠红 | SVG | `mf-wiring-empty-error` |
| WG-OVERLAY-01 | 叠加 | 步进焦点环 | Agent 高亮对应元件 | 外包节点 +4–6px | Primary 脉冲描边 3px；可选 Accent 外晕 | 3px | 跟随节点圆角 | 动画不闪瞎；尊重减动效 | SVG/规格 | `mf-wiring-overlay-focus` |
| WG-OVERLAY-02 | 叠加 | Hover 名称 Tip | 悬停显示中文名 | Tip 最大宽 160px | 白底 Shadow/Hover；字 Primary 系 | — | 8–12px | Tip 字对比达标 | 规格 | `mf-wiring-overlay-tip` |
| WG-OVERLAY-03 | 叠加 | 禁用蒙层（弱） | 整图不可用 | 覆盖内容区 | `rgba(26,43,60,0.12)` 轻罩 | — | 随面板 | **非**目录强引导蒙层；仅面板禁用 | 规格 | `mf-wiring-overlay-disabled` |

### 1.7 第一课示意 · 最小资产集合（必须交付）

| 优先级 | 资产 ID | 说明 |
|---|---|---|
| P0 | WG-NODE-01 | XIAO ESP32-S3 |
| P0 | WG-NODE-02 | DHT22 |
| P0 | WG-NODE-03 | 有源蜂鸣器 |
| P0 | WG-WIRE-01 / 02 / 03 | 信号、电源、地（按课包实际边使用） |
| P0 | WG-PIN-01 / WG-PIN-02 | 端口点 + 引脚标（至少覆盖第一课用到的脚） |
| P0 | WG-LEGEND-01 | 线色图例 |
| P0 | WG-OVERLAY-01 / 02 | 焦点高亮 + hover Tip |
| P0 | WG-EMPTY-02 / 03 | 骨架与加载失败 |
| P1 | WG-WIRE-04 / 05、WG-NODE-04/05、WG-EMPTY-01 | 错误边、预览虚线、通用占位、无图空态 |

**第一课连线示意构图意图（非代码）：**

```text
        [ XIAO ESP32-S3 ]
           │        │
      (信号线)   (电源/地)
           │        │
        [ DHT22 ]   │
                    │
              [ 有源蜂鸣器 ]
```

面板标题栏始终显示「连线图」。图例用中文短句（例：「蓝线：信号」「黄线：电源」「深线：地」——具体色名以 §1.5 为准）。

### 1.8 交互态矩阵（连线图）

| 交互态 | 视觉表现 | 用户可见文案/行为 |
|---|---|---|
| **默认** | 节点 WG-NODE-* + 实线；图例可见；标题「连线图」 | 可浏览；无强制引导 |
| **Hover** | 节点轻微抬升/描边加深；**名称 Tip**（中文 displayName） | Tip 例：「温湿度传感器」；不打断 |
| **焦点步进高亮** | WG-OVERLAY-01 脉冲描边；可同步预览虚线 WG-WIRE-05 | 与 GuideStep `highlight` 锚点对应；减动效时改为静态描边 |
| **禁用 / 未加载骨架** | WG-EMPTY-02 骨架块；或整面板弱蒙层 + 不可点 | 无错误惊吓；可保留标题「连线图」 |
| **加载失败** | WG-EMPTY-03；Error 图标 + 短句 | 例：「连线图加载失败」+ 按钮「重试」；**禁止** Wiring Graph |

### 1.9 与课包数据对接 · 规格字段占位（仅字段名）

> 只列 UI 资产绑定所需字段名，不写业务逻辑。对内模型为 ConnectionGraph；对外产品名仍为「连线图」。

| 规格字段名 | 用途（资产侧） | 备注 |
|---|---|---|
| `componentId` | 节点资产 ↔ 课包元件实例 | 与节点 `ref` / 清单 ID 对齐 |
| `componentType` | 选择哪套 WG-NODE 外形 | 如 `xiao_esp32s3` / `dht22` / `active_buzzer` |
| `displayName` | Hover Tip、无障碍名 | 中文儿童短名 |
| `pinLabel` | 引脚标注文本 | 如 `D4`、`3V3`、`GND` |
| `portId` | 端口圆点绑定 | 与边的 from/to.port 对应 |
| `nodeId` | 图画布节点实例 | ConnectionGraph.nodes[].id |
| `edgeId` | 线材实例 | ConnectionGraph.edges[].id |
| `wireKind` | 映射 WG-WIRE-01…05 | `signal` / `vcc` / `gnd` / `error` / `preview` |
| `highlightTarget` | 步进高亮目标 | 来自 GuideStep.highlight；可为 `nodeId` 或 `componentId` |
| `boardId` | 板型节点皮肤 | 引用 BoardDocument |
| `assetKey` | 显式指定 SVG 资源名 | 可选覆盖默认 `mf-wiring-…` |
| `legendItems[]` | 图例项 | `{ wireKind, labelZh }` |
| `loadState` | `ready` / `loading` / `error` / `empty` | 驱动空态资产 |

**文案键（资产相关）：**

| 键 | 正确 | 禁止 |
|---|---|---|
| `wiring.title` | 连线图 | Wiring Graph |
| `wiring.tip.retry` | 重试 | — |
| `wiring.loadError` | 连线图加载失败 | Wiring Graph failed 等英文产品句 |
| `wiring.legend.signal` 等 | 中文短词 | 英文产品标题 |

---

## 2. G-05 赛博猫 Rive Idle / Guiding 状态规格

### 2.1 状态机总览

| 状态 ID | 名称 | 绑定表面 | 猫可见 | 引导气泡 / GuideStepCard |
|---|---|---|---|---|
| CAT-IDLE | Idle | **S1 目录、S1a 详情** | 可显示 | **默认关**；最多 1 句可关 Tip；**无强制蒙层** |
| CAT-GUIDING | Guiding | **S2 工作台** | 显示 | **C-AGENT-STEP 默认开** |
| CAT-QUIET | Quiet | **S3 测验（可选）** | 可显示（低调） | 可选轻答疑，**不挡提交** |

组件：`C-CAT-RIVE`（CyberCatRive）；容器：`C-AGENT-DOCK`（右下）。

### 2.2 分状态规格表

| 项 | Idle（CAT-IDLE） | Guiding（CAT-GUIDING） | Quiet（CAT-QUIET） |
|---|---|---|---|
| **触发条件** | `surface = catalog` 或详情未进课；进课前 / 回目录 | `surface = workbench` 且课内引导进行中 | `surface = quiz`（可选）；或用户收起引导后的短静默 |
| **循环 / 单次** | **循环**呼吸/轻晃 | **循环**主体 + 可触发**单次**点头/指向强调 | **循环**极低幅度；少表情切换 |
| **幅度** | **低幅度**，不抢卡片 CTA 与筛选注意力 | 中幅度；可轻微前倾/眨眼强调「下一步」 | 极低；接近静止插画 |
| **时长建议** | 呼吸周期约 **3–4s**；无突然大动作 | 循环 **2.5–3.5s**；单次强调 **0.4–0.7s** | 呼吸 **4s+** 或近静态 |
| **表情 / 姿态** | 放松坐姿或半蹲；眼神柔和；浅色 UI 友好着色；Teal/主蓝光仅作眼部或胸灯点缀，**不作全站暗底** | 身体略转向引导卡；可抬爪/点头；表情专注友好 | 眯眼/安静微笑；不挥手抢焦点 |
| **与 Agent 气泡关系** | **气泡默认不渲染**；允许 1 条非打断 Tip（用户可关） | **GuideStepCard 默认可见**（现在做/为什么/成功时 + 下一步）；猫在卡下方或右下角叠放 | 气泡默认关或极简一句；**不得遮挡提交按钮** |
| **减动效** | 若 `reducedMotion`：改为静态帧或极慢淡入 | 同左；强调改为色板描边而非大幅位移 | 静态 |

### 2.3 目录不抢引导（硬约束复述）

| 规则 | 要求 |
|---|---|
| 猫 | Idle 可出现在右下 |
| 引导气泡 | **默认关** |
| 蒙层 | **禁止**全屏/强引导蒙层 |
| 自动开讲 | **禁止** |
| Tip | 可选 ≤1 句，可关闭，非 quiz |
| 验收 | 对齐 R8 M7 / QA-M7-01、QA-AGT-02 |

### 2.4 资源规格（Rive）

| 项 | 规格 |
|---|---|
| 建议文件名 | `mf-cybercat.riv`（主文件）；可选拆 `mf-cybercat-lite.riv` |
| Artboard 命名 | `CyberCat`（主）；备用 `CyberCat/Simple` |
| State Machine 命名 | `CatSM` |
| 主输入（enum 或等效） | `mood`：`idle` \| `guiding` \| `quiet` |
| 布尔输入 | `isPointing`（Guiding 下单次指向）；`isHappy`（庆祝短态，P1）；`reducedMotion` |
| 可选数字输入 | `energy` 0–1（幅度倍率；目录强制 ≤0.35） |
| 画布建议尺寸 | 目录待机约 **72–88px**；工作台展开陪伴约 **96–128px**（与 hi-fi / UX direction 对齐） |
| 着色 | 浅色儿童 UI 重着色；主色亲和 Primary；Accent 仅点缀 |
| 文件放置约定 | `assets/rive/mf-cybercat.riv`；静态回退见下 |
| 导出/交付 | `.riv` + 状态机输入说明表（本文）+ 三态预览 GIF/APNG（可选） |

**Fallback（Rive 失败或未加载）：**

| ID | 资源 | 用途 |
|---|---|---|
| CAT-FALLBACK-IDLE | `mf-cybercat-idle.png`（@2x） | 目录静态猫 |
| CAT-FALLBACK-GUIDING | `mf-cybercat-guiding.png`（@2x） | 工作台静态猫 |
| CAT-FALLBACK-QUIET | `mf-cybercat-quiet.png`（@2x） | 测验静态猫 |

失败时：**不**挡住主 CTA；静态图仍遵守右下锚点与气泡显隐规则。

### 2.5 与 C-AGENT-DOCK / GuideStepCard 的布局锚点

| 项 | 规格 |
|---|---|
| 锚点 | **视口右下**；组件 C-AGENT-DOCK |
| 边距 | 距右 **16–24px**；距底 **16–24px**，且需避开串口 Dock（底栏展开时整体上移） |
| S1 结构 | 仅猫（Idle）± 可关 Tip；**无** GuideStepCard |
| S2 结构 | 上方/内侧：GuideStepCard（宽约 340–400px，圆角 20–24px）；下方或右下角：猫 Guiding |
| 层级 | Dock 浮层高于主区内容，但**不得永久遮挡**编译/烧录主操作；用户可收起卡正文、保留猫 |
| 焦点顺序 | … → 连线图 → 串口 → Agent 卡「下一步」→ 猫（猫可非键盘焦点） |
| 对齐文档 | hi-fi notes §3.5、§5.6、§7；design-R4「右下：Agent + 赛博猫 Rive」 |

```text
S1 目录（不抢引导）              S2 工作台
┌─────────────────────┐         ┌──────────────────────────┐
│  课程卡片…           │         │  编辑器 │ 连线图          │
│                      │         │         │                │
│              [猫Idle]│         │              ┌引导卡───┐ │
│           （气泡关）  │         │              │三栏+下一步│ │
└─────────────────────┘         │              └──[猫Guiding]
                                └──────────────────────────┘
```

### 2.6 状态切换触发摘要

| 从 → 到 | 触发 | 动效建议 |
|---|---|---|
| Idle → Guiding | 开始课程进入 S2 | ≤400ms 表情过渡；同时打开 GuideStepCard |
| Guiding → Idle | 返回目录 / 结束课 session | 收起气泡后切 Idle；无残留蒙层 |
| Guiding → Quiet | 打开 S3 测验 | 降幅度；卡不挡提交 |
| Quiet → Guiding | 关闭测验回到工作台且引导未完成 | 恢复 Guiding |
| * → Fallback 静态 | Rive 运行时错误 / 超时 | 换对应 PNG；保留布局 |

---

## 3. 交付与验收清单

### 3.1 G-04 交付物

- [ ] §1.4–1.6 所列 P0 资产 SVG（第一课最小集合齐全）
- [ ] 面板任何预览稿标题均为「连线图」
- [ ] 全文/切图/标注无用户可见「Wiring Graph」
- [ ] 五态（默认/hover/焦点/骨架/失败）有示意或说明
- [ ] 字段占位表含 `componentId`、`pinLabel` 等

### 3.2 G-05 交付物

- [ ] Rive 状态机含 Idle / Guiding /（可选）Quiet
- [ ] 输入名与本文一致或有对照表
- [ ] 三态静态 fallback PNG
- [ ] 目录场景：气泡默认关、无强制蒙层（录屏或标注稿）
- [ ] 右下锚点与 GuideStepCard 叠放关系标明

### 3.3 硬约束自检

| 约束 | 结果 |
|---|---|
| 色板 `#74B0E1` / `#F4C65C` / `#C0E2F9` 未改 | ✅ 本文冻结引用 |
| 用户可见禁 Wiring Graph；标题「连线图」 | ✅ §0 HC-02、§1.1、§1.9 |
| 目录不抢引导（Idle + 气泡关 + 无强蒙层） | ✅ §0 HC-03、§2.3 |
| 无实现代码 | ✅ 仅规格与字段名 |
| 儿童亮色、大圆角气质 | ✅ 节点圆角与色板贯穿 |

---

## 4. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 初稿：补齐 R8 G-04 连线图资产清单 + G-05 赛博猫 Rive 状态规格；对齐 hi-fi notes 与 R4 |

---

*本文为可交付资产规格清单，供视觉制作与课包字段对齐；实现细节由功能 bot 按 R5/R6 契约承接。*
