# MakeFast 一键造物 · 给评委的 3 分钟导览

> **一句话**：MakeFast 是给孩子的硬件编程课。课程 Agent「小铁猫」会一直**感知**孩子的连线图、程序、编译报错和串口输出，出错时**诊断**原因、**直接带孩子到出错的那一行 / 那块积木**，讲清楚为什么，征得同意后才帮忙改（可一键撤销）。下课后它根据答题、用时、提示次数和修错过程生成**成长卡**，并**推荐**真的能直接去学的下一课。

## 怎么跑起来（本机，无需硬件）

```bash
scripts/dev.sh            # 同时起后端 :8000 和前端 :5173，Ctrl+C 一起停
# 浏览器打开 http://localhost:5173
```

不需要登录、不需要开发板：工作台默认「模拟模式」。配置了 `DEEPSEEK_API_KEY` 时聊天走 DeepSeek（流式打字）；没配时自动用本课知识库和本地规则，所有功能照样能演示。

## 3 分钟演示（推荐）

打开欢迎页，点 **「老师 / 评委：3 分钟看懂小铁猫」**（或直接打开 `/workbench?course=first-lesson&demo=1`），然后点「下一步」或「自动播放」：

| 步骤 | 你会看到 Agent 做了什么 |
|---|---|
| ① 主动迎接 | 进课时小铁猫主动打招呼，说明它会看连线、程序、串口 |
| ② 手滑删掉分号 | 制造最常见的第一课错误 |
| ③ 感知 → 诊断 → 跳行 | 编译器报“第 12 行 expected ';'”，小铁猫知道少分号会报在下一行，直接带到**第 11 行**，显示改前/改后和原因；展开「🧠 小铁猫是怎么想的」能看到完整推理链 |
| ④ 征得同意再改 | 「我自己改」（盯着、改对庆祝）或「帮我改」（需确认，可撤销） |
| ⑤ 工具链 | 连接 → 编译 → 烧录，每步都有即时反应 |
| ⑥ 自动认出成功 | 从串口读数自动判断主线完成 |
| ⑦ 问答 + 带我去 | 回答结合当前步骤/程序/串口，附「带我去」按钮和「思路」说明 |
| ⑧ 成长卡 + 推荐 | 5 维技能分 + 推荐理由；点「去学这一课」进入第二课「排错小侦探」 |

所有操作都发生在真实界面上（脚本只是替你点按钮），Agent 的反应全部来自真实逻辑，没有预录。

## 值得一看的地方

- **第二课「排错小侦探」**（`/workbench?course=debug-detective`）：程序里藏了 3 个 bug（少分号 / 函数名拼错 / 引脚冲突），整节课就是 Agent 带着读报错。
- **积木模式**：把连线图里 DATA 改到 D2 再编译，修改建议会贴在对应积木的引脚格子旁边，且不挡住积木。
- **安全边界**：问离题或不安全的问题会被礼貌拒绝（本机先拦一次，服务端再拦一次），拒答记录脱敏后进入后台。
- **管理员后台** `/admin`：课程发布、FAQ（改完学生聊天立即生效）、安全词、学习者画像与会话、每题用时、常见编译错误。管理员密码在本机 `backend/data/ADMIN_LOCAL_CREDENTIALS.txt`（不进 git）。

## 测试

`cd backend && python3 -m pytest -q` · `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx vitest --run && npm run build` · `scripts/e2e.sh`（临时库、不读 .env，覆盖每个页面的每个按钮、演示 8 步、后台增删改）。详细结果和已知限制见 `DELIVERY.md`。

---

# MakeFast ESP 在线开发平台

MakeFast 是一个面向 Arduino / ESP 教学和创客课程的在线开发平台。用户可以在浏览器里编辑代码、使用积木视图、在线编译、通过 Web Serial 烧录开发板，也可以从课程代码库打开管理员发布的课程资源。

## 主要功能

- 在线代码编辑：支持 `.ino`、`.cpp`、`.h`、`.c`、`.hpp` 多文件项目，本地自动保存。
- 积木视图：内置常见 Arduino / ESP / 传感器 / 执行器积木，支持从代码转换到积木视图。
- 在线编译：后端基于 Arduino CLI 和 ESP 工具链编译，低配服务器可限制并发。
- 浏览器烧录：使用 Web Serial API 直接连接 ESP32/ESP8266 等开发板。
- 课程资源库：管理员上传课程代码、文档资料、源代码、3D 打印模型或自定义资源包。
- 管理后台：课程、固件、开发板、Arduino 库、自定义积木、AI 配置、用户反馈和运行统计。
- 单机部署：生产环境支持 Docker Compose、Redis、SQLite 运行统计、可选 S3 兼容对象存储。

## 技术栈

- 前端：React 19、TypeScript、Vite、TailwindCSS、Blockly、esptool-js
- 后端：Python 3.10、FastAPI、Arduino CLI、SQLite、Redis
- 部署：Docker Compose、Caddy 自动 HTTPS、Nginx 内部反向代理

## 本地开发

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

访问：

- 用户端：http://localhost:5173
- 管理后台：http://localhost:5173/admin
- API 文档：http://localhost:8000/api/docs（需要设置 `ENABLE_API_DOCS=true`）

## 生产部署

生产环境请使用 `docker-compose.prod.yml`。入口服务是 Caddy，会为 `makefast.cn` 自动申请和续期免费的 Let's Encrypt / ZeroSSL 证书；Nginx 保留在 Docker 内部用于限流、缓存和安全响应头。

详细步骤见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

## 关键生产配置

- `ENV=production`
- `ALLOWED_ORIGINS=https://makefast.cn`
- `COOKIE_SECURE=true`
- `REDIS_URL=redis://redis:6379/0`
- `COMPILE_CONCURRENCY=1`
- `OBJECT_STORAGE_ENABLED=false`，课程资源增长后再切到腾讯 COS / 阿里 OSS / Cloudflare R2 等对象存储。

## 浏览器要求

烧录功能依赖 Web Serial API，推荐使用 Chrome 或 Edge。公网生产环境必须通过 HTTPS 访问，`localhost` 是浏览器允许的开发例外。
