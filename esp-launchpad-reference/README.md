# ESP Launchpad 🚀

<div align="center">

![ESP Launchpad Logo](assets/esp-logo.png)

**现代化的ESP设备在线烧录工具**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![WebSerial](https://img.shields.io/badge/WebSerial-Enabled-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
[![WebUSB](https://img.shields.io/badge/WebUSB-Compatible-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API)

[🌐 在线体验](https://Good0007.github.io/esp-launchpad/) | [📖 使用指南](#使用指南) | [🔧 本地部署](#本地部署) | [🤝 贡献代码](#贡献)

</div>

---

## ✨ 特性亮点

### 🎯 核心功能
- **🔌 即插即用** - 无需安装任何软件，浏览器直接连接ESP设备
- **⚡ 快速烧录** - 支持WebSerial和WebUSB双重连接方式
- **🎨 现代界面** - 响应式设计，完美适配桌面和移动设备
- **📁 智能识别** - 自动识别固件类型并分配Flash地址
- **🔄 实时监控** - 烧录进度实时显示，支持控制台日志查看

### 🛠️ 技术特性
- **无依赖部署** - 纯前端实现，所有依赖使用CDN
- **ES6模块化** - 现代JavaScript架构，代码结构清晰
- **Bootstrap 5** - 响应式UI框架，美观易用
- **设备兼容性** - 支持ESP32全系列芯片
- **浏览器兼容** - Chrome、Edge等现代浏览器完美支持

---

## 🚀 快速开始

### 在线使用（推荐）

1. 访问 [ESP Launchpad 在线版本](https://Good0007.github.io/esp-launchpad/)
2. 使用USB数据线连接ESP设备到电脑
3. 点击"连接设备"按钮选择串口
4. 选择固件文件或使用快速开始模式
5. 点击"开始烧录"完成固件更新

### 本地部署

```bash
# 克隆项目
git clone https://github.com/Good0007/esp-launchpad.git
cd esp-launchpad

# 启动HTTP服务器（避免CORS问题）
python3 -m http.server 8080

# 访问应用
open http://localhost:8080
```

---

## 💻 浏览器支持

| 浏览器 | WebSerial | WebUSB | 推荐程度 |
|--------|-----------|---------|----------|
| Chrome 89+ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Edge 89+ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| Opera 76+ | ✅ | ✅ | ⭐⭐⭐⭐ |
| Safari | ❌ | ❌ | ❌ |
| Firefox | ❌ | ❌ | ❌ |

> **注意**: Safari和Firefox由于不支持WebSerial/WebUSB API，暂时无法使用此工具。

---

## 🎮 使用指南

### 连接设备

1. **准备工作**
   - 确保使用支持的浏览器（Chrome/Edge推荐）
   - 准备USB数据线连接ESP设备

2. **设备连接**
   - 点击右上角"连接设备"按钮
   - 在弹出的设备选择框中选择对应的串口
   - 连接成功后状态指示器变绿

### 烧录模式

#### 🚀 快速开始模式
- 适合新手用户
- 预置常用应用固件
- 一键烧录，简单快捷

#### 🔧 自定义模式  
- 适合开发者使用
- 支持单文件上传
- 可自定义Flash地址
- 支持拖拽操作

### 烧录步骤

1. **选择固件**
   - 快速模式：从下拉菜单选择应用
   - 自定义模式：上传.bin文件并设置地址

2. **配置参数**
   - 烧录波特率（默认460800）
   - 是否擦除Flash
   - 是否压缩数据

3. **开始烧录**
   - 点击"开始烧录"按钮
   - 观察进度条和控制台日志
   - 烧录完成后设备自动重启

---

## 🔧 设备支持

### 支持的ESP芯片
- **ESP32** - 原始ESP32芯片
- **ESP32-S2** - 带USB-CDC的ESP32变种
- **ESP32-S3** - 双核ESP32，支持USB-CDC
- **ESP32-C3** - RISC-V架构ESP32
- **ESP32-C6** - 新一代WiFi 6芯片

### 支持的USB转串口芯片
- **CP2102/CP2102N** - Silicon Labs
- **FT232R/FT2232H** - FTDI
- **CH340T/CH9102F** - WCH
- **ESP32内置USB** - 原生USB支持

---

## 🏗️ 项目结构

```
esp-launchpad/
├── index.html              # 主界面文件
├── LICENSE                 # 开源许可证
├── README.md              # 项目说明文档
├── assets/                # 静态资源
│   ├── favicon.ico        # 网站图标
│   ├── esp-logo.png       # ESP Logo
│   └── fonts/            # 字体文件
├── css/                  # 样式文件
│   ├── modern-styles.css # 现代化样式
│   └── xterm.css         # 终端样式
└── js/                   # JavaScript文件
    ├── bundle.js         # ESP工具库
    ├── modern-app-simple.js # 主应用逻辑
    └── qrcode.min.js     # QR码生成库
```

---

## 🛠️ 开发

### 技术栈

- **前端框架**: 原生JavaScript + ES6模块
- **UI框架**: Bootstrap 5.3
- **图标库**: Font Awesome 6.4
- **ESP库**: esptool-js
- **构建工具**: 无需构建，直接运行

### 开发环境

```bash
# 克隆项目
git clone https://github.com/Good0007/esp-launchpad.git
cd esp-launchpad

# 启动开发服务器
python3 -m http.server 8080

# 或使用Node.js
npx serve .
```

### 代码结构

- **modern-app-simple.js** - 主应用类，包含所有核心功能
- **bundle.js** - ESP工具库，处理设备通信
- **modern-styles.css** - 现代化UI样式

---

## 🔍 故障排除

### 常见问题

**Q: 无法连接设备**
- 检查浏览器是否为Chrome/Edge最新版本
- 确认USB数据线支持数据传输（非仅充电线）
- 检查设备驱动是否正确安装

**Q: 烧录失败**
- 确认固件文件格式为.bin
- 检查Flash地址设置是否正确
- 尝试降低烧录波特率

**Q: 设备无法识别**
- 按住BOOT按钮重新连接设备
- 检查设备是否处于下载模式
- 尝试其他USB端口

### 调试模式

打开浏览器开发者工具（F12）查看详细日志信息。

---

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 许可证。

---

## 🙏 致谢

感谢以下开源项目的支持：

- [esptool-js](https://github.com/Good0007/esptool-js) - ESP设备通信库
- [Bootstrap](https://getbootstrap.com/) - 响应式UI框架
- [Font Awesome](https://fontawesome.com/) - 图标库
- [xterm.js](https://xtermjs.org/) - 终端模拟器

---
