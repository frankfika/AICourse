import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { prisma } from '@/lib/db'

export default async function AdminSettingsPage() {
  const assistantQr = await prisma.siteConfig.findUnique({ where: { key: 'assistantQrUrl' } })
  const qrUrl = assistantQr ? JSON.parse(assistantQr.value) as string : ''
  const assistantWechat = await prisma.siteConfig.findUnique({ where: { key: 'assistantWechatId' } })
  const wechatId = assistantWechat ? JSON.parse(assistantWechat.value) as string : ''
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">网站配置</h1>
        <p className="text-muted-foreground">管理网站基本设置</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>网站信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">网站名称</h4>
            <p className="text-muted-foreground">OpenCSG AI学院</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">网站描述</h4>
            <p className="text-muted-foreground">
              探索 AI 的无限可能，精选优质课程，系统化学习路径
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">联系邮箱</h4>
            <p className="text-muted-foreground">contact@courseai.com</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>课程小助手二维码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrUrl && (
            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-gray-50">
                <Image src={qrUrl} alt="课程小助手二维码" fill className="object-cover" />
              </div>
              <div className="text-sm text-muted-foreground break-all">{qrUrl}</div>
            </div>
          )}
          <form method="POST" action="/api/admin/site-config" className="space-y-3">
            <input type="hidden" name="key" value="assistantQrUrl" />
            <div>
              <label className="block text-sm font-medium mb-1">二维码图片URL</label>
              <input
                name="value"
                defaultValue={qrUrl}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="输入二维码图片地址"
              />
            </div>
            <button className="px-4 py-2 rounded-md bg-primary text-white">保存</button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>课程小助手微信号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wechatId && (
            <div className="text-sm text-muted-foreground">{wechatId}</div>
          )}
          <form method="POST" action="/api/admin/site-config" className="space-y-3">
            <input type="hidden" name="key" value="assistantWechatId" />
            <div>
              <label className="block text-sm font-medium mb-1">微信号</label>
              <input
                name="value"
                defaultValue={wechatId}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="输入微信号"
              />
            </div>
            <button className="px-4 py-2 rounded-md bg-primary text-white">保存</button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
