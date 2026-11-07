# AI 代码助手配置指南

## 功能概述

AI 代码助手是一个集成在右侧面板的智能编程助手，可以：

- 🤖 通过自然语言对话生成 Arduino/ESP32 代码
- 💡 根据选择的开发板提供针对性的代码建议
- ✨ 自动将生成的代码插入到左侧编辑器
- 📝 支持上下文感知，理解当前代码内容

## 界面位置

AI 助手位于右侧操作面板的底部，在编译结果卡片下方。

- **折叠状态**：显示标题和消息数量徽章
- **展开状态**：显示完整的聊天界面（400px 高度）
- **编译成功提示**：已简化为"固件已就绪"，节省空间

## 后端配置

### 1. 安装依赖

```bash
cd backend
pip install httpx  # 用于 HTTP 请求
```

### 2. 配置环境变量

创建或编辑 `backend/.env` 文件：

```bash
# OpenAI API 配置（推荐）
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1  # 可选，默认为 OpenAI
AI_MODEL=gpt-4  # 或 gpt-3.5-turbo

# 或者使用其他兼容 OpenAI API 的服务
# AI_API_KEY=your-api-key
# AI_API_BASE=https://your-api-endpoint.com/v1
# AI_MODEL=your-model-name
```

### 3. 支持的 AI 服务

#### OpenAI
```bash
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4
```

#### Azure OpenAI
```bash
OPENAI_API_KEY=your-azure-key
OPENAI_API_BASE=https://your-resource.openai.azure.com/
AI_MODEL=gpt-4
```

#### 本地模型（Ollama、LM Studio 等）
```bash
OPENAI_API_BASE=http://localhost:11434/v1
AI_MODEL=codellama
# 不需要 API Key
```

#### 国内 API（如智谱、通义千问等）
```bash
AI_API_KEY=your-api-key
AI_API_BASE=https://api.provider.com/v1
AI_MODEL=model-name
```

### 4. 测试模式

如果没有配置 API Key，系统会自动使用**模拟响应模式**，提供基本的关键词匹配代码生成功能。

## 前端配置

前端会自动连接到后端的 `/api/ai/generate` 端点，无需额外配置。

如果需要自定义 API 地址，可以在 `frontend/.env` 中设置：

```bash
VITE_AI_API_URL=/api/ai
```

## 使用方法

### 1. 基本使用

1. 点击右侧面板底部的 **"AI 代码助手"** 卡片展开
2. 在输入框中描述你想要的功能，例如：
   - "帮我写一个LED闪烁的代码"
   - "生成一个串口通信的示例"
   - "写一个连接WiFi的程序"
3. 按 Enter 或点击发送按钮
4. AI 会生成代码并自动插入到左侧编辑器

### 2. 高级功能

- **上下文感知**：AI 会考虑当前编辑器中的代码
- **开发板适配**：根据选择的开发板生成适配的代码
- **对话历史**：支持多轮对话，可以追问和修改
- **清空对话**：点击"清空"按钮重新开始

### 3. 示例对话

```
用户：帮我写一个LED闪烁的代码
AI：我为你生成了一个LED闪烁的代码：
    [代码自动插入到编辑器]

用户：能不能改成每500毫秒闪烁一次？
AI：好的，我已经修改了延迟时间...
    [更新后的代码插入到编辑器]
```

## API 端点

### POST /api/ai/generate

生成代码（非流式）

**请求体：**
```json
{
  "messages": [
    {"role": "user", "content": "帮我写一个LED闪烁的代码"}
  ],
  "board": "esp32",
  "context": "// 当前代码内容"
}
```

**响应：**
```json
{
  "success": true,
  "message": "我为你生成了...",
  "code": "void setup() {...}"
}
```

### POST /api/ai/generate/stream

生成代码（流式，实时输出）

返回 Server-Sent Events (SSE) 流。

## 自定义系统提示词

编辑 `backend/app/ai_service.py` 中的 `system_prompt` 变量，可以自定义 AI 的行为和风格。

```python
self.system_prompt = """你是一个专业的嵌入式开发助手...
[在这里自定义提示词]
"""
```

## 故障排查

### 1. AI 助手不显示

- 检查前端组件是否正确导入
- 查看浏览器控制台是否有错误

### 2. 生成失败

- 检查后端日志：`docker-compose logs backend`
- 确认 API Key 配置正确
- 测试 API 连接：`curl http://localhost:8000/api/health`

### 3. 代码未插入编辑器

- 检查 AI 响应中是否包含代码块
- 查看浏览器控制台的网络请求

### 4. 使用模拟模式

如果没有配置 API Key，系统会自动使用模拟模式，支持以下关键词：
- LED、闪烁、blink → LED 闪烁代码
- 串口、Serial → 串口通信代码
- WiFi → WiFi 连接代码

## 成本优化

### 使用更便宜的模型

```bash
AI_MODEL=gpt-3.5-turbo  # 比 gpt-4 便宜很多
```

### 使用本地模型（免费）

```bash
# 安装 Ollama
brew install ollama  # macOS
# 或访问 https://ollama.ai

# 下载模型
ollama pull codellama

# 配置
OPENAI_API_BASE=http://localhost:11434/v1
AI_MODEL=codellama
```

### 限制上下文长度

在 `ai_service.py` 中调整 `max_tokens` 参数：

```python
"max_tokens": 1000  # 减少生成长度
```

## 安全建议

1. **不要在前端暴露 API Key**
2. **使用环境变量存储敏感信息**
3. **考虑添加速率限制**
4. **在生产环境中启用 HTTPS**

## 未来改进

- [ ] 支持代码解释和调试
- [ ] 支持多文件项目生成
- [ ] 集成代码审查功能
- [ ] 添加代码模板库
- [ ] 支持语音输入

## 技术栈

- **前端**：React + TypeScript + Zustand
- **后端**：FastAPI + Python
- **AI**：OpenAI API（或兼容接口）
- **样式**：自定义 CSS（紫色主题）

## 贡献

欢迎提交 Issue 和 Pull Request！
