# API 使用示例

本文档提供了 ESP 在线开发平台 API 的使用示例。

## 基础信息

- **Base URL**: `http://localhost:8000` (开发环境)
- **API 文档**: `http://localhost:8000/api/docs` (Swagger UI)
- **API 规范**: `http://localhost:8000/api/openapi.json` (OpenAPI JSON)

## 端点列表

### 1. 健康检查

检查服务状态和系统信息。

**请求**:
```bash
GET /api/health
```

**响应示例**:
```json
{
  "status": "ok",
  "service": "makefast-platform",
  "version": "0.1.0",
  "arduino_cli": {
    "ok": true,
    "version": "arduino-cli Version: 1.4.1"
  },
  "libraries": {
    "preinstalled_count": 18
  },
  "disk": {
    "free_gb": 45.2
  }
}
```

**curl 示例**:
```bash
curl http://localhost:8000/api/health
```

---

### 2. 获取支持的开发板列表

获取所有支持的 ESP32 开发板信息。

**请求**:
```bash
GET /api/boards
```

**响应示例**:
```json
{
  "boards": [
    {
      "id": "esp32dev",
      "name": "ESP32 Dev Module",
      "fqbn": "esp32:esp32:esp32",
      "description": "ESP32 开发模块"
    },
    {
      "id": "esp32doit-devkit-v1",
      "name": "DOIT ESP32 DevKit v1",
      "fqbn": "esp32:esp32:esp32doit-devkit-v1",
      "description": "DOIT ESP32 DevKit v1 开发板"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:8000/api/boards
```

---

### 3. 编译代码

提交用户代码进行编译。

**请求**:
```bash
POST /api/compile
Content-Type: application/json
```

**请求体**:
```json
{
  "code": "void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  Serial.println(\"Hello ESP32\");\n  delay(1000);\n}",
  "board_id": "esp32dev"
}
```

**成功响应示例**:
```json
{
  "success": true,
  "firmware_id": "abc123def456",
  "firmware_size": 245760,
  "warnings": [],
  "duration": 12.5
}
```

**失败响应示例**:
```json
{
  "success": false,
  "errors": [
    {
      "type": "error",
      "line": 15,
      "message": "'WiFi' was not declared in this scope",
      "hint": "缺少 WiFi 库，请检查是否包含 #include <WiFi.h>"
    }
  ],
  "duration": 5.2
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{
    "code": "void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  Serial.println(\"Hello\");\n  delay(1000);\n}",
    "board_id": "esp32dev"
  }'
```

**验证规则**:
- `code`: 必填，1-50000 字符
- `board_id`: 必填，必须是支持的开发板 ID

---

### 4. 下载固件

下载编译好的固件文件。

**请求**:
```bash
GET /api/firmware/{firmware_id}
```

**响应**:
- Content-Type: `application/octet-stream`
- Content-Disposition: `attachment; filename="firmware.bin"`
- Body: 二进制固件数据

**curl 示例**:
```bash
curl -O http://localhost:8000/api/firmware/abc123def456
```

---

## 错误处理

### 验证错误 (422)

当请求参数不符合要求时返回。

**示例 - 空代码**:
```bash
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "", "board_id": "esp32dev"}'
```

**响应**:
```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "code"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

**示例 - 无效的开发板 ID**:
```bash
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "void setup() {}", "board_id": "invalid"}'
```

**响应**:
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "board_id"],
      "msg": "Value error, Invalid board_id 'invalid'. Allowed values: esp32, esp32dev, esp32doit-devkit-v1, nodemcu-32s, esp32wrover, esp32-poe"
    }
  ]
}
```

### 系统错误 (500)

服务器内部错误。

**响应**:
```json
{
  "success": false,
  "error_type": "system_error",
  "message": "服务器内部错误，请稍后重试。如果问题持续，请联系技术支持。"
}
```

---

## JavaScript 示例

### 使用 Fetch API

```javascript
// 获取开发板列表
async function getBoards() {
  const response = await fetch('http://localhost:8000/api/boards');
  const data = await response.json();
  return data.boards;
}

// 编译代码
async function compileCode(code, boardId) {
  const response = await fetch('http://localhost:8000/api/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      board_id: boardId
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// 下载固件
async function downloadFirmware(firmwareId) {
  const response = await fetch(`http://localhost:8000/api/firmware/${firmwareId}`);
  const blob = await response.blob();
  
  // 创建下载链接
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'firmware.bin';
  a.click();
  window.URL.revokeObjectURL(url);
}

// 使用示例
async function main() {
  try {
    // 1. 获取开发板列表
    const boards = await getBoards();
    console.log('Available boards:', boards);
    
    // 2. 编译代码
    const code = `
      void setup() {
        Serial.begin(115200);
      }
      
      void loop() {
        Serial.println("Hello ESP32");
        delay(1000);
      }
    `;
    
    const result = await compileCode(code, 'esp32dev');
    
    if (result.success) {
      console.log('Compilation successful!');
      console.log('Firmware ID:', result.firmware_id);
      console.log('Firmware size:', result.firmware_size, 'bytes');
      
      // 3. 下载固件
      await downloadFirmware(result.firmware_id);
    } else {
      console.error('Compilation failed:');
      result.errors.forEach(error => {
        console.error(`Line ${error.line}: ${error.message}`);
        if (error.hint) {
          console.log(`Hint: ${error.hint}`);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### 使用 Axios

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 编译代码
async function compileCode(code, boardId) {
  try {
    const response = await api.post('/api/compile', {
      code,
      board_id: boardId
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      // 服务器返回错误
      console.error('Server error:', error.response.data);
    } else if (error.request) {
      // 请求发送但没有响应
      console.error('No response from server');
    } else {
      // 其他错误
      console.error('Error:', error.message);
    }
    throw error;
  }
}
```

---

## Python 示例

### 使用 requests

```python
import requests

API_BASE_URL = 'http://localhost:8000'

def get_boards():
    """获取开发板列表"""
    response = requests.get(f'{API_BASE_URL}/api/boards')
    response.raise_for_status()
    return response.json()['boards']

def compile_code(code, board_id):
    """编译代码"""
    response = requests.post(
        f'{API_BASE_URL}/api/compile',
        json={
            'code': code,
            'board_id': board_id
        }
    )
    response.raise_for_status()
    return response.json()

def download_firmware(firmware_id, output_path='firmware.bin'):
    """下载固件"""
    response = requests.get(f'{API_BASE_URL}/api/firmware/{firmware_id}')
    response.raise_for_status()
    
    with open(output_path, 'wb') as f:
        f.write(response.content)
    
    return output_path

# 使用示例
if __name__ == '__main__':
    # 1. 获取开发板列表
    boards = get_boards()
    print(f'Available boards: {len(boards)}')
    
    # 2. 编译代码
    code = '''
    void setup() {
      Serial.begin(115200);
    }
    
    void loop() {
      Serial.println("Hello ESP32");
      delay(1000);
    }
    '''
    
    result = compile_code(code, 'esp32dev')
    
    if result['success']:
        print('Compilation successful!')
        print(f"Firmware ID: {result['firmware_id']}")
        print(f"Firmware size: {result['firmware_size']} bytes")
        
        # 3. 下载固件
        firmware_path = download_firmware(result['firmware_id'])
        print(f'Firmware downloaded to: {firmware_path}')
    else:
        print('Compilation failed:')
        for error in result['errors']:
            print(f"Line {error['line']}: {error['message']}")
            if 'hint' in error:
                print(f"Hint: {error['hint']}")
```

---

## 测试工具

### Postman Collection

可以导入以下 Postman Collection 进行测试：

```json
{
  "info": {
    "name": "MakeFast Platform API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/health"
      }
    },
    {
      "name": "Get Boards",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/boards"
      }
    },
    {
      "name": "Compile Code",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/compile",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"code\": \"void setup() {\\n  Serial.begin(115200);\\n}\\n\\nvoid loop() {\\n  Serial.println(\\\"Hello\\\");\\n  delay(1000);\\n}\",\n  \"board_id\": \"esp32dev\"\n}"
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:8000"
    }
  ]
}
```

---

## 注意事项

1. **编译超时**: 编译时间限制为 60 秒，超时会返回错误
2. **代码长度限制**: 代码最大 50000 字符
3. **并发限制**: 建议控制并发编译请求数量
4. **固件有效期**: 编译好的固件会在服务器保存一段时间后自动清理
5. **CORS**: 开发环境已配置 CORS，生产环境需要配置允许的域名

---

## 更多信息

- **API 文档**: 访问 `http://localhost:8000/api/docs` 查看完整的交互式 API 文档
- **OpenAPI 规范**: 访问 `http://localhost:8000/api/openapi.json` 获取 OpenAPI JSON 规范
