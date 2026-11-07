# 多文件项目编译指南

## 功能概述

现在平台已支持多文件项目编译，可以直接上传包含多个文件的 Arduino 项目（如 .ino + .cpp + .h）。

## 使用方法

### 1. 上传多文件项目

#### 方式一：拖拽文件夹
1. 打开编辑器
2. 将整个项目文件夹拖拽到编辑器区域
3. 系统会自动读取所有代码文件
4. 切换到"项目视图"查看所有文件

#### 方式二：点击上传按钮
1. 点击编辑器顶部的"上传项目"按钮
2. 选择多个文件（按住 Ctrl/Cmd 多选）
3. 系统会自动加载所有文件

### 2. 编辑多文件项目

在"项目视图"中：
- 点击文件标签切换不同文件
- 每个文件独立编辑
- 支持添加、删除、复制文件
- 文件类型图标区分（.ino, .cpp, .h 等）

### 3. 编译多文件项目

1. 确保所有文件都已上传
2. 选择正确的开发板
3. 点击"编译代码"按钮
4. 系统会将所有文件发送到后端编译

## 技术实现

### 前端

**数据结构：**
```typescript
interface ProjectFile {
  name: string;      // 文件名，如 "sketch.ino"
  content: string;   // 文件内容
}

interface CompileRequest {
  code?: string;              // 单文件模式
  files?: ProjectFile[];      // 多文件模式
  board_id: string;
}
```

**编译调用：**
```typescript
// 单文件编译
await CompilationClient.compile(code, boardId);

// 多文件编译
await CompilationClient.compile(undefined, boardId, files);
```

### 后端

**项目结构：**
```
/tmp/compile/{session_id}/
├── sketch.ino          # 主文件
├── helper.cpp          # C++ 源文件
├── helper.h            # 头文件
└── build/              # 编译输出
```

**编译流程：**
1. 接收文件列表
2. 在临时目录创建所有文件
3. 使用 Arduino CLI 编译整个项目
4. 生成固件文件

## 示例项目

### 示例 1：简单的多文件项目

**sketch.ino:**
```cpp
#include "helper.h"

void setup() {
  Serial.begin(115200);
  initHelper();
}

void loop() {
  doSomething();
  delay(1000);
}
```

**helper.h:**
```cpp
#ifndef HELPER_H
#define HELPER_H

void initHelper();
void doSomething();

#endif
```

**helper.cpp:**
```cpp
#include "helper.h"
#include <Arduino.h>

void initHelper() {
  Serial.println("Helper initialized");
}

void doSomething() {
  Serial.println("Doing something...");
}
```

### 示例 2：墨水屏项目（您的案例）

**test_chinese_display.ino:**
```cpp
#include <GxEPD2_BW.h>
#include <U8g2_for_Adafruit_GFX.h>
#include "GDEW042T2_GFX.h"

// 主程序代码...
```

**GDEW042T2_GFX.h:**
```cpp
#ifndef GDEW042T2_GFX_H
#define GDEW042T2_GFX_H

#include <Adafruit_GFX.h>

class GDEW042T2_GFX : public Adafruit_GFX {
  // 类定义...
};

#endif
```

**GDEW042T2_GFX.cpp:**
```cpp
#include "GDEW042T2_GFX.h"

// 类实现...
```

## 内置库列表

以下库是 ESP32 核心的一部分，不需要单独安装：

- Arduino
- Wire
- SPI
- EEPROM
- FS
- SD
- SD_MMC
- SPIFFS
- WiFi
- WiFiClient
- WiFiServer
- WebServer
- ESPmDNS
- Update
- Preferences
- BluetoothSerial
- BLE
- HTTPClient
- HTTPUpdate
- ArduinoOTA

## 常见问题

### Q1: 编译时提示找不到头文件

**问题：**
```
fatal error: helper.h: No such file or directory
```

**解决方案：**
- 确保所有相关的 .h 文件都已上传
- 检查 #include 语句中的文件名是否正确
- 使用双引号 `#include "helper.h"` 而不是尖括号

### Q2: 编译时提示库未找到

**问题：**
```
Libraries not found: SomeLib
```

**解决方案：**
- 检查库名是否正确
- 确认该库是否为内置库
- 如果是第三方库，需要后端预装或支持在线安装

### Q3: 多个文件中有重复定义

**问题：**
```
multiple definition of 'functionName'
```

**解决方案：**
- 在头文件中使用 `#ifndef` 保护
- 函数实现只能在 .cpp 文件中
- 头文件中只声明，不实现

### Q4: 文件顺序是否重要？

**答案：**
不重要。Arduino CLI 会自动处理文件依赖关系。只要所有文件都在项目目录中，编译器会正确链接它们。

## API 文档

### 编译接口

**端点：** `POST /api/compile`

**请求体（单文件）：**
```json
{
  "code": "void setup() {}\nvoid loop() {}",
  "board_id": "esp32"
}
```

**请求体（多文件）：**
```json
{
  "files": [
    {
      "name": "sketch.ino",
      "content": "#include \"helper.h\"\nvoid setup() {}\nvoid loop() {}"
    },
    {
      "name": "helper.h",
      "content": "void helperFunction();"
    },
    {
      "name": "helper.cpp",
      "content": "#include \"helper.h\"\nvoid helperFunction() {}"
    }
  ],
  "board_id": "esp32"
}
```

**响应：**
```json
{
  "success": true,
  "firmware_id": "abc123...",
  "firmware_size": 245760,
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
      "name": "app.bin",
      "address": 65536,
      "size": 218112,
      "role": "app"
    }
  ],
  "duration": 12.5
}
```

## 最佳实践

### 1. 文件命名
- 主文件使用 `.ino` 扩展名
- 头文件使用 `.h` 扩展名
- 实现文件使用 `.cpp` 扩展名
- 文件名使用英文，避免特殊字符

### 2. 头文件保护
```cpp
#ifndef MY_HEADER_H
#define MY_HEADER_H

// 声明...

#endif
```

### 3. 包含顺序
```cpp
// 1. Arduino 核心库
#include <Arduino.h>

// 2. 第三方库
#include <WiFi.h>

// 3. 本地头文件
#include "helper.h"
```

### 4. 文件组织
```
project/
├── project.ino      # 主文件（setup 和 loop）
├── config.h         # 配置和常量
├── network.h        # 网络相关声明
├── network.cpp      # 网络相关实现
├── display.h        # 显示相关声明
└── display.cpp      # 显示相关实现
```

## 限制和注意事项

1. **文件大小限制：** 每个文件最大 50000 字符
2. **文件数量限制：** 建议不超过 20 个文件
3. **编译时间：** 多文件项目编译时间可能较长（10-30秒）
4. **库依赖：** 确保所有依赖的库都已预装或内置

## 未来改进

- [ ] 支持文件夹结构
- [ ] 支持 .ino 以外的主文件
- [ ] 在线库管理和安装
- [ ] 项目模板和示例
- [ ] 项目导出和分享
- [ ] 版本控制集成

## 总结

多文件编译功能让您可以：
- ✅ 上传完整的 Arduino 项目
- ✅ 管理多个源文件和头文件
- ✅ 编译复杂的项目结构
- ✅ 与本地 Arduino IDE 保持兼容

现在您可以直接将本地项目拖拽到平台上编译和烧录了！
