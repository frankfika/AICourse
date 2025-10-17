import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export const metadata = {
  title: '课程管理 - CourseAI 后台',
}

export default async function AdminCoursesPage() {
  const courses = await prisma.course.findMany({
    include: {
      category: true,
      instructor: true,
      _count: {
        select: {
          chapters: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">课程管理</h1>
          <p className="text-muted-foreground">管理所有课程</p>
        </div>
        <Link href="/admin/courses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建课程
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>课程列表 ({courses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">课程名称</th>
                  <th className="text-left py-3 px-4">分类</th>
                  <th className="text-left py-3 px-4">讲师</th>
                  <th className="text-left py-3 px-4">难度</th>
                  <th className="text-left py-3 px-4">章节数</th>
                  <th className="text-left py-3 px-4">浏览量</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">更新时间</th>
                  <th className="text-right py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium max-w-xs truncate">
                        {course.title}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{course.category.name}</Badge>
                    </td>
                    <td className="py-3 px-4">{course.instructor.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{course._count.chapters}</td>
                    <td className="py-3 px-4">{course.viewCount}</td>
                    <td className="py-3 px-4">
                      {course.status === 'published' ? (
                        <Badge className="bg-green-500">已发布</Badge>
                      ) : (
                        <Badge variant="secondary">草稿</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(course.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/courses/${course.slug}`} target="_blank">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/courses/${course.id}/edit`}>
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

