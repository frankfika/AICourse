import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Users,
  BarChart3,
  Award,
  Rocket,
  Building2,
} from 'lucide-react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navItems = [
    { path: '/admin/dashboard', label: '数据看板', icon: BarChart3 },
    { path: '/admin/courses', label: '课程管理', icon: BookOpen },
    { path: '/admin/degrees', label: '学位管理', icon: GraduationCap },
    { path: '/admin/enterprise', label: '企业咨询', icon: Building2 },
    { path: '/admin/users', label: '用户管理', icon: Users },
    { path: '/admin/badges', label: '徽章管理', icon: Award },
    { path: '/admin/hackathons', label: '黑客松管理', icon: Rocket },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
          / Admin Console
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">管理后台</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-56 shrink-0">
          <nav className="border-2 border-[#171717] bg-white">
            {navItems.map(({ path, label, icon: Icon }, i) => {
              const active = location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#666666] hover:bg-[#EEEDE9] hover:text-[#171717]'
                  } ${i < navItems.length - 1 ? 'border-b border-[#EEEDE9]' : ''}`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
