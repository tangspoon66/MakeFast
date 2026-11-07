# 实现计划：ESP 在线开发平台

## 概述

本实现计划将 ESP 在线开发平台分解为可执行的开发任务。平台采用前后端分离架构：
- **前端**：React 18 + TypeScript + Vite，使用 Web Serial API 与 ESP32 设备通信
- **后端**：Python + FastAPI，提供云端编译服务和库管理

实现策略：先搭建基础架构，再实现核心功能（编译、上传），最后完善错误处理和用户体验。

## 任务列表

### 1. 项目初始化和环境搭建

- [x] 1.1 创建项目目录结构和初始化配置
  - 创建前端项目（Vite + React + TypeScript）
  - 创建后端项目（FastAPI + Python）
  - 配置 ESLint、Prettier、TypeScript
  - 配置 pytest、black、mypy
  - 创建 Docker Compose 配置文件
  - 创建 .gitignore 和 README.md
  - _需求：所有需求的基础_

- [x] 1.2 配置开发环境和依赖
  - 前端：安装 React、TypeScript、TailwindCSS、zustand、axios
  - 后端：安装 FastAPI、Uvicorn、Pydantic
  - 配置 Vite 开发服务器和代理
  - 配置 CORS 中间件
  - _需求：所有需求的基础_

- [x] 1.3 设置后端工具链初始化脚本
  - 实现 `scripts/init_toolchain.py`（安装 Arduino CLI 和 ESP32 核心）
  - 实现 `scripts/install_preinstalled_libs.py`（安装 20-30 个预装库）
  - 创建 Dockerfile 包含工具链初始化
  - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

### 2. 后端核心服务实现

- [x] 2.1 实现数据模型和 API 接口定义
  - 创建 Pydantic 模型：`CompileRequest`, `CompileResult`, `CompileError`, `LibraryInfo`
  - 定义 API 路由：`POST /api/compile`, `GET /api/firmware/{id}`, `GET /api/boards`, `GET /api/health`
  - 实现请求验证（代码长度限制、开发板 ID 验证）
  - _需求：1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2.2 实现库管理器（LibraryManager）
  - 实现 `is_preinstalled()` 方法检查预装库
  - 实现 `is_cached()` 方法检查库缓存
  - 实现 `download_library()` 方法（从 Arduino Library Manager 和 GitHub 下载）
  - 实现 `ensure_libraries()` 方法（确保所有库可用）
  - 实现 60 秒下载超时机制
  - _需求：3.7, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.3 实现编译服务（CompilationService）
  - 实现 `_parse_includes()` 方法（从代码中提取 #include 语句）
  - 实现 `_create_temp_project()` 方法（创建临时项目目录）
  - 实现 `_run_arduino_cli()` 方法（执行编译命令，60 秒超时）
  - 实现 `_parse_errors()` 方法（解析编译错误输出）
  - 实现 `_save_firmware()` 方法（保存固件文件）
  - 实现 `_cleanup()` 方法（清理临时文件）
  - 实现 `compile()` 主方法（整合所有步骤）
  - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2.4 实现 API 端点处理器
  - 实现 `POST /api/compile` 端点（接收编译请求，返回结果）
  - 实现 `GET /api/firmware/{id}` 端点（下载固件文件）
  - 实现 `GET /api/boards` 端点（返回支持的开发板列表）
  - 实现 `GET /api/health` 端点（健康检查）
  - 添加全局异常处理器
  - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 2.5 编写后端单元测试
  - 测试 `_parse_includes()` 函数（提取库名）
  - 测试 `_parse_errors()` 函数（解析编译错误）
  - 测试库名验证（防止路径遍历）
  - 测试请求验证（代码长度、开发板 ID）
  - _需求：1.5, 4.1, 4.2, 5.4_

- [ ]* 2.6 编写后端集成测试
  - 测试简单代码编译流程（无库依赖）
  - 测试带 WiFi 库的代码编译
  - 测试缺失库的错误处理
  - 测试编译超时处理
  - 测试库下载和缓存机制
  - _需求：3.7, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.6_

### 3. 检查点 - 后端服务验证

- [x] 3. 确保后端服务正常运行
  - 启动后端服务（`uvicorn main:app --reload`）
  - 验证 `/api/health` 端点返回正常
  - 使用 curl 或 Postman 测试 `/api/compile` 端点
  - 验证简单代码可以成功编译
  - 确保所有测试通过，询问用户是否有问题

### 4. 前端基础组件实现

- [x] 4.1 实现浏览器兼容性检查
  - 创建 `checkBrowserCompatibility()` 函数（检查 Web Serial API 支持）
  - 创建 `BrowserCompatibilityWarning` 组件（显示不支持警告）
  - 在应用启动时执行兼容性检查
  - 显示支持的浏览器列表和下载链接
  - _需求：8.1, 8.2, 8.3, 8.4_

- [x] 4.2 实现代码编辑器组件（CodeEditor）
  - 创建 `CodeEditor` 组件（使用 `<textarea>` 或 CodeMirror）
  - 实现 `getCode()`, `setCode()`, `clear()` 方法
  - 实现字符计数显示（当前/最大 50000）
  - 实现代码长度验证
  - 添加基本编辑功能（复制、粘贴、撤销、重做）
  - _需求：1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 4.3 实现开发板检测器组件（BoardDetector）
  - 创建 `BoardInfo` 接口（id, name, vid, pid, compileFlags）
  - 创建开发板数据库（至少 5 种 ESP32 开发板）
  - 实现 `detectBoard()` 方法（通过 Web Serial API 读取 VID/PID）
  - 实现 `matchBoard()` 方法（根据 VID/PID 匹配开发板）
  - 创建 `BoardSelector` 组件（手动选择开发板）
  - 实现自动检测失败时的降级逻辑
  - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.3.1 扩展后端支持所有 ESP 芯片系列
  - [x] 安装 ESP8266 核心包
  - [x] 扩展 SUPPORTED_BOARDS 列表（ESP8266, ESP32, ESP32-S2/S3/C3/C6/H2）
  - [x] 更新数据模型验证逻辑
  - [x] 测试 /api/boards 端点
  - [x] 实现芯片自动检测功能（使用 esptool-js）
  - [x] 创建芯片到开发板的映射表（按芯片系列分类）
  - [x] 实现一键检测按钮
  - [x] 实现自动选择开发板逻辑
  - [x] 创建 BoardSelector 组件（动态获取开发板列表）
  - [x] 添加 CSS 样式（芯片检测和开发板选择器）
  - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.3.2 添加 Arduino 开发板支持
  - [x] 验证 Arduino AVR 核心包已安装
  - [x] 添加 6 个常用 Arduino 板子到 SUPPORTED_BOARDS
    - Arduino UNO (arduino:avr:uno)
    - Arduino Nano (arduino:avr:nano)
    - Arduino Mega 2560 (arduino:avr:mega)
    - Arduino Leonardo (arduino:avr:leonardo)
    - Arduino Micro (arduino:avr:micro)
    - Arduino Pro Mini (arduino:avr:pro)
  - [x] 更新前端 BoardSelector 组件添加 Arduino 系列分组
  - [x] 测试开发板列表 API 返回 Arduino 板子
  - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.3.3 改进芯片检测体验（方案 C：混合检测）
  - [x] 实现智能检测逻辑
    - 0 个设备 → 引导式检测
    - 1 个设备 → 直接检测
    - 多个设备 → 引导式检测（推荐）
  - [x] 实现引导式拔插检测流程
    - 步骤 1：提示用户拔掉开发板
    - 步骤 2：提示用户插入开发板
    - 步骤 3：自动检测新插入的设备
  - [x] 添加引导式检测对话框 UI
  - [x] 添加引导式检测 CSS 样式
  - [x] 优化用户提示文案（适合小学生理解）
  - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.3.4 整合开发板选择和芯片检测功能
  - [x] 创建 BoardDetectionCard 组合组件
  - [x] 实现三种状态的 UI
    - 初始状态：显示"自动检测"按钮
    - 检测成功：显示检测结果 + 开发板选择器 + 重新检测按钮
    - 检测失败：显示错误信息 + 手动选择器 + 重新检测按钮
  - [x] 移动到侧边栏顶部（最重要的操作）
  - [x] 添加推荐标记（⭐）
  - [x] 添加对应的 CSS 样式
  - [x] 移除自动检测功能，改为纯手动选择（简化用户体验）
  - [x] 修复串口选择对话框刷新问题（移除 filters 参数）
  - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4.4 实现编译客户端（CompilationClient）
  - 创建 `CompilationClient` 类（封装 API 调用）
  - 实现 `compile()` 方法（POST /api/compile）
  - 实现 `downloadFirmware()` 方法（GET /api/firmware/{id}）
  - 实现错误处理和重试逻辑
  - 添加请求超时配置（编译 70 秒，下载 30 秒）
  - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 4.5 实现固件上传器组件（FirmwareUploader）
  - 创建 `FirmwareUploader` 类（使用 esptool-js）
  - 实现 `isSupported()` 方法（检查 Web Serial API）
  - 实现 `upload()` 方法（上传固件到 ESP32）
  - 实现上传进度回调（0-100%）
  - 实现设备复位逻辑（进入下载模式）
  - 实现错误处理（串口权限拒绝、设备断开等）
  - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ]* 4.6 编写前端单元测试
  - 测试代码验证逻辑（空代码、超长代码）
  - 测试开发板匹配逻辑（VID/PID 识别）
  - 测试浏览器兼容性检查
  - _需求：1.5, 2.1, 2.2, 8.1_

### 5. 前端状态管理和主界面

- [x] 5.1 实现全局状态管理（使用 zustand）
  - 创建 `EditorState` 接口（code, selectedBoard, isCompiling, isUploading, compileResult, uploadProgress）
  - 创建 `useEditorStore` hook（管理编辑器状态）
  - 实现状态更新方法（setCode, setBoard, setCompiling, setUploading, setCompileResult, setUploadProgress）
  - _需求：1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 5.5, 6.5_

- [x] 5.2 实现主界面布局和组件集成
  - 创建 `App` 组件（主应用容器）
  - 集成 `BrowserCompatibilityWarning` 组件
  - 集成 `CodeEditor` 组件
  - 集成 `BoardSelector` 组件
  - 添加编译按钮和上传按钮
  - 添加状态显示区域（编译中、上传中、成功、失败）
  - 使用 TailwindCSS 实现响应式布局
  - _需求：所有需求_

- [x] 5.3 实现编译流程逻辑
  - 实现编译按钮点击处理器
  - 验证代码和开发板选择
  - 调用 `CompilationClient.compile()`
  - 显示编译进度和状态
  - 处理编译成功（显示固件信息，启用上传按钮）
  - 处理编译失败（显示错误信息，高亮错误行）
  - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5.4 实现上传流程逻辑
  - 实现上传按钮点击处理器
  - 调用 `CompilationClient.downloadFirmware()` 获取固件
  - 调用 `FirmwareUploader.upload()` 上传固件
  - 显示上传进度（0-100%）
  - 处理上传成功（显示成功消息）
  - 处理上传失败（显示错误信息和解决建议）
  - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

### 6. 错误处理和用户体验优化

- [x] 6.1 实现友好的错误提示
  - 创建 `ErrorDisplay` 组件（显示编译错误）
  - 实现错误行号高亮
  - 添加常见错误的友好提示（如缺少库的提示）
  - 创建 `UploadErrorDisplay` 组件（显示上传错误）
  - 添加上传错误的解决步骤提示
  - _需求：5.4, 6.7_

- [x] 6.2 实现加载和进度指示器
  - 创建 `LoadingSpinner` 组件（编译中动画）
  - 创建 `ProgressBar` 组件（上传进度条）
  - 添加编译状态文本提示（"正在编译..."、"正在下载库..."）
  - 添加上传状态文本提示（"正在连接设备..."、"上传中 X%"）
  - _需求：5.5, 6.5_

- [x] 6.3 实现输入验证和用户反馈
  - 代码为空时禁用编译按钮
  - 代码超长时显示警告
  - 未选择开发板时禁用编译按钮
  - 编译未成功时禁用上传按钮
  - 添加操作确认提示（如清空代码）
  - _需求：1.5, 2.6, 5.1, 5.2_

- [ ]* 6.4 编写前端 E2E 测试
  - 测试完整编译流程（输入代码 → 选择开发板 → 编译 → 显示成功）
  - 测试编译错误显示（输入错误代码 → 编译 → 显示错误信息）
  - 测试浏览器兼容性警告显示
  - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4_

### 7. 检查点 - 端到端功能验证

- [x] 7. 验证完整的用户流程
  - 启动前端和后端服务
  - 测试浏览器兼容性检查
  - 测试代码输入和编辑
  - 测试开发板自动检测和手动选择
  - 测试简单代码编译（无库依赖）
  - 测试带库代码编译（如 WiFi 示例）
  - 测试编译错误显示
  - 测试固件上传流程（如果有 ESP32 设备）
  - 确保所有核心功能正常，询问用户是否有问题

### 8. 部署配置和文档

- [ ] 8.1 完善 Docker 部署配置
  - 创建前端 Dockerfile（多阶段构建）
  - 创建后端 Dockerfile（包含工具链初始化）
  - 完善 docker-compose.yml（前端 + 后端 + Nginx）
  - 配置 Nginx 反向代理和静态文件服务
  - 添加健康检查配置
  - _需求：所有需求_

- [ ] 8.2 创建部署文档和运维指南
  - 编写 README.md（项目介绍、快速开始、功能特性）
  - 编写 DEPLOYMENT.md（单机部署、生产部署步骤）
  - 编写 DEVELOPMENT.md（开发环境搭建、开发指南）
  - 编写 TROUBLESHOOTING.md（常见问题排查）
  - 添加架构图和流程图
  - _需求：所有需求_

- [ ] 8.3 配置 CI/CD 流水线
  - 创建 GitHub Actions 工作流（单元测试、集成测试）
  - 配置自动构建 Docker 镜像
  - 配置代码质量检查（ESLint、mypy、black）
  - 配置测试覆盖率报告
  - _需求：所有需求_

- [ ]* 8.4 添加监控和日志配置
  - 配置 Prometheus 指标收集
  - 配置日志轮转和持久化
  - 创建 Grafana 仪表板配置
  - 添加告警规则（编译失败率、队列长度）
  - _需求：所有需求_

### 9. 最终检查点

- [ ] 9. 最终验证和交付
  - 运行所有测试套件（单元测试、集成测试、E2E 测试）
  - 验证 Docker 部署流程
  - 检查代码质量和测试覆盖率
  - 验证所有 8 个 MVP 需求已实现
  - 更新文档和 README
  - 确保所有功能正常，询问用户是否准备好交付

## 注意事项

- 标记 `*` 的任务为可选任务，可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证，及时发现问题
- 前端使用 TypeScript，后端使用 Python
- 优先实现核心功能（编译、上传），再完善用户体验
- 测试任务为可选，但建议至少完成集成测试以确保核心流程正常

## 技术栈总结

**前端**:
- React 18 + TypeScript + Vite
- TailwindCSS（样式）
- zustand（状态管理）
- axios（HTTP 客户端）
- esptool-js（固件上传）

**后端**:
- Python 3.10+ + FastAPI
- Uvicorn（ASGI 服务器）
- Pydantic（数据验证）
- Arduino CLI（编译工具）

**开发工具**:
- Docker + Docker Compose
- ESLint + Prettier（前端）
- pytest + black + mypy（后端）
- GitHub Actions（CI/CD）
