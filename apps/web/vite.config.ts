import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Security: GEMINI_API_KEY must NEVER be injected into the client bundle.
// Any Gemini call goes through the backend (apps/api) — see ai.service.ts.
export default defineConfig(({ mode }) => {
    // 读根目录 .env(与 apps/api 共享),不注入到 client
    const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
    const API_TARGET = env.API_INTERNAL_URL ?? 'http://localhost:8080';

    return {
      server: {
        port: 5500,
        host: '0.0.0.0',
        // P1 fix: 把 /api/* proxy 到后端,让 frontend 与 backend 视为同源
        //
        // 为什么需要: 后端用 httpOnly cookie (refresh_token) 鉴权,cookie 设了
        //   sameSite=lax + path=/api/v1/auth。浏览器对 **跨站 fetch(XHR/axios)
        //   不送 lax cookie**,所以 hard reload 后 401 → refresh 永远失败。
        // 通过 Vite proxy 让浏览器把请求都发到 5500(proxy 转发到 8080),
        //   Set-Cookie 落到 5500 这个 origin,后续 fetch 同源,cookie 正常带。
        //
        // 生产环境: 真实部署时 nginx / cloudfront 同源反向代理,行为一致。
        proxy: {
          '/api': {
            target: API_TARGET,
            changeOrigin: true,
            // 不要 rewrite — 后端路径已经以 /api/v1 开头,直接转发
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
    };
});
