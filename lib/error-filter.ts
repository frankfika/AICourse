/**
 * 错误过滤器 - 过滤浏览器扩展产生的错误
 * 避免Web3钱包等扩展的错误干扰开发
 */

// 需要忽略的错误模式
const IGNORED_ERROR_PATTERNS = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /webkit-masked-url:\/\//i,
  /solana\.js/i,
  /btc\.js/i,
  /ethereum/i,
  /web3/i,
  /metamask/i,
  /phantom/i,
  /Cannot destructure property.*of 'undefined'/i,
  /Invalid or unexpected token/i,
  /@vite\/client/
]

/**
 * 检查错误是否应该被忽略
 */
export function shouldIgnoreError(error: Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message || error.toString()
  
  return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))
}

/**
 * 过滤后的控制台错误
 */
export function filteredConsoleError(...args: any[]) {
  const errorMessage = args.join(' ')
  
  if (!shouldIgnoreError(errorMessage)) {
    console.error(...args)
  }
}

/**
 * 过滤后的控制台警告
 */
export function filteredConsoleWarn(...args: any[]) {
  const warnMessage = args.join(' ')
  
  if (!shouldIgnoreError(warnMessage)) {
    console.warn(...args)
  }
}

/**
 * 初始化全局错误处理
 */
export function initGlobalErrorHandler() {
  if (typeof window === 'undefined') return

  // 处理未捕获的错误
  window.addEventListener('error', (event) => {
    if (shouldIgnoreError(event.message || event.error?.message || '')) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  })

  // 处理未捕获的Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    if (shouldIgnoreError(event.reason?.message || event.reason || '')) {
      event.preventDefault()
      return false
    }
  })
}
