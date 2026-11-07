# 调试步骤 - 网页上传不闪问题

## 问题现象
- Arduino IDE 上传：✅ 能闪
- 网页上传：❌ 不能闪

## 可能的原因

### 1. 后端没有生成完整的固件文件
### 2. 前端没有下载所有文件
### 3. 前端没有按正确地址烧录

## 调试步骤

### 步骤 1: 检查后端编译结果

在网页上编译代码后，打开浏览器开发者工具（F12），查看 Network 标签：

1. 找到 `/api/compile` 请求
2. 查看 Response，应该看到：

```json
{
  "success": true,
  "firmware_id": "xxx-xxx-xxx",
  "firmware_size": 300000,
  "firmware_files": [
    {
      "name": "bootloader.bin",
      "address": 4096,
      "size": 24576,
      "role": "bootloader"
    },
    {
      "name": "partitions.bin",
      "address": 32768,
      "size": 3072,
      "role": "partitions"
    },
    {
      "name": "boot_app0.bin",
      "address": 57344,
      "size": 8192,
      "role": "boot_app0"
    },
    {
      "name": "app.bin",
      "address": 65536,
      "size": 200000,
      "role": "app"
    }
  ],
  "duration": 12.5
}
```

**如果 `firmware_files` 是空的或者没有这个字段**，说明后端没有正确生成文件。

### 步骤 2: 检查前端是否显示烧录文件清单

编译成功后，在右侧面板应该看到：

```
烧录文件
• 0x01000  bootloader.bin  (24.0 KB)
• 0x08000  partitions.bin  (3.0 KB)
• 0x0e000  boot_app0.bin   (8.0 KB)
• 0x10000  app.bin         (200.0 KB)
```

**如果没有显示这个列表**，说明前端没有正确读取 `firmware_files`。

### 步骤 3: 检查前端是否下载了所有文件

点击"上传到设备"后，在 Network 标签应该看到 4 个下载请求：

```
GET /api/firmware/{id}/bootloader.bin
GET /api/firmware/{id}/partitions.bin
GET /api/firmware/{id}/boot_app0.bin
GET /api/firmware/{id}/app.bin
```

**如果只有 1 个请求**（比如只下载了 app.bin），说明前端还在用旧的上传逻辑。

### 步骤 4: 检查 Console 日志

在 Console 标签应该看到：

```
Downloaded bootloader.bin: 24576 bytes @ 0x1000
Downloaded partitions.bin: 3072 bytes @ 0x8000
Downloaded boot_app0.bin: 8192 bytes @ 0xe000
Downloaded app.bin: 200000 bytes @ 0x10000
```

**如果没有这些日志**，说明下载逻辑有问题。

### 步骤 5: 检查后端文件是否存在

如果前端显示正常，检查后端是否真的生成了文件：

```bash
# 查看固件目录
ls -la /tmp/esp_firmware/

# 应该看到一个 UUID 目录
ls -la /tmp/esp_firmware/{firmware_id}/

# 应该看到 4 个文件
bootloader.bin
partitions.bin
boot_app0.bin
app.bin
```

## 快速诊断命令

### 检查后端日志
```bash
# 如果后端在运行，查看日志
tail -f backend/logs/app.log

# 或者直接看终端输出
```

应该看到类似：
```
INFO: Saved bootloader: 24576 bytes
INFO: Saved partitions: 3072 bytes
INFO: Saved boot_app0: 8192 bytes
INFO: Saved app: 200000 bytes
INFO: Saved firmware xxx: 4 files, 300000 bytes total
```

### 测试后端 API

```bash
# 1. 编译代码
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() { pinMode(8, OUTPUT); } void loop() { digitalWrite(8, HIGH); delay(1000); digitalWrite(8, LOW); delay(1000); }",
    "board_id": "esp32c3"
  }' | jq .

# 2. 检查返回的 firmware_files 字段

# 3. 下载文件测试
curl http://localhost:8000/api/firmware/{firmware_id}/bootloader.bin -o test_bootloader.bin
curl http://localhost:8000/api/firmware/{firmware_id}/partitions.bin -o test_partitions.bin
curl http://localhost:8000/api/firmware/{firmware_id}/boot_app0.bin -o test_boot_app0.bin
curl http://localhost:8000/api/firmware/{firmware_id}/app.bin -o test_app.bin

# 4. 检查文件大小
ls -lh test_*.bin
```

## 可能的问题和解决方案

### 问题 1: 后端没有重启
**症状**: `firmware_files` 字段为空

**解决**: 重启后端服务
```bash
cd backend
# 停止旧进程
pkill -f "uvicorn app.main:app"

# 重新启动
python -m uvicorn app.main:app --reload
```

### 问题 2: 前端没有重新构建
**症状**: 前端还在用旧的上传逻辑

**解决**: 清除缓存并重新加载
```bash
cd frontend
npm run build

# 或者开发模式
npm run dev
```

然后在浏览器按 `Ctrl+Shift+R`（强制刷新）

### 问题 3: boot_app0.bin 找不到
**症状**: 后端日志显示 "boot_app0.bin not found"

**解决**: 检查 Arduino15 路径
```bash
# macOS
ls ~/Library/Arduino15/packages/esp32/hardware/esp32/*/tools/partitions/boot_app0.bin

# 如果不存在，重新安装
arduino-cli core install esp32:esp32
```

### 问题 4: 浏览器缓存了旧代码
**症状**: 前端代码已更新，但行为没变

**解决**: 
1. 打开开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

## 对比 Arduino IDE 的烧录

Arduino IDE 上传时会执行：
```bash
esptool.py --chip esp32c3 write_flash \
  0x0    bootloader.bin \
  0x8000 partitions.bin \
  0xe000 boot_app0.bin \
  0x10000 app.bin
```

我们的网页版应该做同样的事情。

## 下一步

请按照上面的步骤检查，然后告诉我：
1. 编译后的 Response 中有没有 `firmware_files` 字段？
2. 前端有没有显示烧录文件清单？
3. Network 标签有没有 4 个下载请求？
4. Console 有没有下载日志？

这样我就能知道问题出在哪里了！
