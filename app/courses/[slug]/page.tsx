import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { CourseDetailTabs } from '@/components/courses/course-detail-tabs'
import { EnrollButton } from '@/components/courses/enroll-button'
import { ComingSoon } from '@/components/courses/coming-soon'
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
    title: `${course.title} - OpenCSG AI学院`,
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

  // 检查课程是否即将开始
  const isComingSoon = course.startDate && new Date(course.startDate) > new Date()
  
  // 如果课程即将开始，显示 Coming Soon 页面
  if (isComingSoon) {
    return (
      <ComingSoon
        courseId={course.id}
        courseTitle={course.title}
        startDate={course.startDate!}
        shortDescription={course.shortDescription}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b bg-gray-50/50">
        <div className="container-anthropic py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">首页</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/courses" className="hover:text-primary transition-colors">课程</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">{course.category.name}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 to-white">
        <div className="container-anthropic py-10 sm:py-12">
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Left: Course Info */}
            <div className="lg:col-span-2 space-y-5">
              {/* Meta Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                  {course.category.name}
                </span>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                </span>
              {course.featured && (
                  <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200">
                    🔥 热门课程
                  </span>
              )}
            </div>

            {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              {course.title}
            </h1>

            {/* Description */}
              <p className="text-lg text-muted-foreground leading-relaxed">
              {course.shortDescription}
            </p>

              {/* Instructor & Stats */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                    {course.instructor.name.charAt(0)}
              </div>
              <div>
                    <div className="text-xs text-muted-foreground">授课讲师</div>
                    <div className="font-semibold text-base">{course.instructor.name}</div>
              </div>
            </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    {formatDuration(course.duration)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {course.chapters.length} 个章节
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    {course.viewCount.toLocaleString()} 人学习
                  </span>
              </div>
              </div>
            </div>

            {/* Right: Purchase Card */}
            <div className="lg:col-span-1">
              <div className="anthropic-card p-6 sticky top-20 space-y-5 shadow-lg">
                {/* Cover Image */}
                {course.coverImage && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 shadow-sm">
                    <Image
                      src={course.coverImage}
                      alt={course.title}
                      width={400}
                      height={225}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}

                {/* Price */}
                <div className="text-center py-2">
                {isFree ? (
                    <div className="text-2xl font-bold text-primary mb-1">免费课程</div>
                ) : (
                    <div className="flex items-baseline justify-center gap-2 mb-1">
                      <div className="text-4xl font-bold text-foreground">¥{course.price}</div>
                    {course.originalPrice && course.originalPrice > course.price && (
                        <div className="text-lg text-muted-foreground line-through">
                        ¥{course.originalPrice}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {isFree ? '立即开始学习' : '一次购买，终身访问'}
                </div>
              </div>

                {/* Enroll Button */}
                <EnrollButton
                  courseId={course.id}
                  courseSlug={course.slug}
                  price={course.price}
                  originalPrice={course.originalPrice}
                />

                {/* Features */}
                <div className="pt-4 border-t space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>随时随地在线学习</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>完成学习获得证书</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>30天无理由退款</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content */}
      <section className="border-t bg-white">
        <div className="container-anthropic py-12 sm:py-16">
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
