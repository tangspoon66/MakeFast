# 上线前待办清单

> 生成日期：2026-05-12
> 状态：本地功能开发中，待统一修改

---

## 严重 🔴 上线前必须修

- [ ] **1. API Key 泄露** — `backend/.env` 里有一把活的 SiliconFlow key (`sk-dfczh...`)，虽然 `.gitignore` 里有 `.env`，但这个文件已经被 Git 追踪了（`M` 状态）。需要：
  - 去 SiliconFlow 后台重置/撤销这把 key
  - `git rm --cached backend/.env`
  - `git filter-branch` 或 `BFG Repo-Cleaner` 清除历史记录
  - 确保 `.env.example` 只是模板，不含真实 key

- [ ] **2. 路径穿越漏洞** — `routes.py:92`，`firmware_id` 参数无校验：
  ```python
  firmware_path = compilation_service.firmware_dir / firmware_id / filename
  ```
  `filename` 有白名单但 `firmware_id` 无任何检查。攻击者传 `../../etc/passwd` 可读任意文件。修复：校验 `firmware_id` 必须为合法 UUID 格式。

- [ ] **3. 零速率限制** — 所有端点无任何限流保护：
  - `/api/compile` — 无限并发编译消耗 CPU
  - `/api/ai/generate` — 无限调用消耗 AI API 额度
  - 建议用 `slowapi`（FastAPI 中间件）加 per-IP 限制
  - 编译：5-10 次/分钟，AI：10 次/分钟，总请求：100 次/分钟

---

## 高危 🟡 建议上线前修

- [ ] **4. 启动日志泄露 API Key 前缀** — `main.py:27`
  ```python
  logger.info(f"AI API Key loaded: {api_key[:20]}...")
  ```
  改为 `logger.info(f"AI API Key configured: {bool(api_key)}")`

- [ ] **5. `validate_library_name()` 定义了但从未调用** — `library_manager.py:381`
  `ensure_libraries()` 直接把用户代码中解析出的库名传给 `subprocess.run`，没有调用验证函数。虽然用了 list 参数不会注入 shell，但恶意库名仍可传给 `arduino-cli`。修复：在 `ensure_libraries` 中调用 `validate_library_name()`，并改用白名单正则 `^[a-zA-Z0-9_\-\. ]+$`。

- [ ] **6. Docker 容器以 root 运行** — Dockerfile 没有 `USER` 指令。修复：
  ```dockerfile
  RUN adduser --disabled-password appuser
  USER appuser
  ```

- [ ] **7. Docker Compose `uvicorn` 带 `--reload`** — 生产环境不需要自动重载，浪费资源且有安全风险。修复：去掉 `--reload`。

- [ ] **8. 原始异常信息返回客户端** — 多处 `error=str(e)` 泄露内部信息：
  - `routes.py:262` AI 端点错误直接返回
  - `routes.py:308` AI 流式端点异常
  - `compilation_service.py:556` 编译失败含详细路径
  - `ai_service.py:199` AI 生成失败泄漏详情
  - 修复：统一用全局异常处理器，返回通用错误消息

- [ ] **9. `subprocess.run` 阻塞异步事件循环** — `routes.py:47`
  改用 `await asyncio.to_thread(compilation_service.compile, ...)` 或改为 `def` 端点让 FastAPI 自动放线程池。

---

## 中危 🟠

- [ ] **10. 硬编码 macOS 路径** — `compilation_service.py:392`
  ```python
  arduino15_path = Path.home() / 'Library' / 'Arduino15' / 'packages' / 'esp32' / 'hardware' / 'esp32'
  ```
  Linux 上 Arduino15 路径是 `~/.arduino15`。需要根据操作系统调整或用环境变量 `ARDUINO_DATA_DIR`。

- [ ] **11. 固件文件无限堆积** — `/opt/firmware/` 下编译产物永不过期。加定时清理任务，删除超过 N 分钟/小时的固件。

- [ ] **12. 编译并发无限制** — 多个编译请求同时到达会各自 spawn `arduino-cli` 子进程，耗尽系统资源。加 `asyncio.Semaphore(3)` 限制最多 3 个并发编译。

- [ ] **13. Docker Compose 引用不存在的文件** — `docker-compose.yml` 里前端服务指定了 `Dockerfile.dev` 但文件不存在。

- [ ] **14. 缺少 `.dockerignore`** — 如果有 `.env`，`COPY . .` 会把它打进 Docker 镜像。需要创建 `.dockerignore` 排除 `.env`、`__pycache__`、`venv`、`tests` 等。

- [ ] **15. `curl | sh` 不安全** — `init_toolchain.py:65`
  ```python
  "curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh"
  ```
  应下载脚本后校验哈希，或改用包管理器（`apt install arduino-cli`）。

- [ ] **16. compose 未传 AI 环境变量** — `docker-compose.yml` 里后端服务没有设置 `OPENAI_API_KEY`、`OPENAI_API_BASE`、`AI_MODEL`，AI 功能在 Docker 中不可用。

---

## 低危 🟢

- [ ] **17. 前端 `console.log` 泄露信息** — `App.tsx`、`chipDetector.ts`、`firmwareUploader.ts` 中遗留了大量调试日志，含芯片型号、MAC 地址、AI 生成代码全文。生产构建时应清理或用条件编译。

- [ ] **18. `SerialPort` 存在 Zustand** — `editorStore.ts:detectedPort: SerialPort | null`，目前未持久化所以没问题，但将来如果加 `persist` 中间件会导致序列化失败。

- [ ] **19. AI 消息未做内容安全策略** — `AIAssistant.tsx` 直接将 AI 响应渲染为 React children（JSX 自动转义 HTML），但若将来加 `dangerouslySetInnerHTML` 会有 XSS。建议清洗内容或限制渲染方式。

- [ ] **20. `sudo` 在 Docker 中多余安装** — Dockerfile 第 9 行 `apt install sudo`，不需要。

- [ ] **21. 缺少 `HEALTHCHECK`** — Dockerfile 没有健康检查指令。

- [ ] **22. CORS 源硬编码** — `main.py` 的 `allow_origins` 列表全是 `localhost`，生产部署需要用环境变量配置实际域名。

- [ ] **23. 无统一配置系统** — 路径、超时、端口分散在各处硬编码，建议加 `config.py` 统一管理。

- [ ] **24. AI API 调用未显式指定 TLS 验证** — `ai_service.py` 使用 `httpx.AsyncClient()`，虽然默认验证 TLS，但建议明确写 `verify=True`。

---

## 生产部署需要的外部基础设施

- [ ] **25. 反向代理 + TLS** — nginx/Caddy 做 HTTPS 终止（Web Serial API 要求在 HTTPS 或 localhost 下才能用）
- [ ] **26. 反向代理层超时/大小限制** — 编译请求可能耗时 60s+，需要调整 proxy 超时
- [ ] **27. 请求体大小限制** — 最大代码 50000 字符，对应约 50KB，在 nginx 中设置 `client_max_body_size`

---

## 已确认安全的部分 ✓
- `CompileRequest` Pydantic 校验完善（board_id 白名单、代码长度限制）
- 固件文件名 `allowed_files` 白名单
- `subprocess.run` 使用 list 参数（非 `shell=True`）
- 全局异常处理器
- `board_config.py` 单一数据源设计
- 浏览器兼容性检测
- 代码结构清晰、关注点分离
