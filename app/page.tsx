import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Play, Users, BookOpen, Award } from 'lucide-react'
import { FadeIn, StaggerContainer, MotionItem, slideUpVariants } from '@/components/ui/motion-wrapper'
import { Counter } from '@/components/ui/counter'

export default async function HomePage() {
  // Fetch data
  const [featuredCourses, stats] = await Promise.all([
      prisma.course.findMany({
        where: { status: 'published', featured: true },
        include: {
          category: true,
          instructor: true,
        },
        orderBy: { viewCount: 'desc' },
        take: 3,
      }),
      prisma.$transaction([
        prisma.course.count({ where: { status: 'published' } }),
        prisma.user.count(),
        prisma.nanoDegree.count({ where: { status: 'published' } }),
      ]),
    ])

  const [coursesCount, usersCount, nanoDegreesCount] = stats

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - 创新布局 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50/30 via-white to-green-50/20">
        {/* 装饰背景 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-emerald-400/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container-anthropic relative py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* 左侧：文字内容 */}
            <div className="space-y-10">
              {/* 标签 */}
              <FadeIn delay={0.1} direction="down">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">AI 驱动学习</span>
                </div>
              </FadeIn>

              {/* 标题 */}
              <div className="space-y-6">
                <FadeIn delay={0.2} direction="left">
                  <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">
                    <span className="block text-gray-900">掌握 AI</span>
                    <span className="block bg-gradient-to-r from-primary via-emerald-500 to-green-500 bg-clip-text text-transparent">
                      改变未来
                    </span>
                  </h1>
                </FadeIn>

                <FadeIn delay={0.3} direction="left">
                  <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                    系统化课程体系，顶尖讲师团队，实战项目驱动，助力你成为 AI 领域专家
                  </p>
                </FadeIn>
              </div>

              {/* 按钮 */}
              <FadeIn delay={0.4} direction="up">
                <div className="flex flex-wrap items-center gap-4">
                  <Link 
                    href="/courses" 
                    className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-emerald-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
                  >
                    <Play className="w-5 h-5" fill="white" />
                    <span>开始学习</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  
                  <Link 
                    href="/nano-degrees" 
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-900 text-lg font-bold rounded-2xl hover:border-primary/30 hover:bg-gray-50 transition-all duration-300"
                  >
                    <Award className="w-5 h-5 text-primary" />
                    <span>认证项目</span>
                  </Link>
                </div>
              </FadeIn>
            </div>

            {/* 右侧：视觉元素 */}
            <div className="relative">
              {/* 统计卡片组 - 创新布局 */}
              <FadeIn delay={0.5} direction="right">
                <div className="relative space-y-4">
                  {/* 第一行 */}
                  <div className="flex gap-4">
                    <div className="flex-1 group relative overflow-hidden bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 border-2 border-gray-100 hover:border-primary/30 transition-all hover:-translate-y-1">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
                      <div className="relative">
                        <div className="text-5xl font-black text-gray-900 mb-2">
                          <Counter value={coursesCount} />
                        </div>
                        <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider">精品课程</div>
                      </div>
                    </div>
                    
                    <div className="flex-1 group relative overflow-hidden bg-gradient-to-br from-primary/5 to-emerald-50/50 rounded-3xl p-8 border-2 border-primary/20 hover:border-primary/40 transition-all hover:-translate-y-1">
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full -ml-16 -mb-16"></div>
                      <div className="relative">
                        <div className="text-5xl font-black bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent mb-2 flex items-center gap-1">
                          <Counter value={usersCount} />+
                        </div>
                        <div className="text-sm font-semibold text-primary uppercase tracking-wider">活跃学员</div>
                      </div>
                    </div>
                  </div>

                  {/* 第二行 */}
                  <div className="flex gap-4">
                    <div className="flex-1 group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50/50 rounded-3xl p-8 border-2 border-emerald-200/50 hover:border-emerald-400/50 transition-all hover:-translate-y-1">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-400/10 rounded-full -ml-16 -mt-16"></div>
                      <div className="relative">
                        <div className="text-5xl font-black text-emerald-700 mb-2">
                          <Counter value={nanoDegreesCount} />
                        </div>
                        <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">认证项目</div>
                      </div>
                    </div>

                    <div className="flex-1 group relative overflow-hidden bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 border-2 border-gray-100 hover:border-primary/30 transition-all hover:-translate-y-1">
                      <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-400/5 rounded-full -mr-16 -mb-16"></div>
                      <div className="relative">
                        <div className="text-5xl font-black text-gray-900 mb-2">100%</div>
                        <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider">实战项目</div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* 精选课程 - 紧凑列表 */}
      <section className="py-16 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="container-anthropic">
          <FadeIn direction="up">
            <div className="flex items-end justify-between mb-10">
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900">精选课程</h2>
                <p className="text-base text-gray-600">
                  热门 AI 课程推荐
                </p>
              </div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 text-primary hover:gap-3 transition-all font-semibold group"
              >
                <span>查看全部</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </FadeIn>

          {/* 紧凑课程列表 */}
          <StaggerContainer className="space-y-4">
            {featuredCourses.map((course, idx) => {
              const isComingSoon = course.startDate && new Date(course.startDate) > new Date()
              
              return (
              <MotionItem
                variants={slideUpVariants}
                key={course.id}
              >
                <Link href={`/courses/${course.slug}`} className="group relative block">
                  <div className="relative bg-white rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-primary/30 transition-all hover:shadow-xl">
                    <div className="grid md:grid-cols-5 gap-0">
                      {/* 左侧：文字内容 */}
                      <div className="md:col-span-3 p-6 flex flex-col justify-center">
                        <div className="space-y-3">
                          {/* 标签和序号 */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20">
                              <span className="text-sm font-black text-primary">{idx + 1}</span>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                              {course.category.name}
                            </span>
                            {isComingSoon && (
                              <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">
                                即将开始
                              </span>
                            )}
                            {course.price === 0 && (
                              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                免费
                              </span>
                            )}
                          </div>

                          {/* 标题 */}
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-primary transition-colors leading-tight">
                            {course.title}
                          </h3>

                          {/* 底部信息 */}
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-primary" />
                              <span className="font-medium">{course.viewCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4 text-primary" />
                              <span className="font-medium">{course.instructor.name}</span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-primary ml-auto group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* 右侧：封面图 */}
                      <div className="md:col-span-2 relative">
                        <div className="aspect-video md:aspect-auto md:absolute md:inset-0 bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                          <Image
                            src={course.coverImage}
                            alt={course.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </MotionItem>
              )
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden bg-gradient-to-br from-primary/5 via-emerald-50/30 to-green-50/20">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="container-anthropic relative">
          <FadeIn direction="up">
            <div className="max-w-4xl mx-auto text-center space-y-10">
              <div className="space-y-6">
                <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900">
                  开启你的 AI 之旅
                </h2>
                <p className="text-2xl text-gray-600 max-w-2xl mx-auto">
                  立即加入，掌握未来核心技能
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Link
                  href="/courses" 
                  className="group inline-flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-primary to-emerald-600 text-white text-xl font-bold rounded-2xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:scale-105"
                >
                  <span>立即开始</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
