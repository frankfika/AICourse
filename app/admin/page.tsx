import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Award, Users, Eye } from 'lucide-react'

export const metadata = {
  title: '仪表盘 - CourseAI 后台',
}

export default async function AdminDashboard() {
  // Fetch statistics
  const [
    coursesCount,
    nanoDegreesCount,
    instructorsCount,
    totalViews,
    recentCourses,
    popularCourses,
  ] = await Promise.all([
    prisma.course.count(),
    prisma.nanoDegree.count(),
    prisma.instructor.count(),
    prisma.course.aggregate({
      _sum: { viewCount: true },
    }),
    prisma.course.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { category: true, instructor: true },
    }),
    prisma.course.findMany({
      take: 5,
      orderBy: { viewCount: 'desc' },
      include: { category: true },
    }),
  ])

  const stats = [
    {
      title: '课程总数',
      value: coursesCount,
      icon: BookOpen,
      description: '全部课程',
    },
    {
      title: 'Nano Degree',
      value: nanoDegreesCount,
      icon: Award,
      description: '认证项目',
    },
    {
      title: '讲师数量',
      value: instructorsCount,
      icon: Users,
      description: '平台讲师',
    },
    {
      title: '总浏览量',
      value: totalViews._sum.viewCount || 0,
      icon: Eye,
      description: '课程浏览',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来！以下是平台数据概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Courses */}
        <Card>
          <CardHeader>
            <CardTitle>最新课程</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium line-clamp-1">{course.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.category.name} · {course.instructor.name}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground ml-4">
                    {course.viewCount} 浏览
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Popular Courses */}
        <Card>
          <CardHeader>
            <CardTitle>热门课程</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {popularCourses.map((course, index) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium line-clamp-1">{course.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {course.category.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold ml-4">
                    {course.viewCount}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

