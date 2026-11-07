# MakeFast 功能细化（R5 Detail）

| 字段 | 值 |
|---|---|
| 状态 | 草稿 · 功能实现规格 · 回传协调位 |
| 日期 | 2026-10-10 |
| 作者 | MakeFast 功能 |
| 基线 | Architecture R5 / PRD R2 / UX R4 / Data Model R6 / API Contracts R6 |
| 对应架构 | Architecture R5 §13 功能 bot 待办 |
| 主交付路径 | `/workspace/makefast-feature-R5-detail.md` |

---

## 0. 文档范围与硬约束

本文冻结 Architecture R5 §13 五项实现规格，并闭合协调位 R8 缺口 **G-01 / G-02 / G-03**，同时对齐 R6 数据模型与 API 契约。

**硬约束（全文生效）：**

1. 引脚能力真源为 **`board.json`（BoardDocument）**；对内模型 **ConnectionGraph**；对外产品文案固定 **「连线图」**。
2. **禁止**把 Wiring Graph / `wiringGraph` / `wiring-graph` 写成 SoT 或对外产品资源名；API/资源路径一律用 **`connection-graph`**。
3. 行为可对标 aily 约定；**禁止**复制 aily GPL 壳/主题/源码/资源/商标（F-WIR-04）。
4. 第一课：Seeed **XIAO ESP32-S3** + **DHT22** + **有源蜂鸣器**。
5. Agent：仅 `surface == workbench` 可进入 **GUIDING**；创建 session 时 `agentState = IDLE`。
6. Quiz：仅现象成功/主线完成后解锁；工具链或引导失败 **不得**要求 quiz；引导步骤中 **禁止** `POST .../quiz`。

---

## 1. board.json 物理 schema + XIAO ESP32-S3 样例（G-01）

### 1.1 设计原则

- MakeFast **自有 schema**（语义兼容 aily 能力惯例：digital / analog / pwm / i2c / spi / uart / power / gnd），**不强制**拷贝 aily 文件结构或数组对形式。
- 运行时对 `board.json` **只读校验**；与 pinmap / SDK 冲突时 **以 board.json 为准**并告警（Architecture AA-02、真源优先级 1）。
- 课包 ConnectionGraph **不得**声明 board 未提供的引脚能力（AA-04）。
- 引脚命名对齐 aily 实测与厂家针脚惯例（D0–D10、A0–A5/A8–A10、I2C D4/D5 等）；**以实测/厂家为准**，Sense 变体内部占用脚需规避。

### 1.2 冻结物理 schema（JSON Schema 风格）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://makefast.local/schemas/board-document-v1.json",
  "title": "MakeFast BoardDocument",
  "type": "object",
  "required": ["schemaVersion", "id", "name", "mcu", "vendor", "pins", "toolchain"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": {
      "type": "string",
      "const": "1.0",
      "description": "BoardDocument schema 版本"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
      "description": "板唯一 id，如 xiao-esp32-s3"
    },
    "name": { "type": "string", "minLength": 1 },
    "mcu": { "type": "string", "minLength": 1 },
    "vendor": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "pins": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/PinDef" }
    },
    "constraints": {
      "type": "array",
      "description": "可选 P1：互斥、必须共地等",
      "items": { "$ref": "#/$defs/BoardConstraint" }
    },
    "toolchain": { "$ref": "#/$defs/ToolchainProfile" },
    "notes": {
      "type": "string",
      "description": "实现备注，如「引脚以实测/厂家为准」"
    }
  },
  "$defs": {
    "PinCapability": {
      "type": "string",
      "enum": [
        "digital_in",
        "digital_out",
        "pwm",
        "adc",
        "dac",
        "i2c_sda",
        "i2c_scl",
        "spi_mosi",
        "spi_miso",
        "spi_sck",
        "spi_ss",
        "uart_rx",
        "uart_tx",
        "interrupt",
        "touch",
        "power_3v3",
        "power_5v",
        "gnd",
        "builtin_led"
      ]
    },
    "PinDef": {
      "type": "object",
      "required": ["id", "labels", "capabilities"],
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "description": "规范引脚 id，如 D0、A0、3V3、GND"
        },
        "labels": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string" },
          "description": "UI/课包可用别名，须含 id 本身"
        },
        "capabilities": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/PinCapability" }
        },
        "gpio": {
          "type": ["integer", "null"],
          "description": "可选 MCU GPIO 号；电源/地为 null"
        },
        "bus": {
          "type": "string",
          "description": "可选总线归属，如 Wire、SPI、Serial"
        }
      }
    },
    "BoardConstraint": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["mutual_exclusion", "must_share_gnd", "reserved", "note"]
        },
        "pins": { "type": "array", "items": { "type": "string" } },
        "messageKey": { "type": "string" }
      }
    },
    "ToolchainProfile": {
      "type": "object",
      "required": ["fqbn", "uploadProtocol"],
      "additionalProperties": false,
      "properties": {
        "fqbn": {
          "type": "string",
          "description": "如 esp32:esp32:XIAO_ESP32S3"
        },
        "uploadProtocol": { "type": "string", "description": "如 esptool" },
        "core": { "type": "string" },
        "mode": { "type": "string", "enum": ["arduino", "micropython"] },
        "defaultBaud": { "type": "integer", "default": 115200 }
      }
    }
  }
}
```

### 1.3 能力与 aily 惯例对照（语义兼容，非文件拷贝）

| MakeFast capability | aily 字段惯例（行为对标） | 第一课用途 |
|---|---|---|
| `digital_in` / `digital_out` | `digitalPins` | DHT 数据线、蜂鸣器 GPIO |
| `adc` | `analogPins` | 预留 |
| `pwm` | `pwmPins` | 预留（有源蜂鸣器本课用 digital_out） |
| `i2c_sda` / `i2c_scl` | `i2cPins.Wire`（D4/D5） | 预留 I2C 模组 |
| `spi_*` | `spiPins.SPI` | 预留 |
| `uart_rx` / `uart_tx` | `serialPins.Serial` | USB-CDC 旁路参考 |
| `power_3v3` / `gnd` | （aily 连线类型 power/gnd） | DHT/蜂鸣器供电 |
| `builtin_led` | `builtinLed` | 可选指示 |

### 1.4 G-01：完整可复制样例 — XIAO ESP32-S3 `board.json`

> 引脚命名参考 aily `xiao_esp32s3` 实测与 Seeed 针脚图；**以实测/厂家为准**。第一课必须可在 capabilities 中解析：DHT 数据脚（推荐 D2）、蜂鸣器 GPIO（推荐 D3）、3V3、GND。

```json
{
  "schemaVersion": "1.0",
  "id": "xiao-esp32-s3",
  "name": "Seeed XIAO ESP32-S3",
  "mcu": "ESP32-S3",
  "vendor": "Seeed Studio",
  "description": "第一课官方板型。引脚标签对齐厂家丝印 D0–D10 / A0–A5,A8–A10；以实测与厂家数据手册为准。",
  "notes": "Sense 变体内部占用脚需规避；本条目为基础 XIAO ESP32-S3。冲突时以本文件为准，pinmap/SDK 仅作实现映射。",
  "pins": [
    {
      "id": "D0",
      "labels": ["D0", "A0", "GPIO1"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "interrupt", "touch"],
      "gpio": 1
    },
    {
      "id": "D1",
      "labels": ["D1", "A1", "GPIO2"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "interrupt", "touch"],
      "gpio": 2
    },
    {
      "id": "D2",
      "labels": ["D2", "A2", "GPIO3"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "interrupt", "touch"],
      "gpio": 3
    },
    {
      "id": "D3",
      "labels": ["D3", "A3", "GPIO4"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "interrupt", "touch"],
      "gpio": 4
    },
    {
      "id": "D4",
      "labels": ["D4", "A4", "SDA", "GPIO5"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "i2c_sda", "interrupt", "touch"],
      "gpio": 5,
      "bus": "Wire"
    },
    {
      "id": "D5",
      "labels": ["D5", "A5", "SCL", "GPIO6"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "i2c_scl", "interrupt", "touch"],
      "gpio": 6,
      "bus": "Wire"
    },
    {
      "id": "D6",
      "labels": ["D6", "A8", "TX", "GPIO43"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "uart_tx", "interrupt"],
      "gpio": 43,
      "bus": "Serial"
    },
    {
      "id": "D7",
      "labels": ["D7", "A9", "RX", "SS", "GPIO44"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "uart_rx", "spi_ss", "interrupt"],
      "gpio": 44,
      "bus": "Serial"
    },
    {
      "id": "D8",
      "labels": ["D8", "A10", "SCK", "GPIO7"],
      "capabilities": ["digital_in", "digital_out", "pwm", "adc", "spi_sck", "interrupt"],
      "gpio": 7,
      "bus": "SPI"
    },
    {
      "id": "D9",
      "labels": ["D9", "MISO", "GPIO8"],
      "capabilities": ["digital_in", "digital_out", "pwm", "spi_miso", "interrupt"],
      "gpio": 8,
      "bus": "SPI"
    },
    {
      "id": "D10",
      "labels": ["D10", "MOSI", "GPIO9"],
      "capabilities": ["digital_in", "digital_out", "pwm", "spi_mosi", "interrupt"],
      "gpio": 9,
      "bus": "SPI"
    },
    {
      "id": "LED_BUILTIN",
      "labels": ["LED_BUILTIN", "LED"],
      "capabilities": ["digital_out", "builtin_led"],
      "gpio": 21
    },
    {
      "id": "3V3",
      "labels": ["3V3", "VCC", "3.3V"],
      "capabilities": ["power_3v3"],
      "gpio": null
    },
    {
      "id": "GND",
      "labels": ["GND", "G", "Ground"],
      "capabilities": ["gnd"],
      "gpio": null
    }
  ],
  "constraints": [
    {
      "type": "must_share_gnd",
      "pins": ["GND"],
      "messageKey": "board.constraint.mustShareGnd"
    },
    {
      "type": "note",
      "pins": ["D4", "D5"],
      "messageKey": "board.constraint.defaultI2cWire"
    }
  ],
  "toolchain": {
    "fqbn": "esp32:esp32:XIAO_ESP32S3",
    "uploadProtocol": "esptool",
    "core": "esp32",
    "mode": "arduino",
    "defaultBaud": 115200
  }
}
```

### 1.5 运行时只读校验规则

| 规则 | 说明 |
|---|---|
| 加载后不可变 | Hardware Session 持有 `BoardProfile` 只读快照；课包/用户图不得改写 pins |
| 冲突裁决 | pinmap 几何或 SDK 映射与 board.json 不一致 → 以 board.json 为准 + `BOARD_PINMAP_MISMATCH` 告警 |
| 编译门禁 | `validate(graph, board).ok !== true` 时 P0 建议阻断进入 Build（可配置警告级，默认 error） |
| API | `GET /boards/{boardId}` 返回本文件内容；`POST /boards/{boardId}/validate-graph` 以之为真源 |

---

## 2. ConnectionGraph 模型 + validate 错误码

### 2.1 命名

| 层级 | 名称 | 谁看见 |
|---|---|---|
| 对外 UI/文案 | **连线图** | 学习者、课程文案、C-WIRING 标题 |
| 对内模型 | **ConnectionGraph** | 工程、课包、校验器 |
| API 资源路径 | **`connection-graph`** | REST/IPC |
| 真源 | **board.json** | 能力校验最高优先级 |
| **禁止** | Wiring Graph / wiring-graph / wiringGraph 作为 SoT 或产品资源名 | — |

### 2.2 TypeScript 风格类型草图

```typescript
/** 对内模型；对外产品文案固定「连线图」 */
export type NodeKind = "board" | "component" | "power";

export type ComponentType = "dht22" | "active_buzzer" | string;

export interface GraphPortRef {
  nodeId: string;
  port: string; // 如 "D2" | "DATA" | "SIG" | "VCC" | "GND" | "3V3"
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  /** board → BoardDocument.id；component → ComponentDef.type；power → "rail_3v3"|"rail_gnd" */
  ref: string;
  displayName: string;
  ports: string[];
}

export interface GraphEdge {
  id: string;
  from: GraphPortRef;
  to: GraphPortRef;
  /** 可选连线角色，便于着色与校验：power|gnd|digital|i2c|… */
  role?: "power" | "gnd" | "digital" | "analog" | "pwm" | "i2c" | "spi" | "uart" | "other";
}

export interface StepAnchor {
  stepId: string;
  nodeIds?: string[];
  edgeIds?: string[];
  label?: string;
}

export interface ConnectionGraph {
  schemaVersion: "1.0";
  id: string;
  coursePackId: string;
  boardId: string; // 必须引用 BoardDocument.id
  nodes: GraphNode[];
  edges: GraphEdge[];
  stepAnchors?: StepAnchor[];
  displayName?: string; // UI 可用；不替代标题「连线图」
}

export type ValidateErrorCode =
  | "UNKNOWN_PIN"
  | "CAPABILITY_MISMATCH"
  | "POWER_GND_SHORT"
  | "PIN_ALREADY_USED"
  | "MISSING_VCC"
  | "MISSING_GND"
  | "BOARD_REF_INVALID"
  | "UNKNOWN_COMPONENT_TYPE"
  | "DUPLICATE_EDGE"
  | "UNKNOWN_NODE"
  | "SELF_LOOP"
  | "INVALID_PORT";

export interface ValidateError {
  code: ValidateErrorCode;
  messageKey: string; // UI 映射儿童可读句
  path?: string;      // 如 edges[2]、nodes[1].ports
  nodes?: string[];
  pins?: string[];
  edgeId?: string;
  childMessage?: string; // 可选预渲染短句（对齐 API R6）
}

export interface ValidateResult {
  ok: boolean;
  errors: ValidateError[];
}

export function validate(
  graph: ConnectionGraph,
  board: BoardDocument
): ValidateResult;
```

### 2.3 元件端口约定（第一课）

| type | displayName | ports | 所需 capability（接到板脚时） |
|---|---|---|---|
| `dht22` | 温湿度传感器 | `VCC`, `DATA`, `GND` | VCC→`power_3v3`；DATA→`digital_in`\|`digital_out`；GND→`gnd` |
| `active_buzzer` | 有源蜂鸣器 | `VCC`, `SIG`, `GND`（或两线 `SIG`+`GND`，课包可配置） | VCC→`power_3v3`；SIG→`digital_out`；GND→`gnd` |

### 2.4 错误码表

| code | messageKey | 触发条件 | 儿童可读句（UI 映射示例） |
|---|---|---|---|
| `UNKNOWN_PIN` | `wiring.error.unknownPin` | 边引用的板脚 id/label 不在 board.pins | 「这块板上没有这个脚哦」 |
| `CAPABILITY_MISMATCH` | `wiring.error.capabilityMismatch` | 元件端口所需能力与板脚 capabilities 无交集 | 「这个脚做不了这件事，换一个脚试试」 |
| `POWER_GND_SHORT` | `wiring.error.powerGndShort` | 3V3/电源轨与 GND 被直接边连通 | 「电源和地连在一起会短路，快检查一下」 |
| `PIN_ALREADY_USED` | `wiring.error.pinAlreadyUsed` | 同一板脚被多条非总线豁免边占用 | 「这个脚已经接过别的东西了」 |
| `MISSING_VCC` | `wiring.error.missingVcc` | 元件需要 VCC 但未接到 `power_3v3` | 「还要接上 3V3 电源」 |
| `MISSING_GND` | `wiring.error.missingGnd` | 元件需要 GND 但未接到 `gnd` | 「还要接上 GND（地）」 |
| `BOARD_REF_INVALID` | `wiring.error.boardRefInvalid` | `graph.boardId` ≠ 加载的 board.id，或无 board 节点 | 「连线图和当前板型对不上」 |
| `UNKNOWN_COMPONENT_TYPE` | `wiring.error.unknownComponent` | nodes[].ref 不在课包/元件库 | 「还不认识这个零件」 |
| `DUPLICATE_EDGE` | `wiring.error.duplicateEdge` | 相同 from/to（或反向等价）重复边 | 「这两根线重复了」 |
| `UNKNOWN_NODE` | `wiring.error.unknownNode` | 边引用不存在的 nodeId | 「连线指到了不存在的零件」 |
| `SELF_LOOP` | `wiring.error.selfLoop` | from 与 to 同一 node+port | 「线不能接到自己身上」 |
| `INVALID_PORT` | `wiring.error.invalidPort` | port 名不在该节点 ports 列表 | 「这个零件没有这个接口」 |

**总线占用豁免：** 当边的 `role` 为 `i2c` / `spi` / `uart`（或两端均为同总线能力脚）时，同一总线脚允许多从设备共享，**不**触发 `PIN_ALREADY_USED`。电源轨 `3V3`/`GND` 允许多扇出。普通 `digital`/`pwm`/`analog` 单占用。

### 2.5 第一课 ConnectionGraph 实例样例

```json
{
  "schemaVersion": "1.0",
  "id": "cg-first-lesson-default",
  "coursePackId": "first-lesson",
  "boardId": "xiao-esp32-s3",
  "displayName": "第一课连线",
  "nodes": [
    {
      "id": "board",
      "kind": "board",
      "ref": "xiao-esp32-s3",
      "displayName": "XIAO ESP32-S3",
      "ports": ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "3V3", "GND", "LED_BUILTIN"]
    },
    {
      "id": "dht",
      "kind": "component",
      "ref": "dht22",
      "displayName": "温湿度传感器",
      "ports": ["VCC", "DATA", "GND"]
    },
    {
      "id": "buzzer",
      "kind": "component",
      "ref": "active_buzzer",
      "displayName": "有源蜂鸣器",
      "ports": ["VCC", "SIG", "GND"]
    }
  ],
  "edges": [
    {
      "id": "e-dht-vcc",
      "from": { "nodeId": "board", "port": "3V3" },
      "to": { "nodeId": "dht", "port": "VCC" },
      "role": "power"
    },
    {
      "id": "e-dht-gnd",
      "from": { "nodeId": "board", "port": "GND" },
      "to": { "nodeId": "dht", "port": "GND" },
      "role": "gnd"
    },
    {
      "id": "e-dht-data",
      "from": { "nodeId": "board", "port": "D2" },
      "to": { "nodeId": "dht", "port": "DATA" },
      "role": "digital"
    },
    {
      "id": "e-buzzer-vcc",
      "from": { "nodeId": "board", "port": "3V3" },
      "to": { "nodeId": "buzzer", "port": "VCC" },
      "role": "power"
    },
    {
      "id": "e-buzzer-gnd",
      "from": { "nodeId": "board", "port": "GND" },
      "to": { "nodeId": "buzzer", "port": "GND" },
      "role": "gnd"
    },
    {
      "id": "e-buzzer-sig",
      "from": { "nodeId": "board", "port": "D3" },
      "to": { "nodeId": "buzzer", "port": "SIG" },
      "role": "digital"
    }
  ],
  "stepAnchors": [
    {
      "stepId": "wire-dht",
      "nodeIds": ["dht"],
      "edgeIds": ["e-dht-vcc", "e-dht-gnd", "e-dht-data"],
      "label": "先接温湿度传感器"
    },
    {
      "stepId": "wire-buzzer",
      "nodeIds": ["buzzer"],
      "edgeIds": ["e-buzzer-vcc", "e-buzzer-gnd", "e-buzzer-sig"],
      "label": "再接蜂鸣器"
    }
  ]
}
```

**Invariant（Data Model R6）：** `validate(graph, board).ok == true` 方可进入编译（P0 对明显非法 error 阻断）。

**API 对齐：**

- `GET /courses/{courseId}/connection-graph` → 课包默认图  
- `PUT /sessions/{sessionId}/connection-graph` → 保存快照并 validate；非法可 422  
- `POST /boards/{boardId}/validate-graph` → Body: ConnectionGraph  

---

## 3. aily 对标 / 禁止清单（G-02）

> GPL 边界按产品默认（Architecture AA-03、PRD A-03）：**行为与 schema 级对标，源码/资源不复制**。下文不虚构未在源文件出现的法务批注结论。

### 3.1 行为可对标清单

| ID | 应对标的行为 | 说明 | MakeFast 落点 |
|---|---|---|---|
| B-01 | 以板级能力约束连线合法性 | 同 board/pinmap 思想；MCU 能力在 board.json | `validate(graph, board)` |
| B-02 | 图可序列化、可渲染为教学图 | 对外叫「连线图」 | ConnectionGraph + C-WIRING |
| B-03 | 元件—引脚模型清晰 | 便于课包作者配置 | ComponentDef.ports + needs capability |
| B-04 | digital/analog/pwm/i2c/spi/uart 能力字段惯例 | 语义对齐，自有 schema | BoardDocument.pins[].capabilities |
| B-05 | 默认总线脚（I2C D4/D5 等） | 对照厂家后冻结 | board.json + notes |
| B-06 | 连接类型：power/gnd/digital/… | 着色与校验角色 | GraphEdge.role |
| B-07 | 冲突校验：VCC↔GND 短路、引脚冲突（总线豁免）、缺电源/地 | 按行为重写 | 错误码表 §2.4 |
| B-08 | 结构化图非静态 PNG 主路径 | AI/课包 → JSON 图 → 可高亮渲染 | 课包 connection-graph |
| B-09 | 编译/上传参数与板绑定 | fqbn / upload protocol | toolchain 字段；不搬桌面宿主 |
| B-10 | 「能力真源 > 积木/代码投影」 | 产品原则 | 真源层级 §Architecture §4 |

### 3.2 禁抄壳清单（GPL / 商标 / 耦合）

| ID | 明确禁止 | 原因 |
|---|---|---|
| F-01 | aily 编辑器壳、菜单、主题、皮肤 | GPL 风险；F-WIR-04 |
| F-02 | aily 资源文件、位图、启动页品牌资产、商标 | GPL/商标 |
| F-03 | 拷贝 aily 源码树（含 `ConnectionGraphService`、iframe UI、Angular/Electron 宿主） | GPL 传染 + 强耦合 |
| F-04 | 拷贝 `aws-parser` / schematic agent / connection-aws 等 parser 源码 | 若复制 → GPL；仅可自研等价 |
| F-05 | 专有文件格式迫使复制实现 | 改用自有 schema，仅语义兼容 |
| F-06 | 整包搬入编译器云/闪电连编桌面模型当浏览器依赖 | 工具链模型 ≠ Web Serial 路径 |
| F-07 | Blockly IDE / 库广场 / 项目广场 / 仿真器 runtime 整包 | 产品边界与 P0 过载 |
| F-08 | 对外使用「Wiring Graph」作产品名或 SoT | PRD F-WIR-01；Architecture 作废旧结论 |
| F-09 | API/字段 `wiring-graph` / `wiringGraph` 作产品资源名 | API R6 禁止 |

### 3.3 自研模块清单（发布前检查 F-WIR-04）

监工发布门禁：下列模块必须为 **MakeFast 自研**（或明确许可的第三方，**非** aily 源码拷贝）。勾选即通过 F-WIR-04。

| 模块 ID | 自研模块 | 职责 | 检查项 |
|---|---|---|---|
| M-BOARD | BoardDocument Loader | 加载/校验 board.json schema | □ 无 aily 文件原样嵌入发行包 |
| M-GRAPH | ConnectionGraph Core | 图模型、序列化、锚点 | □ 无 `ConnectionGraphService` 移植痕迹 |
| M-VAL | Graph Validator | validate + 错误码 | □ 规则自研；未 copy-paste aily 服务 |
| M-WIR-UI | WiringDiagramPanel | 「连线图」渲染/高亮 | □ 自研 UI；无 aily iframe/主题资源 |
| M-COMP | Component Catalog | dht22 / active_buzzer 等端口定义 | □ 自有 JSON |
| M-LINK | DeviceLink Adapter | 枚举/连接（Web Serial 等） | □ 非 aily Electron FS 路径 |
| M-BUILD | Build Adapter | 编译与错误规范化 | □ 适配层自研 |
| M-FLASH | Flash Adapter | 烧录进度/结果 | □ 适配层自研 |
| M-SER | Serial Adapter | 流式读写 + 温湿度解析钩子 | □ 解析钩子自研 |
| M-PHENO | Phenomenon Detector | 自动检测或用户确认 | □ 对齐 F-HW-01 |
| M-AGENT | Agent Guide Engine | IDLE/GUIDING/…；surface 门禁 | □ 课内会话，非全局 aily agent |
| M-MOCK | Firmware/Blocks Mock | G-03 mock 支撑工具链演示 | □ 占位固件，非上游二进制盗用 |

**发布检查句：** 实现清单无 aily 壳/菜单/主题/资源/商标/源码树/parser 拷贝项。

---

## 4. DeviceLink / Build / Flash / Serial / Phenomenon 适配接口

### 4.1 UI 锚点

| 模块 | 顶栏/底栏 | ToolchainStepper phase | API（逻辑 REST，可 IPC） |
|---|---|---|---|
| 板型确认 | 顶栏「板型」 | `board` | `PATCH .../toolchain` `{ phase:"board" }` |
| DeviceLink | 顶栏「连接」 | `connection` | `PATCH .../toolchain` `{ phase:"connection" }` |
| Build | 顶栏「编译」 | `build` | `POST /sessions/{sessionId}/build` |
| Flash | 顶栏「烧录」 | `flash` | `POST /sessions/{sessionId}/flash` |
| Serial | 底栏串口 | `serial` | `GET /sessions/{sessionId}/serial/stream` |

**约束：** 任一阶段失败 → Agent MAY 解释 WHY；**SHALL NOT** 以 quiz 解锁重试（F-AGT-04；API R6 §5）。

### 4.2 共享类型

```typescript
export type ToolchainPhaseStatus = "todo" | "current" | "done" | "error";

export interface AdapterError {
  code: string;
  message: string;
  childMessage?: string; // 儿童短句
  detail?: string;       // 堆栈/日志进「详情」
  retryable: boolean;
  /** 永远 false：失败不得要求 quiz */
  requiresQuiz: false;
}
```

### 4.3 DeviceLink

**职责：** 枚举设备、建立/断开连接、上报连接状态。

```typescript
export type DeviceLinkState =
  | "disconnected"
  | "enumerating"
  | "connecting"
  | "connected"
  | "failed";

export interface DeviceInfo {
  id: string;
  label: string;
  transport: "webserial" | "mock";
  vendorId?: string;
  productId?: string;
}

export interface DeviceLinkAdapter {
  listDevices(): Promise<DeviceInfo[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  getState(): DeviceLinkState;
  onStateChange(cb: (s: DeviceLinkState, err?: AdapterError) => void): () => void;
}
```

### 4.4 Build

**职责：** 编译课包固件/积木产物；错误规范化为儿童可读。

```typescript
export type BuildState = "idle" | "building" | "success" | "failed";

export interface BuildRequest {
  sessionId: string;
  boardId: string;
  graph: ConnectionGraph; // 须已 validate ok
  firmwareRef: string;    // 或 mock://first-lesson
}

export interface BuildResult {
  artifactId: string;
  warnings: string[];
}

export interface BuildAdapter {
  build(req: BuildRequest): Promise<BuildResult>;
  getState(): BuildState;
  onStateChange(cb: (s: BuildState, err?: AdapterError) => void): () => void;
}
```

错误示例：`{ code: "BUILD_FAILED", childMessage: "程序里有小错误，我们一起改改", retryable: true, requiresQuiz: false }`。

### 4.5 Flash

**职责：** 烧录产物到已连接设备；进度与结果。

```typescript
export type FlashState = "idle" | "flashing" | "success" | "failed";

export interface FlashRequest {
  sessionId: string;
  artifactId: string;
  deviceId: string;
}

export interface FlashProgress {
  percent: number; // 0–100
  messageKey?: string;
}

export interface FlashAdapter {
  flash(req: FlashRequest): Promise<void>;
  getState(): FlashState;
  onProgress(cb: (p: FlashProgress) => void): () => void;
  onStateChange(cb: (s: FlashState, err?: AdapterError) => void): () => void;
}
```

### 4.6 Serial

**职责：** 读写串口流；温湿度解析钩子；支撑现象自动检测。

```typescript
export type SerialState = "closed" | "open" | "error";

export interface SerialLine {
  ts: number;
  text: string;
  raw?: Uint8Array;
}

export interface SensorReading {
  temperatureC?: number;
  humidityPct?: number;
  sourceLine: string;
}

export interface SerialAdapter {
  open(sessionId: string, baud?: number): Promise<void>;
  close(): Promise<void>;
  write(data: string | Uint8Array): Promise<void>;
  getState(): SerialState;
  /** 流式行 */
  onLine(cb: (line: SerialLine) => void): () => void;
  /** 温湿度解析钩子：匹配课包约定格式则回调 */
  onSensorReading(cb: (r: SensorReading) => void): () => void;
  clearBuffer(): void;
}
```

**解析约定（第一课 mock/真固件共用）：** 行内可解析 `T=23.5 H=60.0` 或 JSON `{"temp":23.5,"humidity":60}`。解析失败不抛 quiz；仅保持「等待数据」。

### 4.7 Phenomenon

**职责：** 判定主线硬件成功（F-HW-01）；成功后解锁 quiz、Agent → WRAP_UP。

```typescript
export type PhenomenonSource = "auto_serial" | "user_confirm";

export interface PhenomenonAdapter {
  /** 自动：连续 N 次有效 SensorReading 或听到蜂鸣的启发式（P0 可仅串口） */
  tryAutoDetect(sessionId: string): Promise<boolean>;
  /** 用户确认「我看到了/听到了」 */
  confirmByUser(sessionId: string): Promise<void>;
}

// API: POST /sessions/{sessionId}/phenomenon-success
// Body: { source: "auto_serial" | "user_confirm" }
// → mainlineCompleted；agentState=WRAP_UP；quiz 解锁
```

---

## 5. 与界面组件前后端契约

### 5.1 C-WIRING · WiringDiagramPanel

| 项 | 约定 |
|---|---|
| 标题 | 固定 **「连线图」**（文案键 `wiring.title`）；**禁止** Wiring Graph |
| 输入 props | 见下表 |
| 高亮 | 由 `highlightAnchor` / Agent `stepAnchors` 驱动 |
| 数据来源 | `GET /courses/{id}/connection-graph` 或 session 快照 |

**Props / Events：**

| 方向 | 名称 | 类型 | 说明 |
|---|---|---|---|
| in | `title` | `string` | 默认「连线图」 |
| in | `graphView` | `ConnectionGraphViewDTO` | 节点/边/显示名；可含布局提示 |
| in | `validation` | `ValidateResult` | 错误高亮 |
| in | `highlightAnchor` | `StepAnchor \| null` | 当前引导锚点 |
| in | `readOnly` | `boolean` | P0 可只读确认 |
| out | `onSelectNode` | `(nodeId) => void` | |
| out | `onSelectEdge` | `(edgeId) => void` | |
| out | `onConfirmWiring` | `() => void` | 用户确认连线完成 → toolchain phase connection |

```typescript
interface ConnectionGraphViewDTO {
  graph: ConnectionGraph;
  boardName: string;
  legend?: { role: string; label: string; colorToken: string }[];
}
```

### 5.2 C-TOP-STEPPER · ToolchainStepper

四步：**板型 → 连接 → 编译 → 烧录**；状态：`todo | current | done | error`。

| 方向 | 名称 | 类型 | 说明 |
|---|---|---|---|
| in | `phases` | `{ id, label, status }[]` | id: `board`\|`connection`\|`build`\|`flash` |
| in | `boardLabel` | `string` | 如 XIAO ESP32-S3 |
| in | `deviceLinkState` | `DeviceLinkState` | 绑定连接步 |
| in | `buildState` | `BuildState` | |
| in | `flashState` | `FlashState` | |
| out | `onPhaseClick` | `(phaseId) => void` | 未满足前置 → 引导提示，**非 quiz** |
| out | `onRetry` | `(phaseId) => void` | `requiresQuiz: false` |

**与 API 事件 payload：**

| 用户动作 | 调用 | payload |
|---|---|---|
| 确认板型 | `PATCH /sessions/{id}/toolchain` | `{ phase:"board", status:"done" }` |
| 连接成功 | 同上 | `{ phase:"connection", status:"done", detail:{ deviceId } }` |
| 点编译 | `POST /sessions/{id}/build` | （body 由会话上下文组装） |
| 点烧录 | `POST /sessions/{id}/flash` | `{ artifactId }` |
| 失败 | `PATCH .../toolchain` | `{ phase, status:"error", detail:{ code, childMessage } }` |

### 5.3 C-SERIAL · SerialDock

| 方向 | 名称 | 类型 | 说明 |
|---|---|---|---|
| in | `collapsed` | `boolean` | 折叠时显示最新行预览 |
| in | `previewLine` | `string` | 折叠预览 |
| in | `lines` | `SerialLine[]` | 流式行（可虚拟列表） |
| in | `baud` | `number` | 默认 115200 |
| in | `status` | `SerialState` | |
| out | `onToggleCollapse` | `() => void` | |
| out | `onClear` | `() => void` | |
| out | `onSensorParsed` | `(SensorReading) => void` | 解析事件 temp/humidity → 可喂 Phenomenon |
| stream | `GET /sessions/{id}/serial/stream` | SSE/WebSocket | 服务端或本地桥推送行 |

### 5.4 Surface / Agent / Quiz 门禁（契约级）

| 规则 | 行为 |
|---|---|
| 创建 session | `POST /courses/{courseId}/sessions` → `{ agentState:"IDLE", surface:"catalog" }` |
| 进工作台 | `PATCH .../surface` `{ surface:"workbench" }` → **允许** `GUIDING` |
| 回目录 | `surface:"catalog"` → `IDLE`，暂停引导 |
| 引导步进 | `PATCH .../guide` 仅当 `surface==workbench` |
| Quiz 读 | `GET .../quiz`：主线未完成 → 403/409 `QUIZ_LOCKED` |
| Quiz 交 | `POST .../quiz/submit`：仅锁开后；**禁止**在引导步骤中调用 |
| 工具链失败 | 不改变 quiz 锁；不要求答题重试 |

---

## 6. G-03：第一课固件 / 积木块 — 接口草图 + Mock

> 真实固件可后补；P0 用 mock 支撑 Build / Flash / Serial 与现象检测演示。

### 6.1 接口草图

```typescript
/** 课包固件/积木引用 */
export interface FirmwareRef {
  id: string;                  // "fw-first-lesson"
  boardId: "xiao-esp32-s3";
  mode: "arduino" | "blocks" | "mock";
  /** 真源路径或 mock scheme */
  uri: string;                 // "mock://first-lesson/v1" | "course://first-lesson/firmware"
  entryPins: {
    dhtData: string;           // "D2"
    buzzerSig: string;         // "D3"
  };
  serial: {
    baud: number;              // 115200
    lineFormat: "kv" | "json"; // T=.. H=.. 或 JSON
  };
}

export interface BlocksRef {
  id: string;
  workspaceUri: string;        // 积木工作区；P0 可指向 mock 生成代码
  generatedFirmwareId?: string;
}

export interface FirmwareArtifact {
  artifactId: string;
  boardId: string;
  bytesBase64?: string;        // mock 可为占位短串
  mockScriptId?: string;       // 指向串口模拟脚本
}
```

### 6.2 Mock 行为规范

| 阶段 | Mock 行为 | 如何支撑 UI/现象 |
|---|---|---|
| Build | `BuildAdapter` 检测 `firmwareRef.mode==="mock"` → 200–800ms 后返回 `artifactId=mock-art-first-lesson`；可选注入语法错误演示儿童句 | C-TOP-STEPPER build → done/error |
| Flash | 校验 DeviceLink 已连接（或 `transport==="mock"`）→ 进度 0→100 → success | 烧录步进 |
| Serial | Flash success 后自动 `open`；按 1s 间隔推送行：`T=23.5 H=61.0`（可微扰） | C-SERIAL 流式行 + `onSensorParsed` |
| Phenomenon | `onSensorParsed` 连续 ≥2 次有效读数 → `tryAutoDetect` true；或用户点「我看到了/听到了」 | `POST .../phenomenon-success` |
| 蜂鸣 | Mock 可在串口插入 `[BUZZER] beep` 行作视觉替代；真机后补 | 操作复核 either |

**Mock 串口脚本示例（逻辑）：**

```text
[MF-MOCK] first-lesson ready
T=23.5 H=60.0
T=23.6 H=60.1
[BUZZER] beep
T=23.4 H=59.9
```

### 6.3 与课包字段接合

```text
CoursePack first-lesson
  boardId: xiao-esp32-s3
  connectionGraph: （§2.5）
  firmwareRef: { mode: mock, uri: mock://first-lesson/v1, entryPins: { dhtData:D2, buzzerSig:D3 } }
  blocksRef:   { id: blocks-first-lesson-mock, workspaceUri: mock://first-lesson/blocks }
  guideScript / quiz: 按 R6
```

真固件替换时：仅改 `firmwareRef.uri/mode` 与产物构建管线；**不改** ConnectionGraph 真源层级、API 路径、UI「连线图」文案。

---

## 7. R6 对齐说明

### 7.1 已对齐项

| R6 来源 | 对齐内容 | 本文位置 |
|---|---|---|
| Data §2.1 BoardDocument | id/name/mcu/vendor/pins/constraints/toolchain/schemaVersion | §1 |
| Data §2.3 ConnectionGraph | nodes/edges/stepAnchors/boardId/coursePackId | §2 |
| Data §2.7–2.8 Session/Agent | IDLE 创建；surface==workbench 才 GUIDING | §5.4、§0 |
| Data §3 枚举 | PinCapability、ToolchainPhaseStatus、AgentState、QuizStatus | §1–§5 |
| API §3 | `/boards/{id}`、`validate-graph`、`/connection-graph` | §1.5、§2.5 |
| API §4–5 | surface/guide/toolchain/build/flash/serial/phenomenon | §4、§5 |
| API §6 Quiz 锁 | QUIZ_LOCKED；submit 规则；禁引导中 POST quiz | §5.4、§0 |
| API §8 废弃 | 无 wiring-graph 资源；无 fadeStage/autonomyLevel | §0、§3.2 F-08/F-09 |

### 7.2 字段 / 路径映射

| 概念 | 对内字段 | API 路径/字段 | UI 文案 |
|---|---|---|---|
| 连线实例 | `ConnectionGraph` | `/connection-graph` | 连线图 |
| 板能力 | `BoardDocument` | `GET /boards/{boardId}` | 板型 |
| 校验 | `validate` | `POST /boards/{boardId}/validate-graph` | 儿童句 via messageKey |
| 会话图快照 | `graphSnapshot` | `PUT /sessions/{id}/connection-graph` | 连线图面板 |
| 现象成功 | `phenomenonSuccess` | `POST .../phenomenon-success` | 我看到了/听到了 |
| 测验锁 | `quiz.status=locked` | `GET .../quiz` → QUIZ_LOCKED | 课后小练习 |

### 7.3 与本细化稿的差异 / 延伸

| 项 | 说明 |
|---|---|
| board.json 物理形状 | R6 给逻辑字段；本文冻结 JSON Schema + 完整 XIAO 样例（G-01） |
| 错误码 | R6 API 示例含 `code/message/childMessage`；本文扩展工程码表（§2.4）并保留 messageKey |
| aily 清单 | R6 未展开；本文 G-02 成表 |
| 固件 mock | R6 仅 firmwareRef；本文 G-03 补接口与 mock 行为 |
| power 节点 | R6 NodeKind 含 `power`；第一课样例将 3V3/GND 作为 **board 端口** 简化表达，语义等价，校验仍走 power_3v3/gnd capability |

### 7.4 开放问题

~~原五项开放问题已由协调位拍板~~ → 见 **§10 协调位决议（Assumptions）**。

---

## 8. 验收清单

### 8.1 架构 / 产品（对齐 R5 §14、PRD、UX）

- [ ] 文档与契约均无对外 Wiring Graph SoT；UI 标题为「连线图」
- [ ] API/资源名使用 `connection-graph`，无 `wiring-graph` / `wiringGraph`
- [ ] validate 以 board.json 为最高优先级
- [ ] 第一课 XIAO + DHT22 + 有源蜂鸣器可表达且可校验
- [ ] 实现清单无 aily 壳/资源/源码拷贝项（G-02 自研模块勾选）
- [ ] Agent GUIDING 仅 workbench；创建 session 为 IDLE
- [ ] Quiz 主线锁；失败不要求 quiz；引导中不 POST quiz

### 8.2 协调位 R8 缺口

- [ ] **G-01** 完整可复制 XIAO `board.json` 样例已写入 §1.4
- [ ] **G-02** 行为对标表 + 禁抄表 + 自研模块检查表已写入 §3
- [ ] **G-03** 固件/积木接口草图 + mock 行为已写入 §6

### 8.3 R6

- [x] §7 R6 对齐说明完整；开放问题已收口至 §10 协调位决议

---

## 9. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 追加 §10 协调位决议（CA-01…05）：三线蜂鸣器、DHT 模组上拉、error 阻断/warning 带病编译、DeviceLink=Web Serial+mock、真固件于 M-P0c→M-P0d；§7.4 开放问题收口；待命 S0 |
| 2026-10-10 | R5 Detail 初稿：冻结 board.json schema + XIAO 样例（G-01）、ConnectionGraph + 错误码、aily 对标/禁止与自研清单（G-02）、工具链适配接口、C-WIRING/C-TOP-STEPPER/C-SERIAL 契约、固件 mock（G-03）、R6 对齐说明与验收清单 |


---

## 10. 协调位决议（Assumptions）

> 来源：makefast 协调位拍板（2026-10-10）。写入本文后作为实现 Assumptions；课包可覆盖处已注明。功能 bot **暂停**，等待 **S0 开工指令**。

| ID | 决议 | 实现含义 |
|---|---|---|
| CA-01 | 有源蜂鸣器默认 **三线**（SIG / VCC / GND） | 第一课 ConnectionGraph / 元件端口默认含 SIG、VCC、GND；课包可改配置为两线拓扑 |
| CA-02 | DHT 默认 **模组自带上拉** | 引导与课包备注按模组自带上拉编写；仅当选用裸探头时文档/课包注明须外接上拉 |
| CA-03 | validate：**error 阻断编译**；**warning 允许带病编译（P0）** | `severity` 含 error ⇒ Build 拒绝；仅 warning ⇒ 可编译，UI 黄提示（儿童可读句） |
| CA-04 | DeviceLink P0：**仅 Web Serial + mock** | 桌面桥 / 本地桥为 **P1**；P0 适配层与 C-TOP-STEPPER「连接」步绑定 Web Serial 与 mock 运输层 |
| CA-05 | 真固件替换 mock | 目标挂在 **M-P0c 末 / 进 M-P0d 前**（工具链闭环可演示之后）；此前 G-03 mock URI 有效 |

**状态：** 细化稿已对齐 R5/R6/R8(G-01…03) + 本决议；**待命 S0**。

---
*文末声明：Wiring Graph 不是真源；真源为 board.json；对外称连线图；对内 ConnectionGraph；路径 connection-graph。*
