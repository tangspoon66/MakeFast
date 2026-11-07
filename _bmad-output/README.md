# MakeFast BMAD 项目产物

本目录是 MakeFast 产品重构与 Agent MVP 的 BMAD 规划基线，按分析、规划、方案设计和实施管理分层。它结合仓库现状与已确认的产品决策；尚未实现的目标均以需求/Story 记录，不代表代码已经具备该能力。

## 文档导航

- [Project Context](project-context.md)：现有系统、约束和规划原则。
- [Research Notes](analysis/research-notes.md)：盘点来源、发现和待核实问题。
- [Product Brief](planning-artifacts/product-brief.md)：产品定位、用户和 MVP 成功条件。
- [PRD](planning-artifacts/prd.md)：范围、需求、指标和验收条件。
- [Rewards & Pilot Metrics](planning-artifacts/rewards-and-pilot-metrics.md)：首发积分、徽章、递减规则、三阶段掌握路径和试用目标。
- [Design](planning-artifacts/design.md)：设计方向与评审清单。
- [Experience](planning-artifacts/experience.md)：体验循环、模式和硬边界。
- [UX Design Specification](planning-artifacts/ux-design-specification.md)：信息架构、页面、工作台、课程和 Agent 交互。
- [Architecture](solutioning-artifacts/architecture.md)：目标架构和技术决策。
- [Data Model](solutioning-artifacts/data-model.md)：持久化领域模型和迁移原则。
- [API Contracts](solutioning-artifacts/api-contracts.md)：拟新增接口和访问边界。
- [Epics & Stories](implementation-artifacts/epics-and-stories.md)：按依赖排序的交付计划和验收标准。
- [Sprint Status](implementation-artifacts/sprint-status.yaml)：故事状态基线。
- [Current Phase Guide](implementation-artifacts/current-phase-guide.md)：用简单中文说明当前阶段、每个 Story 的目标、完成标准和下一步。
- [Implementation Readiness](solutioning-artifacts/implementation-readiness.md)：跨文档检查结果与开工门槛。

## 状态约定

- `planned`：已列入路线图，尚未实现。
- `in-progress`：实现中。
- `review`：实现完成，待验收/评审。
- `done`：测试和验收条件已通过。
- 只有代码、测试和产品验收均有证据时，才能将 Story 设为 `done`。

本目录不宣称由仓库中不存在的 BMAD CLI 自动生成；它是遵循 BMAD 分析 → 规划 → 设计 → 故事拆分 → readiness → sprint 的结构化产物。每次需求变更需同步更新相关文档和 sprint 状态。

## 当前实施说明

`ST-101` 和 `ST-102` 已完成并通过定向验证。当前进入 `ST-201`：让登录后的项目与学习总览读取服务器保存的数据。每个 Story 开始前先读[当前阶段指南](implementation-artifacts/current-phase-guide.md)，完成后记录代码、验证结果和下一步。
