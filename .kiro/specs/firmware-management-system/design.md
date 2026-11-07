# 设计文档 - 固件管理和分发系统

## 概述

固件管理和分发系统是 ESP 在线开发平台的扩展功能模块,为管理员提供固件包上传、管理和配置的能力,为用户提供固件浏览、搜索和一键烧录的体验。系统采用前后端分离架构,复用现有的 Web Serial API 烧录功能和开发板配置,通过本地文件系统存储固件和 JSON 文件管理元数据。

### 设计目标

1. **简单部署**: 使用本地文件系统存储,无需额外数据库
2. **安全可控**: 管理员认证保护,防止未授权访问
3. **用户友好**: 直观的固件浏览和一键烧录体验
4. **可扩展性**: 支持版本管理、标签分类和统计分析

### 技术栈

**前端**:
- React 18 + TypeScript
- React Router v6 (新增路由管理)
- TailwindCSS (UI 样式)
- Heroicons (图标库)
- 复用现有的 FirmwareUploader (Web Serial API)

**后端**:
- Python 3.10+ FastAPI
- Pydantic (数据验证)
- Passlib + JWT (认证)
- Pillow (图片处理)
- 本地文件系统 (固件存储)
- JSON 文件 (元数据存储)

## 架构

### 系统架构图

```mermaid
graph TB
    subgraph "前端 Frontend"
        A[用户固件库页面<br/>/firmware/*]
        B[管理员界面<br/>/admin/*]
        C[FirmwareUploader<br/>Web Serial API]
    end
    
    subgraph "后端 Backend API"
        D[认证中间件<br/>JWT Token]
        E[固件管理 API<br/>/api/firmware/*]
        F[管理员 API<br/>/api/admin/*]
        G[AI 配置 API<br/>/api/admin/ai-config]
    end
    
    subgraph "存储层 Storage"
        H[固件文件系统<br/>/opt/firmware/{firmware_id}/]
        I[元数据 JSON<br/>metadata.json]
        J[缩略图<br/>thumbnail.png]
        K[后端配置<br/>.env]
    end
    
    A -->|浏览/搜索| E
    A -->|烧录| C
    C -->|下载固件| E
    B -->|上传/管理| F
    B -->|配置 AI| G
    F -->|验证| D
    G -->|验证| D
    E -->|读取| H
    E -->|读取| I
    F -->|写入| H
    F -->|写入| I
    F -->|写入| J
    G -->|写入| K
```

### 目录结构

```
/opt/firmware/                          # 固件存储根目录
├── {firmware_id_1}/                    # 固件包目录
│   ├── metadata.json                   # 项目元数据
│   ├── metadata.json.bak               # 元数据备份
│   ├── bootloader.bin                  # ESP32 bootloader
│   ├── partitions.bin                  # 分区表
│   ├── boot_app0.bin                   # Boot app0
│   ├── app.bin                         # 应用程序
│   ├── firmware.hex                    # Arduino AVR 固件 (可选)
│   └── thumbnail.png                   # 缩略图 (可选)
├── {firmware_id_2}/
│   └── ...
└── .stats.json                         # 全局统计数据 (可选)

backend/
├── app/
│   ├── firmware_manager.py            # 固件管理服务 (新增)
│   ├── auth_service.py                # 认证服务 (新增)
│   ├── admin_routes.py                # 管理员路由 (新增)
│   ├── firmware_routes.py             # 固件路由 (新增)
│   └── models.py                      # 数据模型 (扩展)
└── .env                               # 环境配置 (扩展)

frontend/
├── src/
│   ├── pages/
│   │   ├── FirmwareLibrary.tsx        # 用户固件库页面 (新增)
│   │   ├── FirmwareDetail.tsx         # 固件详情页面 (新增)
│   │   ├── AdminDashboard.tsx         # 管理员仪表板 (新增)
│   │   ├── AdminFirmwareList.tsx      # 管理员固件列表 (新增)
│   │   ├── AdminFirmwareUpload.tsx    # 固件上传页面 (新增)
│   │   └── AdminAIConfig.tsx          # AI 配置页面 (新增)
│   ├── components/
│   │   ├── FirmwareCard.tsx           # 固件卡片组件 (新增)
│   │   ├── FirmwareFilter.tsx         # 固件筛选组件 (新增)
│   │   ├── AdminLogin.tsx             # 管理员登录组件 (新增)
│   │   └── ProtectedRoute.tsx         # 路由保护组件 (新增)
│   ├── api/
│   │   ├── firmwareClient.ts          # 固件 API 客户端 (新增)
│   │   └── adminClient.ts             # 管理员 API 客户端 (新增)
│   └── store/
│       └── authStore.ts               # 认证状态管理 (新增)
└── App.tsx                            # 路由配置 (修改)
```

## 组件和接口

### 后端组件

#### 1. 认证服务 (AuthService)

**职责**: 管理员身份验证和 Token 管理

**接口**:
```python
class AuthService:
    def authenticate(username: str, password: str) -> Optional[str]:
        """验证用户名密码,返回 JWT token"""
        
    def verify_token(token: str) -> Optional[dict]:
        """验证 token 有效性,返回用户信息"""
        
    def check_rate_limit(username: str) -> bool:
        """检查登录频率限制"""
        
    def lock_account(username: str, duration: int):
        """锁定账户"""
```

**实现细节**:
- 使用 Passlib 的 bcrypt 算法哈希密码
- JWT token 有效期 24 小时
- 使用内存字典跟踪登录失败次数 (简化实现)
- 5 次失败锁定 30 分钟

#### 2. 固件管理服务 (FirmwareManager)

**职责**: 固件包的 CRUD 操作和元数据管理

**接口**:
```python
class FirmwareManager:
    def upload_firmware(
        zip_file: UploadFile,
        metadata: FirmwareMetadata
    ) -> str:
        """上传固件包,返回 firmware_id"""
        
    def get_firmware_list(
        published_only: bool = True,
        board_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> List[FirmwareMetadata]:
        """获取固件列表,支持筛选"""
        
    def get_firmware_detail(firmware_id: str) -> Optional[FirmwareMetadata]:
        """获取固件详情"""
        
    def update_metadata(
        firmware_id: str,
        metadata: FirmwareMetadata
    ) -> bool:
        """更新元数据"""
        
    def delete_firmware(firmware_id: str) -> bool:
        """删除固件包"""
        
    def upload_thumbnail(
        firmware_id: str,
        image_file: UploadFile
    ) -> bool:
        """上传缩略图"""
        
    def get_statistics() -> Dict:
        """获取统计信息"""
```

**实现细节**:
- 固件文件存储在 `/opt/firmware/{firmware_id}/`
- 元数据存储在 `metadata.json`
- 更新前创建 `metadata.json.bak` 备份
- 使用原子写入 (临时文件 + rename)
- 缩略图自动调整为 400x400 以内

#### 3. 管理员路由 (AdminRoutes)

**端点**:

```python
# 认证
POST   /api/admin/login              # 管理员登录
POST   /api/admin/logout             # 管理员登出
GET    /api/admin/verify             # 验证 token

# 固件管理
GET    /api/admin/firmware           # 获取所有固件 (包括未发布)
POST   /api/admin/firmware           # 上传固件包
PUT    /api/admin/firmware/{id}      # 更新固件元数据
DELETE /api/admin/firmware/{id}      # 删除固件包
POST   /api/admin/firmware/{id}/thumbnail  # 上传缩略图
PATCH  /api/admin/firmware/{id}/publish    # 发布/取消发布

# AI 配置
GET    /api/admin/ai-config          # 获取 AI 配置
PUT    /api/admin/ai-config          # 更新 AI 配置

# 统计
GET    /api/admin/statistics         # 获取统计信息
```

#### 4. 固件路由 (FirmwareRoutes)

**端点**:

```python
# 用户端点 (无需认证)
GET    /api/firmware                 # 获取已发布固件列表
GET    /api/firmware/{id}            # 获取固件详情
GET    /api/firmware/{id}/download   # 下载固件包 (ZIP)
GET    /api/firmware/{id}/files/{filename}  # 下载单个固件文件
GET    /api/firmware/{id}/thumbnail  # 获取缩略图
POST   /api/firmware/{id}/flash-log  # 记录烧录事件 (统计用)
```

### 前端组件

#### 1. 路由配置

```typescript
// App.tsx
<BrowserRouter>
  <Routes>
    {/* 现有路由 */}
    <Route path="/" element={<HomePage />} />
    
    {/* 用户固件库 */}
    <Route path="/firmware" element={<FirmwareLibrary />} />
    <Route path="/firmware/:id" element={<FirmwareDetail />} />
    
    {/* 管理员路由 */}
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<ProtectedRoute />}>
      <Route index element={<AdminDashboard />} />
      <Route path="firmware" element={<AdminFirmwareList />} />
      <Route path="firmware/upload" element={<AdminFirmwareUpload />} />
      <Route path="firmware/:id/edit" element={<AdminFirmwareEdit />} />
      <Route path="ai-config" element={<AdminAIConfig />} />
    </Route>
  </Routes>
</BrowserRouter>
```

#### 2. 用户固件库页面 (FirmwareLibrary)

**功能**:
- 显示已发布固件列表
- 支持按开发板筛选
- 支持按标签筛选
- 支持搜索 (项目名称和描述)
- 卡片式布局展示

**状态**:
```typescript
interface FirmwareLibraryState {
  firmwares: FirmwareMetadata[];
  loading: boolean;
  selectedBoard: string | null;
  selectedTags: string[];
  searchQuery: string;
}
```

#### 3. 固件详情页面 (FirmwareDetail)

**功能**:
- 显示完整的固件信息
- 显示支持的开发板列表
- 显示文件大小和总大小
- 兼容性检查 (与当前检测的开发板对比)
- "烧录到设备" 按钮
- "下载固件包" 按钮

**烧录流程**:
1. 检查是否选择串口
2. 检查开发板兼容性 (可选警告)
3. 调用 `FirmwareUploader.upload()` 复用现有烧录逻辑
4. 显示进度条
5. 记录烧录事件 (统计用)

#### 4. 管理员仪表板 (AdminDashboard)

**功能**:
- 显示统计卡片:
  - 固件包总数
  - 存储空间使用
  - 30 天下载次数
  - 30 天烧录次数
- 显示热门固件 Top 10
- 存储空间警告 (>80%)

#### 5. 管理员固件列表 (AdminFirmwareList)

**功能**:
- 显示所有固件 (包括未发布)
- 每个固件显示:
  - 项目名称、版本
  - 发布状态 (已发布/草稿)
  - 创建时间
  - 操作按钮 (编辑/删除/发布切换)
- 删除确认对话框

#### 6. 固件上传页面 (AdminFirmwareUpload)

**功能**:
- ZIP 文件上传 (拖拽或选择)
- 元数据表单:
  - 项目名称 (3-100 字符)
  - 描述 (10-2000 字符)
  - 版本 (语义化版本)
  - 支持的开发板 (多选)
  - 标签 (最多 5 个)
  - 发布状态 (已发布/草稿)
- 缩略图上传 (可选)
- 实时验证
- 上传进度显示

#### 7. AI 配置页面 (AdminAIConfig)

**功能**:
- API Key 输入 (密码框)
- API Base URL 输入
- Model 名称输入
- Temperature 滑块 (0.0-2.0)
- Max Tokens 输入 (100-8000)
- 测试连接按钮
- 保存按钮

## 数据模型

### 固件元数据 (FirmwareMetadata)

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class FirmwareMetadata(BaseModel):
    firmware_id: str = Field(..., description="固件唯一标识")
    project_name: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    version: str = Field(..., regex=r'^\d+\.\d+\.\d+$')
    supported_board_ids: List[str] = Field(..., min_items=1)
    tags: List[str] = Field(default=[], max_items=5)
    published: bool = Field(default=False)
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # 文件信息
    files: List[FirmwareFileInfo]
    total_size: int  # 字节
    has_thumbnail: bool = False
    
    # 统计信息
    download_count: int = 0
    flash_count: int = 0
    flash_success_count: int = 0
    flash_failure_count: int = 0

class FirmwareFileInfo(BaseModel):
    name: str
    size: int
    address: int  # 烧录地址
    role: str  # bootloader, partitions, boot_app0, app, firmware
```

### 管理员凭证

```python
class AdminCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 小时
```

### AI 配置

```python
class AIConfig(BaseModel):
    api_key: str
    api_base: str
    model: str = Field(..., max_length=200)
    temperature: float = Field(..., ge=0.0, le=2.0)
    max_tokens: int = Field(..., ge=100, le=8000)
```

## 错误处理

### 错误码设计

```python
class ErrorCode(str, Enum):
    # 认证错误 (401)
    INVALID_CREDENTIALS = "invalid_credentials"
    TOKEN_EXPIRED = "token_expired"
    ACCOUNT_LOCKED = "account_locked"
    
    # 权限错误 (403)
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions"
    
    # 资源错误 (404)
    FIRMWARE_NOT_FOUND = "firmware_not_found"
    FILE_NOT_FOUND = "file_not_found"
    
    # 验证错误 (400)
    INVALID_ZIP_FORMAT = "invalid_zip_format"
    MISSING_REQUIRED_FILES = "missing_required_files"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    INVALID_METADATA = "invalid_metadata"
    INVALID_VERSION_FORMAT = "invalid_version_format"
    VERSION_CONFLICT = "version_conflict"
    INVALID_BOARD_ID = "invalid_board_id"
    INVALID_IMAGE_FORMAT = "invalid_image_format"
    IMAGE_SIZE_EXCEEDED = "image_size_exceeded"
    INVALID_IMAGE_DIMENSIONS = "invalid_image_dimensions"
    
    # 存储错误 (500)
    STORAGE_ERROR = "storage_error"
    INSUFFICIENT_STORAGE = "insufficient_storage"
    METADATA_WRITE_ERROR = "metadata_write_error"
    
    # 业务逻辑错误 (409)
    FIRMWARE_IN_USE = "firmware_in_use"
    DUPLICATE_FIRMWARE_ID = "duplicate_firmware_id"
```

### 错误响应格式

```python
class ErrorResponse(BaseModel):
    success: bool = False
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None
```

### 错误处理策略

1. **认证错误**: 返回 401,清除前端 token
2. **验证错误**: 返回 400,显示具体字段错误
3. **存储错误**: 返回 500,记录日志,回滚操作
4. **业务逻辑错误**: 返回 409,显示友好提示

## 测试策略

### Property-Based Testing 适用性评估

**结论**: 本系统**不适合** Property-Based Testing (PBT)

**原因**:
1. **系统性质**: 固件管理系统主要涉及配置管理、文件 I/O、UI 渲染和外部 API 集成,而非纯函数或算法
2. **操作类型**: 
   - 文件上传/下载 - I/O 密集型操作
   - 元数据 CRUD - 简单的数据验证和存储
   - 认证授权 - 状态管理和配置
   - Web Serial API - 外部硬件交互
3. **测试特点**: 这些操作更适合使用具体示例测试、集成测试和快照测试,而不是跨大量随机输入验证通用属性

**推荐测试方法**:
- **单元测试**: 验证具体的验证规则和业务逻辑
- **集成测试**: 验证完整的工作流程 (上传、烧录、认证)
- **快照测试**: 验证 UI 组件渲染和 API 响应格式
- **端到端测试**: 验证用户完整操作流程

### 单元测试

**后端**:
- `test_auth_service.py`: 认证逻辑、token 生成/验证、频率限制
  - 测试有效/无效凭证
  - 测试 token 过期
  - 测试账户锁定 (5 次失败)
  - 测试密码哈希安全性
  
- `test_firmware_manager.py`: 固件 CRUD、元数据验证、文件操作
  - 测试 ZIP 文件验证 (必需文件、文件大小)
  - 测试元数据验证 (字段长度、版本格式、board ID)
  - 测试文件存储和检索
  - 测试原子写入和备份机制
  - 测试缩略图处理 (格式、大小、尺寸)
  
- `test_admin_routes.py`: API 端点、请求验证、响应格式
  - 测试认证中间件
  - 测试各端点的输入验证
  - 测试错误响应格式
  
- `test_firmware_routes.py`: 用户端点、筛选逻辑、下载功能
  - 测试固件列表筛选 (board、tags、search)
  - 测试文件下载
  - 测试统计记录

**前端**:
- `FirmwareCard.test.tsx`: 卡片渲染、点击事件
  - 测试不同状态的渲染 (有/无缩略图、兼容性标记)
  - 测试点击事件
  
- `FirmwareFilter.test.tsx`: 筛选逻辑、状态更新
  - 测试 board 筛选
  - 测试 tag 筛选
  - 测试搜索功能
  
- `AdminLogin.test.tsx`: 表单验证、登录流程
  - 测试表单验证规则
  - 测试登录成功/失败
  - 测试 token 存储
  
- `firmwareClient.test.ts`: API 调用、错误处理
  - 测试 API 请求构造
  - 测试错误处理和重试逻辑

### 集成测试

1. **固件上传流程**:
   - 上传 ZIP → 验证 → 存储 → 返回 firmware_id
   - 测试各种错误场景:
     - 缺少必需文件 (bootloader.bin, partitions.bin, boot_app0.bin, app.bin)
     - 文件过大 (>10MB)
     - 无效元数据 (版本格式错误、无效 board ID)
     - 存储空间不足
     - 网络中断 (部分上传)

2. **固件烧录流程**:
   - 浏览固件 → 选择固件 → 检查兼容性 → 烧录 → 记录统计
   - 测试场景:
     - 串口未选择
     - 固件不存在
     - 芯片检测失败
     - 烧录超时
     - 烧录失败后重试

3. **管理员认证流程**:
   - 登录 → 获取 token → 访问受保护端点 → token 过期 → 重新登录
   - 测试场景:
     - 频率限制 (5 次失败)
     - 账户锁定 (30 分钟)
     - Token 过期 (24 小时)
     - 并发登录

4. **版本管理流程**:
   - 上传 v1.0.0 → 上传 v1.1.0 → 上传 v2.0.0
   - 测试场景:
     - 版本冲突检测
     - 版本排序
     - Latest 标记

### 端到端测试

使用 Playwright 或 Cypress:

1. **用户场景**:
   - 浏览固件库
   - 使用筛选器和搜索
   - 查看固件详情
   - 烧录固件到设备
   - 下载固件包

2. **管理员场景**:
   - 登录管理界面
   - 上传新固件包
   - 编辑固件元数据
   - 上传缩略图
   - 发布/取消发布固件
   - 删除固件包
   - 配置 AI API
   - 查看统计仪表板

### 测试数据

创建测试固件包:
```bash
# 创建测试 ZIP
mkdir test-firmware
cd test-firmware
dd if=/dev/zero of=bootloader.bin bs=1024 count=16
dd if=/dev/zero of=partitions.bin bs=1024 count=4
dd if=/dev/zero of=boot_app0.bin bs=1024 count=4
dd if=/dev/zero of=app.bin bs=1024 count=512
zip ../test-firmware.zip *.bin
```

### 测试覆盖率目标

- **后端单元测试**: >80% 代码覆盖率
- **前端单元测试**: >70% 代码覆盖率
- **集成测试**: 覆盖所有主要工作流程
- **端到端测试**: 覆盖所有用户和管理员关键路径

## 部署和配置

### 环境变量

```bash
# backend/.env

# 现有配置
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1
AI_MODEL=gpt-4

# 新增配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$xxx  # bcrypt hash
JWT_SECRET_KEY=your-secret-key-here
FIRMWARE_STORAGE_PATH=/opt/firmware
MAX_FIRMWARE_SIZE_MB=10
MAX_THUMBNAIL_SIZE_KB=500
```

### 初始化脚本

```python
# backend/scripts/init_admin.py
import os
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

username = input("Admin username: ")
password = input("Admin password: ")
password_hash = pwd_context.hash(password)

print(f"\nAdd to .env file:")
print(f"ADMIN_USERNAME={username}")
print(f"ADMIN_PASSWORD_HASH={password_hash}")
```

### Docker 配置

```yaml
# docker-compose.yml (扩展)
services:
  backend:
    volumes:
      - firmware-data:/opt/firmware  # 固件持久化
    environment:
      - FIRMWARE_STORAGE_PATH=/opt/firmware

volumes:
  firmware-data:
```

### Nginx 配置

```nginx
# 增加上传大小限制
client_max_body_size 100M;

# 固件文件缓存
location /api/firmware/ {
    proxy_pass http://backend:8000;
    proxy_cache firmware_cache;
    proxy_cache_valid 200 1h;
}
```

## 性能优化

### 后端优化

1. **固件列表缓存**: 使用内存缓存 (TTL 5 分钟)
2. **元数据索引**: 在内存中维护 firmware_id → metadata 映射
3. **并发下载**: 使用 `StreamingResponse` 流式传输大文件
4. **缩略图懒加载**: 前端按需加载缩略图

### 前端优化

1. **虚拟滚动**: 固件列表使用 `react-window` 虚拟化
2. **图片懒加载**: 使用 `Intersection Observer`
3. **搜索防抖**: 300ms 防抖避免频繁请求
4. **路由懒加载**: 使用 `React.lazy()` 按需加载页面

### 存储优化

1. **定期清理**: 删除 30 天未访问的草稿固件
2. **压缩存储**: 固件文件使用 gzip 压缩 (可选)
3. **备份策略**: 每周备份元数据到外部存储

## 安全考虑

### 认证安全

1. **密码哈希**: 使用 bcrypt (cost factor 12)
2. **Token 安全**: JWT 使用 HS256 签名,24 小时过期
3. **频率限制**: 5 次失败锁定 30 分钟
4. **HTTPS**: 生产环境强制 HTTPS

### 文件安全

1. **文件类型验证**: 严格验证 ZIP 内容
2. **文件大小限制**: 单文件 10MB,总包 100MB
3. **路径遍历防护**: 禁止 `../` 等路径操作
4. **病毒扫描**: 可选集成 ClamAV

### API 安全

1. **CORS 配置**: 限制允许的源
2. **速率限制**: 使用 `slowapi` 限制请求频率
3. **输入验证**: Pydantic 严格验证所有输入
4. **SQL 注入防护**: 不使用数据库,无 SQL 注入风险

## 监控和日志

### 日志记录

```python
# 关键操作日志
logger.info(f"Firmware uploaded: {firmware_id} by {username}")
logger.info(f"Firmware deleted: {firmware_id} by {username}")
logger.info(f"Firmware flashed: {firmware_id} to {board_id}")
logger.warning(f"Login failed: {username} from {ip}")
logger.error(f"Storage error: {error_message}")
```

### 监控指标

1. **存储空间**: 监控 `/opt/firmware` 使用率
2. **API 响应时间**: 监控各端点响应时间
3. **错误率**: 监控 4xx/5xx 错误比例
4. **烧录成功率**: 监控烧录成功/失败比例

### 告警规则

1. 存储空间 > 80%: 发送告警
2. API 错误率 > 5%: 发送告警
3. 烧录失败率 > 20%: 发送告警

## 未来扩展

### 短期 (1-3 个月)

1. **固件评论**: 用户可以评论和评分固件
2. **固件收藏**: 用户可以收藏常用固件
3. **批量操作**: 管理员批量删除/发布固件
4. **导入导出**: 支持固件包导入导出

### 中期 (3-6 个月)

1. **多管理员**: 支持多个管理员账户
2. **权限管理**: 细粒度权限控制 (上传/删除/发布)
3. **审计日志**: 完整的操作审计日志
4. **数据库迁移**: 从 JSON 迁移到 SQLite/PostgreSQL

### 长期 (6-12 个月)

1. **CDN 集成**: 固件文件使用 CDN 加速
2. **OTA 更新**: 支持设备 OTA 固件更新
3. **固件签名**: 固件包数字签名验证
4. **多语言支持**: 国际化 (i18n)

---

**文档版本**: 1.0  
**最后更新**: 2024-01-XX  
**作者**: Kiro AI Agent

