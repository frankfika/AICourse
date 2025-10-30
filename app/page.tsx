import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Clock, Users } from 'lucide-react'
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
      {/* Hero Section - Premium Design: Large, impactful, elegant */}
      <section className="section-padding-lg hero-gradient overflow-hidden">
        <div className="container-anthropic">
          <div className="max-w-5xl space-y-12">
            {/* Eyebrow with animation hint */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-sm font-semibold tracking-wide text-foreground/80">
                AI 在线学习平台
              </span>
            </div>

            {/* Main Heading - Larger, bolder */}
            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-[1.1]">
              掌握 AI
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/80 bg-clip-text text-transparent">
                从这里开始
              </span>
            </h1>

            {/* Subtitle - Better hierarchy */}
            <p className="text-xl sm:text-2xl md:text-3xl text-muted-foreground/90 max-w-3xl leading-relaxed font-light">
              系统化的课程体系，专业的讲师团队，助你在 AI 领域不断成长
            </p>

            {/* CTA Buttons - More prominent */}
            <div className="flex flex-col sm:flex-row gap-5 pt-8">
              <Link href="/courses" className="anthropic-button text-base">
                探索课程
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/nano-degrees" className="anthropic-button-secondary text-base">
                查看认证项目
              </Link>
            </div>

            {/* Stats - More refined */}
            <div className="flex flex-wrap gap-x-16 gap-y-8 pt-16 border-t border-border/40">
              <div className="space-y-2">
                <div className="stat-number text-5xl font-bold">{coursesCount}+</div>
                <div className="stat-label text-base">精品课程</div>
              </div>
              <div className="space-y-2">
                <div className="stat-number text-5xl font-bold">{nanoDegreesCount}+</div>
                <div className="stat-label text-base">认证项目</div>
              </div>
              <div className="space-y-2">
                <div className="stat-number text-5xl font-bold">{instructorsCount}+</div>
                <div className="stat-label text-base">专业讲师</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="section-padding section-divider">
        <div className="container-anthropic">
          <div className="max-w-3xl mb-20">
            <h2 className="mb-6 text-4xl sm:text-5xl font-bold tracking-tight">探索学习方向</h2>
            <p className="text-xl text-muted-foreground/90 leading-relaxed">
              从基础到进阶，覆盖 AI 领域的各个方向
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/courses?category=${category.slug}`}
                className="group anthropic-card p-10 block hover:scale-[1.02] transition-all duration-500"
              >
                <div className="text-5xl mb-8 transform group-hover:scale-110 transition-transform duration-500">{category.icon}</div>
                <h3 className="text-2xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                  {category.name}
                </h3>
                <p className="text-sm text-muted-foreground/80 font-medium">
                  {category._count.courses} 门课程
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="section-padding section-divider">
        <div className="container-anthropic">
          <div className="flex items-end justify-between mb-20">
            <div className="max-w-3xl">
              <h2 className="mb-6 text-4xl sm:text-5xl font-bold tracking-tight">精选课程</h2>
              <p className="text-xl text-muted-foreground/90 leading-relaxed">
                由行业专家精心打造的高质量课程
              </p>
            </div>
            <Link
              href="/courses"
              className="hidden lg:flex items-center gap-3 text-foreground hover:text-primary transition-all group font-medium text-lg"
            >
              查看全部
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuredCourses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="group block"
              >
                <div className="anthropic-card overflow-hidden h-full flex flex-col">
                  {/* Image */}
                  <div className="image-container aspect-[16/9] relative overflow-hidden">
                    <Image
                      src={course.coverImage}
                      alt={course.title}
                      fill
                      className="object-cover"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-5 flex flex-col flex-grow">
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant="outline" className="anthropic-badge font-semibold">
                        {course.category.name}
                      </Badge>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-muted-foreground/80 font-medium">{COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-semibold group-hover:text-primary transition-colors duration-300 line-clamp-2 leading-tight">
                      {course.title}
                    </h3>

                    {/* Description */}
                    <p className="text-base text-muted-foreground/80 line-clamp-2 leading-relaxed flex-grow">
                      {course.shortDescription}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-5 border-t border-border/50">
                      <span className="text-sm text-muted-foreground/80 font-medium">
                        {course.instructor.name}
                      </span>
                      {course.price === 0 ? (
                        <span className="text-base font-semibold text-primary">免费</span>
                      ) : (
                        <span className="text-base font-semibold">¥{course.price}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="text-center mt-12 lg:hidden">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors group"
            >
              查看全部课程
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* Nano Degrees */}
      {featuredNanoDegrees.length > 0 && (
        <section className="section-padding section-divider bg-muted/30">
          <div className="container-anthropic">
            <div className="max-w-3xl mb-16">
              <h2 className="mb-4">专业认证项目</h2>
              <p className="text-lg text-muted-foreground">
                系统化的学习路径，完成后获得权威认证证书
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredNanoDegrees.map((nanoDegree) => (
                <Link
                  key={nanoDegree.id}
                  href={`/nano-degrees/${nanoDegree.slug}`}
                  className="group block"
                >
                  <div className="anthropic-card p-8 h-full flex flex-col">
                    {/* Badge */}
                    <Badge className="anthropic-badge w-fit mb-6">
                      专业认证
                    </Badge>

                    {/* Title */}
                    <h3 className="text-2xl mb-4 group-hover:text-primary transition-colors">
                      {nanoDegree.title}
                    </h3>

                    {/* Description */}
                    <p className="text-muted-foreground mb-6 flex-grow line-clamp-3">
                      {nanoDegree.shortDescription}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-6 border-t border-border/60">
                      <span className="text-sm text-muted-foreground">
                        {nanoDegree._count.courses} 门课程
                      </span>
                      {nanoDegree.price === 0 ? (
                        <span className="text-sm font-medium">免费</span>
                      ) : (
                        <span className="text-sm font-medium">¥{nanoDegree.price}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA Section */}
      <section className="section-padding section-divider">
        <div className="container-anthropic">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl sm:text-5xl md:text-6xl">
              开启你的 AI 学习之旅
            </h2>
            <p className="text-xl text-muted-foreground">
              加入数千名学员，一起探索人工智能的无限可能
            </p>
            <div className="pt-4">
              <Link href="/courses" className="anthropic-button">
                立即开始学习
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
