import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import api from '../lib/api';
import { useAuthStore, AuthUser } from '../stores/authStore';

/**
 * AuthProvider Context - 前端 auth 抽象层
 *
 * 设计目标：与后端 AuthProvider 对齐
 * - 不 hardcode endpoint：前端不写死 /auth/login /auth/oauth/google 等
 * - 启动时拉一次 GET /auth/providers,知道后端启用了哪些 provider
 * - 调用方只关心 provider id + credentials
 *
 * 用法（替代 useAuthStore 直接操作）:
 *   const { login, register, loginWithProvider, providers } = useAuth();
 *   await loginWithProvider('email_password', { email, password, mode: 'login' });
 *   await loginWithProvider('oauth.google', { code });
 *
 * 与 zustand authStore 的关系:
 *   - authStore 还是 single source of truth for user + accessToken
 *   - AuthProvider 在它上面包一层,加 provider 调度 + 错误处理
 */

export interface AuthProviderDescriptor {
  id: string;
  label: string;
  type: 'email_password' | 'oauth' | 'sso';
  iconUrl?: string;
}

export interface AuthContextValue {
  /** 后端启用的 provider 列表（从 GET /auth/providers 拉） */
  providers: AuthProviderDescriptor[];
  /** provider 调度入口 - 替换前端所有 /api/v1/auth/... 硬编码 endpoint */
  loginWithProvider: (
    providerId: string,
    credentials: Record<string, unknown>,
  ) => Promise<{ user: AuthUser; accessToken: string }>;
  /** 兼容旧 API：email/password 登录（底层走 loginWithProvider） */
  login: (email: string, password: string) => Promise<AuthUser>;
  /** 兼容旧 API：email/password 注册（底层走 loginWithProvider） */
  register: (email: string, password: string, name: string) => Promise<void>;
  /** 登出 */
  logout: () => Promise<void>;
  /** 当前用户 */
  user: AuthUser | null;
  /** provider 列表是否已加载（用于在 LoginPage 渲染 OAuth 按钮前的占位） */
  providersLoaded: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [providers, setProviders] = useState<AuthProviderDescriptor[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);

  // 启动时拉一次 provider 列表
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/v1/auth/providers')
      .then((res) => {
        if (cancelled) return;
        setProviders(res.data?.providers ?? []);
      })
      .catch((err) => {
        // 拉 provider 失败不应该 block 登录（email_password 仍可用）
        // eslint-disable-next-line no-console
        console.warn('[AuthProvider] Failed to load providers:', err?.message);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 通用 provider 入口：替换前端所有 hardcode endpoint */
  const loginWithProvider = useCallback(
    async (providerId: string, credentials: Record<string, unknown>) => {
      const { data } = await api.post(`/api/v1/auth/${providerId}`, credentials);
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      };
      setAuth(authUser, data.accessToken);
      return { user: authUser, accessToken: data.accessToken };
    },
    [setAuth],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: u } = await loginWithProvider('email_password', {
        email,
        password,
        mode: 'login',
      });
      return u;
    },
    [loginWithProvider],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      await loginWithProvider('email_password', {
        email,
        password,
        name,
        mode: 'register',
      });
    },
    [loginWithProvider],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // 静默 - 清本地状态即可
    }
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        providers,
        loginWithProvider,
        login,
        register,
        logout,
        user,
        providersLoaded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
