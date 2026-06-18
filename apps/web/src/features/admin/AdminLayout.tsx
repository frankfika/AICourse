import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, Users, BarChart3 } from 'lucide-react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navItems = [
    { path: '/admin/courses', label: '课程管理', icon: BookOpen },
    { path: '/admin/degrees', label: '学位管理', icon: GraduationCap },
    { path: '/admin/users', label: '用户管理', icon: Users },
    { path: '/admin/analytics', label: '数据统计', icon: BarChart3 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-48 shrink-0">
          <nav className="bg-white border border-[#EEEDE9] rounded-2xl p-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                  location.pathname.startsWith(path)
                    ? 'bg-[#171717] text-white'
                    : 'text-[#666666] hover:bg-[#F5F4F0]'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
