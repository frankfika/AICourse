/**
 * LocalAuthAdapter — Phase 1 默认实现
 *
 * 行为:
 *   - signIn({kind:'local'})  → POST /api/v1/auth/login
 *   - signIn({kind:'oauth-redirect'})  → window.location = /api/v1/auth/<p>/authorize
 *   - refresh                  → POST /api/v1/auth/refresh (cookie 自动带)
 *   - listProviders            → GET /api/v1/auth/providers
 *   - listMyIdentities         → GET /api/v1/auth/identities
 *   - unbindProvider           → DELETE /api/v1/auth/identities/:id
 *
 * 与 api.ts 的关系:
 *   - 所有请求走同一个 axios instance (withCredentials: true,401 自动 refresh)
 *   - 401 由 api.ts 的 response interceptor 处理,这里不重复实现
 */
import { api } from '../api';
import type {
  AuthAdapter,
  AuthSession,
  Identity,
  ProviderInfo,
  SignInInput,
} from './types';

/** 后端 /auth/login 响应 */
interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'student' | 'instructor';
    passwordResetRequired?: boolean;
  };
}

/** 后端 /auth/providers 响应 */
interface ProvidersResponse {
  providers: Array<{
    id: string;
    label: string;
    type: 'email_password' | 'oauth' | 'sso';
    iconUrl?: string;
    enabled: boolean;
  }>;
}

/**
 * Phase 1 灰度 provider 列表 — 用于前端按钮网格
 *
 * 6 个 provider 来自 mock-auth.html:Google / GitHub / 微信 / 企业微信 / 飞书 / Apple
 * Phase 1 全部 enabled=false(灰度),Phase 2+ 再通过后端 AUTH_PROVIDERS env 切
 *
 * 后端 /auth/providers 返回的列表若空(没接 env)就 fallback 到这组,保证 UI 始终有 6 宫格
 */
const GRAYSCALE_PROVIDERS: ProviderInfo[] = [
  { id: 'oauth.google', label: 'Google', type: 'oauth', enabled: false },
  { id: 'oauth.github', label: 'GitHub', type: 'oauth', enabled: false },
  { id: 'wechat', label: '微信', type: 'oauth', enabled: false },
  { id: 'wecom', label: '企业微信', type: 'oauth', enabled: false },
  { id: 'feishu', label: '飞书', type: 'oauth', enabled: false },
  { id: 'apple', label: 'Apple', type: 'oauth', enabled: false },
];

export class LocalAuthAdapter implements AuthAdapter {
  async signIn(input: SignInInput): Promise<AuthSession> {
    if (input.kind === 'local') {
      const { data } = await api.post<LoginResponse>('/api/v1/auth/login', {
        email: input.email,
        password: input.password,
      });
      return {
        user: data.user,
        accessToken: data.accessToken,
      };
    }

    if (input.kind === 'oauth-redirect') {
      const { data } = await api.get<{ authorizationUrl: string }>(
        `/api/v1/auth/${encodeURIComponent(input.provider)}/start`,
      );
      window.location.assign(data.authorizationUrl);
      // Navigation normally interrupts this promise; keep a typed fallback for
      // test environments where location.assign is mocked.
      throw new Error('Redirecting to OAuth provider…');
    }

    // exhaustiveness check
    const _exhaustive: never = input;
    throw new Error(`Unknown signIn input: ${JSON.stringify(_exhaustive)}`);
  }

  async signOut(): Promise<void> {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // 静默 — 即使后端失败也要清本地 state
    }
  }

  async refresh(): Promise<AuthSession | null> {
    try {
      const { data } = await api.post<LoginResponse>(
        '/api/v1/auth/refresh',
        {},
      );
      return {
        user: data.user,
        accessToken: data.accessToken,
      };
    } catch {
      // 401 = 未登录;其他错误也按未登录处理,让 AuthProvider 引导到 /auth/login
      return null;
    }
  }

  async listProviders(): Promise<ProviderInfo[]> {
    try {
      const { data } = await api.get<ProvidersResponse>(
        '/api/v1/auth/providers',
      );
      const backend = (data?.providers ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        type: p.type,
        iconUrl: p.iconUrl,
        enabled: p.enabled,
      }));
      // 后端没返回任何 provider 时 fallback 到灰度列表
      // 业务方按 enabled 字段决定按钮是否可点
      return backend.length > 0 ? backend : GRAYSCALE_PROVIDERS;
    } catch {
      // 后端连不上 / 报错 — UI 至少还能渲染灰度按钮
      return GRAYSCALE_PROVIDERS;
    }
  }

  /**
   * 列当前用户的 Identity 列表
   *
   * Phase 1 状态(spec §9.3 表格里要求 GET /auth/identities,但后端 P0-1 没实现):
   *   - 后端有 cookie → 兜底返回 [local identity] (Phase 1 本地账号永远存在)
   *   - 后端没 cookie / 401 → 返回 []
   *
   * P1 fix: 不再内部调 this.refresh(),改由调用方(AuthProvider)传入 user
   *   - 旧逻辑: AuthProvider mount 时调 refresh + listMyIdentities 内部再调 refresh,
   *     → 同一 page load 触发 2-3 次 /auth/refresh,5/sec 全局限流被快速打爆,
   *     后续 hard reload 全部 429。
   *   - 新逻辑: refresh 只调一次(listProviders 之前 Promise.all),listMyIdentities
   *     复用已拿到的 user。
   *
   * 后端端点已实装，直接返回真实 identity。
   */
  async listMyIdentities(user: { id: string; email: string; name: string } | null): Promise<Identity[]> {
    if (!user) return [];
    const { data } = await api.get<Identity[]>('/api/v1/auth/identities');
    return data;
  }

  /**
   * 解绑 Identity
   *
   * 本地主登录由后端拒绝解绑；第三方 identity 可正常解绑。
   */
  async unbindProvider(identityId: string): Promise<void> {
    await api.delete(`/api/v1/auth/identities/${encodeURIComponent(identityId)}`);
  }
}
