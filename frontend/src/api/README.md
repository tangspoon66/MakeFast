# API 客户端使用指南

本目录包含与后端 API 通信的客户端模块。

## 模块概览

### 1. `firmwareClient.ts` - 用户端固件 API 客户端

提供用户端固件浏览、搜索、下载和烧录功能（无需认证）。

#### 主要功能

- `getFirmwareList(filters?)` - 获取已发布固件列表
- `getFirmwareDetail(firmwareId)` - 获取固件详情
- `downloadFirmware(firmwareId)` - 下载固件包（ZIP）
- `downloadFirmwareFile(firmwareId, filename)` - 下载单个固件文件
- `getThumbnailUrl(firmwareId)` - 获取缩略图 URL
- `logFlashEvent(firmwareId, success)` - 记录烧录事件

#### 使用示例

```typescript
import { FirmwareClient } from './api/firmwareClient';

// 获取固件列表
const firmwares = await FirmwareClient.getFirmwareList({
  board_id: 'esp32dev',
  tags: ['wifi', 'sensor'],
  search: 'temperature'
});

// 获取固件详情
const firmware = await FirmwareClient.getFirmwareDetail('firmware-id');

// 下载固件包
const blob = await FirmwareClient.downloadFirmware('firmware-id');
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${firmware.project_name}_v${firmware.version}.zip`;
a.click();

// 获取缩略图 URL
const thumbnailUrl = FirmwareClient.getThumbnailUrl('firmware-id');

// 记录烧录事件
await FirmwareClient.logFlashEvent('firmware-id', true);
```

#### 错误处理

```typescript
import { FirmwareApiError } from './api/firmwareClient';

try {
  const firmwares = await FirmwareClient.getFirmwareList();
} catch (error) {
  if (error instanceof FirmwareApiError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Error Code:', error.errorCode);
  }
}
```

### 2. `adminClient.ts` - 管理员 API 客户端

提供管理员认证和固件管理功能（需要认证）。

#### 主要功能

**认证相关：**
- `login(credentials)` - 管理员登录
- `logout()` - 管理员登出
- `verifyToken()` - 验证 Token
- `isLoggedIn()` - 检查是否已登录

**固件管理：**
- `getAllFirmware(filters?)` - 获取所有固件（包括未发布）
- `uploadFirmware(data)` - 上传固件包
- `updateFirmwareMetadata(firmwareId, metadata)` - 更新元数据
- `deleteFirmware(firmwareId)` - 删除固件
- `uploadThumbnail(firmwareId, file)` - 上传缩略图
- `togglePublish(firmwareId, published)` - 切换发布状态

**统计信息：**
- `getStatistics()` - 获取统计信息

**AI 配置：**
- `getAIConfig()` - 获取 AI 配置
- `updateAIConfig(config)` - 更新 AI 配置

#### 使用示例

```typescript
import { AdminClient } from './api/adminClient';

// 登录
try {
  const token = await AdminClient.login({
    username: 'admin',
    password: 'EXAMPLE_PASSWORD_NOT_A_LOGIN'
  });
  console.log('登录成功:', token);
} catch (error) {
  console.error('登录失败:', error);
}

// 检查登录状态
if (AdminClient.isLoggedIn()) {
  console.log('已登录');
}

// 验证 Token
try {
  const userInfo = await AdminClient.verifyToken();
  console.log('用户信息:', userInfo);
} catch (error) {
  console.error('Token 无效:', error);
}

// 获取所有固件
const firmwares = await AdminClient.getAllFirmware({
  search: 'temperature'
});

// 上传固件
const file = document.querySelector('input[type="file"]').files[0];
const result = await AdminClient.uploadFirmware({
  zip_file: file,
  project_name: 'WiFi 温度监控',
  description: '基于 ESP32 的 WiFi 温度监控系统',
  version: '1.0.0',
  supported_board_ids: ['esp32dev', 'esp32'],
  tags: ['wifi', 'sensor', 'iot'],
  published: false
});
console.log('上传成功，固件 ID:', result.firmware_id);

// 更新元数据
await AdminClient.updateFirmwareMetadata('firmware-id', {
  description: '更新后的描述',
  tags: ['wifi', 'sensor', 'iot', 'updated']
});

// 上传缩略图
const thumbnailFile = document.querySelector('input[type="file"]').files[0];
await AdminClient.uploadThumbnail('firmware-id', thumbnailFile);

// 发布固件
await AdminClient.togglePublish('firmware-id', true);

// 删除固件
await AdminClient.deleteFirmware('firmware-id');

// 获取统计信息
const stats = await AdminClient.getStatistics();
console.log('统计信息:', stats);

// 获取 AI 配置
const aiConfig = await AdminClient.getAIConfig();
console.log('AI 配置:', aiConfig);

// 更新 AI 配置
await AdminClient.updateAIConfig({
  api_key: 'sk-xxx',
  api_base: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 2000
});

// 登出
await AdminClient.logout();
```

#### 错误处理

```typescript
import { AdminApiError } from './api/adminClient';

try {
  await AdminClient.login({ username: 'admin', password: 'wrong' });
} catch (error) {
  if (error instanceof AdminApiError) {
    if (error.statusCode === 401) {
      console.error('用户名或密码错误');
    } else if (error.statusCode === 429) {
      console.error('账户已锁定');
    }
  }
}
```

#### Token 管理

AdminClient 自动管理 JWT token：
- 登录成功后自动保存 token 到 localStorage
- 所有需要认证的请求自动添加 Authorization 头
- 401 错误时自动清除 token
- 登出时自动清除 token

### 3. `types.ts` - 类型定义

包含所有 API 相关的 TypeScript 类型定义。

#### 主要类型

**固件相关：**
- `FirmwareMetadata` - 固件元数据
- `FirmwareFileInfo` - 固件文件信息
- `FirmwareFilters` - 固件筛选条件
- `FirmwareUploadData` - 固件上传数据

**认证相关：**
- `AdminCredentials` - 管理员凭证
- `AdminToken` - 管理员 Token

**配置相关：**
- `AIConfig` - AI 配置

**统计相关：**
- `AdminStatistics` - 管理员统计信息

## 错误处理最佳实践

### 1. 使用 try-catch 包裹 API 调用

```typescript
try {
  const result = await FirmwareClient.getFirmwareList();
  // 处理成功结果
} catch (error) {
  // 处理错误
  if (error instanceof FirmwareApiError) {
    // 显示用户友好的错误消息
    showErrorMessage(error.message);
  }
}
```

### 2. 处理特定错误码

```typescript
try {
  const firmware = await FirmwareClient.getFirmwareDetail(id);
} catch (error) {
  if (error instanceof FirmwareApiError) {
    if (error.statusCode === 404) {
      // 固件不存在
      navigate('/firmware');
    } else if (error.statusCode === 0) {
      // 网络错误
      showErrorMessage('网络连接失败，请检查网络');
    }
  }
}
```

### 3. 处理认证错误

```typescript
try {
  const firmwares = await AdminClient.getAllFirmware();
} catch (error) {
  if (error instanceof AdminApiError) {
    if (error.statusCode === 401) {
      // Token 过期，跳转到登录页
      navigate('/admin/login');
    }
  }
}
```

## 重试逻辑

对于网络错误，可以实现简单的重试逻辑：

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FirmwareApiError && error.statusCode === 0) {
        // 网络错误，重试
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}

// 使用示例
const firmwares = await fetchWithRetry(() =>
  FirmwareClient.getFirmwareList()
);
```

## 超时配置

API 客户端已配置以下超时：
- 默认请求：10 秒
- 编译请求：70 秒
- 下载请求：60 秒
- 上传请求：120 秒

如需修改超时配置，可以在客户端文件中调整相应的常量。

## 开发建议

1. **始终处理错误**：所有 API 调用都应该包裹在 try-catch 中
2. **使用类型定义**：充分利用 TypeScript 类型检查
3. **显示加载状态**：API 调用期间显示加载指示器
4. **用户友好的错误消息**：将技术错误转换为用户可理解的消息
5. **日志记录**：在开发环境记录 API 错误以便调试
