import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminSettingsPage() {
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
            <p className="text-muted-foreground">CourseAI</p>
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
    </div>
  )
}
