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
  Sun,
  Moon,
  Sparkles,
  Home,
  BookOpen,
  Search,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTheme, useThemeStore } from '../stores/themeStore';
import { CommandPalette } from './CommandPalette';
import { cn } from '../lib/cn';
import { Skeleton } from './ui/Skeleton';
import { useList, useSiteSettings, useI18n, pickSite } from '../lib/cms';

// initThemeFromStorage 重新导出,保持 index.tsx 的导入路径不变
export { initThemeFromStorage } from '../stores/themeStore';

/**
 * useNavItems — 顶部 nav 4 项 (CMS 驱动,fallback LIST_FALLBACK.top-nav)
 */
function useNavItems(): Array<{ label: string; path: string }> {
  const { data } = useList<{ label: string; path: string; isActive?: boolean }>('top-nav');
  if (data && data.length > 0) {
    return data.filter((it) => it.isActive !== false).map((it) => ({ label: it.label, path: it.path }));
  }
  return [
    { label: '课程', path: '/courses' },
    { label: '学位', path: '/degrees' },
    { label: '黑客松', path: '/hackathons' },
    { label: '企业培训', path: '/enterprise' },
  ];
}

/**
 * useFooterColumns — footer 4 列 (CMS 驱动,fallback LIST_FALLBACK.footer-columns)
 */
function useFooterColumns(): Array<{ title: string; links: Array<{ label: string; path: string }> }> {
  const { data } = useList<{ title: string; links: Array<{ label: string; path: string }>; isActive?: boolean }>('footer-columns');
  if (data && data.length > 0) {
    return data.filter((c) => c.isActive !== false).map((c) => ({ title: c.title, links: c.links }));
  }
  return [
    {
      title: '学习',
      links: [
        { label: '课程', path: '/courses' },
        { label: '学位', path: '/degrees' },
        { label: '黑客松', path: '/hackathons' },
        { label: '企业培训', path: '/enterprise' },
      ],
    },
    {
      title: '公司',
      links: [
        { label: '关于我们', path: 'https://opencsg.com' },
        { label: '企业培训', path: '/enterprise' },
        { label: '价格', path: '/courses' },
      ],
    },
    {
      title: '法律',
      links: [
        { label: '服务条款', path: '/terms' },
        { label: '隐私政策', path: '/privacy' },
      ],
    },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const theme = useTheme();
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

  // 全局 ⌘K / Ctrl+K 触发 CommandPalette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 路由切换时关闭移动端菜单 / 搜索弹层
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = useNavItems();

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
            <span className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white rounded-md">
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
                className="px-3 py-2 text-neutral-600 hover:text-[#171717] hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors uppercase tracking-wider text-[12px]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* P1-2: 顶部搜索框(md+ 显 / mobile 隐) — 点击 / focus 调出 CommandPalette */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="打开搜索(⌘K)"
            className={cn(
              'hidden md:flex items-center gap-2',
              'flex-1 max-w-md mx-4 h-9 px-3',
              'rounded-md border border-neutral-200',
              'bg-neutral-100 dark:bg-neutral-100',
              'text-neutral-600 dark:text-neutral-600',
              'hover:border-[#171717] hover:bg-neutral-0 dark:hover:bg-neutral-0',
              'transition-colors text-left text-sm',
            )}
          >
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">搜索课程 / 讲师 / 技能</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded border border-neutral-200 text-neutral-600 dark:text-neutral-600">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1">
            {user ? (
              <>
                {/* P1-3 修复:头像/名字 < sm 也显示(只显头像,名字 >= sm 显) */}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-sm font-bold px-2 sm:px-3 py-2 min-h-[44px] hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
                  aria-label={`个人中心:${user.name}`}
                >
                  <div className="w-7 h-7 bg-[#171717] flex items-center justify-center text-white text-xs font-black rounded-md">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-neutral-900 dark:text-neutral-900">
                    {user.name}
                  </span>
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
                    title="管理后台"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider bg-[#171717] text-white px-3 sm:px-4 py-2 min-h-[44px] hover:bg-[#262626] transition-colors rounded-md"
                aria-label="登录"
              >
                <UserIcon className="w-4 h-4" /> <span className="hidden xs:inline sm:hidden">登</span><span className="hidden sm:inline">登录</span>
              </Link>
            )}

            {/* P1-2: mobile 搜索图标按钮(md 以下点击也调出 CommandPalette) */}

            {/* P1-2: mobile 搜索图标按钮(md 以下点击也调出 CommandPalette) */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
              aria-label="打开搜索"
              title="搜索(⌘K)"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* P0-5 新增:theme toggle 按钮(admin 入口前) */}
            <button
              onClick={toggleTheme}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
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
              className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors text-neutral-900 dark:text-neutral-900"
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
                className="block px-6 py-3 text-sm font-bold uppercase tracking-wider text-neutral-600 hover:text-[#171717] hover:bg-neutral-100 dark:hover:bg-neutral-100 border-b border-neutral-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {!user && (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#171717] hover:bg-neutral-100 dark:hover:bg-neutral-100 border-b border-neutral-200"
              >
                登录
              </Link>
            )}
          </div>
        )}
      </header>

      <main>
        {/* P0-6 + 后续懒加载路由 fallback — 顶部 nav 不闪,主区域显示骨架 */}
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </main>

      {/* P1-2: 全局 ⌘K 搜索弹层 */}
      <CommandPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* ============================================================
       * 公共 footer (P1 统一: 从 HomePage SiteFooter 提升, 所有页共享)
       * ============================================================ */}
      <SiteFooter />


      {/* ============================================================
       * AI 助教 FAB(P0-5 placeholder → 跳 /dashboard/learning)
       * fixed 右下角,所有断点都显
       * mobile:bottom-20(在 bottom tab 之上)
       * md+:bottom-6
       * ============================================================ */}
      <Link
        to="/dashboard/learning"
        className="fixed right-6 bottom-20 md:bottom-6 w-14 h-14 rounded-full bg-[#171717] text-white hover:bg-[#262626] transition-all hover:scale-105 flex items-center justify-center z-40"
        aria-label="打开 AI 助教"
        title="AI 助教"
      >
        <Sparkles className="w-6 h-6" />
      </Link>

      {/* ============================================================
       * 移动端 bottom tab(< 768px 显示)
       * 5 宫格:首页 / 课程 / 学位 / AI / 我的
       * 当前路由高亮 #171717 (brutalist 主色)
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

// 移动 bottom tab 单个 item — P1-3 触摸目标 ≥ 44px(iOS HIG)
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
      className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[48px] py-1.5 px-2 transition-colors ${
        active
          ? 'text-[#171717]'
          : 'text-neutral-600 dark:text-neutral-600 hover:text-[#171717]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

// React.lazy() 路由的 Suspense fallback — 顶部 nav 不闪,
// 主区域显示轻量骨架,避免白屏(LCP 友好)
function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <Skeleton className="h-10 w-2/3 mb-6" />
      <Skeleton className="h-4 w-full mb-2" count={3} />
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton variant="rectangle" className="h-48" />
        <Skeleton variant="rectangle" className="h-48" />
        <Skeleton variant="rectangle" className="h-48" />
      </div>
    </div>
  );
}

/**
 * SiteFooter — CMS-driven 公共 footer
 *  - brand statement / version: site_settings.brand.footer.*
 *  - 3 列: useList('footer-columns')
 */
function SiteFooter() {
  const columns = useFooterColumns();
  const { data: siteData } = useSiteSettings([
    'brand.footer.tagline',
    'brand.footer.version_tag',
  ]);
  const tagline = pickSite(
    siteData,
    'brand.footer.tagline',
    'zh-CN',
    '学完仍然不会做?让 AI 时代的能力可被看见。',
  );
  const versionTag = pickSite(
    siteData,
    'brand.footer.version_tag',
    'zh-CN',
    'v0.5.0 · built for AI era',
  );
  return (
    <footer className="py-12 border-t border-neutral-200 bg-neutral-50 dark:bg-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-[#171717] flex items-center justify-center text-white font-bold text-sm">
                O
              </div>
              <span className="font-semibold text-neutral-900">OpenCSG Academy</span>
            </div>
            <p className="text-sm text-neutral-600 max-w-xs">
              {tagline}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-3 text-neutral-900">{col.title}</h4>
              <ul className="space-y-2 text-sm text-neutral-600">
                {col.links.map((link) => {
                  // 外链 (http/https) 用 <a>,内链用 <Link>
                  if (link.path.startsWith('http')) {
                    return (
                      <li key={link.path}>
                        <a
                          href={link.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#171717] transition"
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.label + link.path}>
                      <Link to={link.path} className="hover:text-[#171717] transition">
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-8 border-t border-neutral-200 text-xs text-neutral-600 flex flex-wrap items-center justify-between gap-4">
          {(() => {
            // 备案号走 env 注入, 避免硬编码假 ICP 引发合规风险
            // 设了 VITE_ICP 就显示, 没设就显示"备案号待补"(绝不展示假数字)
            const platformName =
              import.meta.env.VITE_PUBLIC_PLATFORM_NAME ?? 'OpenCSG Academy';
            const icp = import.meta.env.VITE_ICP?.trim();
            return (
              <span>
                © 2026 {platformName}
                {icp ? ` · 备案号 ${icp}` : ' · 备案号待补'}
              </span>
            );
          })()}
          <span className="font-mono">{versionTag}</span>
        </div>
      </div>
    </footer>
  );
}
