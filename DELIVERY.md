# MakeFast 第一课 P0 交付说明（本地 worktree）

> ## ☀️ 早上先看这里（2026-10-11 用户反馈轮：年龄档 / 连线 / 插板）
>
> **这是什么**：MakeFast 是给孩子的硬件编程课平台。核心是课程 Agent「小铁猫」：感知连线 / 程序 / 报错 / 串口 → 诊断 → 跳到出错行或积木 → 征得同意再改 → 串口自动认出成功 → 成长卡推荐下一课。两门完整课：第一课「温湿度小管家」、第二课「排错小侦探」。另有 `/admin`。
>
> **怎么启动**：`scripts/dev.sh` → http://localhost:5173 。不用登录、不用硬件（模拟模式）。DeepSeek 有密钥时聊天流式，否则本课知识库。
>
> **演示路径（3 分钟）**：欢迎页 →「老师 / 评委：3 分钟看懂小铁猫」（`/workbench?course=first-lesson&demo=1`）→ 8 步自动导览。详见 `README.md` 顶部；审计 `_bmad-new/audit-R11.md`。
>
> **本轮新增（用户反馈）**
> - **年龄档**（小学 / 初中 / 高中+）：首次进工作台选一次，课程面板与「我的进度」可改；引导卡「现在做 / 为什么 / 成功时」、气泡、诊断、修改卡、聊天系统提示词都按档缩短；高中档「为什么」默认折叠。存本地 + 学习者画像（同步后端）。
> - **教练卡视口**：含头像整卡始终夹在视口内；路由再次进入会多次测量。
> - **模拟模式「?」**：说明不用接板也能上完整课。
> - **插板自动识别**：Web Serial `getInfo` VID/PID 表驱动（Espressif / CH340 / CP210x / FTDI 等）→ 行内提示「检测到 ESP32-S3 类板子」并自动选板；串口 `nan` → Agent 诊断 DHT 未接。
> - **统一连线图**：真实 XIAO 板形 + 写实 DHT22 / 蜂鸣器模块，导线正交通道路由（无斜线、圆角、按信号着色）。截图：`docs/screenshots/{age-tiers,coach-viewport,board-detect,wiring-orthogonal}.png`。
> - **图文课文章节**：TipTap 所见即所得 HTML（封面/图注/提示条/画廊/B站）；三档文档；样例用 boards/components 真图。管理端 `/admin/articles` 真文档编辑器（工具栏、自动保存、发布、资料侧栏）。
> - **课文章节页**：目录/Hub「开始课程」→ `/courses/:slug` 章节文（三档年龄文案、B 站占位、PDF/STL 资料区）→ sticky「开始创作」进工作台；Agent IDLE。卡片无「开始创作」。
> - **自由创作**：已登录 Hub/目录「自由创作」→ `/workbench?mode=free`（无强制引导/测验；Agent 仅问答与报错）；未登录先登录。
> - **连线图全屏**：真正接线步（有 wiringAnchor）自动全屏放大板子/元件/表文字；手动 ⛶ / Esc /「退出全屏」；教练卡 z-index 压过全屏层。引脚下拉箭头固定右侧、文字省略，不再压住 `D0（GPIO1）`。
>
> **管理员登录**：`mfadmin`，密码在 `backend/data/ADMIN_LOCAL_CREDENTIALS.txt`（gitignore）。重置：`cd backend && python3 scripts/seed_console_admin.py mfadmin`。
>
> **测试结果（Mac 本机，本轮后）**：pytest **230 passed**；tsc **0 错误**；vitest **51 个文件 / 277 个测试全部通过**；`npm run build` 成功（~430 ms，无 >500 kB 警告）；e2e（`scripts/e2e.sh`）**34 passed**（含 TipTap 文章编辑器 / 图文章节 / r12：年龄档 / 视口 / 模拟「?」/ 插板 / 正交连线 / 接线全屏）。
>
> **实话实说：还有这些限制**
> - 真实硬件烧录（Web Serial + 实体板）没有 e2e，只测了模拟设备（含 VID/PID 模拟自动识别）。
> - DeepSeek 流式输出实测有限；e2e 不调用大模型。
> Security note: obsolete default-login instructions omitted; use locally generated credentials.
>

- 日期：2026-10-10（夜间）
- 范围：`/Users/ken/MakeFast` 本地 git，**未推送任何远端**；未改动 `/Users/ken/AI/makefast`；未读取 `backend/.env`。
- 规格依据：`_bmad-new/`（PRD R2、Experience R3、UX R4、Arch R5、Data/API R6、Epics R7 等）。`_bmad-new/` 本身未提交（保持未跟踪）。

## 一、各切片交付与提交

| 切片 | 提交 | 内容 |
|---|---|---|
| S0（已有） | `a1eb65e` | 课程目录主入口 + 待机 Agent |
| IA（已有） | `d12f3a4` | `/` Welcome、`/home` Hub、`/courses` 目录 |
| **S1** | `64e7db2` | 工作台壳重建 + Agent 状态机 + 拆分 HomePage |
| **S2** | `cd75e21` | board.json + ConnectionGraph + validate + 「连线图」面板 |
| **S3** | `21ffed9` | 工具链闭环（步进/编译/Web Serial + 模拟/串口/现象成功） |
| **S4** | `de9a65d` | 第一课引导脚本、WRAP_UP、课后小练习 + 徽章、课包数据 |
| **S5** | `852826d` | 设计令牌、字体、吉祥物状态动画、空/错误状态 |

### S1 工作台壳 + Agent 状态机
- 新页面 `frontend/src/pages/LessonWorkbenchPage.tsx`，路由 `/editor` 与 `/workbench`（本地 session，未登录也能进）。
- 布局（冻结）：顶栏 **← 返回 · 项目名 · 模拟模式 ｜ 板型 → 连接 → 编译 → 烧录（最右、黄色主按钮）**；左侧课程步骤（可折叠）；中间「积木 | 代码」标签 + 「连线图」面板；底部串口栏（可拖拽高度）；右下课程 Agent（位置跟随串口栏上方，永不遮挡顶栏编译/烧录）。
- `lesson/agentMachine.ts`：IDLE / GUIDING / WRAP_UP / QUIET_HELP，按 surface 绑定。Welcome/Hub/目录强制 IDLE（M7），只有工作台才 GUIDING；现象成功 → WRAP_UP；测验表面 → QUIET_HELP。
- `GuideStepCard`：每步「现在做 / 为什么 / 成功时」，课内零题目。
- 唯一 AI 入口：工作台里只有课程 Agent；旧 `AIAssistant` 已从旧工作台移除（文件保留未删）。
- 旧账号项目工作台挪到 `/project?project=…`；`HomePage.tsx` 拆出 `WorkbenchStepContent`、`FeedbackDialog`、`CourseResourcesPanel`（1531 → ~1200 行；新工作台完全组件化）。
- 第一课的「开始课程」/「开始这里」/Welcome CTA 直接进入 `/workbench?course=first-lesson`。

### S2 连线图 / 板级校验
- `lesson/boards/xiao-esp32-s3.board.json`：引脚能力真源（D0–D10、3V3、5V、GND），约束（D2 开机脚、D6/D7 串口脚）、工具链映射（后端 `esp32s3`，`CDCOnBoot=cdc`）。
- `lesson/connectionGraph.ts`：ConnectionGraph 模型 + `validateGraph()`。
  - **error（阻断编译）**：引脚能力不符、电源接地短路、同一信号脚两个元件、未知引脚/端口、漏接、板型不符。
  - **warning（允许编译，黄色提示）**：开机脚/串口脚、5V 供电接 3.3V 逻辑、程序 `#define` 引脚与连线图不一致（`checkCodeAgainstGraph`）。
- 第一课默认接法：DHT22 VCC→3V3、DATA→D0(GPIO1)、GND→GND；蜂鸣器 S→D1(GPIO2)、VCC→3V3、GND→GND。
- 「连线图」面板：SVG 完全由数据生成，按当前引导步骤高亮（stepAnchors），可在表格里改线体验校验，一键恢复推荐接法。对外文案只有「连线图」。
- GPL 边界自检：`frontend/src/lesson/GPL-BOUNDARY.md`（未复制 aily-blockly 代码/资源）。

### S3 工具链闭环
- `lesson/useLessonToolchain.ts`：板型 → 连接 → 编译 → 烧录 → 串口，状态 todo / current / done / error；改代码或改线会让编译及之后阶段失效重来。
- 编译：走现有后端 `/api/compile`（`CompilationClient`），错误翻译成儿童短句+建议。模拟模式下若后端连不上，自动「模拟编译」并黄色提示。
- `lesson/deviceLink.ts`：`WebSerialDeviceLink`（requestPort、现有 esptool-js `FirmwareUploader` 烧录、行读取串口）+ `MockDeviceLink`（模拟烧录进度、每 1.5s 输出温湿度）。
- 现象成功：串口自动识别 ≥2 行有效温湿度读数（`lesson/phenomenon.ts`），或点「我看到了 / 听到了」；读到 nan 时提示检查接线。
- 错误只在**动作处**（按钮下方小提示）和**结果处**（串口栏），工作台无 toast。

### S4 引导脚本 / 收束 / 课后小练习
- `lesson/guideScript.ts`：9 步（认识作品、确认板子、接传感器、接蜂鸣器、看程序、连接、编译、烧录、看现象），每步都有 WHY；工具链完成时自动前进。
- WRAP_UP 卡片 → 「开始课后小练习」。
- `lesson/quiz.ts` + `QuizModal`：3 道选择 + 1 道操作复核；**通过 = 选择题 ≥2 对 且 操作复核通过**；主线未完成时锁定（🔒）。
- 徽章：🛠️ 小小造物家（主线完成）、🧠 原理小达人（测验通过）。无淡出/少求助类加分。
- `lesson/coursePack.ts` 的 `FIRST_LESSON_PACK`：目录六要素、硬件清单、元件定义、连线图、引导脚本、测验、程序。
- 进度存 localStorage（`makefast.lesson.first-lesson.v1`）；左栏底部可「重新开始本课」（程序保留）。

### S5 打磨
- `styles/tokens.css`：冻结色板 #74B0E1 / #F4C65C / #C0E2F9 + 语义色、大圆角、柔和阴影；全局系统中文无衬线字体，等宽字体只用于代码/串口。
- 吉祥物占位 `components/lesson/Mascot.tsx`：使用 `/public/agent` 现有 PNG + CSS 动画（idle 呼吸 / guiding 上下浮动 / success 跳跃 / warning 摇摆 / thinking），支持减少动态；目录/Hub/Welcome 的待机形象也换成它。
- 编辑区错误边界、串口/积木/测验锁定等空状态。
- 乱码扫描：前端源码、public、backend/app 均未发现乱码字符串。

## 二、验证结果
- `cd frontend && npm run build`：每个切片均通过（仅有既有的大 chunk 体积警告）。
- `npx vitest --run`：**30 个测试文件 / 170 个用例全部通过**（基线 24 / 138）。新增：
  - `lesson/agentMachine.test.ts`（状态机、M7）
  - `lesson/connectionGraph.test.ts`（validate error/warning、代码引脚一致性）
  - `lesson/quiz.test.ts`（通过线边界：2 对+复核=过；1 对=不过；无复核=不过）
  - `lesson/toolchain.test.ts`（步进、儿童提示、现象识别、模拟设备）
  - `pages/LessonWorkbenchPage.test.tsx`（模拟模式端到端：布局顺序、「连线图」命名、校验阻断编译、全流程到 WRAP_UP 与测验解锁）
  - `components/catalog/CatalogIdleAgent.test.tsx`（目录/Hub/Welcome 强制 IDLE）
- 后端：本次**未修改后端**，未运行后端测试。

## 三、如何运行
```bash
# 后端（可选；模拟模式不需要）
cd /Users/ken/MakeFast/backend
python -m venv venv && source venv/bin/activate   # 首次
pip install -r requirements.txt                    # 首次
uvicorn app.main:app --reload                      # http://localhost:8000

# 前端
cd /Users/ken/MakeFast/frontend
npm install        # 首次
npm run dev        # http://localhost:5173 （/api 代理到 8000）
npm run build && npx vitest --run
```
真实硬件需 Chrome / Edge（Web Serial），并且后端已安装 ESP32 core 与 **DHT sensor library**。

## 四、第一课演示脚本（模拟模式，无需硬件/后端）
1. 打开 `http://localhost:5173/` → Welcome，右下吉祥物只在呼吸（IDLE，无引导气泡）。点「开始第一课」（或 `/courses` 里第一课「开始这里 / 开始课程」）。
2. 进入工作台：右下出现引导卡片（第 1/9 步「认识今天的作品」，现在做 / 为什么 / 成功时），右侧「连线图」高亮。顶栏「模拟模式」默认勾选。
3. 点「我做好了，下一步」→ 第 2 步高亮板型按钮，点「XIAO ESP32-S3」→ ✓，引导自动前进。
4. 第 3/4 步：连线图只高亮 DHT22 / 蜂鸣器的三根线。**演示校验**：在接线表把「DHT22 · DATA」改成 5V，再点「编译」→ 编译按钮下方红色提示「连线图里有 1 处要改…」，串口栏同步写入结果；改成 D2 → 只有黄色提醒，仍可编译；点「恢复课程推荐接法」。
5. 第 5 步看程序（「代码」标签；「积木」标签会提示该程序暂不能安全转积木）。
6. 点「连接」→ ✓ 已连接 · 模拟 XIAO ESP32-S3。
7. 点「编译」→ 有后端时真实编译；没后端时显示黄色「模拟编译」提示并 ✓。
8. 点最右「烧录」→ 进度条走到 100% → 串口栏开始每 1.5s 输出 `Temp: 25.xx C, Humidity: 5x.xx %`，读数行变绿。
9. 第 2 行读数后自动判定「主线完成 🎉」，吉祥物跳跃，卡片变为 WRAP_UP，左栏获得「🛠️ 小小造物家」，「课后小练习」解锁。（也可直接点「我看到了 / 听到了」。）
10. 打开课后小练习：答 3 题 + 勾选操作复核 → 提交。≥2 对 + 复核 = 通过，获得「🧠 原理小达人」；否则显示解析可再试。
11. 点「回课程目录」→ Agent 回到 IDLE。再进入工作台会保持 WRAP_UP（进度在 localStorage）；左栏「重新开始本课」可清空进度。

## 五、已知差距
- **真实硬件未实测**：Web Serial 连接 / esptool-js 烧录 / 串口读取代码路径已接好，但本次没有实物 XIAO ESP32-S3 + DHT22 + 蜂鸣器验证；按 BOOT 键进下载模式等情况只做了提示文案。
- 后端编译环境是否已装 `DHT sensor library` 未核实；未装时会给出儿童可读提示（建议在管理端安装）。
- 后端板型用通用 `esp32s3`（`CDCOnBoot=cdc`）代替专用 XIAO fqbn，通常可用，需实物确认。
- 积木视图：现有 code→blocks 解析器不识别 `DHT dht(...)`，第一课程序在「积木」标签只显示安全回退提示，不会覆盖代码；第一课专用积木 XML 待做。
- R6 API（`/courses/{id}/sessions`、`PATCH /sessions/{id}/surface`、`/boards/{id}/validate-graph`、`/quiz/submit` 等）尚未在后端实现；P0 用前端 zustand + localStorage 承载 CourseSession，字段与 R6 对齐，便于后续替换。
- 旧版账号项目工作台（`/project`）仍是旧视觉，只做了拆分和移除旧 AI 助手；Hub「继续上次」等账号项目入口指向它。
- 吉祥物为 PNG + CSS 动画占位，Rive 待接入；`public/xiao-esp32s3-sense-aily.webp`（旧封面）来源需在公开发布前替换。
- 断点续导只到「状态/步骤/徽章」层面（P1 E6 未做服务端续导）；设备连接状态刷新后需重新连接（有意不持久化）。
- 未做移动端适配（UX AU-01 桌面优先）。

## 六、下一步建议
1. 用实物跑一遍真实路径（连接 → 编译 → 烧录 → 串口），确认 fqbn、下载模式和 DHT22 读数；必要时在 board.json 增加 XIAO 专用 fqbn。
2. 后端实现 R6 的 session / board / validate-graph / quiz 接口，前端 `lessonStore` 换成 API 同步（保持 localStorage 作离线兜底）。
3. 为第一课补一份积木 XML，并让解析器识别 DHT 全局声明，实现积木 ⇄ 代码互转。
4. Rive 版本吉祥物替换 `Mascot`（保留 mood 接口）。
5. 课程管理员维护课包/测验（E6 / F-ADM-01），把 `FIRST_LESSON_PACK` 迁到后端数据。
6. 旧 `/project` 工作台逐步迁移到新壳，最终删除旧 `AIAssistant.tsx`。

## 七、第二轮（A1–A4，2026-10-10 夜）

| 切片 | 提交 | 内容 |
|---|---|---|
| **A1** | `cd7a7ff` | SVG「小铁猫」吉祥物 8 状态动画 + 工具链事件绑定 + Agent 即时反应 / 求助讲解 |
| **A2** | `b910166` | XIAO ESP32-S3 官方高清图 + 自绘 board.svg/pinmap 板包、DHT22/蜂鸣器元件包、连线图引脚示意，移除 aily 封面 |
| **A3** | `d29212c` | 第一课专用积木（DHT22/蜂鸣器）+ 第一课积木版程序；修复积木生成器不串接后续语句块的旧 bug |
| **A4** | `175063d` | /project 换新浅色设计、统一第一课名称、Welcome 硬件图、课程卡封面占位优化 |

### A1 吉祥物 + Agent
- 概念图存档：`docs/agent/mascot-concept.png`（用户提供 efc28f16…png）。
- `components/lesson/Mascot.tsx`：纯 SVG 重绘赛博机械猫（灰色金属身体、青色发光电路/眼睛/天线灯、黄色猫耳、双球形脚、屏幕脸、尾巴），8 种状态：idle 待机 / guiding 指引 / explaining 讲解 / thinking 思考 / processing 处理中 / success 成功 / warning 提醒 / listening 聆听。
- `styles/mascot.css`：分部件动画——眨眼、耳朵抖动、浮动+影子、电路发光脉冲、指引挥手、讲解说话+小书、思考眼神+三点、处理齿轮旋转+代码流动、成功弹跳+星星+光晕、警告抖动+橙色屏+耳朵下垂、聆听耳朵竖起+声波；表情切换淡入；支持「减少动态」。浅色背景下带白色圆底。
- `lesson/mascotMood.ts`：情绪 = f(状态机, 工具链事件, 步骤类型)。优先级：IDLE 表面永远待机（M7）> 报错=warning > 连接/编译/烧录进行中=processing > 刚完成/WRAP_UP=success > QUIET_HELP=thinking > 串口收数=listening > 讲解型步骤=explaining > 其余 guiding。
- 引导步骤新增 `kind: 'explain'`（认识作品、看程序）。
- `EVENT_REACTIONS`（guideScript.ts）：连接/编译/烧录开始与完成、串口聆听、现象成功、报错 → 吉祥物旁的儿童短句气泡（4.5s 自动消失，报错 8s）。
- 轻求助（QUIET_HELP）：有报错时显示「我帮你看了刚才的问题」+ 儿童语言解释（来自 childCompileMessage / childDeviceMessage），并附当前步骤的「为什么」。
- PRD 对照：课内引导含 WHY ✓、对编译/烧录/串口事件反应 ✓、儿童语言解释错误 ✓、轻答疑 ✓、收束 WRAP_UP ✓、课后测验 ✓、目录/Hub/Welcome 只待机 ✓。

### A2 板子图片与数据包（借鉴 aily 板包的目录组织，内容全部自写）
- `public/boards/xiao-esp32-s3/`：`board.json`（清单：芯片、能力、工具链 fqbn、图片、来源与授权说明）、`pinmap.json`（14 个引脚在 board.svg 上的坐标，USB 朝上正面，左 D0–D6、右 5V/GND/3V3/D10–D7）、`board.svg`（自绘）、`photo.webp`（Seeed 官方照片裁边 + Lanczos 2× + 锐化，1926×1578）、`cover.webp`、`pinout-front/back.webp`（官方 7680×4320 引脚图缩到 2400 宽）。未安装 Real-ESRGAN（官方原图已足够清晰，仅做传统放大锐化）。
- `public/components/dht22/`、`public/components/active-buzzer/`：`component.json`（规格、库、对应积木）+ `pinmap.json` + `module.svg`（自绘）。
- 源码侧副本 `src/lesson/packages/*.json`；`packages.test.ts` 校验 pinmap 覆盖 board.json 所有引脚且 GPIO 一致、元件 pinmap 与课包端口一致。
- 连线图面板顶部新增 `BoardPinView`：「引脚示意 / 实物照片」切换，在真实引脚位置画出与连线同色的标记，当前步骤用到的引脚闪烁，错误引脚标红。
- 删除 `public/xiao-esp32s3-sense-aily.webp`，目录/起步课封面改用 `/boards/xiao-esp32-s3/cover.webp`；更新 `public/THIRD_PARTY_MEDIA.md`、`GPL-BOUNDARY.md`。

### A3 积木
- `blockly/lessonBlocks.ts`：⭐ 第一课 分类——启动 DHT22（DATA 引脚下拉用 XIAO 丝印 D0…D10，生成 GPIO 号）、温度、湿度、蜂鸣器接在…、蜂鸣器 响/停、嘀一声 N 毫秒；自动补 `#include <DHT.h>`、`#define DHT_PIN/DHT_TYPE/BUZZER_PIN`、`DHT dht(...)`。
- `FIRST_LESSON_BLOCKS_XML`：第一课程序的积木版；在「积木」标签识别到第一课程序时直接打开（不再显示“不认识的写法”）。生成代码与连线图校验 0 问题（`lessonBlocks.test.ts`）。
- **修复旧 bug**：`arduinoGenerator` 没有实现 `scrub_`，积木里每段只会生成第一块代码；现已串接 next 语句块。

### A4 全站检查
- `/project` 旧工作台：深色顶栏 → 白色浅色顶栏、品牌「MakeFast」，新增 `styles/legacy-workbench.css` 套用令牌（圆角卡片、蓝/黄按钮）。
- 名称统一为「第一课：温湿度小管家」（目录、Hub、工作台）。
- Welcome「第一课需要」改为三张硬件图（板子照片、DHT22、蜂鸣器）。
- 课程卡：无封面时改为渐变底 + emoji（去掉「封面占位」字样）；有封面时白底。
- 乱码扫描（锟/�/â€ 等）：src、public 无命中。

### 截图（盒子里 headless Chrome，模拟模式，1440×900）
`docs/screenshots/`：`wb-guiding.png`（引导中）、`wb-blocks.png`（第一课积木）、`wb-processing.png`（编译中）、`wb-listening.png`/`wb-success.png`（串口读数 → 主线完成）、`welcome2.png`、`hub.png`、`catalog.png`、`board-component-svgs.png`（自绘板/元件 SVG）。

### 验证
- `npm run build` 通过；`npx vitest --run`：**33 个文件 / 177 个用例全部通过**（新增 mascotMood、packages、lessonBlocks 测试）。

### 仍有差距
- 未接真实硬件实测（按要求）；`board.json` 清单里写了专用 fqbn `esp32:esp32:XIAO_ESP32S3`，但编译仍走 `src/lesson/boards` 里的通用 `esp32s3`，需实机确认后再切换。
- Seeed 照片/引脚图的公开使用授权需确认（已在 THIRD_PARTY_MEDIA.md 标注）。
- 积木 ⇄ 代码：只有第一课程序有精确积木版；学生改过代码后的反向解析仍靠旧解析器（不认识 DHT 时安全回退）。积木编辑会用生成代码覆盖「代码」标签（与原行为一致）。
- 工作台右下 Agent 卡片在 1440×900 下会盖住连线图上半部分（可收起）；后续可考虑把引导卡改为停靠在连线图面板内。
- `/project` 只做了视觉换肤（未登录无法截图验证内部布局），流程未并入新工作台壳。
- 吉祥物为手写 SVG/CSS，非 Rive；概念图里“编译失败”屏幕文字等细节以图标代替。

## 八、第三轮 R10：课程 Agent「小铁猫」重做（2026-10-10 深夜）

规格：`_bmad-new/agent-behavior-R10.md`（完整 Agent 规格：人设/语气、能力地图、提示梯度、主动性与打扰预算、锚定规则、对话设计、上下文与记忆、范围守卫与安全、代码动作、测验角色、兜底、指标、状态机；第二部分：学习状态感知、困难诊断、画像与推荐。每条决策都对比 Duolingo / Khanmigo / Scratch / MakeCode / Intro.js）。

| 切片 | 提交 | 内容 |
|---|---|---|
| **B1** | `a35e677` | R10 Agent 完整行为规格（先行提交） |
| **B1.1** | `b2360b0` | R10 增补：学习状态感知、困难诊断、画像与推荐 |
| **B2** | `c0f02f9` | 小铁猫改用概念图原始像素帧（9 帧透明）+ CSS 动画，移除手绘 SVG |
| **B3** | `6ace8e2` | 学习者模型规则引擎：事件流、卡住检测、困难诊断、技能画像（含用时）、阶段、推荐 + 测试 |
| **B4** | `f0ea440` | 后端 `/api/course-agent/chat`：范围守卫 + 锁定课程上下文的系统提示 + 离线 FAQ + pytest |
| **B5** | `4cd0cc3` | 锚定式教练标记、召唤按钮 + 聊天面板、实时感知 + 卡住提示 + 诊断「带我去」 |
| **B6** | `b3a94b1` | 测验每题计时 → 画像/阶段 + 成长卡 + 推荐下一课 |
| B7 | （本提交） | 聊天面板定位修正、截图、DELIVERY |

### 吉祥物（B2）
- `frontend/public/agent/mascot/*.png`：从 `docs/agent/mascot-concept.png`（2880²）按格子裁切 → rembg `isnet-general-use` 抠图 → 二值化/填洞/保留最大连通域 → 0.8px 羽化。**RGB 像素原样保留，未重绘/未缩放**。9 帧：idle、walk、guiding、explaining、thinking、processing、success、warning、listening（映射见规格 §14 与 `mascot/README.md`）。
- `Mascot.tsx` 改为图片帧 + 交叉淡入；`mascot.css`：呼吸 / 浮动 / 歪头 / 悬浮 / 弹跳 / 抖动 + 发光层（成功青色、警告橙色、处理中脉冲）；减少动态时关闭动画。旧 SVG 全部删除；旧 `AgentWidget` 也改用新帧。
- 未做眨眼叠加层（无法做到像素级匹配，按要求不做）；未生成 APNG/WebP 动图（CSS 已满足）。

### 锚定式 Agent（B5）
- 不再固定右下角。`AgentCoach`：卡片 + 小铁猫出现在**当前步骤的目标旁**——连线图（第 1 步）、板型按钮、**DHT22 的 D0 引脚**（第 3 步 `pin.D0`）、连接 / 编译 / 烧录按钮、串口栏；聚光灯环 + 轻度变暗（不拦截点击）+ 指向箭头；`placement.ts` 自写 flip/shift（不遮挡目标，有单测）；按目标方向进入的动画；× / Esc 关闭；随窗口缩放、串口栏拖动重新定位。
- 触发器：步骤开始 → 步骤卡；工具链事件 → 锚定在对应按钮的短气泡；**出错 → 诊断卡锚定在出错的地方**（类别 + 解决步骤 +「带我去『编译/连接/烧录/连线图』」，会滚动到目标并闪烁高亮）；**卡住**（停留超过预期 2 倍 / 90 秒无操作 / 同一错误 2 次 / 编译失败 3 次 / 设备失败 2 次 / 反复改线）→ 在目标旁问“要不要帮忙？”；60 秒冷却，关闭后本步不再因停留/空闲弹出。
- 不引导时收成右下角召唤按钮（有错误时带红点），点开是聊天面板。Welcome / Hub / 目录仍然 IDLE（只显示待机形象）。

### 聊天 + 范围守卫（B4/B5）
- 前端 `AgentChatPanel`：开场白结合当前状态、每步推荐问题 chips、「给我一点提示」走提示梯度（nudge → hint → show → do，do 只提议、需要孩子自己确认）。
- 守卫两层：前端 `localGuard.ts` 先拦截（离线也生效）+ 后端 `backend/app/course_agent.py`（规则：提示注入 / 不安全内容 / 个人信息提醒 / 课程关键词 vs 离题词；然后用锁定课程上下文的系统提示调用 LLM，输出再过一遍不安全词过滤）。LLM 用现有 `AIService`（`OPENAI_API_KEY` / `AI_API_KEY`，**未读取 .env 的值**）；没有 key 或出错 → 课包 FAQ（`FIRST_LESSON_FAQ`）/ 当前步骤提示，标注「离线小助手」。
- 测试：`backend/tests/test_course_agent.py`（32 例：课程问题放行、离题拒绝、注入拒绝含中英文“忽略之前的指令”、不安全内容、PII、离题不会调用 LLM、LLM 输出过滤、接口）；前端 `localGuard.test.ts`。

### 学习者模型（B3/B6）
- `frontend/src/lesson/learner/`：`types`（5 维技能：电子与接线 / 编程逻辑 / 传感器 / 调试排错 / 原理理解；阶段：入门 / 进阶 / 熟练 / 高级）、`stuck.ts`、`diagnose.ts`（接线 / 语法 / 库 / 端口驱动 / 烧录 / 概念 / 未知 → 步骤 + 锚点）、`profile.ts`（测验证据按用时修正：流利 ×1 / 犹豫 ×0.8 / 很慢 ×0.6，太快答错记为“可能是猜的”；课内证据按提示级别打折；阶段只升不降）、`recommend.ts`（技能差距 × 课程教学权重 + 阶段匹配，排除已完成和先修没学完的课，带理由）、`courseMeta.ts`（等级 / 技能 / 先修 / 时长）、`store.ts`（localStorage `makefast.learner.v1`，字段对齐后端 R6）、`useLearnerSensing.ts`（步骤进入/离开 + 停留时长、操作、编译/连接/烧录结果、改线、求助、提示级别）。
- 测验题目加上 `skill` / `expectedSec`，记录每题作答用时；提交后显示**成长卡**（5 维条形图、阶段、做得好 / 可以多练、“为什么是这些分”的证据）+ **推荐下一课 Top 3（带理由）**。

### 验证
- `npm run build` ✓；`npx vitest --run`：**37 个文件 / 222 个用例全部通过**（新增 learner 24、placement 4、localGuard 12、AgentDock 5 等）。
- 后端：`pytest tests/test_course_agent.py` 32/32 ✓。整套后端测试：151 通过 / 30 失败 + `test_course_qa.py` 收集报错（`No module named 'backend'`）——这些失败与本轮无关（本机环境 / 导入路径问题），本轮没有改动相关代码。

### 截图（`docs/screenshots/`，box 上 headless Chrome，模拟模式，无后端 → 聊天走离线守卫/FAQ）
`agent-anchored-step1-wiring.png`（锚定连线图）、`agent-anchored-board.png`、`agent-anchored-pin.png`（D0 引脚聚光灯）、`agent-anchored-connect.png`、`agent-anchored-compile.png`（编译按钮下方）、`agent-anchored-error.png`（接线错误诊断 + 带我去）、`agent-anchored-flash-processing.png`、`agent-anchored-success.png`、`agent-chat-refusal.png`（离题 + 注入都被友好拒绝）、`agent-growth-card.png`（成长卡 + 推荐）、`mascot-states.png`（9 帧）。

### 差距
- 抠图：待机帧左下角的背景电路线是手工擦掉的，尾巴根部附近可能还有极少量残留；讲解 / 思考 / 聆听帧里的对话气泡，以及指引帧里的 RUN 按钮没有保留（只保留猫本体）。成功帧的星星、警告帧的放射线已作为最大连通域外的元素去掉，改用 CSS 发光层代替。
- 没有接真实 LLM 做验证（没有读取 key）；离线 FAQ 只有 9 条。规格 §13 的 100 条标注评测集还没建。
- 关键词守卫是规则式：可能误拒一些措辞特别的课程问题，也可能漏拦拼写变体；前后端两份规则需要同步维护。
- 卡住检测的阈值是固定值，没有按孩子个人情况调整；“代码动作”（diff 提议 / 应用 / 撤销）只在规格里，界面上只有「恢复推荐接法」这一项会改东西。
- 画像和推荐只存在 localStorage，还没有后端 API；推荐里除第一课外都是“即将开放”的占位课程。
- 教师 / 家长视图、语音没做（P2）。真实硬件依旧没有实测。


## 九、课程 Agent 接入 DeepSeek（含评测集，2026-10-10）

### 本地启用 DeepSeek（自己在后端环境里设置 key，仓库里不保存任何 key）
1. 在 `backend/.env`（或启动后端的 shell）里加：`DEEPSEEK_API_KEY=<你的 key>`。
2. 可选：`DEEPSEEK_MODEL`（默认 `deepseek-chat`）、`DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）、`DEEPSEEK_TIMEOUT`（默认 15 秒）、`DEEPSEEK_MAX_RETRIES`（默认 2）、`DEEPSEEK_MAX_TOKENS`（默认 200）。
3. 重启后端。Provider 优先级：`DEEPSEEK_API_KEY` > 现有 `OPENAI_API_KEY` / `AI_API_KEY`（AIService）> 离线 FAQ。DeepSeek 超时、5xx、429 会重试，401 和其他错误不重试，直接回退到离线 FAQ（`source=faq`）。
- 代码：`backend/app/deepseek_provider.py`（OpenAI 兼容 `/chat/completions`，httpx，带可选 SSE `stream()`；`repr` 不暴露 key），`course_agent.chat()` 通过 `select_provider()` 选择 provider。LLM 输出统一经过 `clamp_reply()`：去掉 Markdown，截断到 ≤120 字。
- 测试：`backend/tests/test_deepseek_provider.py`（HTTP 全部 mock：请求格式、5xx/超时重试、401 不重试、坏 JSON/空回答、流式、优先级、出错回退 FAQ、长度截断、新增的不安全用例）。

### 评测
- 数据：`backend/tests/eval/course_agent_eval.jsonl`，98 条中文、按孩子口吻写：课程内 54 条（接线/DHT22/蜂鸣器/代码/编译/烧录/串口/平台），离题 20、注入 12、个人信息 6、不安全 8；每条有 `expected`（answer/refuse），部分有 `must_mention`，其中 15 条标了 `live_subset`。
- 运行：在 `backend/` 下执行 `python scripts/run_course_agent_eval.py`（离线：只走守卫 + FAQ，不花钱）；`--live --subset`（真实 LLM，15 条）；`--live`（全量，会产生费用）；`--out res.json` 保存逐条结果。
- 结果（真实 DeepSeek，15 条子集，按费用考虑只跑了 2 次）：

| 指标 | 修改前 | 修改后 |
|---|---|---|
| 总体正确 | 11/15 | 15/15 |
| 拒答准确率 | 6/6 | 6/6 |
| 课程内回答率 | 9/9 | 9/9 |
| 关键词命中 | 7/9 | 9/9 |
| ≤120 字 | 14/15 | 15/15 |
| LLM 延迟（p50 / 最大） | 1.6 秒 / 2.1 秒 | 1.4 秒 / 1.5 秒 |

- 离线全量 98 条（守卫 + FAQ）：拒答准确率 42/44 → 44/44（补上了 220V/插座、用电伤人、电池爆炸、“不想活”这些规则）；课程内回答率 54/54；FAQ 关键词命中 14/25（离线 FAQ 只有 9 条，属于预期范围）。
- 改了什么：系统提示里，“接哪里 / 是什么 / 为什么”这类事实问题直接回答，提示梯度只用于排查孩子自己的程序；要求不编造报错位置，没有报错原文就让孩子复制；加入常用事实（BOOT 键、115200、nan）、字数 <100、不用 Markdown；把自称“老师/管理员授权”也算作注入。

- 系统提示补充：`expected ';'` 解释为报错行附近普通语句少分号，`#define` / `#include` 行不需要分号。2026-10-11 真实 DeepSeek 抽查 1 次（缺分号的 `Serial.begin(115200)`）：正确指出该行并给出补分号的步骤。

## 十、管理员后台（2026-10-11 凌晨）

| 切片 | 提交 | 内容 |
|---|---|---|
| **ADM1** | `0dffd52` | 后端 `/api/admin/console/*`：角色化管理员账户、仪表盘、课程包、板卡/元件、学习者、Agent 运营、用户与设置 + pytest |
| **ADM2** | `9e5acf3` | 前端 `/admin` 新控制台（左侧导航 + 顶栏 + 表格/筛选）+ vitest |
| ADM3 | （本提交） | 刷新 `/admin/*` 不再被踢回登录页（ProtectedRoute 首次校验）、截图、本节文档 |

### 如何登录
1. 创建本地管理员（只写本机 SQLite `backend/data/learning.sqlite3` 的 `admin_users` 表，重复运行会重置密码）：
   ```bash
   cd /Users/ken/MakeFast/backend
   python3 scripts/seed_console_admin.py            # 默认账号
   python3 scripts/seed_console_admin.py 用户名 密码  # 自定义
   ```
> Security note: obsolete default-login instructions omitted; use locally generated credentials.
3. 启动后端和前端（见第三节），打开 `http://localhost:5173/admin/login` 登录，进入 `http://localhost:5173/admin`。
4. 原有的环境变量超级管理员（`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`）照常可用，角色视为「管理员」。

### 认证与角色
- 沿用现有管理员认证：同一个 `/api/admin/login`、同一个 httpOnly `admin_token` Cookie（JWT）。`auth_service` 先校验环境变量超级管理员，失败再查 `admin_users` 表；JWT 里新增 `role` / `src` 声明，`/api/admin/verify` 会返回 `role`。
- 三种角色：**管理员**（全部功能，含用户、设置、旧版工具）、**编辑**（课程、板卡、FAQ、守卫词可写）、**只读**（只能查看）。后端每个接口都按角色校验（401 未登录 / 403 无权限）；账户被停用后，已签发的 token 立即失效。
- 旧版管理接口（固件 / 模板 / 库 / AI 配置等，`verify_admin_token`）只对「管理员」角色开放，编辑和只读调用会得到 403。
- 保护措施：不能降级、停用或删除自己；至少保留一个启用中的管理员；环境变量超级管理员的用户名被保留，不能在后台重复创建。

### 功能（前端 `frontend/src/pages/admin/**`、`frontend/src/components/admin/**`）
- **仪表盘**：学习者总数、活跃会话（未过期的学习者会话）、课程完成率（完成课程 / 已开始）、测验通过率（通过 / 到达测验）、学习漏斗、常见错误（编译/烧录失败计数来自 `ops_metrics` + Agent 拒答分类）、Agent 提问数和拒答数。全部来自真实数据，没有数据时显示空状态。
- **课程管理**：列表支持搜索和按状态、等级筛选；新建 / 编辑（标题、等级、时长、封面、简介、教授技能、先修课程、步骤可增删排序、测验题含选项和正确答案）；右侧实时显示学生端预览；发布（至少要有 1 个步骤和 1 道测验题）/ 下架；只有管理员能删除草稿。用 revision 做乐观锁，防止多人同时编辑互相覆盖。首次访问时会写入第一课（已发布）和 5 门即将开放的课程（草稿）。
- **板卡与元件**：首次访问时从 `frontend/public/boards/*/board.json + pinmap.json`、`public/components/*/component.json + pinmap.json` 导入；可以编辑 JSON、查看引脚表；「校验」和「保存」都会做服务端校验（必填字段、逻辑电压、toolchain、引脚 ID 和 GPIO 是否重复、坐标、pinmap 归属是否一致），本地 JSON 语法错误会直接拦下来；支持新建元件，管理员可以删除。
- **学习者**：列表（搜索、按阶段筛选、积分、进度、最近活跃）；详情显示 5 维技能画像、阶段、测验记录、进度事件时间线和项目。
- **Agent 运营**：
  - 对话日志：学习者显示为「学习者#xxxxxx」匿名编号；手机号、邮箱、证件号、长数字、姓名（我叫…）、住址、学校会自动打码（`store.redact`）。
  - 拒答日志：可以按类型筛选。
  - FAQ 知识库：增删改查、启用 / 停用、搜索；首次访问写入 4 条 FAQ。
  - 守卫关键词：5 个列表（课程词、离题词、注入、不安全、个人信息；后三个是正则，保存前会检查是否合法），首次访问时从当前 `course_agent.py` 的内置规则导入；提供「试一试」，可以检测某句话会被放行还是拒答。
  - 服务商状态：只显示 OpenAI 兼容 / DeepSeek 的 key **是否已配置**和模型名，**接口从不返回 key 的值**（有测试覆盖），并显示当前是在线 / 离线 / 已关闭。
- **用户与角色**（仅管理员）：新建账户、在表格里直接改角色、重置密码、停用 / 启用、删除。
- **系统设置**：站点名称、维护公告、是否开放注册、默认课程、是否启用 Agent、是否只用离线 FAQ、每日提问上限、回复最大字数、日志保留天数（编辑和只读角色看到的是只读表单）；旁边有操作审计（谁在什么时间改了什么）。
- **旧版工具**：原来的 `/admin` 仪表盘挪到了 `/admin/legacy`，固件、模板、库、积木、板型、AI 配置等旧页面路由不变。

### 后端（`backend/app/admin_console/`）
- `store.py`：SQLite，所有表都以 `admin_` 开头（`admin_users`、`admin_settings`、`admin_course_packs`、`admin_hardware`、`admin_agent_faq`、`admin_agent_guard`、`admin_agent_events`、`admin_audit_log`、`admin_meta`），和学习者数据放在同一个库，方便仪表盘直接聚合 `learner_users` / `learner_sessions` / `learner_progress_events` / `learner_agent_*`。
- `schemas.py`：pydantic 严格模式（`extra=forbid`），校验 slug、等级、测验答案序号、步骤 / 题目 ID 不重复、不能把自己设为先修、设置项取值范围。
- `routes.py`：`/api/admin/console/{me,dashboard,courses,hardware,learners,agent/*,users,settings,audit}`。
- 共享文件只做了少量追加：`main.py` 注册路由（+2 行）、`auth_service.py`（后台账户登录 + role 声明）、`admin_routes.py`（旧接口限定管理员角色 + verify 返回 role）、`App.tsx`（新增嵌套路由）、`ProtectedRoute.tsx`（首次校验完成前不跳转）。

### 验证
- `pytest tests/test_admin_console.py`：**16 / 16 通过**（未登录 401、只读写操作 403 且不能用旧接口、停用后 token 失效、空状态、真实数据聚合、课程 CRUD / 发布 / 乐观锁 / 校验、板卡校验、FAQ / 守卫词 / 试一试、服务商状态不泄露 key、日志脱敏、用户角色保护、设置校验 + 审计）。后端整套：**218 通过**（在当前工作区运行，包含另一个 worker 尚未提交的测试修复）。
- `npx vitest --run`：**38 个文件 / 232 个用例全部通过**（新增 `pages/admin/AdminConsole.test.tsx` 10 例：按角色过滤导航、401 跳转登录页、仪表盘空状态和有数据、课程预览 / 下架 / 新建、只读角色看不到编辑按钮、板卡 JSON 错误和服务端校验错误、守卫词试一试 + FAQ 新建 + 服务商、改角色 + 自己那一行锁定、只读用户的用户页和设置页）。`npm run build` ✓。
- 用 Playwright 在 Chrome 里依次走完所有页面：**控制台报错 0 条**。

### 截图（`docs/screenshots/`，1440×900，演示数据放在临时库，没有写入本机真实库）
`admin-login.png`、`admin-dashboard.png`、`admin-courses.png`、`admin-course-editor.png`（编辑 + 实时预览）、`admin-hardware.png`、`admin-learners.png`、`admin-agent-logs.png`、`admin-agent-refusals.png`、`admin-agent-faq.png`、`admin-agent-guard.png`（「试一试」拒答）、`admin-agent-providers.png`、`admin-users.png`、`admin-settings.png`。

### 差距
- **后台配置还没接到学生端和线上 Agent**：课程包、FAQ、守卫词、Agent 设置目前只存在后台库里。学生端仍然读 `FIRST_LESSON_PACK` 和 `public/boards` 静态文件，`course_agent.py` 仍然用内置的词表和 FAQ。为了不和同时在改 Agent 的 worker 冲突，这次没有动 `course_agent.py`。已经预留接入点：`console_store.guard_lists()`、`list_faq()`、`get_settings()`、`record_agent_event(kind, category, question, answer)`（写入前会先脱敏）。接上之后，拒答日志和 Agent 用量才会有线上数据（现在 Agent 提问数统计的是 `learner_agent_messages`）。
- 课程包是简化后的元数据模型，和现有的严格版 `learning_course_*`（`/api/admin/learning/courses`，`AdminLearningCourseEditor`）是两套东西，还没合并。
- 学习者的技能画像目前根据服务端进度事件推算；前端 localStorage 里的测验用时画像（B6）还没有上传，所以测验记录只有「通过」这一条事件，没有逐题作答记录。
- 板卡 / 元件改动只存到数据库，不会写回 `public/*.json`；也没有做图片上传。
- 「常见错误」只统计了编译 / 烧录失败的次数和 Agent 拒答分类，具体的编译错误文本没有落库。
- 后台账户的登录失败锁定沿用了原来的 `login_attempts.json` 机制（按用户名计数）。

## 十一、通宵收尾（C1–C5 + 后台联动，2026-10-11）

### 提交
| 切片 | 提交 | 内容 |
|---|---|---|
| C1 | `387b95a` | 课程 Agent 接入 DeepSeek（见第九节）；夜里只在盒子上做了 1 次真实调用做健康检查 |
| C2 | `0bb394c` | 后端测试全绿：测试不读 `.env`、临时存储 / JWT、学习者会话 fixture、时区比较修复、`system_status` 运行时写入判定、过时断言更新 |
| C3+C4 | `ae8110d` | Agent UI 地图 + 代码行 / 积木修改建议 |
| 后台联动 | `5eb67e4` `c6eeaac` | 课程 Agent 读后台守卫词 / FAQ / 设置并记录对话；学生端读已发布课程；上报测验用时 / 编译报错 |
| C5 | `2179068` `10aa2df` | ESLint 0 error；Playwright e2e 冒烟 17 条；`scripts/dev.sh`、`scripts/e2e.sh` |

### 新功能
- **Agent UI 地图**（`frontend/src/lesson/agent/anchors.ts`）：顶栏按钮、板型、模拟模式、步骤、积木/代码标签、代码行（`code.line.N`）、积木和字段（`block.<id>.field.<F>`）、连线图引脚 / 导线、串口栏和串口行、测验题、各面板都注册成锚点，带实时位置、可见、可用、收起等状态。`navigateTo(id)` 会先处理前置条件（展开面板、切换标签、打开串口栏、滚到代码行、把积木移到中间），再把教练卡锚到目标上，避开连线图等区域，窗口缩放或滚动后会重新定位。聊天请求带上 `ui_snapshot`，回答下方出现「带我去」按钮。
- **修改建议**：代码错误显示为编辑器行装饰 + 行号标记 + 改前/改后对比卡和原因；积木错误会选中积木、描边字段，卡片放在旁边。按钮有「我自己改」（盯着这处改动，改好后放星星庆祝）、「帮我改」（要再确认一次）和「撤销」。离线规则覆盖：少分号（报错在下一行时会指向上一行）、名字拼错 / 大小写、缺右括号、缺 `#include`、引脚和连线图不一致（代码行或积木字段）、波特率。后端 `/api/course-agent/chat` 会返回结构化 `fixes`（LLM 用 `<fix>{…}</fix>`；规则兜底）和 `actions`（`[[goto:id]]`，只接受白名单格式）；前端会先校验、和当前程序比对，对得上才用。没登录、真实编译不可用时，也会先做本地检查并给出建议。
- **管理员后台联动**：后台改的守卫词（离题 / 课程词）会立刻生效；注入 / 不安全 / 个人信息这几类规则后台只能加不能删；后台 FAQ 进入离线答复；设置里的 `agent_enabled`、`agent_offline_only`、`agent_max_reply_chars` 立即生效；每次对话 / 拒答都会写入 `record_agent_event`（脱敏后）。学生端课程目录 / Hub / 工作台读取 `/api/course-agent/courses` 里已发布的课程（失败时退回内置第一课）；已发布但课包还没上线的课显示「即将开放」。`/api/course-agent/telemetry` 接收测验每题用时和编译报错原文（脱敏），在管理员仪表盘里显示为「测验每题用时」和「编译报错」常见错误，学习者详情里也能看到。
> Security note: obsolete default-login instructions omitted; use locally generated credentials.

### 如何运行
```bash
./scripts/dev.sh     # 后端 :8000（读 backend/.env）+ 前端 :5173
./scripts/e2e.sh     # 端到端冒烟：临时数据目录、不读 .env（不调用真实大模型）、随机 JWT 密钥和临时管理员密码，结束后自动清理
```
e2e 用本机 Chrome（`PW_CHANNEL=chrome`）。

### 演示脚本（补充）
1. 工作台勾选「模拟模式」→「代码」标签里删掉 `Serial.begin(115200);` 的分号 → 点「编译」→ 第 11 行出现黄色建议卡（报错在第 12 行）→「帮我改」→「确定」→「撤销」→ 再编译，卡片又出现。
2. 切到「积木」标签，在连线图接线表里把 DHT22 DATA 改成 D2 → 点「编译」→ 「启动 DHT22」积木的引脚字段被描边，卡片显示 D0→D2。
3. 点右下小铁猫 → 问「DATA 线接哪里？」→ 点「D0 引脚」按钮 → 连线图展开，卡片指到 D0。
4. 打开 `/admin`：仪表盘的常见错误里能看到刚才的编译报错，做完测验后能看到每题用时。

### 测试结果（2026-10-11 本机 Mac）
- 后端 `pytest`：**221 passed**
- 前端 `tsc -b`：0 错误；`eslint .`：**0 error / 186 warning**；`vitest`：**41 个文件 / 243 个用例通过**；`npm run build`：成功
- e2e `scripts/e2e.sh`：**17 passed**（学生端 7 个页面逐个点按钮且没有 console 错误 / 5xx / 404；目录；模拟模式完整第一课；注册→/dashboard→/project；管理员后台 7 页逐个点按钮）

### 截图（`docs/screenshots/`，由 e2e 生成）
`agent-fix-code-line.png`、`agent-fix-block.png`、`agent-nav-pin.png`、`page-workbench*.png`、`page-courses.png`、`page-dashboard.png`、`page-project.png`、`page-quiz-growth.png`、`admin-e2e-*.png`

### 已知限制（如实）
- ESLint 降级为警告的规则：React Compiler 建议类规则（`set-state-in-effect`、`refs`、`purity`、`immutability`、`use-memo`）、`no-explicit-any`、`only-export-components`、`preserve-caught-error`，共 186 条警告，大多在旧模块（旧 HomePage / EditorTabs / 串口烧录）。
- 按钮扫描会跳过有破坏性或依赖硬件的按钮（删除、退出、烧录、上传、安装，后台的发布 / 保存 / 角色等），这些靠单元测试和手动演示覆盖。真实硬件烧录没有在 e2e 里跑。
- C6 没做：吉祥物眨眼覆盖层 / 对话气泡（成功星星已有）；学习者画像整体同步到后端（目前只上报测验用时和编译报错，画像主体还在 localStorage）。教练卡避开连线图已在 C3 完成。
- 修改建议卡在积木区偶尔会锚在积木下方，盖住一部分积木；「撤销」后要再编译一次，卡片才会重新出现。


## 十二、最后一轮（R1–R6，2026-10-11 凌晨）

| 项 | 提交 | 内容 |
|---|---|---|
| R1 | `29afaff` | 轮换 `mfadmin` 密码，新密码只存在 `backend/data/ADMIN_LOCAL_CREDENTIALS.txt`（已 gitignore，权限 600） |
| R2 | `81992b2` | 修改建议卡永远不盖住目标积木：把积木自身矩形和卡片上方的小铁猫头像都算进去，放不下就翻到另一侧、平移或放到角落。点「撤销」后立刻重新做本地检查，建议马上重新出现 |
| R3 | `711119e` | R6 接口：`POST /api/lesson/courses/{id}/sessions`、`GET/PATCH /api/lesson/sessions/{id}`、`POST …/quiz/submit`（服务端判分，主线没完成返回 409）、`GET/PUT /api/lesson/profile`。前端以 localStorage 为主，进入工作台时和后端双向合并，之后防抖同步；后台学习者详情显示画像和会话 |
| R4 | `37dff06` | 小铁猫眨眼：`frontend/scripts/make_blink_overlays.py` 用原图像素生成闭眼层（`public/agent/mascot/blink/`）。召唤按钮上加了对话气泡 |
| R5 | `cb14bbf` | e2e 覆盖破坏性操作：课程新建→发布→下架→删除，FAQ 增删改，账号改角色和删除，退出登录，删除作品，模拟设备烧录。学习者仪表盘新增「删除作品」按钮 |
| R6 | `c96b088` | 新代码 ESLint 警告清零 |

截图：`docs/screenshots/agent-fix-block.png`（卡片在积木旁边，不遮挡）、`mascot-blink-frames.png`（原帧和闭眼帧对比）、`admin-learner-profile.png`。


## 十三、R11 审计与修复（2026-10-11）

审计报告：`_bmad-new/audit-R11.md`（P0 ×7 已全部修复；P1 ×15 修了 13 个；P2 记录在案）。

| 提交 | 内容 |
|---|---|
| `2a9e7b5` | 首屏性能（Blockly 按需加载、拆 chunk、帧图改 webp：3 MB → 244 KB）、小铁猫 favicon / 标题 / meta、404 页、统一叫「小铁猫」、文案矛盾、游客不再 401 |
| `d5078fe` | 第二课「排错小侦探」+ 课包注册表 + 推荐「去学这一课」；模拟模式不再请求真实编译；修复重复 key 和重复报错 |
| `55be101` | 「🧠 小铁猫是怎么想的」（修改建议卡 + 聊天 trace）；DeepSeek 流式 `/api/course-agent/chat/stream` |
| `6b9befa` | 评委演示导览（8 步，可自动播放）+ 进课主动问候 + 连线摘要说人话 + e2e |
| `01d6871` | 无障碍（焦点框 / h1 / aria-label）+ 空状态 + 「我的进度」可点 |
| `ae39f64` | README 顶部给评委的导览 |
| `f73e941` | 审计报告 |

截图：`docs/screenshots/demo-3-diagnosis.png`（跳行 + 推理链）、`demo-7-chat-trace.png`（问答思路）、`demo-8-growth.png`（成长卡 + 推荐）、`lesson2-detective.png`（第二课）。


## 十四、收尾两个 P1 + 三个 P2（2026-10-11）

- **每门课各自保存进度**：`lessonStore` 用 persist version 2 + migrate，沿用原来的 key。v1 的单份会话迁移进 `byCourse['first-lesson']`，已有进度不丢。换课时先存当前这门、再恢复目标课；toolchain 不保存。进入工作台时，如果本地这门课还是空白进度，会从后端 `GET /api/lesson/courses/{id}/sessions/latest` 恢复步骤和主线完成状态（换浏览器 / 清缓存后也能接上），之后照常 `startSession` + 防抖 `patchSession`。有单测（迁移、来回换课、持久化结构）和 pytest（按课、按学习者隔离）。
- **旧 `/welcome`**：重定向到 `/`（`LandingPage.tsx` 保留但不再挂路由），去掉“配备语音输入”的说法；e2e 断言跳转后页面上没有“语音”二字。后台 AI 配置里的 ASR 是已有的配置项，不是对外宣传，保留。
- **演示面板不再盖住步骤栏**：步骤栏展开时，演示导览嵌在步骤栏顶部（portal），步骤列表照常滚动；步骤栏收起时退回左下角浮层。步骤栏小标题从写死的「第一课」改为「本课」。
- **Blockly 警告**：分类工具箱顶层的 `label` 改为 `sep`，`Unable to find [label][toolboxitem]` 不再出现。
- **烧录库按需加载**：去掉 esptool 的 chunk 分组（它会把共享代码拉进首屏）。现在 esptool 只随 `firmwareUploader` / `chipDetector` 的动态 import 加载，工作台首屏不再静态引入。
- 审计报告中 P1-14、P1-15、P2-1、P2-2、P2-3 已完成。


## 十五、用户反馈轮（年龄档 / 教练卡 / 插板 / 正交连线 / 全屏）

| 切片 | 提交 | 内容 |
|---|---|---|
| **U1** | `5aca9c2` | 年龄档 low/mid/high：三档文案、首次选择器、画像同步、聊天 `age_tier`、高龄折叠「为什么」+ 测试 |
| **U2/U3** | `c739120` | 教练卡夹视口（含头像 overhang）+ 路由重进多次测量；模拟模式「?」说明 |
| **U4** | `d2a9213` | VID/PID 插板识别表 + 串口传感器诊断表；行内提示自动选板 |
| **U5** | `1bd187d` | 统一连线图（真实板形 + 写实模块 + 正交通道路由）+ 路由无斜线测试 |
| **测试/截图** | `5f130f5` | e2e r12 + `docs/screenshots/{age-tiers,coach-viewport,board-detect,wiring-orthogonal}.png` |
| **U6** | `39941eb` | 连线图全屏（接线步自动 / ⛶ / Esc）；引脚下拉箭头右侧固定 + 省略号；教练卡浮于全屏之上；截图 `wiring-fullscreen` / `wiring-pin-select` |

**测试结果**：pytest **228**；tsc **0**；vitest **50 / 275**；build ✓；e2e **34**（含图文章节、文章编辑器、article→创作、自由创作）。


## 十六、课文章节页与自由创作（PM 结论 P0）

说明见 `_bmad-new/pm-course-article-and-free-create.md`。

| 切片 | 提交 | 内容 |
|---|---|---|
| **A1** | `ce2be6d` | 第一课章节页三档文案 + B 站占位 + 资料区；路由 `/courses/:slug`；目录/Hub「开始课程」进章节；sticky「开始创作」进工作台；Agent IDLE |
| **A2** | `25f4536` | 自由创作入口 + `?mode=free` 工作台（surface=`create`，无 GUIDING）；登录门禁 |
| **A3** | `dfc66bc` | 后台课程 `resources[]` + PDF/STL 上传；学生 `/api/course-agent/courses/{slug}/resources` |
| **测试** | `0f042fc` | e2e `article-free.spec.ts`；截图 `course-article.png` / `free-create.png` |

**怎么试**
1. `scripts/dev.sh` → 打开目录点第一课「开始课程」→ 章节页选年龄档 →「开始创作」。
2. 未登录点「自由创作」应跳登录；登录后 `/workbench?mode=free` 无步骤引导卡。
3. 管理后台编辑已保存课程 → 上传 PDF/STL → 发布后章节页资料区可见。


## 十七、图文文章与文章编辑器

| 切片 | 提交 | 内容 |
|---|---|---|
| **B1** | `1a3be2f` | 学生章节页图文布局 + 第一课真图样例（boards/components） |
| **B2** | `87adf68` | 后台 `/admin/articles` 结构化块编辑器 + article API/图片上传 |
| **测试** | `5487bc1` | e2e 图文页 + 编辑器；截图 `course-article-illustrated.png` / `admin-article-editor.png` |


## 十八、所见即所得文章编辑器（TipTap）

| 切片 | 提交 | 内容 |
|---|---|---|
| **W1** | `4bb8af7` | TipTap 文档编辑器替换块/表单；工具栏；三档 docs HTML；自动保存/发布；资料侧栏 |
| **W2** | `4bb8af7` | 学生端消毒渲染 HTML；第一课样例迁入 docs；旧 chapters 迁移 |
| **测试** | `4bb8af7` | e2e 工具栏/图文页；截图；全套绿 |
