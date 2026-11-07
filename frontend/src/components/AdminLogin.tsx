/**
 * 管理员登录组件
 * 
 * 功能：
 * - 登录表单 (用户名、密码)
 * - 表单验证
 * - 登录错误处理 (无效凭证、账户锁定)
 * - Token 存储
 * 
 * 需求: 1.1-1.10
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function AdminLogin() {
  const navigate = useNavigate();
  const { login, isLoading: storeLoading, error, clearError } = useAuthStore();
  
  // 使用本地 loading 状态，避免被 checkAuth 影响
  const [submitting, setSubmitting] = useState(false);
  const isLoading = submitting || storeLoading;
  
  // 表单状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 表单验证错误
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  
  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};
    
    // 验证用户名 (3-50 字符)
    if (!username) {
      errors.username = '请输入用户名';
    } else if (username.length < 3) {
      errors.username = '用户名至少需要 3 个字符';
    } else if (username.length > 50) {
      errors.username = '用户名不能超过 50 个字符';
    }
    
    // 验证密码 (8-128 字符)
    if (!password) {
      errors.password = '请输入密码';
    } else if (password.length < 8) {
      errors.password = '密码至少需要 8 个字符';
    } else if (password.length > 128) {
      errors.password = '密码不能超过 128 个字符';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // 清除之前的错误
    clearError();
    setValidationErrors({});
    
    // 验证表单
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      // 调用登录
      await login(username, password);
      
      // 登录成功，跳转到管理员仪表板
      navigate('/admin');
    } catch (error) {
      // 错误已经在 authStore 中处理
      console.error('Login failed:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  /**
   * 处理输入变化（清除验证错误）
   */
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (validationErrors.username) {
      setValidationErrors({ ...validationErrors, username: undefined });
    }
    if (error) {
      clearError();
    }
  };
  
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (validationErrors.password) {
      setValidationErrors({ ...validationErrors, password: undefined });
    }
    if (error) {
      clearError();
    }
  };
  
  /**
   * 获取错误消息（优先显示 API 错误）
   */
  const getErrorMessage = (): string | null => {
    if (error) {
      // 处理特定错误码
      if (error.includes('account_locked') || error.includes('账户锁定') || error.includes('temporarily locked')) {
        return error;
      }
      if (error.includes('invalid_credentials') || error.includes('认证失败') || error.includes('Invalid credentials')) {
        return '用户名或密码错误';
      }
      return error;
    }
    return null;
  };
  
  const errorMessage = getErrorMessage();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4">
      <div className="w-full max-w-md">
        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 头部 */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
              <Lock className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">管理员登录</h1>
            <p className="text-blue-100 text-sm">MakeFast 管理后台 · 课程 / FAQ / 小铁猫设置</p>
          </div>
          
          {/* 表单 */}
          <div className="px-8 py-8">
            {/* 全局错误消息 */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">登录失败</p>
                  <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 用户名输入 */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  用户名
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className={`
                      block w-full pl-10 pr-3 py-2.5 
                      border rounded-lg 
                      focus:outline-none focus:ring-2 
                      transition-colors
                      ${validationErrors.username 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }
                    `}
                    placeholder="请输入用户名"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
                {validationErrors.username && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.username}
                  </p>
                )}
              </div>
              
              {/* 密码输入 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className={`
                      block w-full pl-10 pr-10 py-2.5
                      border rounded-lg
                      focus:outline-none focus:ring-2
                      transition-colors
                      ${validationErrors.password
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }
                    `}
                    placeholder="请输入密码"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.password}
                  </p>
                )}
              </div>
              
              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full py-3 px-4 
                  bg-gradient-to-r from-blue-500 to-cyan-500 
                  text-white font-medium rounded-lg 
                  transition-all duration-200
                  ${isLoading 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg'
                  }
                `}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    登录中...
                  </span>
                ) : (
                  '登录'
                )}
              </button>
            </form>
            
            {/* 提示信息 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                登录失败 5 次将锁定账户 30 分钟
              </p>
            </div>
          </div>
        </div>
        
        {/* 返回首页链接 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← 返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
