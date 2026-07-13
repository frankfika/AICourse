import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './src/router';
import { queryClient } from './src/lib/queryClient';
import { AuthProvider } from './src/lib/auth/AuthProvider';
import { ToastProvider } from './src/components/auth/Toast';
import { initThemeFromStorage } from './src/components/Layout';

// 启动时同步 theme 到 <html class="dark">,避免首屏闪烁
initThemeFromStorage();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
