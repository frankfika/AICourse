import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}/api/v1/auth/refresh`,
          { refreshToken },
          { withCredentials: true },
        );
        localStorage.setItem('access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
