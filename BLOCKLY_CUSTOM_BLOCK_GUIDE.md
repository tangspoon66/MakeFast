# 自定义积木开发指南

本文档供 AI 或开发者为本 Blockly 编辑器创建自定义积木。

---

## 一、输出格式

每个自定义积木是一个 JSON 对象，包含 4 个字段：

```json
{
  "name": "my_block_type",
  "category": "传感器",
  "json_definition": { ... },
  "generator_code": "..."
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 积木唯一标识符，小写下划线风格 |
| `category` | string | 工具箱分类名，必须是下方分类列表中的一个 |
| `json_definition` | object | Blockly 积木的 JSON 定义 |
| `generator_code` | string | JavaScript 函数体字符串，接收 `block` 和 `generator` 两个参数 |

---

## 二、可用的工具箱分类

```
程序结构、控制流、变量、运算、函数、
ESP32、输入/输出、通信、传感器、执行器、显示与灯带、红外遥控、数据处理
```

---

## 三、json_definition 格式规范

### 基本结构

```json
{
  "type": "my_block_type",
  "message0": "读取 %1 的值",
  "args0": [ ... ],
  "previousStatement": null,
  "nextStatement": null,
  "colour": 200,
  "tooltip": "鼠标悬停时的提示文字"
}
```

### message0 占位符

- `%1`, `%2`, `%3` ... 对应 `args0` 中的第 1, 2, 3 个输入
- `%1` 也可以写成文字描述的一部分，如 `"设置引脚 %1 为 %2"`

### args0 支持的输入类型

#### 1. 数字输入框

```json
{
  "type": "field_number",
  "name": "PIN",
  "value": 2,
  "min": 0,
  "max": 39,
  "precision": 1
}
```

- `value` — 默认值
- `min` / `max` — 范围限制
- `precision` — 精度（1 = 整数）

#### 2. 文本输入框

```json
{
  "type": "field_input",
  "name": "TEXT",
  "text": "默认文本"
}
```

#### 3. 下拉选择框

```json
{
  "type": "field_dropdown",
  "name": "MODE",
  "options": [
    ["HIGH", "HIGH"],
    ["LOW", "LOW"]
  ]
}
```

每个选项是 `["显示文本", "代码值"]` 的数组。

#### 4. 颜色选择器

```json
{
  "type": "field_colour",
  "name": "COLOR",
  "colour": "#ff0000"
}
```

#### 5. 值输入（可连接表达式积木）

```json
{
  "type": "input_value",
  "name": "VALUE",
  "check": "Number"
}
```

`check` 限制连接类型，可选值：`"Number"`, `"String"`, `"Boolean"`, `"Array"`，不设则任意。

#### 6. 语句输入（可接语句积木堆叠）

```json
{
  "type": "input_statement",
  "name": "BODY"
}
```

### 积木形状控制

| 属性 | 值 | 含义 |
|------|-----|------|
| `previousStatement` | `null` | 上方可连接（语句块） |
| `nextStatement` | `null` | 下方可连接（语句块） |
| `output` | `"Number"` / `"String"` / `"Boolean"` / `null` | 设为表达式块（可被别人连接） |
| `inputsInline` | `true` | 输入横向排列 |

**语句块**：有 `previousStatement` 和/或 `nextStatement`
**表达式块**：有 `output`，没有 `previousStatement`/`nextStatement`

### 颜色参考

| 色相值 | 用途 |
|--------|------|
| 20 | 传感器 |
| 40 | 红外遥控 / 舵机 |
| 50 | 数字 I/O |
| 60 | ESP32 专用 |
| 120 | 程序结构 / 控制流 |
| 160 | 串口 / 通信 |
| 180 | 模拟 I/O |
| 200 | 执行器 |
| 230 | 运算 |
| 260 | 数组 |
| 290 | 时间 / 函数 |
| 300 | NeoPixel |
| 310 | 显示 |
| 330 | 变量 / 数据转换 |

---

## 四、generator_code 编写规范

`generator_code` 是一个 **JavaScript 函数体字符串**，系统会这样注册它：

```js
arduinoGenerator.forBlock[blockName] = new Function('block', 'generator', generator_code);
```

### 参数

- `block` — 当前积木实例，用 `block.getFieldValue('NAME')` 读取 Field 值
- `generator` — Arduino 代码生成器

### generator 的关键方法

| 方法 | 用途 | 示例 |
|------|------|------|
| `generator.valueToCode(block, 'INPUT', ORDER)` | 获取连接的表达式积木生成的代码 | `generator.valueToCode(block, 'VALUE', 0)` |
| `generator.statementToCode(block, 'INPUT')` | 获取连接的语句积木生成的代码 | `generator.statementToCode(block, 'BODY')` |
| `generator.addSetupCode_(key, code)` | 添加 setup 代码（去重） | `generator.addSetupCode_('wire', 'Wire.begin();\n')` |

### 优先级常量

```js
const ORDER_ATOMIC = 0;
const ORDER_MULTIPLICATIVE = 5;
const ORDER_ADDITIVE = 6;
const ORDER_RELATIONAL = 8;
const ORDER_EQUALITY = 9;
const ORDER_LOGICAL_AND = 13;
const ORDER_LOGICAL_OR = 14;
const ORDER_NONE = 99;
```

### 返回值

- **语句块**：返回代码字符串，如 `return "  digitalWrite(2, HIGH);\n";`
- **表达式块**：返回 `[代码, 优先级]` 元组，如 `return ["analogRead(34)", ORDER_ATOMIC];`

### 代码缩进

生成的 Arduino 代码在 `setup()` / `loop()` 函数体内，**每个语句前加 2 个空格缩进**，末尾加 `\n`。

---

## 五、完整示例

### 示例 1：简单语句块（数字输出）

```json
{
  "name": "custom_digital_write",
  "category": "输入/输出",
  "json_definition": {
    "type": "custom_digital_write",
    "message0": "设置引脚 %1 为 %2",
    "args0": [
      { "type": "field_number", "name": "PIN", "value": 2, "min": 0, "max": 39, "precision": 1 },
      { "type": "field_dropdown", "name": "VALUE", "options": [["HIGH", "HIGH"], ["LOW", "LOW"]] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 50,
    "tooltip": "设置数字引脚的输出电平"
  },
  "generator_code": "var pin = block.getFieldValue('PIN');\nvar value = block.getFieldValue('VALUE');\nreturn '  digitalWrite(' + pin + ', ' + value + ');\\n';"
}
```

### 示例 2：带值输入的表达式块（读取传感器）

```json
{
  "name": "custom_analog_read",
  "category": "传感器",
  "json_definition": {
    "type": "custom_analog_read",
    "message0": "读取引脚 %1 的模拟值",
    "args0": [
      { "type": "field_number", "name": "PIN", "value": 34, "min": 0, "max": 39, "precision": 1 }
    ],
    "output": "Number",
    "colour": 20,
    "tooltip": "读取模拟引脚的值（0-4095）"
  },
  "generator_code": "var pin = block.getFieldValue('PIN');\nreturn ['analogRead(' + pin + ')', 0];"
}
```

### 示例 3：带子语句的控制块

```json
{
  "name": "custom_repeat_times",
  "category": "控制流",
  "json_definition": {
    "type": "custom_repeat_times",
    "message0": "重复 %1 次 %2",
    "args0": [
      { "type": "field_number", "name": "TIMES", "value": 10, "min": 1, "precision": 1 },
      { "type": "input_statement", "name": "BODY" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "重复执行指定次数"
  },
  "generator_code": "var times = block.getFieldValue('TIMES');\nvar body = generator.statementToCode(block, 'BODY');\nvar code = '  for (int _i = 0; _i < ' + times + '; _i++) {\\n' + body + '  }\\n';\nreturn code;"
}
```

### 示例 4：带 setup 的硬件初始化块

```json
{
  "name": "custom_servo_init",
  "category": "执行器",
  "json_definition": {
    "type": "custom_servo_init",
    "message0": "舵机连接引脚 %1",
    "args0": [
      { "type": "field_number", "name": "PIN", "value": 9, "min": 0, "max": 39, "precision": 1 }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 200,
    "tooltip": "初始化舵机并连接到指定引脚"
  },
  "generator_code": "var pin = block.getFieldValue('PIN');\ngenerator.addSetupCode_('include_servo', '#include <Servo.h>');\ngenerator.addSetupCode_('servo_' + pin, 'Servo _servo_' + pin + ';\\n_servo_' + pin + '.attach(' + pin + ');\\n');\nreturn '';"
}
```

---

## 六、ESP32 常用 API 参考

生成 Arduino C 代码时可用的 API：

### GPIO
```c
pinMode(pin, INPUT/OUTPUT/INPUT_PULLUP)
digitalWrite(pin, HIGH/LOW)
digitalRead(pin)                // 返回 HIGH/LOW
analogRead(pin)                 // 返回 0-4095
analogWrite(pin, value)         // PWM 输出 0-255
```

### 时间
```c
delay(ms)
delayMicroseconds(us)
millis()                        // 返回 unsigned long
micros()                        // 返回 unsigned long
```

### 串口
```c
Serial.begin(baudRate)          // 如 115200
Serial.print(value)
Serial.println(value)
```

### I2C (Wire)
```c
#include <Wire.h>
Wire.begin()
Wire.beginTransmission(address)
Wire.write(data)
Wire.endTransmission()
Wire.requestFrom(address, quantity)
Wire.read()
```

### ESP32 LEDC (PWM)
```c
ledcSetup(channel, freq, resolution)
ledcAttachPin(pin, channel)
ledcWrite(channel, duty)
```

### WiFi
```c
#include <WiFi.h>
WiFi.begin(ssid, password)
WiFi.status()                   // 返回 WL_CONNECTED 等
```

### Servo
```c
#include <Servo.h>
Servo myservo;
myservo.attach(pin)
myservo.write(angle)
```

### NeoPixel (WS2812)
```c
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel strip(count, pin, NEO_GRB + NEO_KHZ800);
strip.begin()
strip.setPixelColor(i, strip.Color(r, g, b))
strip.show()
strip.setBrightness(0-255)
strip.clear()
```

### DHT 温湿度
```c
#include <DHT.h>
DHT dht(pin, DHT11/DHT22);
dht.begin()
dht.readTemperature()
dht.readHumidity()
```

### OLED (SSD1306)
```c
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(width, height, &Wire, -1);
display.begin(SSD1306_SWITCHCAPVCC, 0x3C)
display.clearDisplay()
display.setTextSize(size)
display.setCursor(x, y)
display.print(text)
display.display()
```

---

## 七、注意事项

1. **name 必须全局唯一**，建议加前缀如 `custom_xxx`
2. **generator_code 中的字符串拼接**：用 `+` 连接，换行写成 `\\n`
3. **setup 代码去重**：`addSetupCode_` 的第一个参数是 key，相同 key 只会添加一次
4. **缩进**：每个语句前加 2 个空格（`'  code;\\n'`）
5. **Field 的 name** 在 `json_definition` 和 `generator_code` 中必须一致
6. **表达式块必须设 `output`**，语句块必须设 `previousStatement`/`nextStatement`
7. **颜色用色相值（0-360）**，不是 RGB
