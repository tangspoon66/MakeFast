# 连线图 / 板级描述 GPL 边界自检（ST-E3-04 / F-WIR-04）

- [x] `boards/xiao-esp32-s3.board.json`：MakeFast 自建结构，引脚数据来自 Seeed 公开引脚图（事实数据），未拷贝 aily-blockly 的 board.json 文件。
- [x] `connectionGraph.ts`：校验逻辑自研；只对标 aily 的行为约定（按引脚能力约束连线、电源/地/信号分类）。
- [x] `WiringDiagramPanel.tsx`：SVG 由数据实时生成，未使用 aily 的组件、主题、图标或图片。
- [x] 对外文案只用「连线图」；对内类型名 ConnectionGraph。
- [x] 已替换（A2）：`public/xiao-esp32s3-sense-aily.webp`（旧目录封面）来源为 aily 板包，公开发布前需替换为自有/授权图片（见 public/THIRD_PARTY_MEDIA.md）。

- 板/元件包结构（`public/boards/*`、`public/components/*`：board.json / component.json + pinmap.json + 图片）仅借鉴 aily-blockly 板包的**目录组织思路**，所有 JSON、SVG 为 MakeFast 自写自绘；照片与官方引脚图来自 Seeed wiki（见 public/THIRD_PARTY_MEDIA.md）。
