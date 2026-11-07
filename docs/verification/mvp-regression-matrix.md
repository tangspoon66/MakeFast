# MakeFast MVP 回归矩阵

这份矩阵对应 BMAD `ST-701`。命令在仓库根目录执行。

| 区域 | 自动验证 | 手工/硬件门禁 |
| --- | --- | --- |
| 学习者账号 | `backend/venv/bin/python -m pytest -q backend/tests/test_learner_auth.py` | 注册、退出、刷新后会话恢复 |
| 游客边界 | `backend/venv/bin/python -m pytest -q backend/tests/test_learning_courses.py` | 游客不能看到源码、工作台、Agent 和下载入口 |
| 项目与进度 | `backend/venv/bin/python -m pytest -q backend/tests/test_learning_projects.py backend/tests/test_learning_progress.py` | 两个浏览器同时保存时旧版本不覆盖新版本 |
| Agent 对话与提案 | `backend/venv/bin/python -m pytest -q backend/tests/test_learning_agent.py` | 对话按项目隔离；提案必须预览后明确应用；版本变化时拒绝；可撤销 |
| 课程 schema | `backend/venv/bin/python -m pytest -q backend/tests/test_learning_courses.py` | 只有已核验素材、pinmap 和连接才能发布 |
| 代码/积木边界 | `cd frontend && npx vitest run src/blockly/codeToBlocksParser.test.ts` | 不可转换代码保留原代码并显示行号和限制 |
| 工作台/Agent 锚点 | `cd frontend && npx vitest run src/components/workbench/AgentOverlay.test.tsx src/components/workbench/WorkbenchShell.test.tsx` | 角色跳到真实控件旁；控件隐藏时安全回退 |
| Agent 无障碍语义 | `cd frontend && npx vitest run src/components/AgentWidget.test.tsx` | 实时播报只包住消息；输入框、下拉框、提案按钮仍按正常 Tab 顺序进入 |
| 课程面板 | `cd frontend && npx vitest run src/pages/WorkbenchStepContent.test.tsx src/pages/LearnerDashboard.test.tsx` | 材料点击确认可刷新恢复；键盘可操作；窄屏无横向溢出 |
| 前端构建 | `cd frontend && npm run build` | 生产构建产物在本地预览检查乱码、字体和资源路径 |
| 真实接线 | 不能用纯软件测试替代 | 固定 XIAO ESP32-S3 Sense、三针 DHT11、三针 3.3V 有源蜂鸣器；逐个引脚和坐标核对，实测编译、烧录、串口、启动短响 |

## 验收记录格式

每次发布记录日期、提交/构建标识、测试命令输出、课程版本、素材核验人、硬件套件 SKU、浏览器和结果。硬件未核验时记录为 `blocked`，不能填写 `verified`。

## 2026-09-28 软件回归记录

- 前端全量测试：`cd frontend && npm test`，`23 files / 135 tests passed`。
- 前端生产构建：`cd frontend && npm run build`，通过（Vite 构建完成；仅有 chunk 大小提示）。
- 管理员兼容回归：`cd frontend && npm test -- src/pages/AdminDashboard.test.tsx src/pages/AdminFirmwareList.test.tsx`，`2 files / 23 tests passed`。
- 学习闭环前端定向套件：`cd frontend && npx vitest --run src/components/workbench/AgentOverlay.test.tsx src/components/workbench/WorkbenchShell.test.tsx src/components/workbench/WiringGraphViewer.test.tsx src/components/SerialToolbar.workbench.test.tsx src/pages/WorkbenchStepContent.test.tsx src/pages/LearnerDashboard.test.tsx src/hooks/useLearnerProject.test.tsx`，`7 files / 17 tests passed`（已包含在全量结果中）。
- Agent 视口回归：目标控件在视口外时，测试确认先调用真实控件的 `scrollIntoView({ block: "center", inline: "nearest" })`，再定位角色；未找到目标时仍使用安全浮动位置。
- 后端学习闭环定向套件：`PYTHONPATH=. backend/venv/bin/python -m pytest backend/tests/test_learning_agent.py backend/tests/test_learning_progress.py backend/tests/test_learning_courses.py backend/tests/test_learning_projects.py backend/tests/test_learner_auth.py -q`，`18 passed`。
- 完整前端套件：已无失败项。管理员固件页面、旧统计 fixture 和登录加载状态的兼容回归已修复；token 仍只保留在内存并依赖 HttpOnly 会话，不写入 localStorage。
- 当前仍未完成的质量门：真实课程硬件烟测；硬件不能由软件或浏览器测试替代。
- 工作台设备调试回归：右侧旧 `AI 对话` 入口在 debug-only 模式下显示为“设备调试”；串口监视器、执行日志、清空日志和 legacy AI 事件隔离测试通过。
- Agent 模式回归：guided 项目进入工作台或切换步骤时自动展开 Agent；autonomous 项目保持收起；代码转积木失败时保留代码并说明可继续在“代码编程”中修改和烧录。
- 首课硬件门禁：`blocked`。XIAO ESP32-S3 Sense 的板卡渲染图已有；DHT11、蜂鸣器、成品图和实物引脚/编译/烧录/串口/短响证据未核验，因此不能发布具体接线指导。

## 2026-09-28 无障碍回归补充

- Agent 气泡不再把包含输入框、对话选择和提案按钮的交互区域标成整块 `role=status`；实时播报收窄到消息段落，并使用 `aria-live="polite"`。
- 浏览器 AX 树确认课程步骤、材料复选框、Agent 输入/发送、设备调试开合和顶部连接设备均有可读名称；材料复选框支持键盘激活。
- 组件回归：`AgentWidget`、`AgentOverlay`、`WorkbenchShell` 共 `3 files / 5 tests passed`。
- 仍待真实硬件烟测；未将浏览器键盘验收当作接线或 Web Serial 验收。

## 2026-09-28 浏览器验收补充

- 本地地址：`http://127.0.0.1:5173`，使用临时本地学习账号进入 `/dashboard` 和带项目 ID 的 `/editor`；未访问或修改线上环境。
- 新手模式进入工作台后 Agent 自动展开；切换到材料、接线、积木、代码步骤时，角色状态、目标提示和中间面板同步变化。接线步骤在硬件未核验时明确显示警告，接线指导和设备动作保持禁用。
- 材料卡可点击确认；未全部确认时“再确认材料”保持禁用。材料确认文案明确表示这是用户确认，不是系统自动识别实物。
- 代码编程与积木编程可切换。输入包含未识别全局声明的代码后切换积木，页面保留代码并显示“有 1 处代码无法转换成积木……原代码已保留，请在代码编程中烧录”。
- 顶部保留“连接设备”和“设备设置”；右侧只显示“设备调试”、串口/波特率/编译/上传/日志，不再显示旧 AI 对话入口。
- 浏览器窄屏检查：`innerWidth=466` 时 `documentElement.scrollWidth=466`，无横向溢出；完整 390px 用例由前端 WorkbenchStepContent 回归覆盖。
- Agent 透明状态素材的 PNG alpha 通道已检查，角色使用独立状态文件，不把整张角色状态图当作头像；素材公开发布仍需补充最终来源/许可记录。
- 浏览器验收发现并修正：尚未绑定已发布课程版本的本地原型项目可以保存练习，但不会再误调用正式积分接口并弹出“项目不存在或没有绑定课程”。只有绑定不可变课程版本的项目才记录正式进度和奖励。
