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
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminCoursesPage } from './features/admin/AdminCoursesPage';
import { AdminDegreesPage } from './features/admin/AdminDegreesPage';
import { AdminUsersPage } from './features/admin/AdminUsersPage';
import { AdminBadgesPage } from './features/admin/AdminBadgesPage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminHackathonsPage } from './features/admin/AdminHackathonsPage';
import { useAuthStore } from './stores/authStore';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;
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
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'login', element: <LoginPage /> },
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
        ],
      },
    ],
  },
]);
