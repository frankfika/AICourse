import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Menu, User as UserIcon, LogOut, Settings, Building2 } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const navItems = [
    { label: '课程', path: '/courses' },
    { label: '学位', path: '/degrees' },
    { label: '黑客松', path: '/hackathons' },
    { label: '企业培训', path: '/enterprise' },
  ];

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#171717] font-sans">
      <header className="sticky top-0 z-50 bg-[#F5F4F0] border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-black text-lg tracking-tighter">
            <span className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </span>
            <span className="uppercase">OpenCSG Academy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-bold">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="px-3 py-2 text-[#666666] hover:text-[#171717] hover:bg-[#EEEDE9] transition-colors uppercase tracking-wider text-[12px]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-sm font-bold px-3 py-2 hover:bg-[#EEEDE9] transition-colors"
                >
                  <div className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white text-xs font-black">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{user.name}</span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 hover:bg-[#EEEDE9] transition-colors"
                    title="管理后台"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-[#EEEDE9] transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[12px] bg-[#171717] text-white px-4 py-2 hover:bg-[#262626] transition-colors"
              >
                <UserIcon className="w-4 h-4" /> 登录
              </Link>
            )}
            <button
              className="md:hidden p-2 hover:bg-[#EEEDE9] transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[#171717] bg-[#F5F4F0]">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#666666] hover:text-[#171717] hover:bg-[#EEEDE9] border-b border-[#EEEDE9]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="bg-[#171717] text-white mt-20 border-t border-[#171717]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 py-16">
            <div>
              <div className="flex items-center gap-2 font-black text-lg mb-4 tracking-tighter uppercase">
                <span className="w-7 h-7 bg-white flex items-center justify-center text-[#171717]">
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span>OpenCSG Academy</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                专注于 AI 和大模型技术培训的在线教育平台。
              </p>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">
                Learn
              </h3>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/courses" className="hover:text-white text-white/70 transition-colors">所有课程</Link></li>
                <li><Link to="/degrees" className="hover:text-white text-white/70 transition-colors">学位项目</Link></li>
                <li><Link to="/hackathons" className="hover:text-white text-white/70 transition-colors">黑客松</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">
                Company
              </h3>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/enterprise" className="hover:text-white text-white/70 transition-colors flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> 企业培训</Link></li>
                <li><a href="https://opencsg.com" target="_blank" rel="noopener noreferrer" className="hover:text-white text-white/70 transition-colors">OpenCSG 官网</a></li>
                <li><a href="https://github.com/OpenCSGs" target="_blank" rel="noopener noreferrer" className="hover:text-white text-white/70 transition-colors">GitHub</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">
                Contact
              </h3>
              <ul className="space-y-2 text-sm font-medium text-white/70">
                <li>contact@opencsg.com</li>
                <li><a href="https://github.com/OpenCSGs/AICourse" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">项目开源地址 →</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <div>&copy; {new Date().getFullYear()} OpenCSG Academy. All rights reserved.</div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em]">Build · Ship · Master AI</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
