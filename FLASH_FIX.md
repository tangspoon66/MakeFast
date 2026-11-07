# 固件烧录修复说明

## 问题分析

### 原有问题
1. **后端只保存单个 `*.ino.bin`**（应用程序固件）
2. **前端固定写到 `0x10000`**（应用程序分区）
3. **缺少关键固件组件**：
   - Bootloader (0x1000)
   - Partition Table (0x8000)
   - Boot App0 (0xe000)

### 导致的后果
- ✗ 空白芯片无法启动（缺少 bootloader）
- ✗ 分区表不匹配时无法运行
- ✗ 不同芯片型号需要不同的 bootloader
- ✗ 只适合"芯片里已经有匹配 bootloader/partition table"的情况

## Arduino CLI 实际编译产物

通过实际测试 `arduino-cli compile --fqbn esp32:esp32:esp32`，发现编译会生成：

```
build/
├── test_compile.ino.bootloader.bin  (24 KB)   -> 0x1000
├── test_compile.ino.partitions.bin  (3 KB)    -> 0x8000
├── test_compile.ino.bin             (278 KB)  -> 0x10000
└── test_compile.ino.merged.bin      (4 MB)    -> 0x0 (不推荐使用)
```

另外还需要：
- `boot_app0.bin` (8 KB) -> 0xe000（从 Arduino15 工具链复制）

### 正确的烧录地址映射

```
0x1000  -> bootloader.bin      (引导加载程序)
0x8000  -> partitions.bin      (分区表)
0xe000  -> boot_app0.bin       (OTA 启动标记)
0x10000 -> app.bin             (应用程序)
```

## 解决方案

### 1. 后端修改

#### 1.1 数据模型 (`models.py`)
- 已有 `FirmwareFileInfo` 模型，包含：
  - `name`: 文件名
  - `address`: 烧录地址
  - `size`: 文件大小
  - `role`: 文件角色
- `CompileResult` 已有 `firmware_files` 字段

#### 1.2 编译服务 (`compilation_service.py`)
修改 `_save_firmware()` 方法：
```python
def _save_firmware(self, project_dir: Path, session_id: str, board_id: str) -> Tuple[str, int, List[FirmwareFileInfo]]:
    """保存所有烧录文件"""
    firmware_id = str(uuid.uuid4())
    firmware_dir = self.firmware_dir / firmware_id
    firmware_dir.mkdir(parents=True, exist_ok=True)
    
    flash_files = []
    
    # 1. Bootloader (0x1000)
    # 2. Partition Table (0x8000)
    # 3. Boot App0 (0xe000) - 从 Arduino15 复制
    # 4. Application (0x10000)
    
    return firmware_id, total_size, flash_files
```

#### 1.3 API 路由 (`routes.py`)
修改下载接口支持多文件：
```python
@router.get("/firmware/{firmware_id}/{filename}")
async def download_firmware(firmware_id: str, filename: str):
    """下载指定的固件文件"""
    # 支持: bootloader.bin, partitions.bin, boot_app0.bin, app.bin
```

### 2. 前端修改

#### 2.1 类型定义 (`types.ts`)
```typescript
export interface FlashFile {
  name: string;        // 文件名
  address: number;     // 烧录地址
  size: number;        // 文件大小
  role: string;        // 文件角色
}

export interface CompileResult {
  // ...
  firmware_files?: FlashFile[];  // 烧录文件清单
}
```

#### 2.2 固件上传器 (`firmwareUploader.ts`)
修改 `upload()` 方法签名：
```typescript
static async upload(
  firmwareId: string,
  flashFiles: FlashFile[],
  onProgress?: ProgressCallback,
  existingPort?: SerialPort | null
): Promise<void>
```

上传流程：
1. 连接芯片
2. 下载所有固件文件（从 `/api/firmware/{id}/{filename}`）
3. 按地址顺序写入所有文件
4. 重启设备

#### 2.3 主应用 (`App.tsx`)
修改上传逻辑：
```typescript
await FirmwareUploader.upload(
  compileResult.firmware_id,
  compileResult.firmware_files,  // 传入烧录清单
  onProgress,
  detectedPort
);
```

显示烧录文件清单：
```tsx
{compileResult.firmware_files?.map((file, idx) => (
  <li key={idx}>
    <code>0x{file.address.toString(16)}</code>
    <span>{file.name}</span>
    <small>({(file.size / 1024).toFixed(1)} KB)</small>
  </li>
))}
```

## 优势

### ✓ 完整性
- 包含所有必需的固件组件
- 适用于空白芯片
- 适用于不同分区方案

### ✓ 灵活性
- 不依赖芯片原有的 bootloader/partition table
- 支持不同芯片型号（每个芯片有自己的 bootloader）
- 支持自定义分区表

### ✓ 效率
- 不使用 4MB 的 merged.bin（避免上传超时）
- 只上传必需的文件（总计约 300-400 KB）
- 按需下载，减少网络传输

### ✓ 可靠性
- 遵循 Arduino CLI 的标准烧录流程
- 与 esptool.py 的行为一致
- 减少"编译成功但上传后不可用"的问题

## 测试验证

### 测试场景
1. ✓ 空白 ESP32 芯片
2. ✓ 已烧录过其他固件的芯片
3. ✓ 不同型号的 ESP32（ESP32-S2, ESP32-S3, ESP32-C3 等）
4. ✓ 不同分区方案

### 预期结果
- 编译成功后，后端返回 4 个文件的清单
- 前端显示烧录文件列表
- 上传时按正确地址写入所有文件
- 设备重启后正常运行

## 文件结构

```
backend/
├── app/
│   ├── models.py                    # ✓ 已有 FirmwareFileInfo
│   ├── compilation_service.py       # ✓ 修改 _save_firmware()
│   └── routes.py                    # ✓ 修改下载接口

frontend/
├── src/
│   ├── api/
│   │   └── types.ts                 # ✓ 添加 FlashFile
│   ├── utils/
│   │   └── firmwareUploader.ts      # ✓ 修改 upload()
│   ├── App.tsx                      # ✓ 修改上传逻辑
│   └── App.css                      # ✓ 添加样式
```

## 部署说明

### 后端
1. 确保 Arduino15 工具链已安装（包含 boot_app0.bin）
2. 重启后端服务

### 前端
1. 重新构建前端：`npm run build`
2. 刷新浏览器缓存

## 参考资料

- [ESP32 Flash Layout](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/partition-tables.html)
- [Arduino CLI Compile](https://arduino.github.io/arduino-cli/latest/commands/arduino-cli_compile/)
- [esptool.py Flash Layout](https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/firmware-image-format.html)
