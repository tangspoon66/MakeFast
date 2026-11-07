/**
 * authStore 功能演示脚本
 * 
 * 这个文件展示了如何使用 authStore 的各种功能
 * 可以在浏览器控制台中运行这些代码片段
 */

import { useAuthStore, TokenManager } from './authStore';

/**
 * 演示 1: 检查初始状态
 */
export function demo1_checkInitialState() {
  const state = useAuthStore.getState();
  console.log('初始状态:', {
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    isLoading: state.isLoading,
    error: state.error
  });
}

/**
 * 演示 2: 登录
 */
export async function demo2_login() {
  const { login } = useAuthStore.getState();
  
  try {
    console.log('开始登录...');
    await login('admin', 'password');
    
    const state = useAuthStore.getState();
    console.log('登录成功!', {
      isAuthenticated: state.isAuthenticated,
      user: state.user
    });
    
    // 检查 localStorage
    console.log('localStorage token:', TokenManager.getToken());
    console.log('localStorage user:', TokenManager.getUser());
  } catch (error) {
    console.error('登录失败:', error);
    const state = useAuthStore.getState();
    console.log('错误信息:', state.error);
  }
}

/**
 * 演示 3: 检查认证状态
 */
export async function demo3_checkAuth() {
  const { checkAuth } = useAuthStore.getState();
  
  console.log('检查认证状态...');
  await checkAuth();
  
  const state = useAuthStore.getState();
  console.log('认证状态:', {
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    error: state.error
  });
}

/**
 * 演示 4: 登出
 */
export async function demo4_logout() {
  const { logout } = useAuthStore.getState();
  
  console.log('开始登出...');
  await logout();
  
  const state = useAuthStore.getState();
  console.log('登出成功!', {
    isAuthenticated: state.isAuthenticated,
    user: state.user
  });
  
  // 检查 localStorage
  console.log('localStorage token:', TokenManager.getToken());
  console.log('localStorage user:', TokenManager.getUser());
}

/**
 * 演示 5: Token 过期检测
 */
export function demo5_tokenExpiration() {
  // 创建一个过期的 token
  const expiredTime = Math.floor(Date.now() / 1000) - 1000;
  console.log('设置过期 token...');
  TokenManager.setToken('expired-token');
  TokenManager.setUser({ username: 'admin', expiresAt: expiredTime });
  
  console.log('检查是否过期:', TokenManager.isTokenExpired(expiredTime));
  
  // 创建一个有效的 token
  const validTime = Math.floor(Date.now() / 1000) + 3600;
  console.log('设置有效 token...');
  TokenManager.setUser({ username: 'admin', expiresAt: validTime });
  
  console.log('检查是否过期:', TokenManager.isTokenExpired(validTime));
  
  // 清理
  TokenManager.clearToken();
  TokenManager.clearUser();
}

/**
 * 演示 6: 错误处理
 */
export async function demo6_errorHandling() {
  const { login, clearError } = useAuthStore.getState();
  
  try {
    console.log('尝试使用错误凭证登录...');
    await login('admin', 'wrong-password');
  } catch (error) {
    console.log('预期的错误:', error);
    
    const state = useAuthStore.getState();
    console.log('错误状态:', state.error);
    
    console.log('清除错误...');
    clearError();
    
    const newState = useAuthStore.getState();
    console.log('清除后的错误状态:', newState.error);
  }
}

/**
 * 演示 7: 订阅状态变化
 */
export function demo7_subscribeToChanges() {
  console.log('订阅状态变化...');
  
  const unsubscribe = useAuthStore.subscribe((state) => {
    console.log('状态变化:', {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      isLoading: state.isLoading,
      error: state.error
    });
  });
  
  console.log('订阅已设置，现在可以执行其他操作来观察状态变化');
  console.log('调用 unsubscribe() 来取消订阅');
  
  return unsubscribe;
}

/**
 * 完整演示流程
 */
export async function demoComplete() {
  console.log('=== authStore 完整演示 ===\n');
  
  console.log('1. 检查初始状态');
  demo1_checkInitialState();
  console.log('\n');
  
  console.log('2. 尝试登录');
  await demo2_login();
  console.log('\n');
  
  console.log('3. 检查认证状态');
  await demo3_checkAuth();
  console.log('\n');
  
  console.log('4. 登出');
  await demo4_logout();
  console.log('\n');
  
  console.log('5. Token 过期检测');
  demo5_tokenExpiration();
  console.log('\n');
  
  console.log('6. 错误处理');
  await demo6_errorHandling();
  console.log('\n');
  
  console.log('=== 演示完成 ===');
}

/**
 * 使用说明
 * 
 * 在浏览器控制台中：
 * 
 * import * as authDemo from './store/authStore.demo';
 * 
 * // 运行完整演示
 * await authDemo.demoComplete();
 * 
 * // 或者运行单个演示
 * authDemo.demo1_checkInitialState();
 * await authDemo.demo2_login();
 * await authDemo.demo3_checkAuth();
 * await authDemo.demo4_logout();
 * authDemo.demo5_tokenExpiration();
 * await authDemo.demo6_errorHandling();
 * 
 * // 订阅状态变化
 * const unsubscribe = authDemo.demo7_subscribeToChanges();
 * // ... 执行其他操作 ...
 * unsubscribe(); // 取消订阅
 */
