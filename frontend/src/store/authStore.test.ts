/**
 * 认证状态管理单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, TokenManager } from './authStore';
import { AdminClient } from '../api/adminClient';

// Mock AdminClient
vi.mock('../api/adminClient', () => ({
  AdminClient: {
    login: vi.fn(),
    logout: vi.fn(),
    verifyToken: vi.fn()
  },
  AdminApiError: class AdminApiError extends Error {
    statusCode?: number;
    errorCode?: string;
    
    constructor(message: string, statusCode?: number, errorCode?: string) {
      super(message);
      this.name = 'AdminApiError';
      this.statusCode = statusCode;
      this.errorCode = errorCode;
    }
  }
}));

describe('TokenManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should store and retrieve token', () => {
    const token = 'test-token-123';
    TokenManager.setToken(token);
    expect(TokenManager.getToken()).toBe(token);
  });
  
  it('should clear token', () => {
    TokenManager.setToken('test-token');
    TokenManager.clearToken();
    expect(TokenManager.getToken()).toBeNull();
  });
  
  it('should store and retrieve user', () => {
    const user = { username: 'admin', expiresAt: 1234567890 };
    TokenManager.setUser(user);
    expect(TokenManager.getUser()).toEqual(user);
  });
  
  it('should clear user', () => {
    TokenManager.setUser({ username: 'admin', expiresAt: 1234567890 });
    TokenManager.clearUser();
    expect(TokenManager.getUser()).toBeNull();
  });
  
  it('should detect expired token', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 1000; // 过去的时间
    expect(TokenManager.isTokenExpired(pastTime)).toBe(true);
  });
  
  it('should detect valid token', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
    expect(TokenManager.isTokenExpired(futureTime)).toBe(false);
  });
  
  it('should detect token expiring soon (within 5 minutes)', () => {
    const soonTime = Math.floor(Date.now() / 1000) + 200; // 200秒后（小于5分钟）
    expect(TokenManager.isTokenExpired(soonTime)).toBe(true);
  });
});

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // 重置 store 状态
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });
  });
  
  describe('login', () => {
    it('should login successfully', async () => {
      const mockToken = {
        access_token: 'test-token',
        token_type: 'bearer',
        expires_in: 86400
      };
      
      vi.mocked(AdminClient.login).mockResolvedValue(mockToken);
      
      const store = useAuthStore.getState();
      await store.login('admin', 'password');
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.username).toBe('admin');
      expect(state.error).toBeNull();
      expect(TokenManager.getToken()).toBe('test-token');
    });
    
    it('should handle login failure', async () => {
      const error = new Error('Invalid credentials');
      vi.mocked(AdminClient.login).mockRejectedValue(error);
      
      const store = useAuthStore.getState();
      
      await expect(store.login('admin', 'wrong')).rejects.toThrow();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.error).toBeTruthy();
    });
  });
  
  describe('logout', () => {
    it('should logout successfully', async () => {
      // 先设置登录状态
      TokenManager.setToken('test-token');
      TokenManager.setUser({ username: 'admin', expiresAt: Date.now() / 1000 + 3600 });
      useAuthStore.setState({
        isAuthenticated: true,
        user: { username: 'admin', expiresAt: Date.now() / 1000 + 3600 }
      });
      
      vi.mocked(AdminClient.logout).mockResolvedValue();
      
      const store = useAuthStore.getState();
      await store.logout();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(TokenManager.getToken()).toBeNull();
      expect(TokenManager.getUser()).toBeNull();
    });
    
    it('should clear local state even if logout API fails', async () => {
      TokenManager.setToken('test-token');
      TokenManager.setUser({ username: 'admin', expiresAt: Date.now() / 1000 + 3600 });
      
      vi.mocked(AdminClient.logout).mockRejectedValue(new Error('Network error'));
      
      const store = useAuthStore.getState();
      await store.logout();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(TokenManager.getToken()).toBeNull();
    });
  });
  
  describe('checkAuth', () => {
    it('should detect no token', async () => {
      const store = useAuthStore.getState();
      await store.checkAuth();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
    
    it('should detect expired token', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 1000;
      TokenManager.setToken('expired-token');
      TokenManager.setUser({ username: 'admin', expiresAt: expiredTime });
      
      const store = useAuthStore.getState();
      await store.checkAuth();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toContain('过期');
      expect(TokenManager.getToken()).toBeNull();
    });
    
    it('should verify valid token', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      TokenManager.setToken('valid-token');
      TokenManager.setUser({ username: 'admin', expiresAt: futureTime });
      
      vi.mocked(AdminClient.verifyToken).mockResolvedValue({
        username: 'admin',
        expires_at: futureTime
      });
      
      const store = useAuthStore.getState();
      await store.checkAuth();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe('admin');
    });
    
    it('should handle token verification failure', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      TokenManager.setToken('invalid-token');
      TokenManager.setUser({ username: 'admin', expiresAt: futureTime });
      
      vi.mocked(AdminClient.verifyToken).mockRejectedValue(new Error('Invalid token'));
      
      const store = useAuthStore.getState();
      await store.checkAuth();
      
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(TokenManager.getToken()).toBeNull();
    });
  });
  
  describe('clearError', () => {
    it('should clear error message', () => {
      useAuthStore.setState({ error: 'Some error' });
      
      const store = useAuthStore.getState();
      store.clearError();
      
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });
});
