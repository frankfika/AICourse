import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export const metadata = {
  title: 'Nano Degree 管理 - CourseAI 后台',
}

export default async function AdminNanoDegreesPage() {
  const nanoDegrees = await prisma.nanoDegree.findMany({
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nano Degree 管理</h1>
          <p className="text-muted-foreground">管理所有 Nano Degree 项目</p>
        </div>
        <Link href="/admin/nano-degrees/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建 Nano Degree
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nano Degree 列表 ({nanoDegrees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">项目名称</th>
                  <th className="text-left py-3 px-4">难度</th>
                  <th className="text-left py-3 px-4">课程数</th>
                  <th className="text-left py-3 px-4">浏览量</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">更新时间</th>
                  <th className="text-right py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {nanoDegrees.map((nd) => (
                  <tr key={nd.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium max-w-md truncate">
                        {nd.title}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {COURSE_LEVELS[nd.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{nd._count.courses} 门</td>
                    <td className="py-3 px-4">{nd.viewCount}</td>
                    <td className="py-3 px-4">
                      {nd.status === 'published' ? (
                        <Badge className="bg-green-500">已发布</Badge>
                      ) : (
                        <Badge variant="secondary">草稿</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(nd.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/nano-degrees/${nd.slug}`} target="_blank">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/nano-degrees/${nd.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

