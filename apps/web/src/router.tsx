import { lazy, Suspense } from 'react';
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
import { useAuthStore } from './stores/authStore';

// ──────────────────────────────────────────────────────────────────────
// Code-split: 懒加载非首屏路由,让首屏 bundle 从 873KB → 拆 3-4 个 chunk
//
// 同步保留(首屏 LCP / 高频导航):
//   - HomePage, CourseList/Detail, DegreeList/Detail,
//   - HackathonList/Detail, ProfilePage,
//   - Login/Register/Forgot(未登录时直接进 auth 流, 不能 lazy)
//
// lazy(点开才拉):
//   - admin 全部页面(只管理员进, 占 chunk 比重最大 ~300KB)
//   - dashboard P0-6 + P1 全部子页(只登录用户进, ~150KB)
//   - search, design-system, not-found, bindings, verify-certificate, enterprise
// ──────────────────────────────────────────────────────────────────────
const BindingsPage = lazy(() => import('./features/auth/BindingsPage').then(m => ({ default: m.BindingsPage })));
const NotificationsPage = lazy(() => import('./features/dashboard/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const OrdersPage = lazy(() => import('./features/dashboard/orders/OrdersPage').then(m => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import('./features/dashboard/orders/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const CertificatesPage = lazy(() => import('./features/dashboard/certificates/CertificatesPage').then(m => ({ default: m.CertificatesPage })));
const CertificateDetailPage = lazy(() => import('./features/dashboard/certificates/CertificateDetailPage').then(m => ({ default: m.CertificateDetailPage })));
const VerifyCertificatePage = lazy(() => import('./features/dashboard/certificates/VerifyCertificatePage').then(m => ({ default: m.VerifyCertificatePage })));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DashboardLayout = lazy(() => import('./features/dashboard/DashboardLayout').then(m => ({ default: m.DashboardLayout })));
const AdminLayout = lazy(() => import('./features/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminCoursesPage = lazy(() => import('./features/admin/AdminCoursesPage').then(m => ({ default: m.AdminCoursesPage })));
const AdminDegreesPage = lazy(() => import('./features/admin/AdminDegreesPage').then(m => ({ default: m.AdminDegreesPage })));
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminBadgesPage = lazy(() => import('./features/admin/AdminBadgesPage').then(m => ({ default: m.AdminBadgesPage })));
const AdminDashboardPage = lazy(() => import('./features/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminHackathonsPage = lazy(() => import('./features/admin/AdminHackathonsPage').then(m => ({ default: m.AdminHackathonsPage })));
const AdminEnterprisePage = lazy(() => import('./features/admin/AdminEnterprisePage').then(m => ({ default: m.AdminEnterprisePage })));
const AdminAuditLogsPage = lazy(() => import('./features/admin/AdminAuditLogsPage').then(m => ({ default: m.AdminAuditLogsPage })));
const AdminReviewsPage = lazy(() => import('./features/admin/AdminReviewsPage').then(m => ({ default: m.AdminReviewsPage })));
const AdminSettingsPage = lazy(() => import('./features/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const EnterprisePage = lazy(() => import('./features/enterprise/EnterprisePage').then(m => ({ default: m.EnterprisePage })));
const NotFoundPage = lazy(() => import('./features/misc/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const DesignSystemPage = lazy(() => import('./routes/design-system').then(m => ({ default: m.default })));
const SearchPage = lazy(() => import('./routes/SearchPage').then(m => ({ default: m.SearchPage })));

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  // user 真正存在的地方是 zustand store (AuthProvider 也读这里)
  // 直接订阅 zustand 避免 React Context 异步 hydration 时机问题
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/auth/login" replace />;
  if (requireAdmin && user.role !== 'admin' && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// 公开 lazy 路由的 fallback — 不能用 Layout 内的 Suspense(因为这些
// 路由在 Layout 外,如 /verify/:serial),所以路由级 <Suspense> 包一层
function PublicSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="加载中" className="min-h-screen flex items-center justify-center text-neutral-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">加载中…</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
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
      { path: 'enterprise', element: <PublicSuspense><EnterprisePage /></PublicSuspense> },
      // P1-2: 全站搜索结果页(公开,带 ?q=)
      { path: 'search', element: <PublicSuspense><SearchPage /></PublicSuspense> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requireAdmin>
            <PublicSuspense><AdminLayout><Outlet /></AdminLayout></PublicSuspense>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <PublicSuspense><AdminDashboardPage /></PublicSuspense> },
          { path: 'courses', element: <PublicSuspense><AdminCoursesPage /></PublicSuspense> },
          { path: 'degrees', element: <PublicSuspense><AdminDegreesPage /></PublicSuspense> },
          { path: 'users', element: <PublicSuspense><AdminUsersPage /></PublicSuspense> },
          { path: 'badges', element: <PublicSuspense><AdminBadgesPage /></PublicSuspense> },
          { path: 'hackathons', element: <PublicSuspense><AdminHackathonsPage /></PublicSuspense> },
          { path: 'enterprise', element: <PublicSuspense><AdminEnterprisePage /></PublicSuspense> },
          { path: 'reviews', element: <PublicSuspense><AdminReviewsPage /></PublicSuspense> },
          { path: 'audit', element: <PublicSuspense><AdminAuditLogsPage /></PublicSuspense> },
          { path: 'settings', element: <PublicSuspense><AdminSettingsPage /></PublicSuspense> },
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
  { path: '/dashboard/settings/bindings', element: <PublicSuspense><BindingsPage /></PublicSuspense> },
  { path: '/dashboard/notifications', element: <ProtectedRoute><PublicSuspense><NotificationsPage /></PublicSuspense></ProtectedRoute> },
  // P1-8: 订单 / 证书(用 dashboard 自身 layout, 不嵌到 /dashboard/children 树里,
  // 这样 OrdersPage / CertificatesPage 自己的 padding/max-w 跟 Layout 独立,
  // 跟 notifications 保持一致风格)
  { path: '/dashboard/orders', element: <ProtectedRoute><PublicSuspense><OrdersPage /></PublicSuspense></ProtectedRoute> },
  { path: '/dashboard/orders/:id', element: <ProtectedRoute><PublicSuspense><OrderDetailPage /></PublicSuspense></ProtectedRoute> },
  { path: '/dashboard/certificates', element: <ProtectedRoute><PublicSuspense><CertificatesPage /></PublicSuspense></ProtectedRoute> },
  { path: '/dashboard/certificates/:id', element: <ProtectedRoute><PublicSuspense><CertificateDetailPage /></PublicSuspense></ProtectedRoute> },
  // P1-8: 公开证书验证(匿名可访问, 不走 ProtectedRoute)
  { path: '/verify/:serial', element: <PublicSuspense><VerifyCertificatePage /></PublicSuspense> },
  // P0-6: dashboard 顶层路由 (不嵌在 / Layout 下, full-screen 体验, 自带 DashboardLayout)
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <PublicSuspense><DashboardLayout /></PublicSuspense>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PublicSuspense><DashboardPage /></PublicSuspense> },
      { path: 'learning', element: <PublicSuspense><DashboardPage /></PublicSuspense> },
    ],
  },
  // P0-4 设计系统演示页 — 临时挂载,后续 worktree 跑完移除
  { path: '/__design-system', element: <PublicSuspense><DesignSystemPage /></PublicSuspense> },
  { path: '*', element: <PublicSuspense><NotFoundPage /></PublicSuspense> },
]);
