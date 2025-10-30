import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export const metadata = {
  title: 'Nano Degree 认证项目 - CourseAI',
  description: '专业的 AI 学习路径和认证项目',
}

export default async function NanoDegreesPage() {
  const nanoDegrees = await prisma.nanoDegree.findMany({
    where: { status: 'published' },
    include: {
      courses: {
        include: {
          course: true,
        },
      },
    },
    orderBy: { viewCount: 'desc' },
  })

  return (
    <div className="min-h-screen">
      {/* Hero Section - Anthropic Style */}
      <section className="section-divider hero-gradient">
        <div className="container-anthropic py-20 sm:py-24 md:py-32">
          <div className="max-w-3xl space-y-6">
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              专业认证
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl">
              认证项目
            </h1>
            <p className="text-xl text-muted-foreground">
              系统化的学习路径，完成后获得行业认可的专业认证
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container-anthropic section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {nanoDegrees.map((nd) => {
          const totalDuration = nd.courses.reduce(
            (sum, c) => sum + c.course.duration,
            0
          )
          return (
            <Link key={nd.id} href={`/nano-degrees/${nd.slug}`} className="group block">
              <div className="anthropic-card overflow-hidden h-full">
                <div className="image-container aspect-[4/3]">
                  <Image
                    src={nd.coverImage}
                    alt={nd.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="anthropic-badge">专业认证</span>
                    {nd.featured && (
                      <span className="anthropic-badge">热门</span>
                    )}
                  </div>
                  <h3 className="text-xl font-medium group-hover:text-primary transition-colors line-clamp-2">
                    {nd.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {nd.shortDescription}
                  </p>
                  <div className="flex items-center justify-between text-sm pt-3 border-t border-border/60">
                    <span className="text-muted-foreground">{nd.courses.length} 门课程</span>
                    <span className="text-muted-foreground">{formatDuration(totalDuration)}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
        </div>
      </div>
    </div>
  )
}

