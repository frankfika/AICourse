import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Security: GEMINI_API_KEY must NEVER be injected into the client bundle.
// Any Gemini call goes through the backend (apps/api) — see ai.service.ts.
export default defineConfig(() => {
    return {
      server: {
        port: 5500,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
