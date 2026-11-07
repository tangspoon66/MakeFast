/**
 * 路由保护组件
 * 
 * 功能：
 * - 检查用户认证状态
 * - 未认证时重定向到登录页
 * - 显示加载状态
 * - 传递 children 给已认证用户
 */

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * ProtectedRoute 组件
 * 
 * 用于保护需要认证的路由
 * 使用 Outlet 渲染嵌套路由
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  // 首次校验完成前不做跳转（否则刷新任何 /admin/* 页面都会先被重定向到登录页）
  const [checked, setChecked] = useState(isAuthenticated);

  // 组件挂载时检查认证状态
  useEffect(() => {
    let alive = true;
    Promise.resolve(checkAuth()).finally(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
  }, [checkAuth]);

  // 加载中：显示加载指示器
  if (isLoading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="验证身份中..." size="lg" />
      </div>
    );
  }

  // 未认证：重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // 已认证：渲染子路由
  return <Outlet />;
}
