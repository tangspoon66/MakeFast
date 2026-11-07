# MakeFast API Contracts（R6）

| 字段 | 值 |
|---|---|
| 状态 | 草稿 · **未落盘** |
| 日期 | 2026-10-10 |
| 风格 | 逻辑 REST；路径可调整，**资源语义锁定** |
| 禁止 | 对外路径/字段 `wiring-graph` / `wiringGraph` 作为产品资源名 |

---

## 1. 约定

- JSON；`schemaVersion` 出现在板与图资源。  
- 错误：`{ code, message, childMessage? }`（childMessage 给 UI）。  
- 鉴权：P0 可本地单用户；字段预留 `userId`。

---

## 2. Catalog

### `GET /courses`

Query: `category?=入门教程`

Response:

```json
{
  "items": [
    {
      "id": "first-lesson",
      "title": "…",
      "coverUrl": "…",
      "starDifficulty": 2,
      "tags": ["入门", "ESP32"],
      "category": "入门教程",
      "badge": "start_here"
    }
  ]
}
```

### `GET /courses/{courseId}`

课程详情 + 硬件需求文案（只读）。

### `POST /courses/{courseId}/sessions`

创建 CourseSession；**不**启动 GUIDING 直到客户端报 surface=workbench。

Response: `{ sessionId, agentState: "IDLE", surface: "catalog" }`

---

## 3. Board & Graph

### `GET /boards/{boardId}`

返回 BoardDocument（board.json 内容）。

### `POST /boards/{boardId}/validate-graph`

Body: ConnectionGraph  

Response: `{ ok: boolean, errors: [{ code, message, childMessage, edgeId? }] }`

### `GET /courses/{courseId}/connection-graph`

课包默认图。

### `PUT /sessions/{sessionId}/connection-graph`

保存学习者图快照；服务端跑 validate；非法可 422。

**命名：** 路径用 `connection-graph`；UI 文案仍「连线图」。勿暴露 `wiring-graph`。

---

## 4. Session / Agent / Toolchain

### `GET /sessions/{sessionId}`

完整 CourseSession。

### `PATCH /sessions/{sessionId}/surface`

Body: `{ surface: "workbench" | "catalog" | "quiz" | "detail" }`  

规则：进入 `workbench` → 允许 `agentState=GUIDING`；回 `catalog` → `IDLE` 并暂停引导。

### `PATCH /sessions/{sessionId}/guide`

Body: `{ action: "next" | "prev" | "retry_step", stepId? }`  
仅 surface=workbench。

### `PATCH /sessions/{sessionId}/toolchain`

Body: `{ phase: "board"|"connection"|"build"|"flash"|"serial", status, detail? }`

### `POST /sessions/{sessionId}/phenomenon-success`

Body: `{ source: "auto_serial" | "user_confirm" }`  
→ 可设 mainlineCompleted；agent → WRAP_UP；quiz 解锁。

---

## 5. Build / Flash / Serial（设备侧可本地桥）

逻辑端点（实现可 IPC）：

- `POST /sessions/{sessionId}/build`  
- `POST /sessions/{sessionId}/flash`  
- `GET /sessions/{sessionId}/serial/stream`（SSE/WebSocket）  

错误不得要求 quiz 答题。

---

## 6. Quiz

### `GET /sessions/{sessionId}/quiz`

主线未完成 → 403/409 `{ code: "QUIZ_LOCKED" }`

### `POST /sessions/{sessionId}/quiz/submit`

Body: `{ mcqAnswers: [{id, choiceIndex}], practicalConfirmed: boolean }`  

Response: `{ passed, mcqCorrect, badgesGranted[] }`  
规则对齐 F-QZ-03。

---

## 7. Agent 推送（可选）

`WS /sessions/{sessionId}/agent`  
事件：`guide_step`, `state_change`, `celebrate`  
目录态不下发 `guide_step`。

---

## 8. 废弃合同

| 旧 | 处置 |
|---|---|
| `/wiring-graph/**` | 废弃；改 `/connection-graph` |
| 字段 `fadeStage` / `autonomyLevel` | 禁止 |
| `POST .../quiz` 在引导步骤中 | 禁止 |

---

## 9. 验收

- [ ] 无对外 wiring-graph 资源名  
- [ ] validate 使用 BoardDocument  
- [ ] surface 门禁约束 Agent  
- [ ] quiz 主线锁  
- [ ] 目录六要素字段齐全  

---

## 10. 变更

| 2026-10-10 | R6 api-contracts 初稿 |
