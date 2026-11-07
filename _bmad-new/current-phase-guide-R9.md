# MakeFast Current Phase Guide（R9 刷新草案）

| 字段 | 值 |
|---|---|
| 状态 | 草稿 · **未落盘** |
| 日期 | 2026-10-10 |
| 当前阶段 | **P0 第一课快乐路径** |
| 目标里程碑 | **M-P0** |
| 故事真源 | R7（仅 `ST-E*`） |
| 就绪真源 | R8 |
| 协调 | makefast |
| 产品 | MakeFast 需求（本角） |
| 界面 | 374c30b5-42a5-481f-b978-ff513975e35b |
| 功能 | e0e7576f-b9c9-4c57-be3c-49cacab2eaa6 |
| 监工 | bb536969-1f61-4f03-9573-de5643255460 |

---

## 1. 阶段一句话

做出：目录选课（Agent 静默）→ 进课 WHY 引导 → 连线图 + board.json 校验 → 连接/编译/烧录/串口 → 现象成功 → 课后测验。

---

## 2. 本阶段不做

- 引导淡出体系、过程 quiz  
- 对外 Wiring Graph / 搬 aily 壳  
- 重开色板与顶栏顺序  
- 把旧 ST-303/403 或冲突 done 当进度  

---

## 3. 建议执行序（强制建议）

```text
S0 E1 目录
  → S1 E2 边界（E2-01/02）
  → S2 E3 连线（E3-04 合规并行）
  → S3 E4 工具链+现象
  → S4 E2 收尾（E2-03/04）+ E5 测验
```

与协调要求一致：**E1 → E2边界 → E3 → E4 → E2收尾 → E5**。

---

## 4. 每日站会看什么

1. **M7**：目录是否仍静默（监工抽检）  
2. 当前 slice 故事 ID（只用 ST-E*）  
3. R8 缺口 G-01…06 是否挡当前 slice  
4. 有无复活旧 ST / wiring-graph / fade 字段  

---

## 5. Slice 出口标准

| Slice | 出口 |
|---|---|
| S0 | 卡片六要素+开始课程；**M7 过** |
| S1 | 仅工作台 GUIDING；回目录 IDLE |
| S2 | 连线图文案正确；validate(board.json) 通 |
| S3 | 工具链可走通；现象成功（自动或确认） |
| S4 | 失败无 quiz 门闩；测验锁+3+1+徽章 |

---

## 6. 状态机规则（看板）

- Active sprint 列 **只允许** R7 ID。  
- ST-303 / ST-403 = `superseded`（归档列，不计 velocity）。  
- 旧 done 与 NEW 冲突 = `superseded`，需重做则开新 ST-E*。  
- P1（E6）进 backlog，不进 P0 完成定义。  

---

## 7. 文档索引（bot box 路径，未落用户仓）

| 文档 | 路径 |
|---|---|
| R7 | `/workspace/makefast-bmad-r0-r1/epics-and-stories-R7.md` |
| R8 | `/workspace/makefast-bmad-r0-r1/implementation-readiness-R8.md` |
| R9 status | `/workspace/makefast-bmad-r0-r1/sprint-status-R9.yaml` |
| R9 guide | 本文件 |

落盘到 `/Users/ken/AI/makefast/_bmad-output/` 需用户/协调明确授权。

---

## 8. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | R9 草案：superseded 旧项；P0 sprint 仅 R7；序 E1→E2边界→E3→E4→E2收尾→E5 |
