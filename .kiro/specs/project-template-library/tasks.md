# 实现计划: 项目模板库 (Project Template Library)

## 概述

本实现计划将项目模板库分解为可独立完成的编码任务。系统采用与固件管理系统相同的架构模式：FastAPI 后端 + React 前端，文件系统存储 + JSON 元数据。实现顺序：后端数据模型 → 后端服务层 → 后端 API 路由 → 前端 API 客户端 → 前端用户页面 → 前端管理员页面 → 集成。

## 任务

- [x] 1. 后端数据模型与服务层
  - [x] 1.1 创建模板数据模型 (Pydantic Models)
    - 创建 `backend/app/template_models.py`
    - 实现 `TemplateSourceFile` 模型（name, content 字段）
    - 实现 `TemplateMetadata` 模型（template_id, name, description, category, tags, supported_board_ids, published, created_at, updated_at, file_count, total_size）
    - 实现 `TemplateDetail` 模型（继承 TemplateMetadata，包含 files 列表）
    - 实现 `TemplateListResponse` 分页响应模型
    - 实现 `TemplateCreateRequest` 和 `TemplateUpdateRequest` 请求模型
    - 实现 `TemplateErrorCode` 错误码枚举
    - _需求: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5, 9.5, 9.6_

  - [x] 1.2 创建模板管理服务 (TemplateManager)
    - 创建 `backend/app/template_manager.py`
    - 实现 `__init__` 方法（存储路径初始化、缓存配置）
    - 实现 `create_template` 方法（生成 UUID、验证、存储元数据和源文件）
    - 实现 `get_template_detail` 方法（读取元数据和源文件内容）
    - 实现 `update_template` 方法（部分更新、保留 template_id 和 created_at）
    - 实现 `delete_template` 方法（删除目录及所有文件）
    - 实现 `get_template_list` 方法（分页、筛选、搜索）
    - 实现 `_validate_metadata` 方法（名称长度、描述长度、分类长度、标签数量、board_id 验证）
    - 实现 `_validate_files` 方法（扩展名、文件大小、文件数量、非空内容）
    - _需求: 1.1-1.7, 2.1-2.6, 5.1-5.7, 7.2-7.4, 8.1-8.3, 9.1, 9.2, 9.6_

  - [x] 1.3 实现 ZIP 上传功能
    - 在 `backend/app/template_manager.py` 中添加 `create_from_zip` 方法
    - 实现 ZIP 格式验证
    - 实现解压大小限制检查（1MB）
    - 实现文件扩展名过滤（仅 .ino, .cpp, .h, .c）
    - 实现目录结构扁平化（仅保留文件名）
    - 实现无有效源文件时拒绝上传
    - _需求: 3.1-3.6_

  - [ ]* 1.4 编写 TemplateManager 单元测试
    - 测试模板创建（有效/无效元数据）
    - 测试模板读取和详情获取
    - 测试模板更新（部分更新、保留 ID 和时间戳）
    - 测试模板删除（文件清理验证）
    - 测试列表筛选（category, tags, board_id, search）
    - 测试分页逻辑（total_pages 计算）
    - 测试 ZIP 上传（有效/无效 ZIP、大小限制、扩展名过滤、目录扁平化）
    - 测试文件验证（扩展名、大小、数量、空内容）
    - _需求: 1.1-1.7, 2.1-2.6, 3.1-3.6, 5.1-5.7_

- [x] 2. 后端 API 路由实现
  - [x] 2.1 实现公共模板路由
    - 创建 `backend/app/template_routes.py`
    - 实现 `GET /api/templates`（列出已发布模板，支持 category, tags, board_id, search, page, page_size 参数）
    - 实现 `GET /api/templates/{template_id}`（获取模板详情含源文件）
    - 仅返回 published=True 的模板给未认证用户
    - 实现参数验证和错误响应
    - _需求: 5.7, 8.2, 8.3, 9.1, 9.2, 9.5, 9.6_

  - [x] 2.2 实现管理员模板路由
    - 创建 `backend/app/template_admin_routes.py`
    - 实现 `GET /api/admin/templates`（管理员列出所有模板，含未发布）
    - 实现 `POST /api/admin/templates`（创建模板，JSON 方式）
    - 实现 `POST /api/admin/templates/upload-zip`（ZIP 上传创建模板）
    - 实现 `PUT /api/admin/templates/{template_id}`（更新模板）
    - 实现 `DELETE /api/admin/templates/{template_id}`（删除模板）
    - 实现 `PATCH /api/admin/templates/{template_id}/publish`（切换发布状态）
    - 所有端点使用 `verify_admin_token` 依赖进行认证
    - _需求: 7.1-7.6, 8.1-8.4, 9.3, 9.4_

  - [x] 2.3 注册路由到主应用
    - 在 `backend/app/main.py` 中注册 `template_routes` 和 `template_admin_routes`
    - 确保路由前缀和标签正确配置
    - _需求: 9.1-9.6_

  - [ ]* 2.4 编写 API 路由测试
    - 测试公共列表端点（筛选、分页、仅返回已发布）
    - 测试公共详情端点（存在/不存在的模板）
    - 测试管理员 CRUD 端点（认证保护、输入验证）
    - 测试 ZIP 上传端点（有效/无效文件）
    - 测试发布状态切换
    - 测试错误响应格式
    - _需求: 7.1, 8.2, 8.3, 9.1-9.6_

- [x] 3. 检查点 - 后端完成
  - 确保所有后端测试通过，询问用户是否有问题。

- [x] 4. 前端 API 客户端与类型定义
  - [x] 4.1 创建模板 API 客户端
    - 创建 `frontend/src/api/templateApi.ts`
    - 定义 TypeScript 接口（TemplateListItem, TemplateDetail, TemplateListResponse, TemplateCreateRequest, TemplateUpdateRequest, TemplateSourceFile）
    - 实现 `templateApi.list(params)` 方法
    - 实现 `templateApi.getDetail(id)` 方法
    - 实现 `templateApi.adminList(params)` 方法
    - 实现 `templateApi.create(data)` 方法
    - 实现 `templateApi.uploadZip(formData)` 方法
    - 实现 `templateApi.update(id, data)` 方法
    - 实现 `templateApi.delete(id)` 方法
    - 实现 `templateApi.togglePublish(id, published)` 方法
    - _需求: 9.1-9.6_

- [x] 5. 前端用户端页面实现
  - [x] 5.1 创建模板卡片组件
    - 创建 `frontend/src/components/TemplateCard.tsx`
    - 显示模板名称、描述（截断）、分类标签
    - 显示支持的开发板列表
    - 显示标签（tags）
    - 显示文件数量和总大小
    - 实现"使用模板"按钮
    - _需求: 5.1, 6.1_

  - [x] 5.2 创建模板筛选组件
    - 创建 `frontend/src/components/TemplateFilter.tsx`
    - 实现分类下拉筛选
    - 实现标签多选筛选
    - 实现开发板筛选下拉框
    - 实现搜索输入框（300ms 防抖）
    - 显示当前筛选结果总数
    - _需求: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.3 创建模板库页面
    - 创建 `frontend/src/pages/TemplateLibrary.tsx`
    - 集成 TemplateFilter 和 TemplateCard 组件
    - 实现分页控件
    - 实现加载状态和空状态显示
    - 实现错误处理和重试
    - 添加路由配置 `/templates`
    - _需求: 5.1-5.7, 9.6_

  - [x] 5.4 实现模板加载到编辑器功能
    - 在 TemplateCard 或模板详情中实现"使用模板"点击处理
    - 实现未保存内容确认对话框
    - 实现获取模板详情（含源文件）
    - 实现设置 EditorTabs 文件列表
    - 实现设置活动标签为第一个 .ino 文件
    - 实现设置开发板为模板支持的第一个 board
    - 实现导航到编辑器页面 `/`
    - _需求: 6.1-6.5_

  - [ ]* 5.5 编写用户端组件测试
    - 测试 TemplateCard 渲染
    - 测试 TemplateFilter 筛选逻辑
    - 测试模板库页面加载和分页
    - 测试模板加载到编辑器流程
    - _需求: 5.1-5.7, 6.1-6.5_

- [x] 6. 检查点 - 用户端前端完成
  - 确保用户端模板浏览和加载功能正常，询问用户是否有问题。

- [x] 7. 前端管理员页面实现
  - [x] 7.1 创建管理员模板列表页面
    - 创建 `frontend/src/pages/AdminTemplateList.tsx`
    - 显示所有模板表格（名称、分类、发布状态、文件数、创建时间）
    - 实现发布状态切换开关
    - 实现编辑按钮（导航到编辑页）
    - 实现删除按钮（含确认对话框）
    - 实现"创建模板"按钮
    - 添加路由配置 `/admin/templates`
    - _需求: 7.1, 7.5, 7.6, 8.4_

  - [x] 7.2 创建管理员模板表单组件
    - 创建 `frontend/src/components/TemplateForm.tsx`
    - 实现元数据表单（名称、描述、分类、标签、支持的开发板、发布状态）
    - 实现多文件代码编辑器（添加/删除/重命名文件）
    - 实现文件扩展名验证（仅 .ino, .cpp, .h, .c）
    - 实现表单验证（字段长度、必填项）
    - 实现保存前预览
    - _需求: 4.1-4.4, 7.2_

  - [x] 7.3 创建管理员模板创建页面
    - 创建 `frontend/src/pages/AdminTemplateCreate.tsx`
    - 集成 TemplateForm 组件
    - 实现 JSON 方式创建模板
    - 实现 ZIP 上传创建模板（拖拽或选择文件）
    - 实现创建成功后导航到列表页
    - 添加路由配置 `/admin/templates/create`
    - _需求: 4.1-4.4, 7.2, 9.3, 9.4_

  - [x] 7.4 创建管理员模板编辑页面
    - 创建 `frontend/src/pages/AdminTemplateEdit.tsx`
    - 复用 TemplateForm 组件
    - 实现加载现有模板数据预填充表单
    - 实现更新模板（部分更新）
    - 实现更新成功后导航到列表页
    - 添加路由配置 `/admin/templates/:id/edit`
    - _需求: 7.3, 7.5_

  - [ ]* 7.5 编写管理员页面测试
    - 测试模板列表页面渲染和操作
    - 测试模板表单验证
    - 测试创建流程（JSON 和 ZIP）
    - 测试编辑流程（数据加载和更新）
    - 测试删除确认和执行
    - 测试发布状态切换
    - _需求: 4.1-4.4, 7.1-7.6, 8.1-8.4_

- [x] 8. 检查点 - 管理员前端完成
  - 确保管理员模板管理功能正常，询问用户是否有问题。

- [x] 9. 集成与导航
  - [x] 9.1 添加模板库导航入口
    - 在主导航栏中添加"模板库"链接
    - 在管理员侧边栏中添加"模板管理"链接
    - 确保路由配置完整（用户端和管理员端）
    - _需求: 5.1, 7.5_

  - [x] 9.2 初始化脚本和存储配置
    - 更新 `backend/.env.example` 添加 `TEMPLATE_STORAGE_PATH` 配置项
    - 确保 TemplateManager 初始化时自动创建存储目录
    - 更新 `docker-compose.yml` 添加模板存储卷映射（如需要）
    - _需求: 2.1, 2.6_

- [x] 10. 最终检查点
  - 确保所有功能正常运行，询问用户是否有问题或需要调整。

## 注意事项

- 任务标记 `*` 的为可选测试任务，可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号，确保可追溯性
- 检查点任务用于增量验证，确保每个阶段完成后系统稳定
- 后端遵循 `FirmwareManager` 的设计模式，使用文件系统存储 + JSON 元数据
- 前端复用现有的 EditorTabs 组件实现模板加载到编辑器
- 所有管理员端点使用现有的 `verify_admin_token` 认证机制

## 技术栈

- **后端**: Python 3.10+ FastAPI, Pydantic, zipfile 标准库
- **前端**: React 18, TypeScript, React Router v6, TailwindCSS
- **存储**: 本地文件系统 (源文件), JSON 文件 (元数据)
- **认证**: 复用现有 JWT Token 认证机制

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4"] },
    { "id": 3, "tasks": ["2.1", "2.2"] },
    { "id": 4, "tasks": ["2.3", "2.4"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3", "5.4"] },
    { "id": 8, "tasks": ["5.5", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3", "7.4"] },
    { "id": 11, "tasks": ["7.5", "9.1", "9.2"] }
  ]
}
```
