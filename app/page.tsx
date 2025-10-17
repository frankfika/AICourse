import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Award, Users, ArrowRight, Clock, TrendingUp, Sparkles } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export default async function HomePage() {
  // Fetch data
  const [categories, featuredCourses, featuredNanoDegrees, stats] =
    await Promise.all([
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
    <div className="min-h-screen">
      {/* Hero Section - Apple style */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 animated-gradient opacity-10"></div>
        
        {/* Floating Shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="container-custom relative z-10 pt-32 pb-20">
          <div className="max-w-5xl mx-auto text-center space-y-8 fade-in">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 px-6 py-3 rounded-full border border-blue-200 dark:border-blue-800">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                开启你的 AI 学习之旅
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
              探索 AI 的
              <span className="block gradient-text">无限可能</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              精选优质课程，系统化学习路径
              <br className="hidden md:block" />
              助力你成为 AI 领域的专家
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Link href="/courses">
                <Button 
                  size="lg" 
                  className="modern-button px-8 py-6 text-lg rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
                >
                  浏览课程
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/nano-degrees">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="modern-button px-8 py-6 text-lg rounded-2xl border-2 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  查看认证项目
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-16">
              <div className="space-y-2">
                <div className="text-4xl font-bold gradient-text">{coursesCount}+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">精品课程</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold gradient-text">{nanoDegreesCount}+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">专业认证</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold gradient-text">{instructorsCount}+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">资深讲师</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gray-400 dark:border-gray-600 rounded-full p-1">
            <div className="w-1.5 h-3 bg-gray-400 dark:bg-gray-600 rounded-full mx-auto"></div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="section-padding bg-gray-50 dark:bg-gray-900">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">探索学习领域</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              从基础到进阶，覆盖 AI 技术全栈
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {categories.map((category, index) => (
              <Link key={category.id} href={`/courses?category=${category.slug}`}>
                <Card className="modern-card group cursor-pointer h-full border-2 hover:border-blue-500 dark:hover:border-blue-600 rounded-2xl">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold group-hover:scale-110 transition-transform">
                      {index + 1}
                    </div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
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
      <section className="section-padding">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-16">
            <div>
              <h2 className="text-5xl font-bold mb-4">热门课程</h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                精选最受欢迎的 AI 课程
              </p>
            </div>
            <Link href="/courses">
              <Button variant="ghost" size="lg" className="group">
                查看全部 
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCourses.map((course) => (
              <Link key={course.id} href={`/courses/${course.slug}`}>
                <Card className="modern-card group h-full overflow-hidden rounded-3xl border-0 shadow-lg">
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={course.coverImage}
                      alt={course.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-white/90 text-gray-900 hover:bg-white">
                        {course.category.name}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(course.duration)}
                      </div>
                    </div>
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                      {course.shortDescription}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {course.instructor.name}
                      </span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Nano Degrees */}
      <section className="section-padding bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">专业认证项目</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              系统化学习路径，完成后获得行业认可的专业认证
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredNanoDegrees.map((nd) => (
              <Link key={nd.id} href={`/nano-degrees/${nd.slug}`}>
                <Card className="modern-card group h-full overflow-hidden rounded-3xl border-0 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={nd.coverImage}
                      alt={nd.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
                        <Award className="h-4 w-4 mr-1" />
                        认证
                      </Badge>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <Badge variant="outline" className="bg-white/90 text-gray-900 border-0">
                        {COURSE_LEVELS[nd.level as keyof typeof COURSE_LEVELS]}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {nd.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-3">
                      {nd.shortDescription}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <BookOpen className="h-4 w-4 mr-1" />
                        {nd._count.courses} 门课程
                      </div>
                      <ArrowRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/nano-degrees">
              <Button 
                size="lg" 
                className="modern-button px-8 py-6 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
              >
                查看所有认证项目
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        
        <div className="container-custom relative z-10 text-center text-white">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-5xl md:text-6xl font-bold">
              准备好开始学习了吗？
            </h2>
            <p className="text-xl md:text-2xl opacity-90">
              立即加入，开启你的 AI 职业生涯
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Link href="/courses">
                <Button 
                  size="lg" 
                  className="modern-button px-8 py-6 text-lg rounded-2xl bg-white text-gray-900 hover:bg-gray-100 shadow-xl"
                >
                  立即开始
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
