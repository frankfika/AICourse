import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Menu, User as UserIcon, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const navItems = [
    { label: '首页', path: '/' },
    { label: '课程', path: '/courses' },
    { label: '学位', path: '/degrees' },
    { label: '黑客松', path: '/hackathons' },
  ];

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#171717] font-sans">
      <header className="sticky top-0 z-50 bg-[#F5F4F0]/90 backdrop-blur-md border-b border-[#EEEDE9]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <GraduationCap className="w-6 h-6" />
            <span>OpenCSG Academy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="text-[#666666] hover:text-[#171717] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 text-sm font-medium">
                  <div className="w-8 h-8 bg-[#171717] rounded-full flex items-center justify-center text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{user.name}</span>
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="p-2 hover:bg-[#EEEDE9] rounded-full">
                    <Settings className="w-5 h-5" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-[#EEEDE9] rounded-full"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-[#171717] text-white rounded-full hover:bg-[#262626]"
              >
                <UserIcon className="w-4 h-4" /> 登录
              </Link>
            )}
            <button
              className="md:hidden p-2 hover:bg-[#EEEDE9] rounded-full"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[#EEEDE9] bg-[#F5F4F0]">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-6 py-3 text-sm font-medium text-[#666666] hover:text-[#171717] hover:bg-[#EEEDE9]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="bg-[#171717] text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-lg mb-4">
                <GraduationCap className="w-6 h-6" />
                <span>OpenCSG Academy</span>
              </div>
              <p className="text-sm text-gray-400">
                专注于 AI 和大模型技术培训的在线教育平台
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">学习资源</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/courses" className="hover:text-white transition-colors">所有课程</Link></li>
                <li><Link to="/degrees" className="hover:text-white transition-colors">学位项目</Link></li>
                <li><Link to="/hackathons" className="hover:text-white transition-colors">黑客松</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">关于我们</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="https://opencsg.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OpenCSG</a></li>
                <li><a href="https://github.com/OpenCSGs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">联系方式</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>邮箱: contact@opencsg.com</li>
                <li>
                  <a href="https://github.com/OpenCSGs/AICourse" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    项目开源地址
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} OpenCSG Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
