/**
 * ProtectedRoute 组件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../store/authStore';

// Mock authStore
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock LoadingSpinner
vi.mock('./LoadingSpinner', () => ({
  LoadingSpinner: ({ message }: { message: string }) => <div data-testid="loading">{message}</div>,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('显示加载状态当正在检查认证时', () => {
    // Mock: 正在加载
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      checkAuth: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText('验证身份中...')).toBeInTheDocument();
  });

  it('重定向到登录页当未认证时（首次校验完成后）', async () => {
    // Mock: 未认证
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      checkAuth: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Login Page</div>} />
        </Routes>
      </BrowserRouter>
    );

    // 应该重定向到登录页
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
