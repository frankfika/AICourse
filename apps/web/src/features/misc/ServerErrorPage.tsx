/**
 * ServerErrorPage — 500 服务器内部错误
 *
 * 触发场景 (来自 audit-web-ux-long.md:54 缺口):
 *   - 后端 5xx 响应 (NestJS unhandled exception / DB connection lost / 第三方 API 挂了)
 *   - 不会白屏,降级到友好页 + 给出操作建议
 *
 * 设计:
 *   - 共用 ErrorShell,跟 404 / 403 / network 风格统一
 *   - 显示错误 ID (timestamp-based),用户截图给客服便于定位
 *   - 「重试」用 useQuery 的 refetch (通过 onRetry prop 传入)
 *   - 「联系客服」email + 错误码贴上去
 *
 * 用法 (e.g. 后端 5xx 时):
 *   <ErrorBoundary type="500" onReset={() => queryClient.invalidateQueries()}>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   或者 Query 层:
 *   if (isError && error?.response?.status >= 500) {
 *     return <ServerErrorPage error={error} onRetry={refetch} />;
 *   }
 */
import { useMemo } from 'react';
import { ErrorShell, ActionButton } from './ErrorShell';
import { I18nText } from '../../components/I18nText';
import { RefreshCw, Home, ServerCrash, Mail, Copy } from 'lucide-react';

interface ServerErrorPageProps {
  error?: unknown;
  onRetry?: () => void;
}

export function ServerErrorPage({ error, onRetry }: ServerErrorPageProps) {
  // 生成一个稳定错误 ID (timestamp + 短随机),用户截图给客服便于定位
  const errorId = useMemo(() => {
    const ts = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14); // 20260724094530
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ERR-${ts}-${rand}`;
  }, []);

  const errorMessage =
    (error as any)?.response?.data?.message ??
    (error as any)?.message ??
    'Internal Server Error';

  const copyErrorId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(errorId).catch(() => {});
    }
  };

  return (
    <ErrorShell
      className="min-h-screen"
      eyebrow="/ 500"
      code="500"
      title={
        <span className="flex items-center gap-3">
          <ServerCrash className="w-8 h-8 md:w-10 md:h-10" aria-hidden="true" />
          <I18nText k="error.500.title" default="Server Error" />
        </span>
      }
      description={
        <I18nText
          k="error.500.desc"
          default="后端开了个小差,工程师已经收到通知。你可以稍后重试,或联系客服并附上错误码。"
        />
      }
      actions={
        <>
          {/* 主 CTA: 重试 (refetch 当前 query) */}
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-between gap-6 bg-[#171717] text-white px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors min-h-[48px]"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <I18nText k="error.500.cta.retry" default="Try Again" />
            </span>
          </button>
          <ActionButton to="/" variant="secondary" showIcon={false} ariaLabel="返回首页">
            <Home className="w-4 h-4" aria-hidden="true" />
            <I18nText k="error.500.cta.home" default="Back To Home" />
          </ActionButton>
        </>
      }
      footer={
        <div className="text-sm text-[#666666] space-y-4">
          {/* 错误码 — 截图给客服 */}
          <div>
            <div className="flex items-center gap-2 mb-2 font-black uppercase text-[10px] tracking-[0.3em] text-[#171717]">
              <I18nText k="error.500.id" default="/ Error ID" />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#F5F4F0] border border-[#171717]/20 text-[#171717] font-mono text-xs break-all">
                {errorId}
              </code>
              <button
                type="button"
                onClick={copyErrorId}
                aria-label="复制错误码"
                className="inline-flex items-center gap-1 px-3 py-2 border border-[#171717] text-[#171717] hover:bg-[#EEEDE9] text-xs font-black uppercase tracking-wider"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <I18nText k="error.500.id.copy" default="Copy" />
              </button>
            </div>
          </div>

          {/* 联系客服 */}
          <div>
            <div className="flex items-center gap-2 mb-2 font-black uppercase text-[10px] tracking-[0.3em] text-[#171717]">
              <Mail className="w-4 h-4" aria-hidden="true" />
              <I18nText k="error.500.contact" default="/ Contact" />
            </div>
            <p className="mb-1">
              <I18nText
                k="error.500.contact.desc"
                default="把错误码 + 截图发给客服,工程师会优先排查:"
              />
            </p>
            <a
              href={`mailto:support@ai-academy.local?subject=${encodeURIComponent(
                `[${errorId}] Server Error Report`,
              )}`}
              className="text-[#171717] underline underline-offset-4 hover:text-[#262626] font-bold"
            >
              support@ai-academy.local
            </a>
          </div>

          {/* dev 模式显示原 message */}
          {import.meta.env.DEV && (
            <pre className="mt-2 p-3 text-left text-xs bg-[#F5F4F0] border border-[#171717]/20 text-[#171717] rounded overflow-auto max-h-32">
              {String(errorMessage)}
            </pre>
          )}
        </div>
      }
    />
  );
}
