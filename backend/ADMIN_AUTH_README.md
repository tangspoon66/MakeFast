# 管理员认证系统

## 概述

管理员认证系统提供了安全的身份验证机制，用于保护固件管理功能。系统使用 JWT (JSON Web Token) 进行无状态认证，并实现了登录频率限制和账户锁定功能。

## 功能特性

### 1. 安全认证
- ✅ 使用 bcrypt 算法哈希密码（cost factor 12）
- ✅ JWT Token 认证（有效期 24 小时）
- ✅ 用户名长度验证（3-50 字符）
- ✅ 密码长度验证（8-128 字符）

### 2. 防暴力破解
- ✅ 登录失败次数跟踪
- ✅ 5 次失败后自动锁定账户 30 分钟
- ✅ 15 分钟时间窗口内的失败计数
- ✅ 锁定剩余时间提示

### 3. API 端点

#### POST /api/admin/login
管理员登录

**请求体:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**成功响应 (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**错误响应:**
- `401 Unauthorized`: 用户名或密码错误
- `429 Too Many Requests`: 账户被锁定

#### POST /api/admin/logout
管理员登出

**请求头:**
```
Authorization: Bearer <token>
```

**成功响应 (200):**
```json
{
  "success": true,
  "message": "登出成功"
}
```

**错误响应:**
- `401 Unauthorized`: Token 无效或过期
- `403 Forbidden`: 未提供 Token

#### GET /api/admin/verify
验证 Token

**请求头:**
```
Authorization: Bearer <token>
```

**成功响应 (200):**
```json
{
  "success": true,
  "username": "admin",
  "expires_at": 1778647790
}
```

**错误响应:**
- `401 Unauthorized`: Token 无效或过期

#### GET /api/admin/health
健康检查（无需认证）

**成功响应 (200):**
```json
{
  "success": true,
  "service": "admin-auth",
  "status": "ok",
  "configured": {
    "admin_username": true,
    "admin_password": true,
    "jwt_secret": true
  }
}
```

## 配置

### 环境变量

在 `backend/.env` 文件中配置以下变量：

```bash
# 管理员用户名
ADMIN_USERNAME=admin

# 管理员密码哈希（使用 bcrypt）
ADMIN_PASSWORD_HASH=$2b$12$uDRjl8Bckqogc9LN5S8hVOBdpgoub738dS9GLH8fWDFUgFFV2Du06

# JWT 密钥（生产环境请使用强随机密钥）
JWT_SECRET_KEY=your-secret-key-change-in-production-please-use-a-strong-random-key
```

### 生成密码哈希

使用以下 Python 脚本生成密码哈希：

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
password = "your_password_here"
password_hash = pwd_context.hash(password)
print(f"ADMIN_PASSWORD_HASH={password_hash}")
```

或使用命令行：

```bash
python3 -c "from passlib.context import CryptContext; pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto'); print(pwd_context.hash('your_password_here'))"
```

## 使用示例

### 前端集成

```typescript
// 登录
const login = async (username: string, password: string) => {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  if (response.ok) {
    const data = await response.json();
    // 保存 token 到 localStorage
    localStorage.setItem('admin_token', data.access_token);
    return data;
  } else {
    const error = await response.json();
    throw new Error(error.detail.message);
  }
};

// 验证 Token
const verifyToken = async (token: string) => {
  const response = await fetch('/api/admin/verify', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.ok;
};

// 登出
const logout = async (token: string) => {
  await fetch('/api/admin/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  // 清除本地 token
  localStorage.removeItem('admin_token');
};

// 受保护的 API 请求
const fetchProtectedData = async (token: string) => {
  const response = await fetch('/api/admin/firmware', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.status === 401) {
    // Token 过期，重定向到登录页
    window.location.href = '/admin/login';
    return;
  }
  
  return response.json();
};
```

## 安全最佳实践

### 1. 生产环境配置
> Security note: obsolete default-login instructions omitted; use locally generated credentials.
- ✅ 使用强随机 JWT 密钥（至少 32 字符）
- ✅ 启用 HTTPS（防止 token 被窃取）
- ✅ 定期更换密码和密钥

### 2. Token 管理
- ✅ 客户端使用 localStorage 或 sessionStorage 存储 token
- ✅ 每次请求都检查 token 有效性
- ✅ Token 过期后自动重定向到登录页
- ✅ 登出时清除本地 token

### 3. 错误处理
- ✅ 不要在错误消息中泄露敏感信息
- ✅ 记录所有登录失败尝试
- ✅ 监控异常登录行为

## 测试

运行测试脚本：

```bash
cd backend
python3 test_admin_routes.py
```

测试覆盖：
- ✅ 健康检查
- ✅ 无效凭证登录
- ✅ 有效凭证登录
- ✅ Token 验证
- ✅ 无效 Token
- ✅ 登出
- ✅ 未提供 Token 的请求

## 故障排查

### 问题：登录失败，提示"用户名或密码错误"

**解决方案：**
1. 检查 `.env` 文件中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD_HASH`
2. 确认密码哈希是否正确生成
3. 检查密码长度是否至少 8 字符

### 问题：Token 验证失败

**解决方案：**
1. 检查 `JWT_SECRET_KEY` 是否配置
2. 确认 token 格式正确（Bearer <token>）
3. 检查 token 是否过期（24 小时有效期）

### 问题：账户被锁定

**解决方案：**
1. 等待 30 分钟后自动解锁
2. 或重启后端服务（内存存储会被清空）

## 架构说明

### 认证流程

```
1. 用户提交用户名和密码
   ↓
2. 验证输入长度
   ↓
3. 检查账户是否被锁定
   ↓
4. 验证用户名和密码哈希
   ↓
5. 生成 JWT token（有效期 24 小时）
   ↓
6. 返回 token 给客户端
```

### Token 验证流程

```
1. 客户端发送请求（携带 Bearer token）
   ↓
2. 认证中间件提取 token
   ↓
3. 验证 token 签名和有效期
   ↓
4. 提取用户信息
   ↓
5. 允许访问受保护资源
```

### 登录失败处理

```
1. 记录失败尝试（用户名 + 时间戳）
   ↓
2. 检查 15 分钟内失败次数
   ↓
3. 如果 >= 5 次，锁定账户 30 分钟
   ↓
4. 返回错误消息（包含剩余锁定时间）
```

## 依赖项

- `fastapi`: Web 框架
- `passlib[bcrypt]`: 密码哈希
- `pyjwt`: JWT token 生成和验证
- `python-dotenv`: 环境变量加载

## 下一步

- [ ] 实现管理员固件管理路由（任务 2.3）
- [ ] 实现 AI 配置路由（任务 2.5）
- [ ] 实现统计路由（任务 2.7）
- [ ] 编写单元测试（任务 2.2）

## 更新日志

### 2024-01-XX - v1.0.0
- ✅ 实现管理员登录端点
- ✅ 实现管理员登出端点
- ✅ 实现 Token 验证端点
- ✅ 实现认证中间件
- ✅ 实现登录频率限制
- ✅ 实现账户锁定机制
- ✅ 完成所有功能测试

---

**文档版本**: 1.0  
**最后更新**: 2024-01-XX  
**作者**: Kiro AI Agent
