import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { NanoDegreeDetailTabs } from '@/components/nano-degrees/nanodegree-detail-tabs'
import { NanoDegreeEnrollButton } from '@/components/nano-degrees/nanodegree-enroll-button'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Clock, BookOpen, Users, ChevronRight, Award } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const nanoDegree = await prisma.nanoDegree.findUnique({
    where: { slug },
  })

  if (!nanoDegree) {
    return { title: 'Nano Degree 未找到' }
  }

  return {
    title: `${nanoDegree.title} - CourseAI`,
    description: nanoDegree.shortDescription,
  }
}

export default async function NanoDegreeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const nanoDegree = await prisma.nanoDegree.findUnique({
    where: { slug, status: 'published' },
    include: {
      courses: {
        include: {
          course: {
            include: {
              instructor: true,
              category: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      faqs: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!nanoDegree) {
    notFound()
  }

  // Increment view count
  await prisma.nanoDegree.update({
    where: { id: nanoDegree.id },
    data: { viewCount: { increment: 1 } },
  })

  const totalDuration = nanoDegree.courses.reduce(
    (sum, c) => sum + c.course.duration,
    0
  )

  const isFree = nanoDegree.price === 0

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="section-divider bg-muted/30">
        <div className="container-anthropic py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              首页
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <Link href="/nano-degrees" className="text-muted-foreground hover:text-primary transition-colors">
              专业认证
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground">{nanoDegree.title}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="hero-gradient">
        <div className="container-anthropic py-16 sm:py-20 md:py-24">
          <div className="max-w-4xl">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge className="anthropic-badge">
                <Award className="w-3 h-3 mr-1.5" />
                专业认证
              </Badge>
              <Badge className="anthropic-badge">
                {COURSE_LEVELS[nanoDegree.level as keyof typeof COURSE_LEVELS]}
              </Badge>
              {nanoDegree.featured && (
                <Badge className="anthropic-badge" variant="primary">热门</Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl mb-6">
              {nanoDegree.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-muted-foreground mb-10 max-w-3xl">
              {nanoDegree.shortDescription}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mb-10 pb-10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{nanoDegree.courses.length} 门课程</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{nanoDegree.viewCount.toLocaleString()} 学生</span>
              </div>
              {nanoDegree.suggestedMonths && (
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground">建议 {nanoDegree.suggestedMonths} 个月完成</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div>
                {isFree ? (
                  <div className="text-3xl font-medium mb-2">免费认证</div>
                ) : (
                  <div className="flex items-baseline gap-3 mb-2">
                    <div className="text-4xl font-medium">¥{nanoDegree.price}</div>
                    {nanoDegree.originalPrice && nanoDegree.originalPrice > nanoDegree.price && (
                      <div className="text-xl text-muted-foreground line-through">
                        ¥{nanoDegree.originalPrice}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {isFree ? '立即开始学习路径' : '一次购买，完成所有课程并获得证书'}
                </div>
              </div>

              <div className="flex-shrink-0">
                <NanoDegreeEnrollButton
                  nanoDegreeId={nanoDegree.id}
                  nanoDegreeSlug={nanoDegree.slug}
                  price={nanoDegree.price}
                  originalPrice={nanoDegree.originalPrice}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cover Image */}
      {nanoDegree.coverImage && (
        <section className="section-divider">
          <div className="container-anthropic py-12">
            <div className="image-container aspect-video max-w-4xl">
              <Image
                src={nanoDegree.coverImage}
                alt={nanoDegree.title}
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <section className="section-divider">
        <div className="container-anthropic py-16 sm:py-20">
          <NanoDegreeDetailTabs
            nanoDegree={nanoDegree}
            courses={nanoDegree.courses}
            faqs={nanoDegree.faqs}
          />
        </div>
      </section>

      {/* Certificate Preview */}
      {nanoDegree.certificateImage && (
        <section className="section-divider bg-muted/30">
          <div className="container-anthropic section-padding">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="mb-4">获得专业认证</h2>
              <p className="text-lg text-muted-foreground">
                完成学习路径后，您将获得由 CourseAI 颁发的专业认证证书
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="anthropic-card overflow-hidden">
                <Image
                  src={nanoDegree.certificateImage}
                  alt="认证证书"
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
