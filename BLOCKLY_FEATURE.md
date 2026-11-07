# Blockly 图形化编程功能说明

## ✅ 已完成的功能

### 1. 核心功能
- ✅ 集成 Google Blockly 图形化编程库
- ✅ 实现代码视图和积木视图的标签页切换
- ✅ 积木块自动生成 Arduino 代码
- ✅ 实时代码同步

### 2. 已实现的积木块

#### 程序结构
- `setup` - Arduino 初始化函数
- `loop` - Arduino 主循环函数

#### 数字 I/O
- `pinMode` - 设置引脚模式（OUTPUT/INPUT/INPUT_PULLUP）
- `digitalWrite` - 数字输出（HIGH/LOW）
- `digitalRead` - 数字输入读取

#### 模拟 I/O
- `analogRead` - 模拟输入读取（0-4095）
- `analogWrite` - PWM 输出（0-255）

#### 时间控制
- `delay` - 延时（毫秒）
- `millis` - 获取运行时间

#### 串口通信
- `Serial.begin` - 初始化串口（9600/115200/57600/38400）
- `Serial.print` - 串口输出（不换行）
- `Serial.println` - 串口输出（换行）

#### 数据类型
- 文本字符串
- 数字

#### 逻辑和控制（使用 Blockly 内置块）
- if 条件判断
- 循环（repeat/while/for）
- 逻辑运算
- 数学运算
- 变量定义和使用

### 3. 用户界面
- ✅ 标签页切换（代码视图 / 积木视图）
- ✅ 工具箱分类（程序结构、数字I/O、模拟I/O、时间、串口、数据、逻辑、循环、数学、变量）
- ✅ 拖拽式编程界面
- ✅ 网格对齐
- ✅ 缩放控制
- ✅ 垃圾桶（删除积木）

### 4. 代码生成
- ✅ 积木 → Arduino C++ 代码
- ✅ 实时代码更新
- ✅ 格式化输出

## 📝 使用说明

### 启动开发服务器
```bash
cd frontend
npm run dev
```

### 使用流程

1. **打开应用**
   - 访问 http://localhost:5173

2. **切换到积木视图**
   - 点击顶部的"积木视图"标签页

3. **拖拽积木编程**
   - 从左侧工具箱拖拽积木块到工作区
   - 积木块会自动连接
   - 代码会实时生成

4. **查看生成的代码**
   - 切换到"代码视图"标签页
   - 查看自动生成的 Arduino 代码

5. **编译和上传**
   - 选择开发板
   - 点击"编译代码"
   - 编译成功后点击"上传到设备"

### 示例：LED 闪烁程序

**积木视图：**
```
┌─────────────┐
│   setup     │
│  ┌────────┐ │
│  │pinMode │ │
│  │引脚: 13│ │
│  │OUTPUT  │ │
│  └────────┘ │
└─────────────┘

┌─────────────┐
│   loop      │
│  ┌────────┐ │
│  │digitalWrite│
│  │引脚: 13│ │
│  │HIGH    │ │
│  └────────┘ │
│  ┌────────┐ │
│  │delay   │ │
│  │1000 ms │ │
│  └────────┘ │
│  ┌────────┐ │
│  │digitalWrite│
│  │引脚: 13│ │
│  │LOW     │ │
│  └────────┘ │
│  ┌────────┐ │
│  │delay   │ │
│  │1000 ms │ │
│  └────────┘ │
└─────────────┘
```

**生成的代码：**
```cpp
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
```

## ⚠️ 注意事项

### 代码手动编辑
- 如果在代码视图中手动编辑代码，切换到积木视图时会提示重置
- 建议：先保存代码，再切换到积木视图

### 当前限制
- ❌ 不支持代码 → 积木的转换（单向：积木 → 代码）
- ❌ AI 生成的代码暂不支持积木视图
- ❌ 复杂的 C++ 语法无法用积木表示

### 推荐使用场景
- ✅ 儿童编程教学
- ✅ 初学者学习 Arduino
- ✅ 快速原型开发
- ✅ 简单的 LED、传感器项目

## 🔧 技术架构

### 文件结构
```
frontend/src/
├── blockly/
│   ├── arduinoBlocks.ts      # 积木块定义
│   ├── arduinoGenerator.ts   # 代码生成器
│   └── toolbox.ts            # 工具箱配置
├── components/
│   ├── BlocklyEditor.tsx     # Blockly 编辑器组件
│   ├── EditorTabs.tsx        # 标签页切换组件
│   └── CodeEditor.tsx        # 代码编辑器组件
└── App.tsx                   # 主应用
```

### 依赖库
- `blockly` - Google Blockly 核心库（Apache 2.0）
- `react` - React 19
- `zustand` - 状态管理

## 🚀 未来扩展

### 可以添加的积木块
- WiFi 连接
- HTTP 请求
- MQTT 通信
- 传感器库（DHT、超声波等）
- 显示屏控制（OLED、LCD）
- 电机控制
- 蓝牙通信

### 可能的改进
- 保存/加载积木项目
- 导出积木为图片
- 积木块搜索功能
- 自定义积木块
- 代码 → 积木转换（使用 AI 辅助）

## 📚 参考资源

- [Google Blockly 官方文档](https://developers.google.com/blockly)
- [Arduino 官方文档](https://www.arduino.cc/reference/en/)
- [ESP32 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)

## 🎉 总结

Blockly 图形化编程功能已成功集成到平台中！

**主要特点：**
- 🎨 直观的拖拽式编程界面
- 🔄 实时代码生成
- 📱 响应式设计
- 🎯 专为 ESP32/Arduino 优化
- 🚀 快速上手，适合初学者

**立即体验：**
```bash
cd frontend
npm run dev
```

然后访问 http://localhost:5173，点击"积木视图"标签页开始使用！
