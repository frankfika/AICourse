/**
 * 开发工具配置
 * 提供更好的开发体验，过滤噪音
 */

/**
 * 配置控制台过滤器
 */
export function setupConsoleFilters() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return
  }

  // 保存原始方法
  const originalError = console.error
  const originalWarn = console.warn

  // 需要过滤的模式
  const filterPatterns = [
    /chrome-extension:/,
    /moz-extension:/,
    /webkit-masked-url:/,
    /Cannot destructure property/,
    /solana\.js/,
    /btc\.js/,
    /web3/i,
    /metamask/i,
    /phantom/i,
    /Invalid or unexpected token/i,
    /@vite\/client/,
    /net::ERR_ABORTED/i,
    /AbortError/i,
    /The operation was aborted/i
  ]

  // 检查是否应该过滤
  const shouldFilter = (args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ')

    return filterPatterns.some(pattern => pattern.test(message))
  }

  // 重写console.error
  console.error = function(...args: any[]) {
    if (!shouldFilter(args)) {
      originalError.apply(console, args)
    }
  }

  // 重写console.warn
  console.warn = function(...args: any[]) {
    if (!shouldFilter(args)) {
      originalWarn.apply(console, args)
    }
  }
}

/**
 * 性能监控辅助函数
 */
export function measurePerformance(label: string) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return {
      start: () => {},
      end: () => {},
    }
  }

  let startTime: number

  return {
    start: () => {
      startTime = performance.now()
    },
    end: () => {
      const duration = performance.now() - startTime
      console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`)
    },
  }
}

/**
 * 检测慢渲染
 */
export function detectSlowRender(threshold = 16) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return
  }

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > threshold) {
            console.warn(`🐌 Slow render detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`)
          }
        }
      })

      observer.observe({ entryTypes: ['measure'] })
    } catch (e) {
      // 忽略不支持的浏览器
    }
  }
}
