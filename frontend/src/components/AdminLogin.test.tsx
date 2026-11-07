/**
 * AdminLogin 组件测试
 * 
 * 测试范围:
 * - 表单渲染
 * - 表单验证
 * - 登录流程
 * - 错误处理
 * - 导航
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminLogin } from './AdminLogin';
import { useAuthStore } from '../store/authStore';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock authStore
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('AdminLogin', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 默认 mock 状态
    (useAuthStore as any).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });
  
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AdminLogin />
      </BrowserRouter>
    );
  };
  
  describe('渲染', () => {
    it('应该渲染登录表单', () => {
      renderComponent();
      
      expect(screen.getByText('管理员登录')).toBeInTheDocument();
      expect(screen.getByText('MakeFast 管理后台 · 课程 / FAQ / 小铁猫设置')).toBeInTheDocument();
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    });
    
    it('应该显示返回首页按钮', () => {
      renderComponent();
      
      expect(screen.getByText('← 返回首页')).toBeInTheDocument();
    });
    
    it('应该显示账户锁定提示', () => {
      renderComponent();
      
      expect(screen.getByText('登录失败 5 次将锁定账户 30 分钟')).toBeInTheDocument();
    });
  });
  
  describe('表单验证', () => {
    it('应该验证空用户名', async () => {
      renderComponent();
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该验证用户名长度 (< 3)', async () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      fireEvent.change(usernameInput, { target: { value: 'ab' } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('用户名至少需要 3 个字符')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该验证用户名长度 (> 50)', async () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      fireEvent.change(usernameInput, { target: { value: 'a'.repeat(51) } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('用户名不能超过 50 个字符')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该验证空密码', async () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('请输入密码')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该验证密码长度 (< 8)', async () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'pass123' } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('密码至少需要 8 个字符')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该验证密码长度 (> 128)', async () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'a'.repeat(129) } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('密码不能超过 128 个字符')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
    
    it('应该在输入时清除验证错误', async () => {
      renderComponent();
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      });
      
      const usernameInput = screen.getByLabelText('用户名');
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      
      await waitFor(() => {
        expect(screen.queryByText('请输入用户名')).not.toBeInTheDocument();
      });
    });
  });
  
  describe('登录流程', () => {
    it('应该在有效输入时调用登录', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('admin', 'password123');
      });
    });
    
    it('应该在登录成功后导航到管理员页面', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      const submitButton = screen.getByRole('button', { name: '登录' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });
    
    it('应该在登录时显示加载状态', () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });
      
      renderComponent();
      
      expect(screen.getByText('登录中...')).toBeInTheDocument();
      
      const submitButton = screen.getByRole('button', { name: /登录中/ });
      expect(submitButton).toBeDisabled();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
  });
  
  describe('错误处理', () => {
    it('应该显示无效凭证错误', () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
        clearError: mockClearError,
      });
      
      renderComponent();
      
      expect(screen.getByText('登录失败')).toBeInTheDocument();
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
    
    it('应该显示账户锁定错误', () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Account is temporarily locked for 25 minutes',
        clearError: mockClearError,
      });
      
      renderComponent();
      
      expect(screen.getByText('登录失败')).toBeInTheDocument();
      expect(screen.getByText('Account is temporarily locked for 25 minutes')).toBeInTheDocument();
    });
    
    it('应该显示通用错误', () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: '网络连接失败',
        clearError: mockClearError,
      });
      
      renderComponent();
      
      expect(screen.getByText('登录失败')).toBeInTheDocument();
      expect(screen.getByText('网络连接失败')).toBeInTheDocument();
    });
    
    it('应该在输入时清除 API 错误', async () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
        clearError: mockClearError,
      });
      
      renderComponent();
      
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
      
      const usernameInput = screen.getByLabelText('用户名');
      fireEvent.change(usernameInput, { target: { value: 'a' } });
      
      await waitFor(() => {
        expect(mockClearError).toHaveBeenCalled();
      });
    });
  });
  
  describe('导航', () => {
    it('应该在点击返回首页时导航', () => {
      renderComponent();
      
      const backButton = screen.getByText('← 返回首页');
      fireEvent.click(backButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
  
  describe('可访问性', () => {
    it('应该有正确的表单标签', () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      expect(usernameInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
    
    it('应该有正确的 autocomplete 属性', () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      expect(usernameInput).toHaveAttribute('autocomplete', 'username');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });
    
    it('应该有正确的 placeholder', () => {
      renderComponent();
      
      const usernameInput = screen.getByLabelText('用户名');
      const passwordInput = screen.getByLabelText('密码');
      
      expect(usernameInput).toHaveAttribute('placeholder', '请输入用户名');
      expect(passwordInput).toHaveAttribute('placeholder', '请输入密码');
    });
  });
});
