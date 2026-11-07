# Bootloader 地址修复

## 问题发现

ESP32-C3 上传后无法启动，串口显示：
```
Invalid image block, can't boot.
```

## 根本原因

**不同 ESP32 芯片的 bootloader 地址不同！**

### ESP32 原始版本
```
0x1000  → bootloader.bin
0x8000  → partitions.bin
0xe000  → boot_app0.bin
0x10000 → app.bin
```

### ESP32-C3 / ESP32-S3
```
0x0     → bootloader.bin  ← 注意：是 0x0，不是 0x1000！
0x8000  → partitions.bin
0xe000  → boot_app0.bin
0x10000 → app.bin
```

## 验证方法

通过 Arduino CLI 的 verbose 输出可以看到：

### ESP32
```bash
arduino-cli compile --fqbn esp32:esp32:esp32 --verbose
# 输出：
# 0x1000 test_compile.ino.bootloader.bin
```

### ESP32-C3
```bash
arduino-cli compile --fqbn esp32:esp32:esp32c3 --verbose
# 输出：
# 0x0 test_compile.ino.bootloader.bin  ← 地址是 0x0
```

## 解决方案

修改 `backend/app/compilation_service.py`，添加 `_get_bootloader_address()` 方法：

```python
def _get_bootloader_address(self, board_id: str) -> int:
    """
    获取开发板的 bootloader 地址
    
    不同芯片的 bootloader 地址不同：
    - ESP32: 0x1000
    - ESP32-C3: 0x0
    - ESP32-S2: 0x1000
    - ESP32-S3: 0x0
    """
    # ESP32-C3 和 ESP32-S3 使用 0x0
    if 'c3' in board_id.lower() or 's3' in board_id.lower():
        return 0x0
    # 其他芯片使用 0x1000
    return 0x1000
```

## 芯片地址对照表

| 芯片型号 | Bootloader 地址 | Partitions | Boot App0 | App |
|---------|----------------|------------|-----------|-----|
| ESP32 | 0x1000 | 0x8000 | 0xe000 | 0x10000 |
| ESP32-S2 | 0x1000 | 0x8000 | 0xe000 | 0x10000 |
| ESP32-S3 | 0x0 | 0x8000 | 0xe000 | 0x10000 |
| ESP32-C3 | 0x0 | 0x8000 | 0xe000 | 0x10000 |
| ESP32-C6 | 0x0 | 0x8000 | 0xe000 | 0x10000 |
| ESP32-H2 | 0x0 | 0x8000 | 0xe000 | 0x10000 |

## 测试步骤

1. **重启后端服务**
   ```bash
   cd backend
   pkill -f "uvicorn"
   python -m uvicorn app.main:app --reload
   ```

2. **清除浏览器缓存**
   - 按 Ctrl+Shift+R 强制刷新

3. **重新编译和上传**
   - 选择 ESP32-C3
   - 编译代码
   - 检查返回的 `firmware_files`，bootloader 地址应该是 `0`（不是 `4096`）
   - 上传到设备

4. **验证**
   - 串口应该不再显示 "Invalid image block"
   - 程序应该正常运行

## 预期结果

### 编译返回（ESP32-C3）
```json
{
  "firmware_files": [
    {
      "name": "bootloader.bin",
      "address": 0,           ← 注意：ESP32-C3 是 0
      "size": 25024,
      "role": "bootloader"
    },
    {
      "name": "partitions.bin",
      "address": 32768,
      "size": 3072,
      "role": "partitions"
    },
    ...
  ]
}
```

### 上传日志
```
Downloaded bootloader.bin: 25024 bytes @ 0x0    ← 注意：地址是 0x0
Downloaded partitions.bin: 3072 bytes @ 0x8000
Downloaded boot_app0.bin: 8192 bytes @ 0xe000
Downloaded app.bin: 280848 bytes @ 0x10000
```

### 串口输出
```
ESP-ROM:esp32c3-api1-20210207
Build:Feb  7 2021
rst:0x1 (POWERON),boot:0xf (SPI_FAST_FLASH_BOOT)
...
Hello from ESP32-C3!  ← 程序正常运行
```

## 参考资料

- [ESP32 Flash Layout](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/partition-tables.html)
- [ESP32-C3 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf)
- [esptool.py Flash Layout](https://docs.espressif.com/projects/esptool/en/latest/esp32c3/advanced-topics/firmware-image-format.html)
