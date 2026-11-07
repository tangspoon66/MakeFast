/**
 * 认证状态管理使用示例
 * 
 * 这个文件展示了如何在组件中使用 authStore
 * 实际使用时可以参考这些模式
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../store/authStore';

/**
 * 示例 1: 登录表单组件
 */
export function LoginFormExample() {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 清除错误信息（当用户开始输入时）
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [username, password, error, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(username, password);
      // 登录成功，可以在这里跳转
      console.log('Login successful!');
    } catch (err) {
      // 错误已经存储在 store 中
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>管理员登录</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div>
        <label>用户名</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>
      
      <div>
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

/**
 * 示例 2: 受保护的路由组件
 */
export function ProtectedRouteExample({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>检查认证状态...</div>;
  }

  if (!isAuthenticated) {
    // 实际使用时应该使用 React Router 的 Navigate 组件
    return <div>请先登录</div>;
  }

  return <>{children}</>;
}

/**
 * 示例 3: 管理员头部组件
 */
export function AdminHeaderExample() {
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
    // 登出后可以跳转到登录页
    console.log('Logged out');
  };

  return (
    <header>
      <div>
        <span>欢迎, {user?.username}</span>
        <span>Token 过期时间: {new Date((user?.expiresAt ?? 0) * 1000).toLocaleString()}</span>
      </div>
      
      <button onClick={handleLogout} disabled={isLoading}>
        {isLoading ? '登出中...' : '登出'}
      </button>
    </header>
  );
}

/**
 * 示例 4: 应用初始化组件
 */
export function AppInitExample() {
  const { checkAuth, isLoading } = useAuth();

  useEffect(() => {
    // 应用启动时检查认证状态
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <div>初始化中...</div>;
  }

  return (
    <div>
      <h1>应用已就绪</h1>
      {/* 其他应用内容 */}
    </div>
  );
}

/**
 * 示例 5: 显示认证状态的组件
 */
export function AuthStatusExample() {
  const { isAuthenticated, user, error } = useAuth();

  return (
    <div>
      <h3>认证状态</h3>
      <p>已认证: {isAuthenticated ? '是' : '否'}</p>
      {user && (
        <>
          <p>用户名: {user.username}</p>
          <p>Token 过期时间: {new Date(user.expiresAt * 1000).toLocaleString()}</p>
        </>
      )}
      {error && <p className="error">错误: {error}</p>}
    </div>
  );
}
