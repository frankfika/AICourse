/** @type {import('next').NextConfig} */
const nextConfig = {
  // 性能优化
  reactStrictMode: true,
  
  // 图片优化配置
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },

  // 生产环境优化
  
  // 压缩配置
  compress: true,

  // 实验性功能
  experimental: {
    // 优化包大小
    optimizePackageImports: ['lucide-react'],
  },

  // 避免浏览器扩展错误影响
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 开发环境下忽略特定的警告
      config.ignoreWarnings = [
        /chrome-extension/,
        /moz-extension/,
        /webkit-masked-url/,
      ]
    }
    return config
  },
}

module.exports = nextConfig
