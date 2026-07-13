/**
 * AuthProvider — spec §9.4 React 上下文实现
 *
 * Context 暴露:
 *   { user, identities, providers, signIn, signOut, bindProvider, unbindProvider, isAuthenticating }
 *
 * 启动流程:
 *   1. 用 adapter.refresh() 探活 (httpOnly cookie 决定是否有 session)
 *      - 200 → 拿到 user + accessToken,setAuth
 *      - 401 → user = null (未登录)
 *   2. 并行 GET /auth/providers 拉按钮网格数据
 *   3. 完成后 isAuthenticating = false
 *
 * 401 拦截:
 *   - api.ts 的 axios response interceptor 已经处理 401 → refresh
 *   - 这里用 onUnauthorized 回调接 refresh 失败通知 → setUser(null) + 跳 /auth/login
 *
 * Adapter 切换:
 *   - 读 import.meta.env.VITE_AUTH_ADAPTER (默认 'local')
 *   - Phase 1: 只有 LocalAuthAdapter,其他 mode fallback 到 local
 *   - Phase 2+: 加 OidcAuthAdapter / HostedAuthAdapter 实现
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
// 注意:AuthProvider 自身放在 BrowserRouter 外层(顺序 QueryClient → AuthProvider → Router),
//      所以这里**不能**调 useLocation / useNavigate(否则会 throw "useLocation() may be used only in the context of a <Router>")。
//      AuthGuard 是单独组件,只在路由元素里用,所以可以在它里面用 useLocation。
//      AuthProvider 自身只用 store / api,跟 router 无关。
import { LocalAuthAdapter } from './LocalAuthAdapter';
import { setAccessToken } from '../api';
import { useAuthStore } from '../../stores/authStore';
import type {
  AuthAdapter,
  AuthSession,
  Identity,
  ProviderInfo,
  SignInInput,
} from './types';

export interface AuthContextValue {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  identities: Identity[];
  providers: ProviderInfo[];
  signIn: (input: SignInInput) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  bindProvider: (provider: string) => Promise<void>;
  unbindProvider: (identityId: string) => Promise<void>;
  isAuthenticating: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 工厂:按 VITE_AUTH_ADAPTER 选 adapter
 * Phase 1 只支持 local,Phase 2+ 加 oidc / hosted
 */
function createAdapter(): AuthAdapter {
  const mode = (import.meta.env.VITE_AUTH_ADAPTER ?? 'local') as
    | 'local'
    | 'oidc'
    | 'hosted';
  switch (mode) {
    case 'local':
      return new LocalAuthAdapter();
    case 'oidc':
    case 'hosted':
      // TODO(phase-2): 实现 OidcAuthAdapter / HostedAuthAdapter
      // 现阶段 fallback 到 local,避免组件代码感知不到
      // eslint-disable-next-line no-console
      console.warn(
        `[AuthProvider] VITE_AUTH_ADAPTER=${mode} 未实现,fallback 到 local`,
      );
      return new LocalAuthAdapter();
    default:
      return new LocalAuthAdapter();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const adapterRef = useRef<AuthAdapter>(createAdapter());
  const adapter = adapterRef.current;

  /**
   * 启动:探活 + 拉 providers
   *
   * 注: spec §9.4 说用 GET /auth/me,但后端 P0-1 未实现
   * 这里用 /auth/refresh(cookie 自动带)代替 — 200 说明有 session,401 说明没
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [session, providerList] = await Promise.all([
          adapter.refresh(),
          adapter.listProviders(),
        ]);
        if (cancelled) return;
        if (session) {
          setAuth(session.user, session.accessToken);
          // 拉 identities (Phase 1: 只返回 local)
          const idents = await adapter.listMyIdentities();
          if (!cancelled) setIdentities(idents);
        } else {
          clearAuth();
          setIdentities([]);
        }
        setProviders(providerList);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn('[AuthProvider] boot failed:', err);
        clearAuth();
        setIdentities([]);
      } finally {
        if (!cancelled) setIsAuthenticating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 仅 mount 时跑一次 — adapter / store 在整个 provider 生命周期稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** signIn 入口 */
  const signIn = useCallback(
    async (input: SignInInput) => {
      const session = await adapter.signIn(input);
      setAuth(session.user, session.accessToken);
      // 登录后立即拉 identities
      try {
        const idents = await adapter.listMyIdentities();
        setIdentities(idents);
      } catch {
        /* ignore */
      }
      return session;
    },
    [adapter, setAuth],
  );

  /**
   * signOut — revoke refresh + 清本地 state
   *
   * 不直接 navigate — 组件代码可以自己做 SPA 跳转(window.location 也行)
   * 留出灵活度:Layout 的"退出登录"按钮可能要留在原页,而 LoginPage 完成后
   * 调 signOut 再 navigate('/')
   */
  const signOut = useCallback(async () => {
    await adapter.signOut();
    setAccessToken(null);
    clearAuth();
    setIdentities([]);
  }, [adapter, clearAuth]);

  /**
   * bindProvider — Phase 1 灰度:所有 oauth 都 disabled
   * 未来实现: window.location = /api/v1/auth/<p>/authorize?redirect=...
   */
  const bindProvider = useCallback(
    async (provider: string) => {
      const p = providers.find((x) => x.id === provider);
      if (!p?.enabled) {
        throw new Error(
          `Provider "${provider}" 未启用 (Phase 1 灰度模式 — 即将推出)`,
        );
      }
      // 未来: window.location.href = `${api.defaults.baseURL}/api/v1/auth/${provider}/authorize?...`
      throw new Error('bindProvider: Phase 2 实现待定');
    },
    [providers],
  );

  /** unbindProvider */
  const unbindProvider = useCallback(
    async (identityId: string) => {
      await adapter.unbindProvider(identityId);
      setIdentities((prev) => prev.filter((i) => i.id !== identityId));
    },
    [adapter],
  );

  // 401 拦截由 api.ts 的 response interceptor 兜底(refresh + 跳 login)
  // AuthProvider 这里不重复实现,避免双跳

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      identities,
      providers,
      signIn,
      signOut,
      bindProvider,
      unbindProvider,
      isAuthenticating,
    }),
    [
      user,
      identities,
      providers,
      signIn,
      signOut,
      bindProvider,
      unbindProvider,
      isAuthenticating,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}

/**
 * AuthGuard — 路由级守卫
 *
 * 用法:
 *   <Route element={<AuthGuard><SettingsLayout /></AuthGuard>} />
 *
 * 行为:
 *   - isAuthenticating: 显示 Skeleton,不闪跳 login
 *   - !user: 跳 /auth/login?from=<current>
 *   - requireAdmin && role !== admin: 跳 /
 */
export function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, isAuthenticating } = useAuth();
  const location = useLocation();

  if (isAuthenticating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="w-full max-w-md p-6 space-y-3">
          <div className="h-6 w-32 rounded-md bg-neutral-200 dark:bg-neutral-200 animate-pulse" />
          <div className="h-4 w-full rounded-md bg-neutral-200 dark:bg-neutral-200 animate-pulse" />
          <div className="h-4 w-3/4 rounded-md bg-neutral-200 dark:bg-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?from=${from}`} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
