'use client'

import { useEffect } from 'react'
import { initGlobalErrorHandler } from '@/lib/error-filter'
import { setupConsoleFilters, detectSlowRender } from '@/lib/dev-tools'
import { ErrorBoundary } from './error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 初始化全局错误处理器
    initGlobalErrorHandler()
    
    // 设置控制台过滤器（仅开发环境）
    if (process.env.NODE_ENV === 'development') {
      setupConsoleFilters()
      detectSlowRender()
    }
  }, [])

  return <ErrorBoundary>{children}</ErrorBoundary>
}

