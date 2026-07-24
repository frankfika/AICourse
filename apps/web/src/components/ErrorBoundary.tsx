/**
 * ErrorBoundary — 全局 React 错误兜底
 *
 * 作用:
 *   - 任何子组件 throw (e.g. JSON.parse 异常 / undefined.map / 第三方库崩)
 *   - 整个 app 不会白屏,降级到「出错了」友好页
 *   - 提供「重试」按钮(remount 子树) + 「回首页」逃生通道
 *   - console.error 上报(后续可接 Sentry 等)
 *
 * 用法 (main.tsx):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * 新增 type prop (基于 audit-web-ux-long.md:54 错误页缺口):
 *   - 'crash'  (默认) — 通用 React 错误兜底,中性卡片风
 *   - '404'           — 路由/资源不存在 (走 NotFoundPage)
 *   - '403'           — 无权限 (走 ForbiddenPage)
 *   - '500'           — 后端 5xx (走 ServerErrorPage,带 error + reset)
 *   - 'network'       — 网络错误 (走 NetworkErrorPage,带 reset)
 *
 * 设计:
 *   - 用 class component(getDerivedStateFromError + componentDidCatch)
 *     function component 没 lifecycle,不能做 error boundary
 *   - 复用设计系统 token(dark mode 自动适配)
 *   - 不在错误页 toast 报,避免递归
 *   - 现有 fallback prop 优先级最高(高级用户自定义 UI)
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NotFoundPage } from '../features/misc/NotFoundPage';
import { ForbiddenPage } from '../features/misc/ForbiddenPage';
import { ServerErrorPage } from '../features/misc/ServerErrorPage';
import { NetworkErrorPage } from '../features/misc/NetworkErrorPage';

export type ErrorBoundaryType = 'crash' | '404' | '403' | '500' | 'network';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义错误兜底 UI(高级用法,默认按 type 走对应页面) */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  /**
   * 错误类型:
   *   - 'crash'  (默认) 组件 throw / unhandled rejection
   *   - '404'    路由/资源不存在
   *   - '403'    无权限
   *   - '500'    后端 5xx
   *   - 'network' 网络错误
   *
   * 注意: '404'/'403'/'500'/'network' 不会真的等错误发生才渲染 — 在生产环境
   *       你应该直接用对应错误页组件而不是 ErrorBoundary 包一层。本 prop 主要
   *       用来统一 reset() 行为(重试 → reset → 重新渲染子树)。
   */
  type?: ErrorBoundaryType;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 上报:开发模式 console.error,生产模式留 hook(后续接 Sentry)
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught error:', error, info);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 1. 高级用户自定义 fallback 优先
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // 2. 按 type 路由到对应错误页
      const { type = 'crash' } = this.props;
      const err = this.state.error;

      switch (type) {
        case '404':
          return <NotFoundPage />;
        case '403':
          return <ForbiddenPage />;
        case '500':
          return <ServerErrorPage error={err} onRetry={this.reset} />;
        case 'network':
          return <NetworkErrorPage onRetry={this.reset} />;
        case 'crash':
        default:
          return <ErrorFallback error={err} reset={this.reset} />;
      }
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  // 故意读 isDev 时显示 stack;生产隐藏
  const isDev = import.meta.env.DEV;
  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4"
    >
      <div className="max-w-md w-full bg-neutral-0 dark:bg-neutral-100 border border-neutral-200 rounded-xl p-6 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-500/20 text-danger-500 mb-4">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
          页面出了点问题
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-600 mb-1">
          组件渲染时遇到意外错误,已经记录到控制台。
        </p>
        {isDev && error && (
          <pre className="mt-3 mb-4 p-3 text-left text-xs bg-neutral-100 dark:bg-neutral-200 text-danger-500 rounded-md overflow-auto max-h-32 border border-neutral-200">
            {error.message}
          </pre>
        )}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#262626] transition-colors text-sm font-medium min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            重试
          </button>
          <Link
            to="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-200 text-neutral-900 dark:text-neutral-50 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-300 transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
