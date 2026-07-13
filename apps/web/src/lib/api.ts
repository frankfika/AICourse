import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  timeout: 10000,
  withCredentials: true,
});

// Security: keep access_token in memory (module-level variable) instead of
// localStorage so it cannot be exfiltrated via XSS. The refresh token lives
// in an httpOnly cookie managed by the backend.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // 不要在 refresh 请求本身失败时递归 / 跳 login(否则 AuthProvider 启动会死循环)
    const isRefreshCall = original?.url?.includes('/auth/refresh');
    if (err.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        // Security: refresh token is in httpOnly cookie. Just hit the endpoint
        // with credentials so the browser sends the cookie automatically.
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        );
        accessToken = data.accessToken;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        accessToken = null;
        // 已经在 auth 页面就不跳了(避免 redirect loop)
        const onAuthPage = window.location.pathname.startsWith('/auth/');
        if (!onAuthPage) {
          window.location.href = '/auth/login?from=' + encodeURIComponent(window.location.pathname);
        }
      }
    }
    return Promise.reject(err);
  },
);

export default api;
