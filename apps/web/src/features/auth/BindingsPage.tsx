/**
 * BindingsPage — 账号绑定 sub-page (P0-3)
 *
 * 路径: /dashboard/settings/bindings
 *
 * 来自 mock-auth.html 底部 "账号绑定 / 解绑管理" 段:
 *   - 顶部:已绑定的 Identity 列表(provider 图标 + 邮箱 + 绑于 + 解除按钮)
 *   - 中部:未绑定的 provider 6 宫格
 *     **Phase 1 灰度:全部 disabled,tooltip "即将推出, 灰度开放中"**
 *   - 底部:"至少保留一种登录方式" 提示
 *
 * API 端点(spec §9.3):
 *   - GET    /api/v1/auth/identities
 *   - DELETE /api/v1/auth/identities/:id
 *
 * Phase 1 状态: 后端 P0-1 未实现 identities 端点
 *   - LocalAuthAdapter.listMyIdentities() 兜底返回 [local]
 *   - unbindProvider() 抛 "后端 P2 实现待定"
 *   见 LocalAuthAdapter 的 TODO
 *
 * Demo 模式:支持 ?demo=with-google 强制渲染带 Google 绑定的视图(给截图用)
 * 不依赖真实 session,便于离线截图验证
 */
import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ProviderButtons } from '../../components/auth/ProviderButtons';
import { useToast } from '../../components/auth/Toast';
import { useAuth } from '../../lib/auth/AuthProvider';
import { ApiError } from '../../lib/apiError';
import type { Identity } from '../../lib/auth/types';
import { useAuthStore } from '../../stores/authStore';
import { useList, usePageSettings, useI18n, pickPage } from '../../lib/cms';

/**
 * Provider 视觉元数据
 * 跟 ProviderButtons 共用 LIST_FALLBACK['auth-providers'] 兜底(7 项)
 * (id → 名称 / 缩写 logo / 主色)
 */
const FALLBACK_PROVIDER_META: Record<
  string,
  { label: string; icon: React.ReactNode; isPrimary?: boolean }
> = {
  local: {
    label: '本地账号(邮箱 + 密码)',
    icon: <Mail className="h-5 w-5" />,
    isPrimary: true,
  },
  google: { label: 'Google', icon: <span className="font-bold text-sm">G</span> },
  github: { label: 'GitHub', icon: <span className="font-bold text-sm">GH</span> },
  wechat: { label: '微信', icon: <span className="font-bold text-sm">微</span> },
  wecom: { label: '企业微信', icon: <span className="font-bold text-sm">企</span> },
  feishu: { label: '飞书', icon: <span className="font-bold text-sm">飞</span> },
  apple: { label: 'Apple', icon: <span className="font-bold text-sm"></span> },
};

/**
 * 提供 meta helper: 优先用 LIST_FALLBACK[auth-providers] (hook 拿不到时),
 * 再次用 FALLBACK_PROVIDER_META (默认 6 + 1)
 */
function useProviderMeta(): Record<string, { label: string; icon: React.ReactNode; isPrimary?: boolean }> {
  const { data } = useList<{ id: string; label: string; icon: string; isActive?: boolean }>('auth-providers');
  if (data && data.length > 0) {
    const map: Record<string, { label: string; icon: React.ReactNode; isPrimary?: boolean }> = {};
    for (const p of data) {
      if (p.isActive === false) continue;
      // 缩写: 取 label 第 1 个字符
      const firstChar = (p.label || p.id).charAt(0);
      map[p.id] = { label: p.label, icon: <span className="font-bold text-sm">{firstChar}</span> };
    }
    // local 是 primary,后端不一定返回;补回去
    if (!map.local) {
      map.local = FALLBACK_PROVIDER_META.local;
    }
    return map;
  }
  return FALLBACK_PROVIDER_META;
}

/** ISO 时间 → "2025.08.14" 形式(跟 mock 一致) */
function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function BindingsPage() {
  const { identities, isAuthenticating, unbindProvider } = useAuth();
  // user 直接从 store 读, 不走 context, 跟其他页面(Layout, PurchaseModal)一致
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  // P0 (audit 2026-07-24): 改用 ConfirmDialog, 跟 OrdersPage / NotificationsPage
  // 风格一致 (弃用 window.confirm — 不能 i18n, 不能定制 variant)
  const [confirmUnbind, setConfirmUnbind] = useState<Identity | null>(null);
  const [params] = useSearchParams();
  // Demo 模式:有 ?demo=with-google 时,即使没真实 session 也渲染带 Google 的视图
  // 用于离线截图 / 视觉验证
  const demoMode = params.get('demo');
  const showWithGoogleDemo = demoMode === 'with-google';

  // 演示模式:在 identities 末尾追加一个 Google identity
  const displayedIdentities: Identity[] = useMemo(() => {
    if (showWithGoogleDemo) {
      return [
        ...identities,
        {
          id: 'demo-google-1',
          provider: 'google',
          providerUserId: 'demo-google-uid',
          email: user?.email ?? 'demo@gmail.com',
          displayName: 'demo@gmail.com',
          linkedAt: '2025-11-02T00:00:00Z',
          lastUsedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        },
      ];
    }
    return identities;
  }, [showWithGoogleDemo, identities, user?.email]);

  // CMS-driven provider meta(从 auth-providers 列表拿 label/icon)
  // 必须在所有 early return 之前调用
  const providerMeta = useProviderMeta();
  const { t } = useI18n();
  const { data: pageData } = usePageSettings('auth', ['h1_bindings']);
  const bindingsH1 = pickPage(pageData, 'h1_bindings', 'zh-CN', t('auth.h1_bindings', '绑定第三方账号,登录更便捷'));

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton variant="text" className="h-8 w-64" />
          <Skeleton variant="rectangle" className="h-32 w-full rounded-lg" />
          <Skeleton variant="rectangle" className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // 未登录且非 demo 模式:硬重定向到登录页(带 ?next= 登录后回弹)
  // 原 EmptyState + 按钮改为 <Navigate>, 避免给未登录访客看到 "请先登录" 卡片
  if (!user && !showWithGoogleDemo) {
    return <Navigate to="/auth/login?next=/dashboard/settings/bindings" replace />;
  }

  const handleUnbind = async (id: Identity) => {
    const meta = providerMeta[id.provider];
    if (id.provider === 'local') {
      showToast(t('auth.toast.local_primary', '本地账号是主登录,无法解绑'), 'warning');
      return;
    }
    setBusyId(id.id);
    try {
      await unbindProvider(id.id);
      showToast(t('auth.toast.unbind', '已解绑'), 'success');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('auth.toast.unbind_fail', '解绑失败');
      showToast(msg, 'error', 4000);
    } finally {
      setBusyId(null);
    }
  };

  // ConfirmDialog 触发: 点"解绑"按钮只 setConfirmUnbind, 用户在弹层确认后才真解绑
  const requestUnbind = (id: Identity) => {
    if (id.provider === 'local') {
      showToast(t('auth.toast.local_primary', '本地账号是主登录,无法解绑'), 'warning');
      return;
    }
    setConfirmUnbind(id);
  };

  const handleBindClick = (_providerId: string, label: string) => {
    showToast(`${label} 绑定即将推出, 灰度开放中`, 'info', 2500);
  };

  const nonPrimaryCount = displayedIdentities.filter(
    (i) => !i.isPrimary,
  ).length;
  const totalCount = displayedIdentities.length;
  // demo 模式下:用 demo email 代替真实 user.email
  const displayUser = user ?? {
    id: 'demo-user',
    email: 'k.chen@opencsg.ai',
    name: 'K. Chen',
    role: 'student' as const,
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center mb-10">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-xp-100 text-xp-500">
            已登录用户 · 账号绑定管理
          </span>
          <h1 className="mt-3 text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-900">
            {bindingsH1}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-600">
            {t('auth.bindings.path', '设置页路径:')}
            <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-100 font-mono text-xs mx-1">
              /dashboard/settings/bindings
            </code>
          </p>
        </header>

        {/* 已绑定列表 */}
        <Card variant="outlined" padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 dark:bg-neutral-50 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-neutral-900 dark:text-neutral-900">
              已绑定的登录方式
            </h2>
            <span className="text-xs text-neutral-600 dark:text-neutral-600">
              {t('auth.bindings.count', '{count} 种 · 至少保留 1 种').replace('{count}', String(totalCount))}
            </span>
          </div>

          {displayedIdentities.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title={t('auth.identity.empty.title', '还没有绑定任何登录方式')}
                description={`${displayUser.email} 还没有绑定任何第三方登录方式`}
              />
            </div>
          ) : (
            <ul role="list" className="divide-y divide-neutral-200">
              {displayedIdentities.map((id) => {
                const meta = providerMeta[id.provider] ?? {
                  label: id.provider,
                  icon: <Lock className="h-5 w-5" />,
                };
                const isPrimary = !!id.isPrimary;
                return (
                  <li
                    key={id.id}
                    className="px-6 py-4 flex items-center gap-4"
                  >
                    <div
                      className={
                        isPrimary
                          ? 'w-10 h-10 rounded-lg bg-[#171717] text-neutral-0 flex items-center justify-center'
                          : 'w-10 h-10 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600'
                      }
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-neutral-900 dark:text-neutral-900 truncate">
                          {isPrimary
                            ? meta.label
                            : `${meta.label} · ${id.displayName ?? id.email ?? id.providerUserId ?? id.id}`}
                        </span>
                        {isPrimary && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-100 text-success-500">
                            主登录
                          </span>
                        )}
                      </div>
                      {id.lastUsedAt && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-600 mt-0.5">
                          上次使用 {formatDate(id.lastUsedAt)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 font-mono hidden sm:block">
                      绑定于 {formatDate(id.linkedAt)}
                    </div>
                    {isPrimary ? (
                      <span className="text-xs text-neutral-400 hidden sm:inline">
                        无法解绑
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => requestUnbind(id)}
                        isLoading={busyId === id.id}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        className="text-danger-500 hover:bg-danger-100"
                      >
                        解绑
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* 添加新 provider 6 宫格(灰度) */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-900 mb-3">
            添加新的登录方式
          </h2>
          <ProviderButtons
            grayscale
            onProviderClick={handleBindClick}
          />
          <p className="mt-3 text-[10px] text-neutral-400">
            启用 / 停用某个 provider,改{' '}
            <code className="px-1 font-mono">AUTH_PROVIDERS</code> 环境变量即可,无需改代码 ·
            详细架构见 redesign-spec.md §9
          </p>
        </section>

        {/* 安全提示 */}
        <div className="mt-8 p-4 rounded-lg bg-warning-100 border border-warning-500/20 flex gap-3">
          <AlertTriangle
            className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-900">
              {nonPrimaryCount === 0
                ? t('auth.identity.keep_one', '至少保留一种登录方式')
                : t('auth.identity.warning_title', '安全提醒')}
            </p>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-600">
              {t('auth.identity.warning_desc', '解绑会立即吊销对应 provider 的 refresh token。')} {t('auth.identity.security_link_prefix', '如发现异常登录,前往')}{' '}
              <a
                href="/dashboard/settings/security"
                className="text-[#171717] underline underline-offset-2 hover:bg-[#171717] hover:text-white"
              >
                安全设置
              </a>{' '}
              撤销所有设备。
            </p>
          </div>
        </div>

        {/* Refresh 按钮 — 让用户能拉最新 identities */}
        <div className="mt-6 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            刷新
          </Button>
        </div>
      </div>

      {/* P0 (audit 2026-07-24): 二次确认走 ConfirmDialog 跟全项目一致 */}
      <ConfirmDialog
        open={!!confirmUnbind}
        onClose={() => setConfirmUnbind(null)}
        onConfirm={async () => {
          if (confirmUnbind) await handleUnbind(confirmUnbind);
        }}
        title={t('auth.unbind.confirm_title', '确认解绑?')}
        description={
          confirmUnbind
            ? t(
                'auth.unbind.confirm_desc',
                `解绑 ${providerMeta[confirmUnbind.provider]?.label ?? confirmUnbind.provider} 后,你将无法再用此账号登录。`,
              )
            : ''
        }
        variant="warning"
        confirmText={t('auth.unbind.confirm_btn', '确认解绑')}
      />
    </div>
  );
}
