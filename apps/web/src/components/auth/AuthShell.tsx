/**
 * AuthShell — 登录/注册/忘记密码页面的外层布局
 *
 * 来自 mock-auth.html 的左右分屏:
 *   - 左侧:品牌宣言 + brutalist 纯黑底 + 数据 + 推荐语
 *   - 右侧:实际表单
 *
 * 暗色: 左侧实心黑(全断点不变),右侧 token 化
 * 移动端:左栏隐藏,只显示表单
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

type Theme = 'light' | 'dark';

function useThemeToggle(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}

export function AuthShell({ children }: { children: ReactNode }) {
  const [theme, toggle] = useThemeToggle();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-900">
      {/* 顶部导航(精简) */}
      <header className="border-b border-neutral-200 dark:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#171717] flex items-center justify-center text-neutral-0 font-bold text-sm">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg">
              OpenCSG <span className="text-[#171717]">Academy</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
              aria-label={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <Link
              to="/"
              className="text-sm text-neutral-600 dark:text-neutral-600 hover:text-[#171717] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 inline-block mr-1" />
              返回首页
            </Link>
          </div>
        </div>
      </header>

      {/* 主体:左右分屏 */}
      <main className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
        {/* 左侧:品牌宣言 + 数据 */}
        <section className="hidden lg:flex flex-col justify-between p-12 bg-[#171717] text-neutral-0 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-xp-500/30 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-[#EEEDE9]/20 blur-3xl" />

          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-2 mb-12">
              <div className="w-10 h-10 rounded-md bg-neutral-0 flex items-center justify-center text-[#171717] font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-semibold text-lg">OpenCSG Academy</span>
            </Link>
            <h1 className="text-4xl xl:text-display-lg font-bold leading-[1.1]">
              学完仍然不会做?
              <br />
              <span className="opacity-90">让 AI 时代的能力</span>
              <br />
              可被看见。
            </h1>
            <p className="mt-6 text-lg opacity-90 max-w-md">
              12,400 名工程师、创业者、CTO 在这里把 AI 能力变成可被验证的作品。
            </p>
          </div>

          <div className="relative space-y-6">
            <div className="grid grid-cols-3 gap-6 max-w-md">
              <div>
                <div className="text-3xl font-bold font-mono">12.4K</div>
                <div className="text-xs opacity-80 mt-1">在读学员</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">86</div>
                <div className="text-xs opacity-80 mt-1">系统化课程</div>
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">2.4K</div>
                <div className="text-xs opacity-80 mt-1">完成项目</div>
              </div>
            </div>
            <blockquote className="p-5 rounded-xl bg-neutral-0/10 backdrop-blur-sm border border-neutral-0/20">
              <p className="text-sm leading-relaxed">
                "我以为 RAG 就是把文档塞进向量库。学完才发现 prompt
                模板、reranking、citation、evaluation
                才是真正决定效果的地方。AI 助教在我卡壳时直接引用课里第几节第几分几秒
                —— 救了我 3 个通宵。"
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <div className="w-7 h-7 rounded-full bg-cert-500 text-neutral-0 flex items-center justify-center font-bold text-xs">
                  K
                </div>
                <div>
                  <div className="font-medium">K. Chen</div>
                  <div className="opacity-70">LLM 应用工程师学位 · 已毕业</div>
                </div>
              </div>
            </blockquote>
          </div>
        </section>

        {/* 右侧:表单容器 */}
        <section className="flex items-center justify-center p-6 sm:p-12 bg-neutral-50 dark:bg-neutral-950">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  );
}

/**
 * AuthTabSwitcher — 登录/注册 双 tab(共享组件)
 *
 * 行为:
 *   - 当前 tab 高亮 + shadow-sm(spec §2.5)
 *   - 切换时改 URL query ?tab=login|register
 */
export function AuthTabSwitcher({
  current,
  loginHref,
  registerHref,
}: {
  current: 'login' | 'register';
  loginHref: string;
  registerHref: string;
}) {
  const linkClass = (active: boolean) =>
    cn(
      'flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150 text-center',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]',
      active
        ? 'bg-neutral-0 dark:bg-neutral-100 text-neutral-900 dark:text-neutral-900 shadow-sm'
        : 'text-neutral-600 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-900',
    );

  return (
    <div
      role="tablist"
      aria-label="登录 / 注册"
      className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-100 mb-8"
    >
      <Link
        to={loginHref}
        role="tab"
        aria-selected={current === 'login'}
        className={linkClass(current === 'login')}
      >
        登录
      </Link>
      <Link
        to={registerHref}
        role="tab"
        aria-selected={current === 'register'}
        className={linkClass(current === 'register')}
      >
        注册
      </Link>
    </div>
  );
}
