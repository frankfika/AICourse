import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './features/home/HomePage';
import { CourseListPage } from './features/courses/CourseListPage';
import { CourseDetailPage } from './features/courses/CourseDetailPage';
import { DegreeListPage } from './features/degrees/DegreeListPage';
import { DegreeDetailPage } from './features/degrees/DegreeDetailPage';
import { HackathonListPage } from './features/hackathons/HackathonListPage';
import { HackathonDetailPage } from './features/hackathons/HackathonDetailPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { BindingsPage } from './features/auth/BindingsPage';
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminCoursesPage } from './features/admin/AdminCoursesPage';
import { AdminDegreesPage } from './features/admin/AdminDegreesPage';
import { AdminUsersPage } from './features/admin/AdminUsersPage';
import { AdminBadgesPage } from './features/admin/AdminBadgesPage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminHackathonsPage } from './features/admin/AdminHackathonsPage';
import { AdminEnterprisePage } from './features/admin/AdminEnterprisePage';
import { EnterprisePage } from './features/enterprise/EnterprisePage';
import { NotFoundPage } from './features/misc/NotFoundPage';
import { useAuth } from './lib/auth/AuthProvider';
import { useAuthStore } from './stores/authStore';
import { DashboardLayout } from './features/dashboard/DashboardLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import DesignSystemPage from './routes/design-system';
import { SearchPage } from './routes/SearchPage';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  // user 真正存在的地方是 zustand store (AuthProvider 也读这里)
  // 直接订阅 zustand 避免 React Context 异步 hydration 时机问题
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/auth/login" replace />;
  if (requireAdmin && user.role !== 'admin' && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout><Outlet /></Layout>,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'courses', element: <CourseListPage /> },
      { path: 'courses/:id', element: <CourseDetailPage /> },
      { path: 'degrees', element: <DegreeListPage /> },
      { path: 'degrees/:id', element: <DegreeDetailPage /> },
      { path: 'hackathons', element: <HackathonListPage /> },
      { path: 'hackathons/:id', element: <HackathonDetailPage /> },
      { path: 'enterprise', element: <EnterprisePage /> },
      // P1-2: 全站搜索结果页(公开,带 ?q=)
      { path: 'search', element: <SearchPage /> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminLayout><Outlet /></AdminLayout>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'courses', element: <AdminCoursesPage /> },
          { path: 'degrees', element: <AdminDegreesPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'badges', element: <AdminBadgesPage /> },
          { path: 'hackathons', element: <AdminHackathonsPage /> },
          { path: 'enterprise', element: <AdminEnterprisePage /> },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  // ===== P0-2 / P0-3 新增路由 — 公开 + 登录态 sub-page =====
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/auth/register', element: <RegisterPage /> },
  { path: '/auth/forgot', element: <ForgotPasswordPage /> },
  // 注:BindingsPage 内部自己处理"未登录" EmptyState,这样 demo 模式 ?demo=with-google
  //     可以绕过登录态渲染示例视图(给截图用)
  { path: '/dashboard/settings/bindings', element: <BindingsPage /> },
  // P0-6: dashboard 顶层路由 (不嵌在 / Layout 下, full-screen 体验, 自带 DashboardLayout)
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'learning', element: <DashboardPage /> },
    ],
  },
  // P0-4 设计系统演示页 — 临时挂载,后续 worktree 跑完移除
  { path: '/__design-system', element: <DesignSystemPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
