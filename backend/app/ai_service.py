"""
AI 代码生成服务

提供基于大语言模型的代码生成功能。
"""

import logging
import os
from typing import List, Dict, Any, Optional, AsyncGenerator
import json

logger = logging.getLogger(__name__)


class AIService:
    """AI 代码生成服务"""
    
    def __init__(self):
        """初始化 AI 服务"""
        self._refresh_config()
        
        # 系统提示词（针对嵌入式开发调试深度优化）
        self.system_prompt = """你是一个专业的嵌入式开发助手，专门帮助用户编写、调试和优化 Arduino/ESP32 代码。

## 你的职责
1. **代码生成**：根据需求生成完整、可运行的新代码
2. **代码修改**：分析现有代码，精准修改用户要求的部分
3. **Bug 分析**：审查代码逻辑，发现潜在 bug 和边界问题
4. **错误诊断**：分析编译错误信息，逐条解释原因并给出修复方案
5. **代码优化**：建议性能、内存、结构方面的优化
6. **多文件管理**：理解多文件项目的依赖关系，协调修改
7. **平台指导**：根据具体开发板特性给出合适建议

## 支持的开发板
- **ESP32 系列**：ESP32, ESP32-S2, ESP32-S3, ESP32-C3, ESP32-C6（推荐）
- **ESP8266 系列**：NodeMCU, WeMos D1 Mini
- **Arduino AVR 系列**：UNO, Nano, Mega

## 常用功能
- GPIO 控制（digitalWrite, digitalRead, pinMode）
- PWM 控制（analogWrite, ledcWrite）
- 串口通信（Serial.begin, Serial.println）
- WiFi 连接（WiFi.begin, WiFi.status — ESP 专用）
- 蓝牙通信（ESP32 专用）
- 传感器读取（analogRead, I2C/SPI 传感器）
- 定时器和中断（millis, attachInterrupt, 定时器库）

## 调试模式 — 编译错误分析
当消息中包含"## 编译错误信息"时，你必须进入调试模式：

**错误分析格式**：
### 错误 1: [错误类型] (第 X 行)
**原因**: [具体的根本原因分析]
**修复**: [精确的代码修改方案]
**说明**: [为什么这样修复]

**调试重要规则**：
1. 逐条分析每个编译错误，不遗漏任何一个
2. 识别级联错误：如果一个错误导致后续多个错误，优先修复根因错误
3. 给出精确的行号和修改位置
4. 如果修改涉及多行代码，说明修改范围
5. 区分错误（error）和警告（warning），警告也要给出处理建议
6. 修复代码必须在 ```cpp 代码块中给出完整的新版本

## 多文件项目
- 理解文件之间的 #include 依赖关系
- 修改时注明涉及哪个文件
- 维护一致的代码风格

## 重要规则
1. **代码格式**：生成或修改代码时，完整代码必须用 ```cpp 代码块包裹
2. **完整性**：Arduino 代码必须包含 setup() 和 loop() 函数
3. **注释**：关键部分用中文注释，解释为什么这样做
4. **库引用**：需要的库在代码开头用 #include 引入
5. **简洁回复**：代码放在前面，解释放在后面，不要过度展开

## 回复示例

用户：帮我写一个LED闪烁的代码

你的回复：
好的，这是一个LED闪烁的代码：

```cpp
// LED闪烁示例
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);  // 设置内置LED为输出模式
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);  // 点亮LED
  delay(1000);                       // 延迟1秒
  digitalWrite(LED_BUILTIN, LOW);   // 熄灭LED
  delay(1000);                       // 延迟1秒
}
```

这段代码会让内置LED每秒闪烁一次。
"""
    
    def _get_board_context(self, board_id: Optional[str]) -> str:
        """获取开发板相关的上下文信息（从集中配置精确匹配）"""
        if not board_id:
            return ""

        from .board_config import get_boards_by_id
        board = get_boards_by_id().get(board_id)
        if board:
            return f"当前开发板：{board.name}（{board.description}）"
        return f"当前开发板：{board_id}"

    def _refresh_config(self) -> None:
        from .service_config import apply_service_config_to_env

        apply_service_config_to_env()
        self.api_key = os.getenv('OPENAI_API_KEY') or os.getenv('AI_API_KEY')
        self.api_base = os.getenv('OPENAI_API_BASE') or os.getenv('AI_API_BASE')
        self.model = os.getenv('AI_MODEL', 'gpt-4')
        self.temperature = float(os.getenv('AI_TEMPERATURE', '0.7'))
        self.max_tokens = int(os.getenv('AI_MAX_TOKENS', '2000'))
    
    def _build_context_messages(
        self,
        board_id: Optional[str],
        context: Optional[str],
        project_files: Optional[List[Dict[str, str]]],
        current_file: Optional[str],
        compile_errors: Optional[List[dict]],
        project_context: Optional[str],
    ) -> List[Dict[str, str]]:
        """构建上下文消息列表（提取公共逻辑）"""
        ctx_msgs = []

        # 开发板上下文
        if board_id:
            board_ctx = self._get_board_context(board_id)
            ctx_msgs.append({"role": "system", "content": board_ctx})

        # 项目结构摘要
        if project_context:
            ctx_msgs.append({"role": "system", "content": f"## 项目结构\n{project_context}"})

        # 项目文件上下文
        if project_files and len(project_files) > 0:
            proj_ctx = "## 当前项目文件\n\n"
            for file in project_files:
                proj_ctx += f"### 文件: {file['name']}\n```cpp\n{file['content']}\n```\n\n"
            if current_file:
                proj_ctx += f"当前正在编辑: {current_file}\n"
            ctx_msgs.append({"role": "system", "content": proj_ctx})
        elif context:
            ctx_msgs.append({
                "role": "system",
                "content": f"当前编辑器中的代码：\n```cpp\n{context}\n```"
            })

        # 编译错误
        if compile_errors and len(compile_errors) > 0:
            err_ctx = "## 编译错误信息\n\n以下是最近一次编译的错误：\n\n"
            for i, err in enumerate(compile_errors):
                err_ctx += f"### 错误 {i+1}: {err.get('type', 'error')} (第 {err.get('line', '?')} 行)\n"
                err_ctx += f"消息: {err.get('message', '')}\n"
                if err.get('hint'):
                    err_ctx += f"提示: {err['hint']}\n"
                err_ctx += "\n"
            err_ctx += "请分析这些编译错误并提供详细的修复方案。\n"
            ctx_msgs.append({"role": "system", "content": err_ctx})

        return ctx_msgs

    async def generate_code(
        self,
        messages: List[Dict[str, str]],
        board_id: Optional[str] = None,
        context: Optional[str] = None,
        project_files: Optional[List[Dict[str, str]]] = None,
        current_file: Optional[str] = None,
        compile_errors: Optional[List[dict]] = None,
        project_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成代码"""
        try:
            full_messages = [
                {"role": "system", "content": self.system_prompt}
            ]
            full_messages.extend(self._build_context_messages(
                board_id=board_id,
                context=context,
                project_files=project_files,
                current_file=current_file,
                compile_errors=compile_errors,
                project_context=project_context,
            ))
            full_messages.extend(messages)

            response = await self._call_ai_api(full_messages)
            assistant_message = response.get('message', '')
            code = self._extract_code(assistant_message)

            return {
                "success": True,
                "message": assistant_message,
                "code": code
            }
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            return {
                "success": False,
                "message": f"生成失败：{str(e)}",
                "error": str(e)
            }
    
    async def generate_code_stream(
        self,
        messages: List[Dict[str, str]],
        board_id: Optional[str] = None,
        context: Optional[str] = None,
        project_files: Optional[List[Dict[str, str]]] = None,
        current_file: Optional[str] = None,
        compile_errors: Optional[List[dict]] = None,
        project_context: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """流式生成代码"""
        try:
            full_messages = [
                {"role": "system", "content": self.system_prompt}
            ]
            full_messages.extend(self._build_context_messages(
                board_id=board_id,
                context=context,
                project_files=project_files,
                current_file=current_file,
                compile_errors=compile_errors,
                project_context=project_context,
            ))
            full_messages.extend(messages)

            async for chunk in self._call_ai_api_stream(full_messages):
                yield chunk

        except Exception as e:
            logger.error(f"AI streaming failed: {e}")
            yield f"[错误] {str(e)}"
    
    async def _call_ai_api(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        调用 AI API（非流式）
        
        这里需要根据实际使用的 AI 服务进行实现。
        支持 OpenAI、Azure OpenAI、本地模型等。
        """
        # TODO: 实现实际的 API 调用
        # 这里提供一个示例实现框架
        
        self._refresh_config()
        if not self.api_key:
            raise ValueError("AI API key not configured")
        
        # 示例：使用 OpenAI API
        try:
            import httpx
            
            api_url = f"{self.api_base or 'https://api.openai.com/v1'}/chat/completions"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": self.temperature,
                        "max_tokens": self.max_tokens
                    },
                    timeout=60.0
                )
                
                response.raise_for_status()
                data = response.json()
                
                return {
                    "message": data['choices'][0]['message']['content']
                }
                
        except ImportError:
            # 如果没有安装 httpx，返回模拟响应
            logger.warning("httpx not installed, using mock response")
            return await self._mock_response(messages)
        except Exception as e:
            logger.error(f"AI API call failed: {e}")
            raise
    
    async def _call_ai_api_stream(
        self,
        messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        """
        调用 AI API（流式）
        """
        # TODO: 实现流式 API 调用
        # 这里提供一个示例实现框架
        
        self._refresh_config()
        if not self.api_key:
            raise ValueError("AI API key not configured")
        
        try:
            import httpx
            
            api_url = f"{self.api_base or 'https://api.openai.com/v1'}/chat/completions"
            
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": self.temperature,
                        "max_tokens": self.max_tokens,
                        "stream": True
                    },
                    timeout=60.0
                ) as response:
                    response.raise_for_status()
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk['choices'][0]['delta'].get('content', '')
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
                                
        except ImportError:
            # 如果没有安装 httpx，返回模拟响应
            logger.warning("httpx not installed, using mock response")
            response = await self._mock_response(messages)
            yield response['message']
        except Exception as e:
            logger.error(f"AI streaming failed: {e}")
            raise
    
    async def _mock_response(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """模拟 AI 响应（用于测试）"""
        user_message = messages[-1]['content'].lower()
        
        # 简单的关键词匹配
        if 'led' in user_message or '闪烁' in user_message or 'blink' in user_message:
            code = """void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}"""
            message = f"我为你生成了一个LED闪烁的代码：\n\n```cpp\n{code}\n```"
            
        elif '串口' in user_message or 'serial' in user_message:
            code = """void setup() {
  Serial.begin(115200);
  Serial.println("Hello, ESP32!");
}

void loop() {
  Serial.println("Running...");
  delay(1000);
}"""
            message = f"我为你生成了一个串口通信的代码：\n\n```cpp\n{code}\n```"
            
        elif 'wifi' in user_message:
            code = """#include <WiFi.h>

const char* ssid = "your_SSID";
const char* password = "your_PASSWORD";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Your code here
}"""
            message = f"我为你生成了一个WiFi连接的代码：\n\n```cpp\n{code}\n```"
            
        else:
            message = """我可以帮你生成各种 Arduino/ESP32 代码。请告诉我你想要实现什么功能，比如：

• LED 控制和闪烁
• 串口通信
• WiFi 连接
• 蓝牙通信
• 传感器读取
• PWM 控制

请描述你的需求，我会为你生成相应的代码。"""
        
        return {"message": message}
    
    def _extract_code(self, message: str) -> Optional[str]:
        """从消息中提取代码块"""
        import re
        
        # 尝试提取 ```cpp 或 ``` 代码块
        patterns = [
            r'```cpp\n(.*?)\n```',
            r'```c\n(.*?)\n```',
            r'```arduino\n(.*?)\n```',
            r'```\n(.*?)\n```'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, message, re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return None


# 全局服务实例
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """获取 AI 服务单例"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
