# ESP32 工具链初始化脚本

本目录包含用于初始化 ESP32 开发环境的脚本。

## 脚本说明

### 1. init_toolchain.py

初始化 ESP32 工具链，包括：
- 安装 Arduino CLI
- 配置 ESP32 开发板支持
- 安装 ESP32 核心包

**使用方法**:
```bash
python3 scripts/init_toolchain.py
```

**前置条件**:
- Python 3.7+
- curl
- sudo 权限（用于安装 Arduino CLI）

**输出**:
- Arduino CLI 安装到 `/usr/local/bin/arduino-cli`
- ESP32 核心包安装到 `~/.arduino15/packages/esp32/`

### 2. install_preinstalled_libs.py

安装 20-30 个常用的 ESP32 库，包括：
- 网络库：PubSubClient, ArduinoJson, ESPAsyncWebServer, AsyncTCP
- 显示屏库：Adafruit GFX, Adafruit SSD1306, TFT_eSPI, U8g2
- 传感器库：DHT, BME280, OneWire, DallasTemperature
- LED 库：FastLED, Adafruit NeoPixel
- 其他：ESP32Servo, Servo

**使用方法**:
```bash
python3 scripts/install_preinstalled_libs.py
```

**前置条件**:
- Arduino CLI 已安装（运行 `init_toolchain.py`）
- ESP32 核心包已安装

**输出**:
- 库安装到 `~/.arduino15/libraries/`

## 完整初始化流程

在开发环境或 Docker 容器中首次设置时，按以下顺序运行：

```bash
# 1. 初始化工具链
python3 scripts/init_toolchain.py

# 2. 安装预装库
python3 scripts/install_preinstalled_libs.py

# 3. 验证安装
arduino-cli version
arduino-cli core list
arduino-cli lib list
```

## Docker 集成

这些脚本已集成到 `Dockerfile` 中，在构建镜像时自动执行：

```dockerfile
# Initialize ESP32 toolchain
RUN python3 /app/scripts/init_toolchain.py

# Install preinstalled libraries
RUN python3 /app/scripts/install_preinstalled_libs.py
```

## 故障排查

### Arduino CLI 安装失败

**问题**: `curl: command not found` 或下载失败

**解决方案**:
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y curl

# macOS
brew install curl
```

### ESP32 核心安装失败

**问题**: 网络连接超时或下载失败

**解决方案**:
1. 检查网络连接
2. 使用国内镜像（如果在中国）
3. 手动下载并安装：
```bash
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

### 库安装失败

**问题**: 某些库安装失败

**解决方案**:
1. 检查库名是否正确
2. 手动安装失败的库：
```bash
arduino-cli lib install "Library Name"
```
3. 查看详细错误信息：
```bash
arduino-cli lib install "Library Name" --verbose
```

## 维护

### 更新预装库列表

编辑 `install_preinstalled_libs.py` 中的 `PREINSTALLED_LIBRARIES` 列表：

```python
PREINSTALLED_LIBRARIES = [
    'PubSubClient',
    'ArduinoJson',
    # 添加新库...
]
```

### 更新 ESP32 核心版本

```bash
arduino-cli core update-index
arduino-cli core upgrade esp32:esp32
```

## 参考资料

- [Arduino CLI 文档](https://arduino.github.io/arduino-cli/)
- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [Arduino 库管理器](https://www.arduino.cc/reference/en/libraries/)
