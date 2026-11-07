# MakeFast Architecture（R5）

| 字段 | 值 |
|---|---|
| 状态 | 草稿 · 回传协调位 · **未落盘** |
| 日期 | 2026-10-10 |
| 作者 | MakeFast 产品经理（架构规格执笔） |
| 实现细化 | **MakeFast 功能** `e0e7576f-b9c9-4c57-be3c-49cacab2eaa6` |
| 基线 | PRD R2（F-WIR / F-BRD / F-AGT）；UX R4 组件；Assumptions A-01…A-03 |
| 替代 | 既有 architecture 中「Wiring Graph = SoT」及可搬 aily 壳的表述 |

---

## 1. 目标与非目标

### 1.1 目标

- 为第一课（XIAO ESP32-S3 + DHT22 + 有源蜂鸣器）提供可校验的**连线—板级能力—工具链**架构。  
- 对外产品名：**连线图**；对内模型：**ConnectionGraph**；引脚能力真源：**board.json**。  
- 行为对标 aily 约定；**不复制 GPL 壳**。  
- 支撑 Agent **仅课内**引导与顶栏 板型→连接→编译→烧录、底栏串口。

### 1.2 非目标

- 实现 aily 编辑器壳 / 主题 / 逐行移植。  
- 多板并行首发（换板 = 新课包）。  
- 在本文件排人天（R7/sprint）。

---

## 2. 假设（Assumptions）

| ID | 假设 |
|---|---|
| AA-01 | XIAO ESP32-S3 存在可用板包；可复用其 pin 命名约定 |
| AA-02 | `board.json` 由平台/课包维护，运行时只读校验 |
| AA-03 | GPL：无最终法务批注前，默认「行为与 schema 级对标，源码/资源不复制」 |
| AA-04 | 课包描述第一课连线实例；不得声明超出 board.json 的引脚能力 |
| AA-05 | 功能 bot 可调整存储格式，但不得改变真源层级与对外命名 |

---

## 3. 逻辑视图

```text
┌──────────────────────────────────────────────────────────┐
│ App Shell / UX（界面 bot）                                │
│  Catalog │ Workbench │ AgentDock │ SerialDock │ Quiz     │
└─────────────┬───────────────────────────┬────────────────┘
              │                           │
┌─────────────▼─────────────┐   ┌─────────▼────────────────┐
│ Course Runtime            │   │ Agent Guide Engine       │
│  progress · quiz · rewards│   │  IDLE/GUIDING/… 状态机    │
└─────────────┬─────────────┘   └─────────┬────────────────┘
              │                           │
┌─────────────▼───────────────────────────▼────────────────┐
│ Hardware Session                                         │
│  BoardProfile ← board.json（真源）                        │
│  ConnectionGraph（课包实例 + 校验）                        │
│  DeviceLink · Build · Flash · Serial                     │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 真源层级（硬规则）

| 优先级 | 产物 | 职责 |
|---|---|---|
| **1 真源** | `board.json` | 板级引脚能力、电气/角色约束、合法外设接口 |
| 2 | 板包 pinmap / SDK | 实现映射到工具链；不得与 board.json 冲突；冲突以 board.json 为准并告警 |
| 3 | 课包 ConnectionGraph 实例 | 第一课具体连线（DHT22、蜂鸣器）；**不可**声明 board 未提供的能力 |
| 4 | UI「连线图」视图 | 只读/引导渲染；文案固定「连线图」 |

**作废：** 任何「Wiring Graph 文档/模型 = SoT」的旧结论。

---

## 5. board.json（产品/架构契约）

### 5.1 最小字段（逻辑 schema，非最终 JSON 锁死）

```text
BoardDocument
  id, name, mcu, vendor
  pins[]: { id, labels[], capabilities[] }  
       # capabilities 例: digital_in, digital_out, adc, i2c_sda, i2c_scl, power_3v3, gnd …
  constraints[]: 互斥/必须共地 等（可选 P1）
  toolchain: { fqbn 或等价板标识, upload_protocol, … }
```

### 5.2 XIAO ESP32-S3 要求

- 必须有独立 `board.json`（或平台库中的 XIAO ESP32-S3 条目）。  
- 第一课用到的 DHT 数据脚、蜂鸣器 GPIO、3V3/GND 必须在 capabilities 中可解析。  
- 顶栏「板型」步骤绑定该 BoardDocument.id。

### 5.3 校验 API（逻辑）

`validate(graph, board) -> { ok, errors[] }`  
错误需可映射为儿童可读句（UI），工程保留 code。

---

## 6. ConnectionGraph（对内）

### 6.1 概念

- **节点：** 板、元件（DHT22、有源蜂鸣器）、电源/地。  
- **边：** 引脚到引脚的连接。  
- **元数据：** 课包 id、步骤锚点（供 Agent 高亮）、显示名。

### 6.2 与 aily 对标（行为，非搬壳）

| 应对标的行为 | 说明 |
|---|---|
| 以板级能力约束连线合法性 | 同 board/pinmap 思想 |
| 图可序列化、可渲染为教学图 | 对外叫连线图 |
| 元件—引脚模型清晰 | 便于课包作者配置 |

| 明确不对标/不复制 | 说明 |
|---|---|
| aily 编辑器壳、菜单、主题、资源文件 | GPL 风险 |
| 专有文件格式若迫使复制实现 | 改用自有 schema，仅保留语义兼容 |
| 商标/品牌资产 | 禁止 |

**GPL 边界声明（产品默认）：**  
允许阅读公开约定与行为、自行实现等价校验与渲染；**禁止**拷贝 aily 源码树、UI 壳、资源与文档中受 GPL 约束的表达性内容到发行包。功能 bot 在实现清单中列「自研模块」；监工发布前检查无搬壳项（F-WIR-04）。

---

## 7. 第一课课包结构（逻辑）

```text
CoursePack first-lesson
  boardRef: xiao-esp32-s3
  components: [ { type: dht22, … }, { type: active_buzzer, … } ]
  connectionGraph: …
  firmware/blocks: …
  guideScript: steps[]  # 现在做/为什么/成功时
  quiz: …
```

默认元件：DHT22、有源蜂鸣器（可配置覆盖，不改主架构）。

---

## 8. 工具链会话（Hardware Session）

| 模块 | 职责 | UI 锚点 |
|---|---|---|
| DeviceLink | 枚举/连接/状态 | 顶栏「连接」 |
| Build | 编译；错误规范化 | 顶栏「编译」 |
| Flash | 烧录进度/结果 | 顶栏「烧录」 |
| Serial | 读写流；温湿度解析钩子 | 底栏串口 |
| Phenomenon | 自动检测或接受用户确认 | F-HW-01 |

失败不得要求 quiz 解锁重试。

---

## 9. Agent Guide Engine

- 状态：IDLE / GUIDING / WRAP_UP / QUIET_HELP（见 PRD §7）。  
- 输入：guideScript + 当前 Hardware/Graph 状态。  
- 输出：GuideStepCard 模型；高亮目标（步进、元件）。  
- **门禁：** `surface != Workbench` ⇒ 禁止进入 GUIDING。

---

## 10. 数据流（选课→成功）

```text
Catalog 选课
  → 加载 CoursePack + board.json
  → 打开 Workbench：Agent → GUIDING
  → 用户连线：ConnectionGraph 编辑/确认 → validate(board)
  → DeviceLink → Build → Flash → Serial
  → Phenomenon success → Agent WRAP_UP → Quiz
```

---

## 11. 安全与合规

- 不在客户端嵌入第三方 GPL 源码发行。  
- 课包与 board.json 签名/来源策略：P1（功能 bot 提方案）。  
- 串口数据仅本地会话除非用户显式上传（P1）。

---

## 12. 与旧架构差异

| 旧 | 新 |
|---|---|
| Wiring Graph 为 SoT | board.json 为能力真源；图为实例 |
| 可搬 aily 壳 | 只对标行为；自研壳与渲染 |
| 全局 Agent | 课内会话引擎 |

---

## 13. 功能 bot 待办（实现）

1. 冻结 `board.json` 物理 schema 与 XIAO 样例文件。  
2. 实现 ConnectionGraph schema + `validate`。  
3. 列出 aily「行为对标清单」vs「禁止复制清单」。  
4. DeviceLink/Build/Flash/Serial 适配层接口。  
5. 与界面 bot 对 C-WIRING / C-TOP-STEPPER / C-SERIAL 数据契约。

---

## 14. 验收（架构）

- [ ] 文档与代码路径均无对外 Wiring Graph SoT  
- [ ] validate 以 board.json 为最高优先级  
- [ ] 第一课 XIAO + DHT22 + 蜂鸣器可表达且可校验  
- [ ] 实现清单无 aily 壳/资源拷贝项  
- [ ] Agent GUIDING 仅 Workbench  

---

## 15. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | R5 初稿：真源层级、ConnectionGraph、GPL 边界、XIAO/第一课、工具链与 Agent |
