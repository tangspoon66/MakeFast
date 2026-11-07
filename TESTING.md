# 固件烧录修复 - 测试指南

## 快速测试

### 1. 后端测试

#### 自动化测试
```bash
cd backend
python3 test_flash_fix.py
```

预期输出：
```
============================================================
测试固件烧录修复
============================================================

1. 编译测试代码...
✅ 编译成功 (耗时: 12.34秒)
   固件 ID: abc123...
   总大小: 305.23 KB

2. 检查烧录文件清单...
✅ 找到 4 个烧录文件:
   - 0x01000  bootloader.bin        24.00 KB  (bootloader)
   - 0x08000  partitions.bin          3.00 KB  (partitions)
   - 0x0e000  boot_app0.bin           8.00 KB  (boot_app0)
   - 0x10000  app.bin               278.00 KB  (app)

3. 验证烧录文件...
✅ bootloader.bin        @ 0x01000
✅ partitions.bin        @ 0x08000
✅ boot_app0.bin         @ 0x0e000
✅ app.bin               @ 0x10000

4. 检查文件是否存在...
✅ bootloader.bin        存在 (24576 bytes)
✅ partitions.bin        存在 (3072 bytes)
✅ boot_app0.bin         存在 (8192 bytes)
✅ app.bin               存在 (284472 bytes)

============================================================
✅ 所有测试通过!
============================================================
```

#### 手动测试
```bash
cd backend

# 启动后端服务
python -m uvicorn app.main:app --reload

# 在另一个终端测试 API
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() { Serial.begin(115200); } void loop() { delay(1000); }",
    "board_id": "esp32"
  }'
```

检查响应中的 `firmware_files` 字段：
```json
{
  "success": true,
  "firmware_id": "abc123...",
  "firmware_size": 312345,
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
      "size": 284472,
      "role": "app"
    }
  ],
  "duration": 12.34
}
```

测试下载接口：
```bash
# 下载 bootloader
curl http://localhost:8000/api/firmware/{firmware_id}/bootloader.bin -o bootloader.bin

# 下载 partitions
curl http://localhost:8000/api/firmware/{firmware_id}/partitions.bin -o partitions.bin

# 下载 boot_app0
curl http://localhost:8000/api/firmware/{firmware_id}/boot_app0.bin -o boot_app0.bin

# 下载 app
curl http://localhost:8000/api/firmware/{firmware_id}/app.bin -o app.bin

# 检查文件大小
ls -lh *.bin
```

### 2. 前端测试

#### 开发模式测试
```bash
cd frontend
npm run dev
```

访问 http://localhost:5173

#### 测试步骤
1. **编译代码**
   - 输入测试代码
   - 点击"编译代码"
   - 等待编译完成

2. **检查烧录文件清单**
   - 编译成功后，查看右侧面板
   - 应该显示 4 个烧录文件：
     ```
     烧录文件
     • 0x01000  bootloader.bin  (24.0 KB)
     • 0x08000  partitions.bin  (3.0 KB)
     • 0x0e000  boot_app0.bin   (8.0 KB)
     • 0x10000  app.bin         (278.0 KB)
     ```

3. **上传固件**
   - 连接 ESP32 设备
   - 点击"上传到设备"
   - 观察上传进度：
     - 正在连接设备...
     - 正在下载 bootloader.bin...
     - 正在下载 partitions.bin...
     - 正在下载 boot_app0.bin...
     - 正在下载 app.bin...
     - 正在写入固件... 0-100%
     - 上传完成！

4. **验证设备**
   - 设备应该自动重启
   - 打开串口监视器（115200 波特率）
   - 应该看到程序输出

#### 浏览器控制台检查
打开浏览器开发者工具（F12），查看 Console：

```javascript
// 应该看到类似的日志
Downloaded bootloader.bin: 24576 bytes @ 0x1000
Downloaded partitions.bin: 3072 bytes @ 0x8000
Downloaded boot_app0.bin: 8192 bytes @ 0xe000
Downloaded app.bin: 284472 bytes @ 0x10000
```

### 3. 集成测试

#### 完整流程测试
```bash
# 1. 启动后端
cd backend
python -m uvicorn app.main:app --reload &

# 2. 启动前端
cd frontend
npm run dev &

# 3. 打开浏览器
open http://localhost:5173
```

#### 测试场景

##### 场景 1: 空白芯片
1. 使用全新的 ESP32 芯片（从未烧录过）
2. 编译并上传固件
3. 预期：成功上传，设备正常运行

##### 场景 2: 已烧录芯片
1. 使用已经烧录过其他固件的 ESP32
2. 编译并上传新固件
3. 预期：成功覆盖，设备运行新固件

##### 场景 3: 不同芯片型号
1. 测试 ESP32-S2
2. 测试 ESP32-S3
3. 测试 ESP32-C3
4. 预期：每个芯片都能正常工作

##### 场景 4: 复杂代码
1. 使用包含 WiFi、Bluetooth 等库的代码
2. 编译并上传
3. 预期：功能正常

## 故障排查

### 问题 1: 缺少 boot_app0.bin
**症状**: 编译成功，但只有 3 个文件

**原因**: Arduino15 工具链未安装或路径不对

**解决**:
```bash
# 检查 Arduino15 路径
ls ~/Library/Arduino15/packages/esp32/hardware/esp32/*/tools/partitions/boot_app0.bin

# 如果不存在，重新安装 ESP32 工具链
arduino-cli core install esp32:esp32
```

### 问题 2: 上传失败
**症状**: 上传时提示"下载 xxx.bin 失败"

**原因**: 后端文件路径不对

**解决**:
```bash
# 检查固件目录
ls -la /tmp/esp_firmware/{firmware_id}/

# 应该看到 4 个文件
bootloader.bin
partitions.bin
boot_app0.bin
app.bin
```

### 问题 3: 设备无法启动
**症状**: 上传成功，但设备不运行

**原因**: 可能是地址错误或文件损坏

**解决**:
```bash
# 使用 esptool.py 手动验证
esptool.py --port /dev/ttyUSB0 read_flash 0x1000 0x1000 bootloader_read.bin
esptool.py --port /dev/ttyUSB0 read_flash 0x8000 0x1000 partitions_read.bin
esptool.py --port /dev/ttyUSB0 read_flash 0xe000 0x2000 boot_app0_read.bin
esptool.py --port /dev/ttyUSB0 read_flash 0x10000 0x100000 app_read.bin

# 对比文件
diff bootloader.bin bootloader_read.bin
```

### 问题 4: 编译超时
**症状**: 编译时间过长

**原因**: 代码太复杂或库太多

**解决**:
- 简化代码
- 增加超时时间（在 `compilation_service.py` 中）

## 性能基准

### 编译时间
- 简单代码（Blink）: 10-15 秒
- 中等代码（WiFi）: 15-25 秒
- 复杂代码（多库）: 25-40 秒

### 上传时间
- 下载固件: 1-2 秒
- 连接设备: 2-3 秒
- 写入固件: 10-15 秒
- 总计: 15-20 秒

### 固件大小
- Bootloader: ~24 KB
- Partitions: ~3 KB
- Boot App0: ~8 KB
- App: 200-500 KB（取决于代码）
- 总计: 235-535 KB

## 成功标准

### 后端
- ✅ 编译成功返回 4 个文件
- ✅ 每个文件地址正确
- ✅ 文件实际存在且大小正确
- ✅ 下载接口返回正确的文件

### 前端
- ✅ 显示烧录文件清单
- ✅ 按顺序下载所有文件
- ✅ 按正确地址写入
- ✅ 上传进度正确显示

### 设备
- ✅ 上传后自动重启
- ✅ 程序正常运行
- ✅ 串口输出正常
- ✅ 功能符合预期

## 下一步

如果所有测试通过：
1. ✅ 提交代码
2. ✅ 更新文档
3. ✅ 部署到生产环境

如果测试失败：
1. 查看错误日志
2. 参考故障排查部分
3. 修复问题后重新测试
