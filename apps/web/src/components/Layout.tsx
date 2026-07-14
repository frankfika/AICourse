/**
 * Layout — P0-5 落地版
 *
 * 顶部 nav:沿用 P0-4 的结构(在 admin 入口前新增 theme toggle 按钮),
 * 不重写,只在 P0-4 基础上加 1 个按钮。
 *
 * 新增:
 *   - 右上角:theme toggle 按钮(☀️/🌙) — 切 <html class="dark"> + localStorage('theme')
 *   - 底部:AI 助教 FAB(fixed 圆球,跳 /dashboard/learning,P0-5 placeholder)
 *   - 移动端:5 宫格 bottom tab(首页/课程/学位/AI/我的)
 *
 * 响应式:
 *   - < 768px (md-):bottom tab 显示,FAB 在 bottom tab 上方
 *   - ≥ 768px (md+):bottom tab 隐藏,FAB 右下角
 *   - theme toggle:所有断点都显
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Menu,
  User as UserIcon,
  LogOut,
  Settings,
  Building2,
  Sun,
  Moon,
  Sparkles,
  Home,
  BookOpen,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

type Theme = 'light' | 'dark';

// 全站 theme state — 同步到 <html class="dark"> + localStorage('theme')
// 首次访问读 localStorage,没有就读 system pref
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}

// 初始化:在 main.tsx 之前一次性写入 <html class="dark">,避免页面闪烁
export function initThemeFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      if (saved === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } else {
      // 没有 localStorage,看系统偏好
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (sysDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  } catch {
    /* ignore */
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

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

  // mobile bottom tab 高亮判定
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans dark:bg-neutral-950 dark:text-neutral-900">
      {/* ============================================================
       * 顶部 nav(P0-4 结构,只加 theme toggle 按钮)
       * ============================================================ */}
      <header className="sticky top-0 z-50 bg-neutral-50/95 backdrop-blur-md border-b border-neutral-200 dark:bg-neutral-950/95 dark:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-black text-lg tracking-tighter">
            <span className="w-7 h-7 bg-brand-500 flex items-center justify-center text-white rounded-md">
              <GraduationCap className="w-4 h-4" />
            </span>
            <span className="uppercase text-neutral-900 dark:text-neutral-900">
              OpenCSG Academy
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-bold">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="px-3 py-2 text-neutral-600 hover:text-brand-500 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors uppercase tracking-wider text-[12px]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hidden sm:flex items-center gap-2 text-sm font-bold px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
                >
                  <div className="w-7 h-7 bg-brand-500 flex items-center justify-center text-white text-xs font-black rounded-md">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-neutral-900 dark:text-neutral-900">
                    {user.name}
                  </span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
                    title="管理后台"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[12px] bg-brand-500 text-white px-4 py-2 hover:bg-brand-700 transition-colors rounded-md"
              >
                <UserIcon className="w-4 h-4" /> 登录
              </Link>
            )}

            {/* P0-5 新增:theme toggle 按钮(admin 入口前) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
              aria-label={theme === 'dark' ? '切换为亮色' : '切换为暗色'}
              title={theme === 'dark' ? '切换为亮色' : '切换为暗色'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              className="md:hidden p-2 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="菜单"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-neutral-50 dark:bg-neutral-950">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-6 py-3 text-sm font-bold uppercase tracking-wider text-neutral-600 hover:text-brand-500 hover:bg-neutral-100 dark:hover:bg-neutral-100 border-b border-neutral-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {!user && (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-6 py-3 text-sm font-bold uppercase tracking-wider text-brand-500 hover:bg-neutral-100 dark:hover:bg-neutral-100 border-b border-neutral-200"
              >
                登录
              </Link>
            )}
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* ============================================================
       * 公共 footer (P1 统一: 从 HomePage SiteFooter 提升, 所有页共享)
       * ============================================================ */}
      <footer className="py-12 border-t border-neutral-200 bg-neutral-50 dark:bg-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                  O
                </div>
                <span className="font-semibold text-neutral-900">OpenCSG Academy</span>
              </div>
              <p className="text-sm text-neutral-600 max-w-xs">
                学完仍然不会做?让 AI 时代的能力可被看见。
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-neutral-900">学习</h4>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><Link to="/courses" className="hover:text-brand-500 transition">课程</Link></li>
                <li><Link to="/degrees" className="hover:text-brand-500 transition">学位</Link></li>
                <li><Link to="/hackathons" className="hover:text-brand-500 transition">黑客松</Link></li>
                <li><Link to="/enterprise" className="hover:text-brand-500 transition">企业培训</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-neutral-900">公司</h4>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><a href="https://opencsg.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 transition">关于我们</a></li>
                <li><Link to="/enterprise" className="hover:text-brand-500 transition">企业培训</Link></li>
                <li><Link to="/courses" className="hover:text-brand-500 transition">价格</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 text-neutral-900">法律</h4>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-brand-500 transition">服务条款</a></li>
                <li><a href="#" className="hover:text-brand-500 transition">隐私政策</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-neutral-200 text-xs text-neutral-600 flex flex-wrap items-center justify-between gap-4">
            <span>© 2026 OpenCSG · 备案号 京 ICP 备 2026000000 号</span>
            <span className="font-mono">v0.5.0 · built for AI era</span>
          </div>
        </div>
      </footer>

      {/* ============================================================
       * AI 助教 FAB(P0-5 placeholder → 跳 /dashboard/learning)
       * fixed 右下角,所有断点都显
       * mobile:bottom-20(在 bottom tab 之上)
       * md+:bottom-6
       * ============================================================ */}
      <Link
        to="/dashboard/learning"
        className="fixed right-6 bottom-20 md:bottom-6 w-14 h-14 rounded-full bg-brand-500 text-white shadow-glow hover:bg-brand-700 transition-all hover:scale-105 flex items-center justify-center z-40"
        aria-label="打开 AI 助教"
        title="AI 助教"
      >
        <Sparkles className="w-6 h-6" />
      </Link>

      {/* ============================================================
       * 移动端 bottom tab(< 768px 显示)
       * 5 宫格:首页 / 课程 / 学位 / AI / 我的
       * 当前路由高亮 brand-500
       * ============================================================ */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-neutral-0/95 dark:bg-neutral-100/95 backdrop-blur border-t border-neutral-200"
        aria-label="主导航"
      >
        <div className="grid grid-cols-5 py-2 pb-[env(safe-area-inset-bottom)]">
          <BottomTabLink
            to="/"
            label="首页"
            icon={Home}
            active={isActive('/')}
          />
          <BottomTabLink
            to="/courses"
            label="课程"
            icon={BookOpen}
            active={isActive('/courses')}
          />
          <BottomTabLink
            to="/degrees"
            label="学位"
            icon={GraduationCap}
            active={isActive('/degrees')}
          />
          <BottomTabLink
            to="/dashboard/learning"
            label="AI"
            icon={Sparkles}
            active={isActive('/dashboard/learning') || isActive('/dashboard')}
          />
          <BottomTabLink
            to={user ? '/profile' : '/login'}
            label="我的"
            icon={UserIcon}
            active={isActive('/profile') || isActive('/login')}
          />
        </div>
      </nav>
    </div>
  );
}

// 移动 bottom tab 单个 item
function BottomTabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 py-1 transition-colors ${
        active
          ? 'text-brand-500'
          : 'text-neutral-600 dark:text-neutral-600 hover:text-brand-500'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

// 显式避免未使用的引用警告
void Trophy;
void Building2;
