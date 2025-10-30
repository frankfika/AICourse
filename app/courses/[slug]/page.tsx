import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CourseDetailTabs } from '@/components/courses/course-detail-tabs'
import { EnrollButton } from '@/components/courses/enroll-button'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Clock, BookOpen, Users, ChevronRight } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await prisma.course.findUnique({
    where: { slug },
  })

  if (!course) {
    return {
      title: '课程未找到',
    }
  }

  return {
    title: `${course.title} - CourseAI`,
    description: course.shortDescription,
  }
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await prisma.course.findUnique({
    where: { slug, status: 'published' },
    include: {
      category: true,
      instructor: true,
      chapters: {
        orderBy: { order: 'asc' },
      },
      faqs: {
        orderBy: { order: 'asc' },
      },
      nanoDegreeCourses: {
        include: {
          nanoDegree: true,
        },
      },
    },
  })

  if (!course) {
    notFound()
  }

  // Increment view count
  await prisma.course.update({
    where: { id: course.id },
    data: { viewCount: { increment: 1 } },
  })

  // Get related courses
  const relatedCourses = await prisma.course.findMany({
    where: {
      categoryId: course.categoryId,
      status: 'published',
      id: { not: course.id },
    },
    include: {
      instructor: true,
      category: true,
    },
    take: 3,
  })

  const isFree = course.price === 0

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
            <Link href="/courses" className="text-muted-foreground hover:text-primary transition-colors">
              课程
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground">{course.category.name}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="hero-gradient">
        <div className="container-anthropic py-16 sm:py-20 md:py-24">
          <div className="max-w-4xl">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge className="anthropic-badge">{course.category.name}</Badge>
              <Badge className="anthropic-badge">
                {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
              </Badge>
              {course.featured && (
                <Badge className="anthropic-badge">热门</Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl mb-6">
              {course.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-muted-foreground mb-10 max-w-3xl">
              {course.shortDescription}
            </p>

            {/* Instructor */}
            <div className="flex items-center gap-4 mb-10">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted">
                {course.instructor.avatar ? (
                  <Image
                    src={course.instructor.avatar}
                    alt={course.instructor.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-medium">
                    {course.instructor.name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">授课讲师</div>
                <div className="font-medium">{course.instructor.name}</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mb-10 pb-10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{formatDuration(course.duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{course.chapters.length} 章节</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">{course.viewCount.toLocaleString()} 学生</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div>
                {isFree ? (
                  <div className="text-3xl font-medium mb-2">免费课程</div>
                ) : (
                  <div className="flex items-baseline gap-3 mb-2">
                    <div className="text-4xl font-medium">¥{course.price}</div>
                    {course.originalPrice && course.originalPrice > course.price && (
                      <div className="text-xl text-muted-foreground line-through">
                        ¥{course.originalPrice}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {isFree ? '立即开始学习' : '一次购买，终身访问'}
                </div>
              </div>

              <div className="flex-shrink-0">
                <EnrollButton
                  courseId={course.id}
                  courseSlug={course.slug}
                  price={course.price}
                  originalPrice={course.originalPrice}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cover Image */}
      {course.coverImage && (
        <section className="section-divider">
          <div className="container-anthropic py-12">
            <div className="image-container aspect-video max-w-4xl">
              <Image
                src={course.coverImage}
                alt={course.title}
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* Course Content */}
      <section className="section-divider">
        <div className="container-anthropic py-16 sm:py-20">
          <CourseDetailTabs
            course={course}
            chapters={course.chapters}
            faqs={course.faqs}
            relatedCourses={relatedCourses}
          />
        </div>
      </section>
    </div>
  )
}
