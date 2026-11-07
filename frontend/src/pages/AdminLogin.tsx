/**
 * 管理员登录页面
 * 
 * 功能：
 * - 用户名和密码输入
 * - 表单验证
 * - 登录错误提示
 * - 登录成功后重定向到管理员仪表板
 * 
 * 需求: 1.1-1.10
 */

import { AdminLogin as AdminLoginComponent } from '../components/AdminLogin';

export function AdminLogin() {
  return <AdminLoginComponent />;
}
