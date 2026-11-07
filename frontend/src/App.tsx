/**
 * App.tsx - 应用路由配置
 *
 * 路由结构（Welcome → Hub → /courses）：
 * /        - Welcome（首次冷开；Agent IDLE）
 * /home    - Home Hub 学习主页（回访默认；Agent IDLE）
 * /courses - 课程目录全库（原 S1；Agent IDLE）
 * /welcome - 旧落地页已下线，重定向到 /
 * /editor, /workbench - 第一课课程工作台（Agent 仅在此 GUIDING）
 * /project?project=… - 旧版账号项目工作台（保留，已移除旧 AI 助手）
 * /library - 课程库预览
 * /firmware/:id - 固件详情
 * /admin/* - 管理端
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LearnerProtectedRoute } from './components/LearnerProtectedRoute';
import './App.css';
import { RouteTitle } from './components/RouteTitle';

// 懒加载页面组件
const WelcomePage = lazy(() => import('./pages/WelcomePage').then(m => ({ default: m.WelcomePage })));
const HomeHubPage = lazy(() => import('./pages/HomeHubPage').then(m => ({ default: m.HomeHubPage })));
const CourseCatalogPage = lazy(() => import('./pages/CourseCatalogPage').then(m => ({ default: m.CourseCatalogPage })));
const CourseArticlePage = lazy(() => import('./pages/CourseArticlePage').then(m => ({ default: m.CourseArticlePage })));
const LessonWorkbenchPage = lazy(() => import('./pages/LessonWorkbenchPage').then(m => ({ default: m.LessonWorkbenchPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const FirmwareDetail = lazy(() => import('./pages/FirmwareDetail').then(m => ({ default: m.FirmwareDetail })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminResourceList = lazy(() => import('./pages/AdminResourceList').then(m => ({ default: m.AdminResourceList })));
const AdminResourceUpload = lazy(() => import('./pages/AdminResourceUpload').then(m => ({ default: m.AdminResourceUpload })));
const AdminFirmwareEdit = lazy(() => import('./pages/AdminFirmwareEdit').then(m => ({ default: m.AdminFirmwareEdit })));
const AdminFirmwareList = lazy(() => import('./pages/AdminFirmwareList').then(m => ({ default: m.AdminFirmwareList })));
const AdminTemplateEdit = lazy(() => import('./pages/AdminTemplateEdit').then(m => ({ default: m.AdminTemplateEdit })));
const AdminAIConfig = lazy(() => import('./pages/AdminAIConfig').then(m => ({ default: m.AdminAIConfig })));
const AdminLibraryManager = lazy(() => import('./pages/AdminLibraryManager').then(m => ({ default: m.AdminLibraryManager })));
const AdminBlockManager = lazy(() => import('./pages/AdminBlockManager').then(m => ({ default: m.default })));
const AdminBoardManager = lazy(() => import('./pages/AdminBoardManager').then(m => ({ default: m.AdminBoardManager })));
const AdminSystemConfig = lazy(() => import('./pages/AdminSystemConfig').then(m => ({ default: m.AdminSystemConfig })));
const AdminCourseQA = lazy(() => import('./pages/AdminCourseQA').then(m => ({ default: m.AdminCourseQA })));
const AdminLearningCourseEditor = lazy(() => import('./pages/AdminLearningCourseEditor').then(m => ({ default: m.AdminLearningCourseEditor })));
// 管理员后台（新版控制台）
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const ConsoleDashboard = lazy(() => import('./pages/admin/ConsoleDashboard'));
const AdminCoursesPage = lazy(() => import('./pages/admin/CoursesPage'));
const AdminArticleEditorPage = lazy(() => import('./pages/admin/ArticleEditorPage'));
const AdminHardwarePage = lazy(() => import('./pages/admin/HardwarePage'));
const AdminLearnersPage = lazy(() => import('./pages/admin/LearnersPage'));
const AdminAgentPage = lazy(() => import('./pages/admin/AgentPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LearnerAuthPage = lazy(() => import('./pages/LearnerAuthPage').then(m => ({ default: m.LearnerAuthPage })));
const LearnerDashboard = lazy(() => import('./pages/LearnerDashboard').then(m => ({ default: m.LearnerDashboard })));
const CoursePreviewPage = lazy(() => import('./pages/CoursePreviewPage').then(m => ({ default: m.CoursePreviewPage })));

/**
 * 加载中占位符
 */
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#C0E2F9]">
      <LoadingSpinner message="加载中..." size="lg" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RouteTitle />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Welcome → Hub → /courses */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/home" element={<HomeHubPage />} />
          <Route path="/courses" element={<CourseCatalogPage />} />
          <Route path="/courses/:slug" element={<CourseArticlePage />} />

          {/* 课程工作台（P0 本地 session，模拟模式可无硬件演示） */}
          <Route path="/editor" element={<LessonWorkbenchPage />} />
          <Route path="/workbench" element={<LessonWorkbenchPage />} />

          {/* 旧落地页保留 */}
          {/* 旧落地页已下线（文件保留在 pages/LandingPage.tsx），统一跳到新欢迎页 */}
          <Route path="/welcome" element={<Navigate to="/" replace />} />

          {/* 游客可看的课程预览 */}
          <Route path="/library" element={<CoursePreviewPage />} />

          {/* 学习者登录与注册 */}
          <Route path="/login" element={<LearnerAuthPage mode="login" />} />
          <Route path="/register" element={<LearnerAuthPage mode="register" />} />

          {/* 登录后：总览 / 工作台 */}
          <Route element={<LearnerProtectedRoute />}>
            <Route path="/dashboard" element={<LearnerDashboard />} />
            <Route path="/project" element={<HomePage />} />
            <Route path="/firmware/:id" element={<FirmwareDetail />} />
          </Route>

          {/* 管理员登录 */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 管理员路由（受保护） */}
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<ConsoleDashboard />} />
              <Route path="courses" element={<AdminCoursesPage />} />
              <Route path="articles" element={<AdminArticleEditorPage />} />
              <Route path="hardware" element={<AdminHardwarePage />} />
              <Route path="learners" element={<AdminLearnersPage />} />
              <Route path="agent" element={<AdminAgentPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
            <Route path="legacy" element={<AdminDashboard />} />
            <Route path="resources" element={<AdminResourceList />} />
            <Route path="resources/upload" element={<AdminResourceUpload />} />
            <Route path="firmware/:id/edit" element={<AdminFirmwareEdit />} />
            <Route path="firmware" element={<AdminFirmwareList />} />
            <Route path="templates/:id/edit" element={<AdminTemplateEdit />} />
            <Route path="ai-config" element={<AdminAIConfig />} />
            <Route path="libraries" element={<AdminLibraryManager />} />
            <Route path="blocks" element={<AdminBlockManager />} />
            <Route path="boards" element={<AdminBoardManager />} />
            <Route path="system" element={<AdminSystemConfig />} />
            <Route path="course-qa" element={<AdminCourseQA />} />
            <Route path="learning-courses/:slug" element={<AdminLearningCourseEditor />} />
          </Route>

          {/* 404 兜底 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
