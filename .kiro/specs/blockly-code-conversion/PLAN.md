# 积木 ↔ 代码双向转换实现计划

## 目标

实现代码视图和积木视图之间的双向转换：
- **积木 → 代码**：已实现（Blockly 自动生成）
- **代码 → 积木**：需要实现（本计划的核心）

## 核心思路

限制代码只使用积木支持的语法子集，这样代码格式是可预测的，可以用模式匹配转换回积木。

## 前提条件

当前系统有 91 个积木块，每个积木生成固定格式的代码。只要代码遵循这些固定格式，就能反向解析。

---

## 实现步骤

### 第一步：建立积木代码映射表

创建文件 `frontend/src/blockly/blockCodeMap.ts`

这个文件导出一个映射表，记录每个积木块生成的代码模式（正则表达式）和对应的 Blockly XML 模板。

```typescript
// 示例结构
export interface BlockPattern {
  blockType: string;           // 积木类型名
  codePattern: RegExp;         // 匹配代码的正则
  extractFields: (match: RegExpMatchArray) => Record<string, string>; // 从匹配中提取字段值
  toBlocklyXml: (fields: Record<string, string>) => string;          // 生成 Blockly XML
}

export const blockPatterns: BlockPattern[] = [
  {
    blockType: 'arduino_pinmode',
    codePattern: /^\s*pinMode\((\d+),\s*(OUTPUT|INPUT|INPUT_PULLUP)\);\s*$/,
    extractFields: (match) => ({ PIN: match[1], MODE: match[2] }),
    toBlocklyXml: (fields) => `<block type="arduino_pinmode"><field name="PIN">${fields.PIN}</field><field name="MODE">${fields.MODE}</field></block>`
  },
  {
    blockType: 'arduino_digitalwrite',
    codePattern: /^\s*digitalWrite\((\d+),\s*(HIGH|LOW)\);\s*$/,
    extractFields: (match) => ({ PIN: match[1], STATE: match[2] }),
    toBlocklyXml: (fields) => `<block type="arduino_digitalwrite"><field name="PIN">${fields.PIN}</field><field name="STATE">${fields.STATE}</field></block>`
  },
  // ... 为所有 91 个积木块定义模式
];
```

### 第二步：实现代码解析器

创建文件 `frontend/src/blockly/codeToBlockly.ts`

```typescript
/**
 * 代码 → Blockly XML 转换器
 * 
 * 解析流程：
 * 1. 按行分割代码
 * 2. 识别结构块（void setup/loop/自定义函数）
 * 3. 逐行匹配积木模式
 * 4. 处理嵌套结构（if/for/while）
 * 5. 生成 Blockly XML
 */

export function codeToBlocklyXml(code: string): string {
  // 1. 预处理：去除注释、空行
  // 2. 识别顶层结构（setup, loop, 自定义函数）
  // 3. 对每个结构体内的语句逐行解析
  // 4. 处理控制流嵌套（递归解析 if/for/while 的 body）
  // 5. 组装完整的 Blockly XML
  return xmlString;
}
```

### 第三步：处理控制流嵌套

控制流（if/for/while）需要递归解析：

```
代码：
  if (x > 10) {
    digitalWrite(13, HIGH);
    delay(1000);
  }

解析为：
  arduino_if 块
    CONDITION: arduino_compare 块 (x > 10)
    DO: 
      arduino_digitalwrite 块 (13, HIGH)
        next: arduino_delay 块 (1000)
```

关键点：
- 用花括号 `{}` 匹配来确定嵌套范围
- 递归调用解析函数处理嵌套内容
- 用 `<next>` 标签连接同级语句

### 第四步：处理表达式（值块）

表达式需要递归解析：

```
代码：map(analogRead(34), 0, 1023, 0, 255)

解析为：
  arduino_map 块
    VALUE: arduino_analogread 块 (pin=34)
    FROMLOW: arduino_number 块 (0)
    FROMHIGH: arduino_number 块 (1023)
    TOLOW: arduino_number 块 (0)
    TOHIGH: arduino_number 块 (255)
```

需要一个表达式解析器，支持：
- 函数调用：`funcName(args...)`
- 变量引用：`varName`
- 数字字面量：`123`, `3.14`
- 字符串字面量：`"hello"`
- 运算符：`a + b`, `a > b`, `a && b`

### 第五步：集成到 EditorTabs

修改 `frontend/src/components/EditorTabs.tsx`：

```typescript
// 当用户从代码视图切换到积木视图时
const handleViewModeChange = (mode: ViewMode) => {
  if (mode === 'blocks' && viewMode === 'code') {
    // 尝试将当前代码转换为积木
    try {
      const xml = codeToBlocklyXml(savedCodeRef.current);
      // 加载 XML 到 Blockly 工作区
      loadBlocklyXml(xml);
    } catch (error) {
      // 转换失败，提示用户
      alert('代码包含积木不支持的语法，无法转换为积木视图');
    }
  }
  setViewMode(mode);
};
```

### 第六步：AI 代码生成约束

创建 Steering 文件 `.kiro/steering/blockly-compatible-code.md`：

```markdown
---
inclusion: manual
---

# 积木兼容代码生成规则

当生成 Arduino/ESP32 代码时，必须遵循以下约束：

## 允许的语法
- void setup() { } 和 void loop() { }
- 变量声明：int/float/String/bool name = value;
- 控制流：if/else, for, while
- 函数调用：只使用以下函数列表中的函数
- 运算：+, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||, !

## 允许的函数列表
[列出所有 91 个积木对应的函数]

## 禁止的语法
- 指针、引用
- 类、结构体
- switch/case
- 三元运算符
- 宏定义
- 模板
- 多维数组
```

---

## 文件清单

| 文件 | 作用 |
|------|------|
| `frontend/src/blockly/blockCodeMap.ts` | 积木代码模式映射表（91 个模式） |
| `frontend/src/blockly/codeToBlockly.ts` | 代码 → Blockly XML 转换器 |
| `frontend/src/blockly/codeParser.ts` | 代码行解析器（语句+表达式） |
| `frontend/src/blockly/expressionParser.ts` | 表达式递归解析器 |
| `frontend/src/components/EditorTabs.tsx` | 修改视图切换逻辑 |
| `.kiro/steering/blockly-compatible-code.md` | AI 代码生成约束规则 |

---

## 实现难度评估

| 步骤 | 难度 | 工作量 |
|------|------|--------|
| 映射表 | 低 | 大（91 个模式，但重复性高） |
| 语句解析 | 中 | 中 |
| 表达式解析 | 高 | 中 |
| 控制流嵌套 | 高 | 中 |
| 集成 | 低 | 小 |
| AI 约束 | 低 | 小 |

总预计工作量：约 2-3 小时

---

## 限制和注意事项

1. **只支持积木子集的代码** — 如果代码使用了积木不支持的语法（如指针、类），转换会失败
2. **转换失败时的处理** — 给用户友好的提示，告诉哪一行无法转换
3. **代码格式要求** — 代码需要基本格式化（每行一个语句），不支持压缩代码
4. **变量作用域** — 简化处理，所有变量视为全局
5. **自定义函数** — 支持无参数的 void 函数，暂不支持带参数的函数

---

## 测试策略

1. 用积木生成代码 → 再转回积木 → 验证一致性（round-trip 测试）
2. 手写符合规则的代码 → 转为积木 → 验证正确性
3. 手写不符合规则的代码 → 验证错误提示友好

---

## 执行顺序建议

1. 先做映射表（blockCodeMap.ts）— 这是基础
2. 再做语句解析器（逐行匹配）— 处理简单的单行语句
3. 然后做表达式解析器 — 处理值块
4. 最后做控制流嵌套 — 处理 if/for/while
5. 集成到 EditorTabs — 连接 UI
6. 写 AI 约束规则 — 确保 AI 生成的代码可转换
