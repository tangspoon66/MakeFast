# 状态管理 Store

本目录包含应用的全局状态管理模块，使用 Zustand 实现。

## authStore - 认证状态管理

认证状态管理模块，用于管理管理员登录、登出和认证状态。

### 功能特性

- ✅ Token 存储和检索 (localStorage)
- ✅ 登录/登出状态管理
- ✅ Token 过期检测（提前 5 分钟判定过期）
- ✅ 自动检查认证状态
- ✅ 错误处理和状态管理

### 使用方法

#### 1. 在组件中使用

```tsx
import { useAuth } from '../store/authStore';

function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  
  const handleLogin = async (username: string, password: string) => {
    try {
      await login(username, password);
      // 登录成功，跳转到管理页面
      navigate('/admin');
    } catch (error) {
      // 错误已经存储在 store 中，可以通过 error 状态访问
      console.error('Login failed:', error);
    }
  };
  
  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={() => handleLogin('admin', 'password')} disabled={isLoading}>
        {isLoading ? '登录中...' : '登录'}
      </button>
    </div>
  );
}
```

#### 2. 检查认证状态

```tsx
import { useAuth } from '../store/authStore';

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" />;
  }
  
  return (
    <div>
      <p>欢迎, {user?.username}</p>
      {children}
    </div>
  );
}
```

#### 3. 登出

```tsx
import { useAuth } from '../store/authStore';

function AdminHeader() {
  const { logout, user } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    // 登出后跳转到登录页
    navigate('/admin/login');
  };
  
  return (
    <header>
      <span>{user?.username}</span>
      <button onClick={handleLogout}>登出</button>
    </header>
  );
}
```

#### 4. 应用启动时检查认证

```tsx
import { useEffect } from 'react';
import { useAuth } from '../store/authStore';

function App() {
  const { checkAuth } = useAuth();
  
  useEffect(() => {
    // 应用启动时检查认证状态
    checkAuth();
  }, [checkAuth]);
  
  return <Router>...</Router>;
}
```

### API 参考

#### 状态

- `isAuthenticated: boolean` - 是否已认证
- `user: User | null` - 当前用户信息
  - `username: string` - 用户名
  - `expiresAt: number` - Token 过期时间（Unix 时间戳，秒）
- `isLoading: boolean` - 是否正在加载（登录/登出/检查认证）
- `error: string | null` - 错误信息

#### 操作

- `login(username: string, password: string): Promise<void>` - 登录
  - 成功：更新状态，保存 token 到 localStorage
  - 失败：抛出错误，设置 error 状态
  
- `logout(): Promise<void>` - 登出
  - 调用后端登出 API
  - 清除本地 token 和用户信息
  - 即使 API 调用失败也会清除本地状态
  
- `checkAuth(): Promise<void>` - 检查认证状态
  - 检查本地是否有 token
  - 验证 token 是否过期
  - 调用后端验证 token 有效性
  - 更新认证状态
  
- `clearError(): void` - 清除错误信息

### Token 管理

authStore 内部使用 `TokenManager` 管理 token 和用户信息的存储：

```typescript
// 存储键
localStorage.setItem('admin_token', token);
localStorage.setItem('admin_user', JSON.stringify(user));

// Token 过期检测
// 提前 5 分钟判定为过期，避免边界情况
const isExpired = now >= (expiresAt - 300);
```

### 错误处理

authStore 会捕获并处理以下错误：

1. **登录失败**
   - 无效凭证
   - 账户锁定
   - 网络错误

2. **Token 过期**
   - 自动检测并清除过期 token
   - 提示用户重新登录

3. **Token 验证失败**
   - 清除本地存储
   - 更新认证状态为未登录

### 测试

运行测试：

```bash
npm test -- src/store/authStore.test.ts
```

测试覆盖：
- ✅ Token 存储和检索
- ✅ 用户信息存储和检索
- ✅ Token 过期检测
- ✅ 登录成功/失败
- ✅ 登出（包括 API 失败情况）
- ✅ 认证状态检查（无 token、过期 token、有效 token、验证失败）
- ✅ 错误清除

## editorStore - 编辑器状态管理

（现有的编辑器状态管理，保持不变）
