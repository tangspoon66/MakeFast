# 固件组件使用文档

本文档说明如何使用 `FirmwareCard` 和 `FirmwareFilter` 组件。

## FirmwareCard 组件

固件卡片组件用于显示固件包的基本信息。

### Props

```typescript
interface FirmwareCardProps {
  firmware: FirmwareMetadata;  // 固件元数据
  currentBoardId?: string;     // 当前选中的开发板 ID（可选）
}
```

### 使用示例

```tsx
import { FirmwareCard } from './components/FirmwareCard';
import type { FirmwareMetadata } from './api/types';

function FirmwareList() {
  const [firmwares, setFirmwares] = useState<FirmwareMetadata[]>([]);
  const currentBoardId = 'esp32'; // 从状态或上下文获取
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {firmwares.map((firmware) => (
        <FirmwareCard
          key={firmware.firmware_id}
          firmware={firmware}
          currentBoardId={currentBoardId}
        />
      ))}
    </div>
  );
}
```

### 功能特性

- **缩略图显示**: 如果固件有缩略图则显示，否则显示默认占位图标
- **兼容性标记**: 当 `currentBoardId` 与固件支持的开发板匹配时，显示"兼容"标记
- **描述截断**: 自动截断超过 200 字符的描述
- **标签显示**: 显示最多 3 个标签，其余显示 "+N"
- **点击跳转**: 点击卡片跳转到 `/firmware/{firmware_id}` 详情页
- **悬停效果**: 鼠标悬停时卡片上浮并显示阴影

## FirmwareFilter 组件

固件筛选组件提供开发板、标签和搜索筛选功能。

### Props

```typescript
interface FirmwareFilterProps {
  onFilterChange: (filters: FirmwareFilters) => void;  // 筛选条件变化回调
}

interface FirmwareFilters {
  board_id?: string;    // 开发板 ID
  tags?: string[];      // 标签列表
  search?: string;      // 搜索关键词
}
```

### 使用示例

```tsx
import { FirmwareFilter } from './components/FirmwareFilter';
import { FirmwareClient } from './api/firmwareClient';
import type { FirmwareFilters, FirmwareMetadata } from './api/types';

function FirmwareLibrary() {
  const [firmwares, setFirmwares] = useState<FirmwareMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  
  const handleFilterChange = async (filters: FirmwareFilters) => {
    setLoading(true);
    try {
      const data = await FirmwareClient.getFirmwareList(filters);
      setFirmwares(data);
    } catch (error) {
      console.error('获取固件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <FirmwareFilter onFilterChange={handleFilterChange} />
      
      {loading ? (
        <div>加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {firmwares.map((firmware) => (
            <FirmwareCard key={firmware.firmware_id} firmware={firmware} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 功能特性

- **开发板筛选**: 从后端 API 动态加载开发板列表
- **标签筛选**: 支持多选标签（预定义常用标签）
- **搜索功能**: 300ms 防抖优化，避免频繁请求
- **活动筛选显示**: 显示当前活动的筛选条件，可单独移除
- **清除筛选**: 一键清除所有筛选条件
- **响应式设计**: 移动端友好的布局

### 常用标签列表

组件内置以下常用标签：
- LED
- WiFi
- Bluetooth
- Sensor
- Display
- IoT
- Demo
- Tutorial

如需修改标签列表，编辑 `FirmwareFilter.tsx` 中的 `COMMON_TAGS` 常量。

## 样式定制

组件样式定义在 `App.css` 中，使用以下 CSS 类：

### FirmwareCard 样式类
- `.firmware-card`: 卡片容器
- `.firmware-card__thumbnail`: 缩略图区域
- `.firmware-card__badge`: 兼容性标记
- `.firmware-card__content`: 内容区域
- `.firmware-card__title`: 标题
- `.firmware-card__version`: 版本标签
- `.firmware-card__tags`: 标签列表

### FirmwareFilter 样式类
- `.firmware-filter`: 筛选器容器
- `.firmware-filter__search`: 搜索框
- `.firmware-filter__select-wrapper`: 下拉框包装器
- `.firmware-filter__tags-button`: 标签按钮
- `.firmware-filter__tags-dropdown`: 标签下拉菜单
- `.firmware-filter__active-filters`: 活动筛选标签区域

## 完整页面示例

```tsx
import { useState } from 'react';
import { FirmwareCard } from './components/FirmwareCard';
import { FirmwareFilter } from './components/FirmwareFilter';
import { FirmwareClient } from './api/firmwareClient';
import type { FirmwareFilters, FirmwareMetadata } from './api/types';

export function FirmwareLibraryPage() {
  const [firmwares, setFirmwares] = useState<FirmwareMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFilterChange = async (filters: FirmwareFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await FirmwareClient.getFirmwareList(filters);
      setFirmwares(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取固件列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">固件库</h1>
      
      <FirmwareFilter onFilterChange={handleFilterChange} />
      
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="mt-6 text-center text-gray-500">
          加载中...
        </div>
      ) : firmwares.length === 0 ? (
        <div className="mt-6 text-center text-gray-500">
          没有找到匹配的固件包
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {firmwares.map((firmware) => (
            <FirmwareCard
              key={firmware.firmware_id}
              firmware={firmware}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## 测试

组件包含完整的单元测试：

```bash
# 运行 FirmwareCard 测试
npm test FirmwareCard.test.tsx

# 运行 FirmwareFilter 测试
npm test FirmwareFilter.test.tsx

# 运行所有测试
npm test
```

## 依赖

- React 18+
- React Router v6 (用于 Link 组件)
- Heroicons (图标库)
- TailwindCSS (样式框架)

## 注意事项

1. **API 端点**: 确保后端 API 端点 `/api/firmware` 和 `/api/boards` 可用
2. **图片加载**: 缩略图通过 `/api/firmware/{firmware_id}/thumbnail` 加载
3. **防抖优化**: 搜索使用 300ms 防抖，避免频繁请求
4. **响应式设计**: 组件在移动端和桌面端都有良好的显示效果
5. **错误处理**: 建议在使用组件时添加适当的错误处理和加载状态
