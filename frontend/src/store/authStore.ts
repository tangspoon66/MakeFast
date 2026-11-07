/**
 * 认证状态管理
 * 
 * 使用 Zustand 管理管理员认证状态
 * 功能：
 * - httpOnly cookie 会话验证
 * - 登录/登出状态管理
 * - 自动检查认证状态
 */

import { create } from 'zustand';
import { AdminClient, AdminApiError } from '../api/adminClient';

/**
 * 用户信息接口
 */
interface User {
  username: string;
  expiresAt: number; // Unix timestamp (秒)
}

/**
 * 认证状态接口
 */
interface AuthState {
  // 状态
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

/**
 * Token 管理工具
 */
class TokenManager {
  private static readonly USER_KEY = 'admin_user';
  private static memoryToken: string | null = null;
  
  /**
   * 不再从 localStorage 读取敏感 token；认证只依赖 httpOnly cookie。
   */
  static getToken(): string | null {
    return this.memoryToken;
  }
  
  /**
   * 兼容旧调用，不落盘保存敏感 token。
   */
  static setToken(token: string): void {
    // Compatibility for older callers; the real session remains HttpOnly.
    this.memoryToken = token;
  }
  
  /**
   * 清除 token
   */
  static clearToken(): void {
    this.memoryToken = null;
    localStorage.removeItem('admin_token');
  }
  
  /**
   * 获取存储的用户信息
   */
  static getUser(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return null;
    
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }
  
  /**
   * 保存用户信息
   */
  static setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
  
  /**
   * 清除用户信息
   */
  static clearUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }
  
  /**
   * 检查 token 是否过期
   */
  static isTokenExpired(expiresAt: number): boolean {
    const now = Math.floor(Date.now() / 1000); // 当前时间（秒）
    // 提前 5 分钟判定为过期，避免边界情况
    return now >= (expiresAt - 300);
  }
}

/**
 * 创建认证状态 store
 */
export const useAuthStore = create<AuthState>((set) => {
  // 仅恢复非敏感用户信息；真实认证状态由 cookie 验证。
  const savedUser = TokenManager.getUser();
  const hasRecentUser = !!(savedUser && !TokenManager.isTokenExpired(savedUser.expiresAt));

  return {
    isAuthenticated: false,
    user: hasRecentUser ? savedUser : null,
    isLoading: false,
    error: null,
  
  /**
   * 登录
   */
  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // 调用登录 API
      const tokenData = await AdminClient.login({ username, password });
      TokenManager.setToken(tokenData.access_token);
      
      // 计算过期时间（当前时间 + expires_in）
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
      
      // 创建用户对象
      const user: User = {
        username,
        expiresAt
      };
      
      // 只保存非敏感用户信息，token 留在 httpOnly cookie 中
      TokenManager.setUser(user);
      
      // 更新状态
      set({
        isAuthenticated: true,
        user,
        isLoading: false,
        error: null
      });
    } catch (error) {
      // 处理错误
      let errorMessage = '登录失败，请稍后重试';
      
      if (error instanceof AdminApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: errorMessage
      });
      
      throw error;
    }
  },
  
  /**
   * 登出
   */
  logout: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // 调用登出 API（即使失败也清除本地状态）
      await AdminClient.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      TokenManager.clearToken();
      TokenManager.clearUser();
      
      // 重置状态
      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
    }
  },
  
  /**
   * 检查认证状态
   * 
   * 在应用启动时调用，验证本地存储的 token 是否有效
   */
  checkAuth: async () => {
    set({ isLoading: true, error: null });

    const savedUser = TokenManager.getUser();
    if (savedUser && TokenManager.isTokenExpired(savedUser.expiresAt)) {
      TokenManager.clearToken();
      TokenManager.clearUser();
      set({ isAuthenticated: false, user: null, isLoading: false, error: '登录已过期，请重新登录' });
      return;
    }

    try {
      try {
        const verifyResult = await AdminClient.verifyToken();
        const updatedUser = { username: verifyResult.username, expiresAt: verifyResult.expires_at };
        TokenManager.setUser(updatedUser);
        set({ isAuthenticated: true, user: updatedUser, isLoading: false, error: null });
      } catch {
        TokenManager.clearToken();
        TokenManager.clearUser();
        set({ isAuthenticated: false, user: null, isLoading: false, error: null });
      }
    } catch (error) {
      console.error('checkAuth error:', error);
      set({ isAuthenticated: false, user: null, isLoading: false, error: '认证检查失败' });
    }
  },
  
  /**
   * 清除错误信息
   */
  clearError: () => {
    set({ error: null });
  }
}; });

/**
 * 导出 useAuth hook（别名）
 */
export const useAuth = useAuthStore;

/**
 * 导出工具函数
 */
export { TokenManager };
