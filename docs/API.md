# API 文档 - 固件管理系统

Base URL: `http://localhost:8000`

交互式文档: `http://localhost:8000/api/docs` (Swagger UI)

## 用户端 API (无需认证)

### 获取已发布固件列表

```
GET /api/firmware
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| board_id | string | 否 | 按开发板 ID 筛选 |
| tags | string | 否 | 按标签筛选，多个用逗号分隔 |
| search | string | 否 | 搜索关键词（最多 200 字符） |

**响应示例:**

```json
[
  {
    "firmware_id": "abc123",
    "project_name": "LED 闪烁示例",
    "description": "ESP32 LED 闪烁基础示例项目",
    "version": "1.0.0",
    "supported_board_ids": ["esp32", "esp32s3"],
    "tags": ["示例", "LED"],
    "published": true,
    "created_at": "2024-01-15T10:30:00",
    "files": [
      {"name": "bootloader.bin", "size": 16384, "address": 4096, "role": "bootloader"},
      {"name": "partitions.bin", "size": 3072, "address": 32768, "role": "partitions"},
      {"name": "boot_app0.bin", "size": 8192, "address": 57344, "role": "boot_app0"},
      {"name": "app.bin", "size": 524288, "address": 65536, "role": "app"}
    ],
    "total_size": 551936,
    "has_thumbnail": true,
    "download_count": 42,
    "flash_count": 15
  }
]
```

---

### 获取固件详情

```
GET /api/firmware/{firmware_id}
```

**响应:** 同上，返回单个固件的完整元数据。

**错误响应 (404):**

```json
{
  "success": false,
  "error_code": "firmware_not_found",
  "message": "固件包不存在"
}
```

---

### 下载固件包 (ZIP)

```
GET /api/firmware/{firmware_id}/download
```

**响应:** ZIP 文件流（包含所有固件文件和 metadata.json）

**响应头:**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="LED闪烁示例_v1.0.0.zip"
```

---

### 下载单个固件文件

```
GET /api/firmware/{firmware_id}/files/{filename}
```

**路径参数:**
- `filename`: 文件名，如 `bootloader.bin`, `app.bin` 等

**响应:** 二进制文件流

---

### 获取缩略图

```
GET /api/firmware/{firmware_id}/thumbnail
```

**响应:** PNG 图片文件

**错误响应 (404):** 固件无缩略图时返回 404

---

### 记录烧录事件

```
POST /api/firmware/{firmware_id}/flash-log
```

**请求体:**

```json
{
  "success": true,
  "board_id": "esp32",
  "duration_ms": 15000
}
```

**响应:**

```json
{
  "success": true,
  "message": "烧录事件已记录"
}
```

---

## 管理员 API (需要 JWT 认证)

所有管理员端点需要在请求头中携带 Token:

```
Authorization: Bearer <jwt_token>
```

### 管理员登录

```
POST /api/admin/login
```

**请求体:**

```json
{
  "username": "admin",
  "password": "your-password"
}
```

**成功响应 (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**错误响应 (401):**

```json
{
  "success": false,
  "error_code": "invalid_credentials",
  "message": "用户名或密码错误"
}
```

**账户锁定 (429):**

```json
{
  "success": false,
  "error_code": "account_locked",
  "message": "账户已锁定，请在 25 分钟后重试"
}
```

---

### 验证 Token

```
GET /api/admin/verify
```

**成功响应:**

```json
{
  "success": true,
  "username": "admin",
  "message": "Token 有效"
}
```

---

### 管理员登出

```
POST /api/admin/logout
```

**响应:**

```json
{
  "success": true,
  "message": "已登出"
}
```

---

### 获取所有固件 (含未发布)

```
GET /api/admin/firmware
```

**查询参数:** 同用户端 `GET /api/firmware`，但返回所有固件（包括未发布）

---

### 上传固件包

```
POST /api/admin/firmware
```

**请求类型:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | ZIP 固件包 |
| project_name | string | 是 | 项目名称 (3-100 字符) |
| description | string | 是 | 项目描述 (10-2000 字符) |
| version | string | 是 | 版本号 (如 `1.0.0`) |
| supported_board_ids | string | 是 | 开发板 ID，逗号分隔 |
| tags | string | 否 | 标签，逗号分隔 (最多 5 个) |
| published | boolean | 否 | 是否发布 (默认 false) |

**成功响应 (201):**

```json
{
  "success": true,
  "firmware_id": "abc123",
  "message": "固件包上传成功"
}
```

**验证错误 (400):**

```json
{
  "success": false,
  "error_code": "missing_required_files",
  "message": "ZIP 包缺少必需文件",
  "details": {
    "missing_files": ["boot_app0.bin"]
  }
}
```

---

### 更新固件元数据

```
PUT /api/admin/firmware/{firmware_id}
```

**请求体:**

```json
{
  "project_name": "LED 闪烁示例 (更新)",
  "description": "更新后的描述...",
  "version": "1.1.0",
  "supported_board_ids": ["esp32", "esp32s3", "esp32c3"],
  "tags": ["示例", "LED", "入门"]
}
```

**响应:**

```json
{
  "success": true,
  "message": "固件元数据已更新"
}
```

---

### 删除固件包

```
DELETE /api/admin/firmware/{firmware_id}
```

**响应:**

```json
{
  "success": true,
  "message": "固件包已删除"
}
```

---

### 上传缩略图

```
POST /api/admin/firmware/{firmware_id}/thumbnail
```

**请求类型:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 图片文件 (PNG/JPEG/WebP, <500KB, 200x200~1000x1000) |

**响应:**

```json
{
  "success": true,
  "message": "缩略图上传成功"
}
```

---

### 发布/取消发布固件

```
PATCH /api/admin/firmware/{firmware_id}/publish
```

**请求体:**

```json
{
  "published": true
}
```

**响应:**

```json
{
  "success": true,
  "published": true,
  "message": "固件已发布"
}
```

---

### 获取统计信息

```
GET /api/admin/statistics
```

**响应:**

```json
{
  "total_firmware": 25,
  "total_storage_mb": 512.5,
  "downloads_30d": 150,
  "flashes_30d": 89,
  "storage_warning": false,
  "top_firmware": [
    {
      "firmware_id": "abc123",
      "project_name": "LED 闪烁示例",
      "download_count": 42
    }
  ]
}
```

---

### 获取 AI 配置

```
GET /api/admin/ai-config
```

**响应:**

```json
{
  "api_key": "sk-***masked***",
  "api_base": "https://api.siliconflow.cn/v1",
  "model": "deepseek-ai/DeepSeek-V3",
  "temperature": 0.7,
  "max_tokens": 4000
}
```

---

### 更新 AI 配置

```
PUT /api/admin/ai-config
```

**请求体:**

```json
{
  "api_key": "sk-your-new-key",
  "api_base": "https://api.siliconflow.cn/v1",
  "model": "deepseek-ai/DeepSeek-V3",
  "temperature": 0.7,
  "max_tokens": 4000
}
```

系统会先测试 API 连接，成功后保存配置到 `.env` 文件。

**响应:**

```json
{
  "success": true,
  "message": "AI 配置已更新并验证成功"
}
```

---

### 导出固件包

```
GET /api/admin/firmware/{firmware_id}/export
```

**响应:** ZIP 文件流（包含固件文件、元数据和缩略图）

---

### 导入固件包

```
POST /api/admin/firmware/import
```

**请求类型:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 之前导出的 ZIP 包 (<100MB) |
| overwrite | boolean | 版本冲突时是否覆盖 (默认 false) |

**响应:**

```json
{
  "success": true,
  "firmware_id": "new-id-123",
  "message": "固件包导入成功"
}
```

---

## 错误码参考

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `invalid_credentials` | 401 | 用户名或密码错误 |
| `token_expired` | 401 | Token 已过期 |
| `account_locked` | 429 | 账户被锁定 |
| `firmware_not_found` | 404 | 固件包不存在 |
| `file_not_found` | 404 | 文件不存在 |
| `invalid_zip_format` | 400 | ZIP 格式无效 |
| `missing_required_files` | 400 | 缺少必需文件 |
| `file_size_exceeded` | 400 | 文件大小超限 |
| `invalid_metadata` | 400 | 元数据验证失败 |
| `invalid_version_format` | 400 | 版本格式无效 |
| `version_conflict` | 409 | 版本号冲突 |
| `invalid_board_id` | 400 | 无效的开发板 ID |
| `invalid_image_format` | 400 | 图片格式不支持 |
| `image_size_exceeded` | 400 | 图片大小超限 |
| `storage_error` | 500 | 存储错误 |
| `insufficient_storage` | 500 | 存储空间不足 |
| `firmware_in_use` | 409 | 固件正在使用中 |
