/**
 * api.ts — Axios 单例 + access token 持久化
 *
 * 设计目标(按 Frank 偏好"零硬编码 + 可换 token 策略"):
 *   1. **同源**: 默认 baseURL 用 window.location.origin,通过 Vite proxy(/api/*
 *      → http://localhost:8080)转发。生产 nginx 同理。开发/生产都是同源,
 *      httpOnly cookie(sameSite=lax + path=/api/v1/auth)能正常收发。
 *   2. **access token 持久化**:
 *      - 旧实现: module-level `let accessToken`,hard reload 后丢失 → 401。
 *      - 新实现: memory 缓存 + sessionStorage 兜底。
 *        - sessionStorage 选型原因: 同 tab hard reload 留存 / 关闭 tab 自动清
 *          / 跨 tab 隔离(比 localStorage 强)。
 *        - 仍是 httpOnly refresh token 的 fallback 策略:access 过期 →
 *          axios interceptor → POST /auth/refresh → cookie 带 → 拿新 access。
 *   3. **可换 token 策略**: 后续要换 sessionStorage / cookie / IndexedDB,
 *      只动 setAccessToken / getAccessToken 两个函数。
 *   4. **XSS 缓解(有限)**: 不放 localStorage,所以跨 tab / 跨会话不会泄漏。
 *      同 tab 内 XSS 仍能读 sessionStorage —— 这是已知 trade-off,比 hard
 *      reload 401 强。
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const ACCESS_TOKEN_KEY = 'aicourse.accessToken';

/**
 * 安全读 sessionStorage,捕获 privacy mode / SSR 异常。
 * 返回 string | null,绝不抛。
 */
function readToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* privacy mode / disabled — 退化为纯内存 */
  }
}

// 内存缓存 — 同步读取用(axios request interceptor 不能 await)
let accessToken: string | null = readToken();

export function setAccessToken(token: string | null) {
  accessToken = token;
  writeToken(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api = axios.create({
  // 默认同源 — Vite dev server(5500)把 /api/* proxy 到后端 8080。
  // 如果显式设 VITE_API_BASE_URL(例如 preview 跨域测试),仍可覆盖。
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * 401 → refresh → retry 一次
 *
 * - 关键: refresh 端点用裸 axios 调(不走 api),避免递归触发本 interceptor
 * - withCredentials 必须 true,否则 httpOnly cookie 不发
 * - refresh 失败不递归 — 直接跳 /auth/login(避免 infinite loop)
 */
let refreshingPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    const baseURL =
      import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
    const { data } = await axios.post(
      `${baseURL}/api/v1/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (!original) return Promise.reject(err);

    // 不要在 refresh 请求本身失败时递归 / 跳 login
    const isRefreshCall = original.url?.includes('/auth/refresh');
    if (err.response?.status !== 401 || original._retry || isRefreshCall) {
      return Promise.reject(err);
    }

    original._retry = true;

    // 并发请求去重 — 多个 401 同时只调一次 refresh
    if (!refreshingPromise) {
      refreshingPromise = doRefresh().finally(() => {
        refreshingPromise = null;
      });
    }
    const newToken = await refreshingPromise;

    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }

    // refresh 失败 — 已经在 auth 页就不跳了(避免 redirect loop)
    const onAuthPage = window.location.pathname.startsWith('/auth/');
    if (!onAuthPage) {
      window.location.href =
        '/auth/login?from=' + encodeURIComponent(window.location.pathname);
    }
    return Promise.reject(err);
  },
);

export default api;
