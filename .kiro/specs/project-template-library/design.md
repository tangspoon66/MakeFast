# Design Document: 项目模板库 (Project Template Library)

## Architecture Overview

项目模板库采用与现有固件管理系统相同的架构模式：FastAPI 后端 + React 前端，文件系统存储 + JSON 元数据。

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ TemplateLibrary  │  │ AdminTemplateManagement           │ │
│  │ /templates       │  │ /admin/templates                  │ │
│  │ (public browse)  │  │ (CRUD + ZIP upload + editor)      │ │
│  └────────┬─────────┘  └────────────────┬─────────────────┘ │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                          │
│  ┌─────────────────────┐  ┌────────────────────────────────┐ │
│  │ template_routes.py  │  │ admin_routes.py (extended)      │ │
│  │ /api/templates      │  │ /api/admin/templates            │ │
│  │ (public GET only)   │  │ (auth required CRUD)            │ │
│  └─────────┬───────────┘  └──────────────┬─────────────────┘ │
│            │                              │                    │
│            ▼                              ▼                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              template_manager.py                        │  │
│  │  (TemplateManager class - CRUD, validation, storage)   │  │
│  └────────────────────────────┬───────────────────────────┘  │
└───────────────────────────────┼───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                   File System Storage                          │
│  /opt/templates/ (or TEMPLATE_STORAGE_PATH env var)           │
│  ├── {template_id}/                                           │
│  │   ├── metadata.json                                        │
│  │   └── sources/                                             │
│  │       ├── sketch.ino                                       │
│  │       ├── helper.cpp                                       │
│  │       └── helper.h                                         │
│  └── ...                                                      │
└───────────────────────────────────────────────────────────────┘
```

## Data Models

### TemplateMetadata (Pydantic Model)

```python
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime


class TemplateSourceFile(BaseModel):
    """模板源代码文件"""
    name: str = Field(..., description="文件名，如 'sketch.ino'")
    content: str = Field(..., min_length=1, max_length=51200, description="文件内容 (最大 50KB)")


class TemplateMetadata(BaseModel):
    """模板元数据模型"""
    template_id: str = Field(..., description="模板唯一标识")
    name: str = Field(..., min_length=3, max_length=100, description="模板名称")
    description: str = Field(..., min_length=10, max_length=2000, description="模板描述")
    category: str = Field(..., min_length=2, max_length=50, description="分类")
    tags: List[str] = Field(default=[], description="标签列表（最多 10 个）")
    supported_board_ids: List[str] = Field(..., min_length=1, description="支持的开发板 ID 列表")
    published: bool = Field(default=False, description="是否已发布")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    file_count: int = Field(..., description="源文件数量")
    total_size: int = Field(..., description="源文件总大小（字节）")


class TemplateDetail(TemplateMetadata):
    """模板详情（包含源文件内容）"""
    files: List[TemplateSourceFile] = Field(..., description="源代码文件列表")


class TemplateListResponse(BaseModel):
    """模板列表分页响应"""
    templates: List[TemplateMetadata] = Field(..., description="模板列表")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_count: int = Field(..., description="总数量")
    total_pages: int = Field(..., description="总页数")


class TemplateCreateRequest(BaseModel):
    """创建模板请求"""
    name: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    category: str = Field(..., min_length=2, max_length=50)
    tags: List[str] = Field(default=[])
    supported_board_ids: List[str] = Field(..., min_length=1)
    published: bool = Field(default=False)
    files: List[TemplateSourceFile] = Field(..., min_length=1, max_length=20)


class TemplateUpdateRequest(BaseModel):
    """更新模板请求"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    tags: Optional[List[str]] = None
    supported_board_ids: Optional[List[str]] = Field(None, min_length=1)
    published: Optional[bool] = None
    files: Optional[List[TemplateSourceFile]] = Field(None, min_length=1, max_length=20)
```

### Storage Format (metadata.json)

```json
{
  "template_id": "uuid-string",
  "name": "WiFi 温度监控模板",
  "description": "基于 ESP32 的 WiFi 温度监控项目模板...",
  "category": "IoT",
  "tags": ["wifi", "sensor", "temperature"],
  "supported_board_ids": ["esp32", "esp32s3"],
  "published": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T14:20:00Z",
  "file_count": 3,
  "total_size": 4096
}
```

## Component Design

### Backend: TemplateManager (template_manager.py)

遵循 `FirmwareManager` 的设计模式：

```python
class TemplateManager:
    """模板管理服务类"""
    
    ALLOWED_EXTENSIONS = {".ino", ".cpp", ".h", ".c"}
    MAX_FILE_SIZE = 50 * 1024          # 50 KB per file
    MAX_FILES_PER_TEMPLATE = 20
    MAX_ZIP_UNCOMPRESSED_SIZE = 1 * 1024 * 1024  # 1 MB
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = Path(
            storage_path or os.getenv("TEMPLATE_STORAGE_PATH", "/opt/templates")
        )
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, Tuple[float, List[TemplateMetadata]]] = {}
        self._cache_ttl = 300  # 5 minutes

    # CRUD Operations
    def create_template(self, request: TemplateCreateRequest) -> TemplateMetadata: ...
    def get_template_detail(self, template_id: str) -> Optional[TemplateDetail]: ...
    def update_template(self, template_id: str, request: TemplateUpdateRequest) -> Optional[TemplateMetadata]: ...
    def delete_template(self, template_id: str) -> bool: ...
    
    # Listing & Filtering
    def get_template_list(
        self,
        published_only: bool = True,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        board_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 12
    ) -> TemplateListResponse: ...
    
    # ZIP Upload
    def create_from_zip(
        self,
        zip_file: UploadFile,
        metadata: TemplateCreateRequest
    ) -> TemplateMetadata: ...
    
    # Validation
    def _validate_metadata(self, name, description, category, tags, board_ids): ...
    def _validate_files(self, files: List[TemplateSourceFile]): ...
    def _validate_file_extension(self, filename: str) -> bool: ...
```

### Backend: API Routes

#### Public Routes (template_routes.py)

```python
router = APIRouter(prefix="/api/templates", tags=["templates"])

@router.get("", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50)
): ...

@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(template_id: str): ...
```

#### Admin Routes (added to admin_routes.py or separate template_admin_routes.py)

```python
router = APIRouter(prefix="/api/admin/templates", tags=["admin-templates"])

@router.get("", response_model=TemplateListResponse)
async def admin_list_templates(
    admin: dict = Depends(verify_admin_token),
    ...
): ...

@router.post("", response_model=TemplateMetadata)
async def create_template(
    request: TemplateCreateRequest,
    admin: dict = Depends(verify_admin_token)
): ...

@router.post("/upload-zip", response_model=TemplateMetadata)
async def upload_zip_template(
    zip_file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    tags: str = Form(""),
    supported_board_ids: str = Form(...),
    admin: dict = Depends(verify_admin_token)
): ...

@router.put("/{template_id}", response_model=TemplateMetadata)
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    admin: dict = Depends(verify_admin_token)
): ...

@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    admin: dict = Depends(verify_admin_token)
): ...

@router.patch("/{template_id}/publish")
async def toggle_publish(
    template_id: str,
    published: bool,
    admin: dict = Depends(verify_admin_token)
): ...
```

### Frontend Components

#### TemplateLibrary Page (/templates)

```typescript
// pages/TemplateLibrary.tsx
interface TemplateListItem {
  template_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  supported_board_ids: string[];
  published: boolean;
  created_at: string;
  file_count: number;
  total_size: number;
}

interface TemplateListResponse {
  templates: TemplateListItem[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}
```

主要 UI 组件：
- **FilterBar**: 分类下拉、标签选择、开发板筛选、搜索框
- **TemplateGrid**: 卡片网格展示模板列表
- **TemplateCard**: 单个模板卡片（名称、描述、标签、支持的开发板）
- **Pagination**: 分页控件
- **UseTemplateButton**: "使用模板" 按钮，触发加载到编辑器

#### AdminTemplateManagement Page (/admin/templates)

主要 UI 组件：
- **TemplateTable**: 模板列表表格（含发布状态、编辑/删除操作）
- **TemplateForm**: 创建/编辑表单（元数据 + 文件编辑器）
- **FileEditor**: 多文件代码编辑器（添加/删除/重命名文件）
- **ZipUploadDialog**: ZIP 上传对话框
- **PublishToggle**: 发布状态切换开关

#### Template Loading Flow

```typescript
// 模板加载到编辑器的流程
async function loadTemplateToEditor(templateId: string) {
  // 1. 检查编辑器是否有未保存内容
  if (hasUnsavedChanges()) {
    const confirmed = await showConfirmDialog(
      "当前编辑器有未保存的代码，加载模板将覆盖现有内容。是否继续？"
    );
    if (!confirmed) return;
  }
  
  // 2. 获取模板详情（含源文件）
  const template = await api.getTemplateDetail(templateId);
  
  // 3. 设置编辑器文件
  setEditorFiles(template.files);
  
  // 4. 设置活动标签为第一个 .ino 文件
  const inoFile = template.files.find(f => f.name.endsWith('.ino'));
  setActiveTab(inoFile?.name || template.files[0].name);
  
  // 5. 设置开发板
  if (template.supported_board_ids.length > 0) {
    setSelectedBoard(template.supported_board_ids[0]);
  }
  
  // 6. 导航到编辑器页面
  navigate('/');
}
```

## Error Handling

### Error Codes (扩展现有 ErrorCode 枚举)

```python
class TemplateErrorCode(str, Enum):
    TEMPLATE_NOT_FOUND = "template_not_found"
    INVALID_TEMPLATE_METADATA = "invalid_template_metadata"
    INVALID_FILE_EXTENSION = "invalid_file_extension"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    FILE_COUNT_EXCEEDED = "file_count_exceeded"
    EMPTY_FILE_CONTENT = "empty_file_content"
    INVALID_ZIP_FORMAT = "invalid_zip_format"
    ZIP_NO_SOURCE_FILES = "zip_no_source_files"
    ZIP_SIZE_EXCEEDED = "zip_size_exceeded"
    STORAGE_ERROR = "storage_error"
```

### Error Response Format

与现有系统保持一致：

```json
{
  "success": false,
  "error_code": "invalid_file_extension",
  "message": "不支持的文件扩展名: .txt。允许的扩展名: .ino, .cpp, .h, .c"
}
```

## Interfaces

### API Contract

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/templates | No | 列出已发布模板（分页+筛选） |
| GET | /api/templates/{id} | No | 获取模板详情（含源文件） |
| GET | /api/admin/templates | Yes | 管理员列出所有模板 |
| POST | /api/admin/templates | Yes | 创建模板 |
| POST | /api/admin/templates/upload-zip | Yes | ZIP 上传创建模板 |
| PUT | /api/admin/templates/{id} | Yes | 更新模板 |
| DELETE | /api/admin/templates/{id} | Yes | 删除模板 |
| PATCH | /api/admin/templates/{id}/publish | Yes | 切换发布状态 |

### Frontend-Backend Interface

前端通过 axios 调用 API，遵循现有 `api.ts` 模式：

```typescript
// api/templates.ts
export const templateApi = {
  list: (params: TemplateListParams) => 
    axios.get<TemplateListResponse>('/api/templates', { params }),
  
  getDetail: (id: string) => 
    axios.get<TemplateDetail>(`/api/templates/${id}`),
  
  // Admin endpoints
  adminList: (params: TemplateListParams) =>
    axios.get<TemplateListResponse>('/api/admin/templates', { params }),
  
  create: (data: TemplateCreateRequest) =>
    axios.post<TemplateMetadata>('/api/admin/templates', data),
  
  uploadZip: (formData: FormData) =>
    axios.post<TemplateMetadata>('/api/admin/templates/upload-zip', formData),
  
  update: (id: string, data: TemplateUpdateRequest) =>
    axios.put<TemplateMetadata>(`/api/admin/templates/${id}`, data),
  
  delete: (id: string) =>
    axios.delete(`/api/admin/templates/${id}`),
  
  togglePublish: (id: string, published: boolean) =>
    axios.patch(`/api/admin/templates/${id}/publish`, { published }),
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template data round-trip

*For any* valid template (with valid metadata and source files containing arbitrary UTF-8 content), creating the template and then retrieving it by ID SHALL return metadata and file content identical to the original input.

**Validates: Requirements 1.1, 2.6**

### Property 2: Template ID uniqueness

*For any* set of N templates created sequentially or concurrently, all generated Template_IDs SHALL be distinct.

**Validates: Requirements 1.2**

### Property 3: Metadata validation rejects invalid input

*For any* template creation request where the name length is outside [3, 100], or description length is outside [10, 2000], or category length is outside [2, 50], or tags count exceeds 10, or supported_board_ids contains an ID not in the system board configuration, or file extension is not in {.ino, .cpp, .h, .c}, or individual file size exceeds 50KB, or file count exceeds 20, the Template_Manager SHALL reject the request with an appropriate error.

**Validates: Requirements 1.5, 1.6, 1.7, 2.2, 2.3, 2.4**

### Property 4: ZIP extraction filters by extension

*For any* valid ZIP archive containing a mix of source files (.ino, .cpp, .h, .c) and non-source files, the Template_Manager SHALL extract exactly the files with allowed extensions and ignore all others.

**Validates: Requirements 3.1, 3.5**

### Property 5: ZIP flattens directory structure

*For any* valid ZIP archive containing source files in nested directories, the Template_Manager SHALL store only the file basenames (without directory paths) as the source file names.

**Validates: Requirements 3.6**

### Property 6: ZIP size limit enforcement

*For any* ZIP archive whose total uncompressed content size exceeds 1MB, the Template_Manager SHALL reject the upload with an appropriate error.

**Validates: Requirements 3.3**

### Property 7: Category filter correctness

*For any* set of templates and any category filter value, all templates returned by the filtered listing SHALL have a category matching the filter value, and no template with a matching category SHALL be excluded.

**Validates: Requirements 5.2**

### Property 8: Tag filter correctness

*For any* set of templates and any tag filter value, all templates returned by the filtered listing SHALL contain the specified tag in their tags list.

**Validates: Requirements 5.3**

### Property 9: Board filter correctness

*For any* set of templates and any board_id filter value, all templates returned by the filtered listing SHALL include the specified board_id in their supported_board_ids list.

**Validates: Requirements 5.4**

### Property 10: Search returns matching results

*For any* set of templates and any search keyword, all templates returned by the search SHALL contain the keyword (case-insensitive) in either their name or description.

**Validates: Requirements 5.5**

### Property 11: Published-only visibility

*For any* mix of published and unpublished templates, the public listing API SHALL return only templates where published is true, and SHALL never include unpublished templates.

**Validates: Requirements 5.7, 8.2, 8.3**

### Property 12: Update preserves identity

*For any* template and any valid update operation, the template_id and created_at timestamp SHALL remain unchanged after the update.

**Validates: Requirements 7.3**

### Property 13: Delete removes all data

*For any* template that is deleted, the template's metadata file and all associated source files SHALL no longer exist in the storage directory.

**Validates: Requirements 7.4**

### Property 14: Pagination metadata correctness

*For any* template listing with total_count items and a given page_size, the total_pages SHALL equal ceil(total_count / page_size), and the number of items on the last page SHALL equal total_count - (total_pages - 1) * page_size.

**Validates: Requirements 9.6**

### Property 15: Admin authentication enforcement

*For any* admin API endpoint (POST, PUT, DELETE, PATCH on /api/admin/templates/*), a request without a valid JWT token SHALL receive a 401 Unauthorized response.

**Validates: Requirements 7.1**
