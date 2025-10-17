import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Award, Users, TrendingUp, ArrowRight, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export default async function HomePage() {
  // Fetch data
  const [banners, categories, featuredCourses, featuredNanoDegrees, stats] =
    await Promise.all([
      prisma.banner.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        take: 3,
      }),
      prisma.category.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { courses: true } },
        },
      }),
      prisma.course.findMany({
        where: { status: 'published', featured: true },
        include: {
          category: true,
          instructor: true,
        },
        orderBy: { viewCount: 'desc' },
        take: 6,
      }),
      prisma.nanoDegree.findMany({
        where: { status: 'published', featured: true },
        include: {
          _count: { select: { courses: true } },
        },
        orderBy: { viewCount: 'desc' },
        take: 3,
      }),
      prisma.$transaction([
        prisma.course.count({ where: { status: 'published' } }),
        prisma.nanoDegree.count({ where: { status: 'published' } }),
        prisma.instructor.count(),
      ]),
    ])

  const [coursesCount, nanoDegreesCount, instructorsCount] = stats

  return (
    <div>
      {/* Hero Section with Banner */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              探索 AI 的无限可能
            </h1>
            <p className="text-xl mb-8 opacity-90">
              精选优质课程，系统化学习路径，助力你成为 AI 领域专家
            </p>
            <div className="flex gap-4">
              <Link href="/courses">
                <Button size="lg" variant="secondary">
                  浏览课程
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/nano-degrees">
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/20">
                  查看认证项目
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <BookOpen className="h-12 w-12 text-blue-500" />
              </div>
              <div className="text-4xl font-bold mb-2">{coursesCount}+</div>
              <div className="text-muted-foreground">精品课程</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <Award className="h-12 w-12 text-purple-500" />
              </div>
              <div className="text-4xl font-bold mb-2">{nanoDegreesCount}+</div>
              <div className="text-muted-foreground">专业认证</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <Users className="h-12 w-12 text-green-500" />
              </div>
              <div className="text-4xl font-bold mb-2">{instructorsCount}+</div>
              <div className="text-muted-foreground">资深讲师</div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">课程分类</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link key={category.id} href={`/courses?category=${category.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold mb-2">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category._count.courses} 门课程
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">热门课程</h2>
            <Link href="/courses">
              <Button variant="ghost">
                查看全部 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCourses.map((course) => (
              <Link key={course.id} href={`/courses/${course.slug}`}>
                <Card className="h-full hover:shadow-xl transition-shadow">
                  <CardHeader className="p-0">
                    <div className="relative w-full h-48">
                      <Image
                        src={course.coverImage}
                        alt={course.title}
                        fill
                        className="object-cover rounded-t-lg"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{course.category.name}</Badge>
                      <Badge variant="outline">
                        {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                    </div>
                    <CardTitle className="mb-2 line-clamp-2 text-lg">
                      {course.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {course.shortDescription}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {course.instructor.name}
                      </span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(course.duration)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Nano Degrees */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">专业认证项目</h2>
              <p className="text-muted-foreground">
                系统化学习路径，获得行业认可的专业认证
              </p>
            </div>
            <Link href="/nano-degrees">
              <Button variant="ghost">
                查看全部 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredNanoDegrees.map((nd) => (
              <Link key={nd.id} href={`/nano-degrees/${nd.slug}`}>
                <Card className="h-full hover:shadow-xl transition-shadow">
                  <CardHeader className="p-0">
                    <div className="relative w-full h-56">
                      <Image
                        src={nd.coverImage}
                        alt={nd.title}
                        fill
                        className="object-cover rounded-t-lg"
                      />
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-yellow-500 text-white">
                          <Award className="h-4 w-4 mr-1" />
                          认证
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <CardTitle className="mb-3 line-clamp-2">{nd.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {nd.shortDescription}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {nd._count.courses} 门课程
                      </span>
                      <Badge variant="outline">
                        {COURSE_LEVELS[nd.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">开启你的 AI 学习之旅</h2>
          <p className="text-xl mb-8 opacity-90">
            立即开始学习，掌握前沿 AI 技术
          </p>
          <Link href="/courses">
            <Button size="lg" variant="secondary">
              立即开始
              <TrendingUp className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
