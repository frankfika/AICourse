import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthGuard } from './lib/auth/AuthProvider';

// ──────────────────────────────────────────────────────────────────────
// Code-split: 懒加载非首屏路由,首屏 LCP 路由保留同步 import
//
// 页面全部按路由拆包，避免不访问的课程、学位、认证和管理功能进入首包。
//
// lazy(点开才拉):
//   - admin 全部页面(只管理员进, 占 chunk 比重最大 ~300KB)
//   - dashboard P0-6 + P1 全部子页(只登录用户进, ~150KB)
//   - search, design-system, not-found, bindings, verify-certificate, enterprise
// ──────────────────────────────────────────────────────────────────────
const BindingsPage = lazy(() => import('./features/auth/BindingsPage').then(m => ({ default: m.BindingsPage })));
const HomePage = lazy(() => import('./features/home/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const OAuthCallbackPage = lazy(() => import('./features/auth/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })));
const CourseListPage = lazy(() => import('./features/courses/CourseListPage').then(m => ({ default: m.CourseListPage })));
const CourseDetailPage = lazy(() => import('./features/courses/CourseDetailPage').then(m => ({ default: m.CourseDetailPage })));
const DegreeListPage = lazy(() => import('./features/degrees/DegreeListPage').then(m => ({ default: m.DegreeListPage })));
const DegreeDetailPage = lazy(() => import('./features/degrees/DegreeDetailPage').then(m => ({ default: m.DegreeDetailPage })));
const HackathonListPage = lazy(() => import('./features/hackathons/HackathonListPage').then(m => ({ default: m.HackathonListPage })));
const HackathonDetailPage = lazy(() => import('./features/hackathons/HackathonDetailPage').then(m => ({ default: m.HackathonDetailPage })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AboutPage = lazy(() => import('./features/about/AboutPage').then(m => ({ default: m.AboutPage })));
const InstructorDetailPage = lazy(() => import('./features/instructors/InstructorDetailPage').then(m => ({ default: m.InstructorDetailPage })));
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
// P1-9 dev-only: 错误页 demo 路由组件, 生产 build 被 tree-shake
const ErrorDemoPage = lazy(() =>
  import('./features/misc/ErrorDemoPage').then(m => ({ default: m.ErrorDemoPage })),
);
// P1-9 法律页 (公开 + lazy, footer 链接需要)
const TermsPage = lazy(() => import('./features/legal/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./features/legal/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const CookiesPage = lazy(() => import('./features/legal/CookiesPage').then(m => ({ default: m.CookiesPage })));
const RefundPage = lazy(() => import('./features/legal/RefundPage').then(m => ({ default: m.RefundPage })));

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
      { index: true, element: <PublicSuspense><HomePage /></PublicSuspense> },
      { path: 'courses', element: <PublicSuspense><CourseListPage /></PublicSuspense> },
      { path: 'courses/:id', element: <PublicSuspense><CourseDetailPage /></PublicSuspense> },
      { path: 'degrees', element: <PublicSuspense><DegreeListPage /></PublicSuspense> },
      { path: 'degrees/:id', element: <PublicSuspense><DegreeDetailPage /></PublicSuspense> },
      { path: 'hackathons', element: <PublicSuspense><HackathonListPage /></PublicSuspense> },
      { path: 'hackathons/:id', element: <PublicSuspense><HackathonDetailPage /></PublicSuspense> },
      { path: 'enterprise', element: <PublicSuspense><EnterprisePage /></PublicSuspense> },
      { path: 'about', element: <PublicSuspense><AboutPage /></PublicSuspense> },
      { path: 'instructors/:slug', element: <PublicSuspense><InstructorDetailPage /></PublicSuspense> },
      // P1-2: 全站搜索结果页(公开,带 ?q=)
      { path: 'search', element: <PublicSuspense><SearchPage /></PublicSuspense> },
      { path: 'profile', element: <AuthGuard><PublicSuspense><ProfilePage /></PublicSuspense></AuthGuard> },
      {
        path: 'admin',
        element: (
          <AuthGuard requireAdmin>
            <PublicSuspense><AdminLayout><Outlet /></AdminLayout></PublicSuspense>
          </AuthGuard>
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
  { path: '/login', element: <PublicSuspense><LoginPage /></PublicSuspense> },
  // ===== P0-2 / P0-3 新增路由 — 公开 + 登录态 sub-page =====
  { path: '/auth/login', element: <PublicSuspense><LoginPage /></PublicSuspense> },
  { path: '/auth/register', element: <PublicSuspense><RegisterPage /></PublicSuspense> },
  { path: '/auth/forgot', element: <PublicSuspense><ForgotPasswordPage /></PublicSuspense> },
  { path: '/auth/oauth/callback', element: <PublicSuspense><OAuthCallbackPage /></PublicSuspense> },
  // ===== P1-9 法律页 (公开, footer 链接需要 — 之前缺失直接 404) =====
  { path: '/terms', element: <PublicSuspense><TermsPage /></PublicSuspense> },
  { path: '/privacy', element: <PublicSuspense><PrivacyPage /></PublicSuspense> },
  { path: '/cookies', element: <PublicSuspense><CookiesPage /></PublicSuspense> },
  { path: '/refund', element: <PublicSuspense><RefundPage /></PublicSuspense> },
  { path: '/dashboard/settings/bindings', element: <AuthGuard><PublicSuspense><BindingsPage /></PublicSuspense></AuthGuard> },
  { path: '/dashboard/notifications', element: <AuthGuard><PublicSuspense><NotificationsPage /></PublicSuspense></AuthGuard> },
  // P1-8: 订单 / 证书(用 dashboard 自身 layout, 不嵌到 /dashboard/children 树里,
  // 这样 OrdersPage / CertificatesPage 自己的 padding/max-w 跟 Layout 独立,
  // 跟 notifications 保持一致风格)
  { path: '/dashboard/orders', element: <AuthGuard><PublicSuspense><OrdersPage /></PublicSuspense></AuthGuard> },
  { path: '/dashboard/orders/:id', element: <AuthGuard><PublicSuspense><OrderDetailPage /></PublicSuspense></AuthGuard> },
  { path: '/dashboard/certificates', element: <AuthGuard><PublicSuspense><CertificatesPage /></PublicSuspense></AuthGuard> },
  { path: '/dashboard/certificates/:id', element: <AuthGuard><PublicSuspense><CertificateDetailPage /></PublicSuspense></AuthGuard> },
  // P1-8: 公开证书验证(匿名可访问, 不走 ProtectedRoute)
  { path: '/verify/:serial', element: <PublicSuspense><VerifyCertificatePage /></PublicSuspense> },
  // P0-6: dashboard 顶层路由 (不嵌在 / Layout 下, full-screen 体验, 自带 DashboardLayout)
  {
    path: '/dashboard',
    element: (
      <AuthGuard>
        <PublicSuspense><DashboardLayout /></PublicSuspense>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <PublicSuspense><DashboardPage /></PublicSuspense> },
      { path: 'learning', element: <PublicSuspense><DashboardPage /></PublicSuspense> },
    ],
  },
  // P0-4 设计系统演示页 — 临时挂载,后续 worktree 跑完移除
  // (仅 dev mode — prod build 时 import.meta.env.DEV === false, 整段被 tree-shake 掉
  //  防止投资人直链进 /__design-system 看到内部色板/字号 token)
  ...(import.meta.env.DEV
    ? [
        {
          path: '__design-system',
          element: <PublicSuspense><DesignSystemPage /></PublicSuspense>,
        },
      ]
    : []),
  // P1-9 错误页演示路由 (仅 dev mode — 用来截图/QA 验证 4 个错误页)
  // 路径: /__error-demo/:type  (type = 404|403|500|network)
  // prod build 时 import.meta.env.DEV === false, 整段被 tree-shake 掉
  ...(import.meta.env.DEV
    ? [
        {
          path: '__error-demo/:type',
          element: <PublicSuspense><ErrorDemoPage /></PublicSuspense>,
        },
      ]
    : []),
  { path: '*', element: <PublicSuspense><NotFoundPage /></PublicSuspense> },
]);
