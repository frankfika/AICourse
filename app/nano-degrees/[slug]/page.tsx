import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
    title: `${nanoDegree.title} - OpenCSG AI学院`,
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

  // Parse JSON fields
  const parsedNanoDegree = {
    ...nanoDegree,
    skills: typeof nanoDegree.skills === 'string' ? JSON.parse(nanoDegree.skills) : nanoDegree.skills,
    highlights: typeof nanoDegree.highlights === 'string' ? JSON.parse(nanoDegree.highlights) : nanoDegree.highlights,
    prerequisites: typeof nanoDegree.prerequisites === 'string' ? JSON.parse(nanoDegree.prerequisites) : nanoDegree.prerequisites,
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b bg-gray-50/50">
        <div className="container-anthropic py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">首页</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/nano-degrees" className="hover:text-primary transition-colors">专业认证</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">{parsedNanoDegree.title}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 to-white">
        <div className="container-anthropic py-10 sm:py-12">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Left: Info */}
            <div className="lg:col-span-2 space-y-5">
              {/* Meta Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                  <Award className="w-3 h-3" />
                  专业认证
                </span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                  {COURSE_LEVELS[parsedNanoDegree.level as keyof typeof COURSE_LEVELS]}
                </span>
                {parsedNanoDegree.featured && (
                  <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200">
                    🔥 热门项目
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                {parsedNanoDegree.title}
              </h1>

              {/* Description */}
              <p className="text-lg text-muted-foreground leading-relaxed">
                {parsedNanoDegree.shortDescription}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {parsedNanoDegree.courses.length} 门课程
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  {formatDuration(totalDuration)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  {parsedNanoDegree.viewCount.toLocaleString()} 人学习
                </span>
                {parsedNanoDegree.suggestedMonths && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Award className="w-4 h-4 text-primary" />
                    建议 {parsedNanoDegree.suggestedMonths} 个月完成
                  </span>
                )}
              </div>
            </div>

            {/* Right: Purchase Card */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-20 space-y-5 shadow-lg">
                {/* Cover Image */}
                {parsedNanoDegree.coverImage && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 shadow-sm">
                    <Image
                      src={parsedNanoDegree.coverImage}
                      alt={parsedNanoDegree.title}
                      width={400}
                      height={225}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}

                {/* Price */}
                <div className="text-center py-2">
                  {isFree ? (
                    <div className="text-2xl font-bold text-primary mb-1">免费认证</div>
                  ) : (
                    <div className="flex items-baseline justify-center gap-2 mb-1">
                      <div className="text-4xl font-bold text-foreground">¥{parsedNanoDegree.price}</div>
                      {parsedNanoDegree.originalPrice && parsedNanoDegree.originalPrice > parsedNanoDegree.price && (
                        <div className="text-lg text-muted-foreground line-through">
                          ¥{parsedNanoDegree.originalPrice}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {isFree ? '立即开始学习' : '完成所有课程并获得证书'}
                  </div>
                </div>

                {/* Enroll Button */}
                <NanoDegreeEnrollButton
                  nanoDegreeId={parsedNanoDegree.id}
                  nanoDegreeSlug={parsedNanoDegree.slug}
                  price={parsedNanoDegree.price}
                  originalPrice={parsedNanoDegree.originalPrice}
                />

                {/* Features */}
                <div className="pt-4 border-t space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>系统化学习路径</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>获得专业认证证书</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>终身访问学习资料</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="border-t bg-white">
        <div className="container-anthropic py-12 sm:py-16">
          <NanoDegreeDetailTabs
            nanoDegree={parsedNanoDegree}
            courses={parsedNanoDegree.courses}
            faqs={parsedNanoDegree.faqs}
          />
        </div>
      </section>

      {/* Certificate Preview */}
      {parsedNanoDegree.certificateImage && (
        <section className="bg-gradient-to-br from-gray-50 to-white border-t">
          <div className="container-anthropic py-16 sm:py-20">
            <div className="max-w-3xl mx-auto text-center mb-12 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold">获得专业认证</h2>
              <p className="text-lg text-gray-600">
                完成学习路径后，您将获得由 OpenCSG AI学院 颁发的专业认证证书
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
                <Image
                  src={parsedNanoDegree.certificateImage}
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
