import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Clock, TrendingUp, Play } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export const metadata = {
  title: '我的课程 - OpenCSG AI学院',
  description: '管理您已报名的课程',
}

export default async function MyCoursesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          category: true,
          instructor: true,
          chapters: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  })

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-custom">
        <div className="mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">我的课程</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            继续您的学习之旅
          </p>
        </div>

        {enrollments.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              还没有报名任何课程
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              浏览我们的课程库，开始学习吧！
            </p>
            <Link href="/courses">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
                浏览课程
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {enrollments.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/learn/${enrollment.course.slug}`}
              >
                <Card className="modern-card group h-full overflow-hidden rounded-3xl border-0 shadow-lg">
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={enrollment.course.coverImage}
                      alt={enrollment.course.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-white/90 text-gray-900">
                          {enrollment.course.category.name}
                        </Badge>
                        <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-white text-sm font-medium">
                            {enrollment.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {COURSE_LEVELS[enrollment.course.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(enrollment.course.duration)}
                      </div>
                    </div>

                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {enrollment.course.title}
                    </h3>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${enrollment.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {enrollment.course.instructor.name}
                      </span>
                      <Button size="sm" className="gap-2">
                        <Play className="h-4 w-4" />
                        继续学习
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
