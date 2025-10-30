'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Award, Download, Printer, Share2, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Certificate {
  id: string
  certificateNo: string
  itemTitle: string
  completedAt: Date
  type: string
  user: {
    name: string
    email: string
  }
  certData: any
}

interface CertificateViewProps {
  certificate: Certificate
}

export function CertificateView({ certificate }: CertificateViewProps) {
  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    alert('下载功能开发中...')
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    alert('证书链接已复制到剪贴板')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 操作按钮 */}
        <div className="mb-8 flex justify-center gap-4 print:hidden">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            打印
          </Button>
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            下载PDF
          </Button>
          <Button onClick={handleShare} variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            分享
          </Button>
        </div>

        {/* 证书主体 */}
        <Card className="bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
          <div className="relative p-12 md:p-16">
            {/* 装饰边框 */}
            <div className="absolute inset-4 border-4 border-double border-blue-600 dark:border-blue-400 rounded-lg"></div>

            {/* 证书内容 */}
            <div className="relative z-10 text-center space-y-8">
              {/* Logo */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <Award className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* 标题 */}
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2">
                  完成证书
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Certificate of Completion
                </p>
              </div>

              {/* 内容 */}
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                  <span>特此证明</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>

                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                  {certificate.user.name}
                </div>

                <div className="text-lg text-gray-700 dark:text-gray-300">
                  已成功完成
                </div>

                <div className="text-2xl md:text-3xl font-semibold text-blue-600 dark:text-blue-400 px-6">
                  {certificate.itemTitle}
                </div>

                <div className="text-gray-600 dark:text-gray-400">
                  {certificate.type === 'course' ? '在线课程' : '认证项目'}
                </div>
              </div>

              {/* 底部信息 */}
              <div className="pt-8 mt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="font-semibold mb-1">完成时间</p>
                    <p>{formatDate(certificate.completedAt)}</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">证书编号</p>
                    <p className="font-mono">{certificate.certificateNo}</p>
                  </div>
                </div>
              </div>

              {/* 签名区 */}
              <div className="pt-8 flex justify-center gap-16">
                <div className="text-center">
                  <div className="w-48 border-t-2 border-gray-400 dark:border-gray-600 mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">CourseAI</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">在线学习平台</p>
                </div>
              </div>

              {/* 验证链接 */}
              <div className="pt-8 text-xs text-gray-500 dark:text-gray-500">
                <p>验证此证书：{window.location.origin}/certificates/{certificate.certificateNo}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* 提示文本 */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400 print:hidden">
          <p>此证书可用于个人简历、LinkedIn 等专业平台</p>
        </div>
      </div>
    </div>
  )
}
