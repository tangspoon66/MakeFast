# MakeFast 课程模块 Schema

这是课程内容的事实源。课程编辑器、工作台、接线图、中文接线清单和 Agent 锚点都从同一份 `CourseDefinition` 读取。

## 结构

```text
CourseDefinition
├── finished_media          成品图：实拍或严格匹配型号的技术渲染图
├── components[]            开发板、传感器、执行器、线材
│   ├── media               图片来源、许可、准确型号、核验状态
│   └── pins[]              引脚语义、英文丝印和图片上的归一化坐标
├── connections[]           两个 component.pin 之间的结构化连线
└── steps[]                 课程步骤、前置条件、Agent 目标和奖励事件
```

## 图片门禁

`verification_status=verified` 必须同时填写 URL、来源、许可、准确型号、替代文字和 `photo`/`technical_render` 类型。技术渲染图还要填写 `variant_check`，说明它和实际购买型号、引脚布局如何比对。Aily 的 DHT11 1×1 占位图不能作为课程素材。

## 引脚和接线

`CoursePin.x/y` 是引脚在对应元件图片中的 0 到 1 归一化坐标；两者必须同时存在。`CourseConnection` 只引用已声明的 `component_id` 和 `pin_id`，并记录电气语义、方向、线色（仅展示）和实测证据。线色不会参与校验。未核验的元件、坐标或连线不能发布。

```json
{
  "id": "sensor-data",
  "from_pin": {"component_id": "xiao-board", "pin_id": "d4"},
  "to_pin": {"component_id": "dht11", "pin_id": "data"},
  "kind": "digital",
  "direction": "source_to_sink",
  "label": "数据脚（DATA）",
  "wire_color": "any",
  "verified": false,
  "verification_evidence": null
}
```

课程作者可以为首发固定套件手动指定目标引脚；这比让 AI 猜 GPIO 更可靠。发布前仍必须完成真实套件的连续性、编译、烧录、串口和蜂鸣器行为核验。

## 内容状态

- `draft`：可以不完整，供作者编辑。
- `validated`：schema 和引用通过，但不一定可以面向学生。
- `published`：不可变版本；所有公开素材、pinmap 和连接关系均有核验记录。
- `pending_hardware_verification`：DHT11、蜂鸣器或成品素材缺失时使用，工作台只展示说明，不展示会误导用户的接线指导。

## 与 Aily 的关系

MakeFast 采用 Aily 的结构化 pinmap / connection-graph 思路；当前适配层只保存与首课有关的字段。若后续直接引入 GPL-3.0 代码，必须保留版权和许可证并按许可证提供对应源码；仅参考数据模型不等于复制代码。通用课程生成 Skill 等首课实测完成后再做。
