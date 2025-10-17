import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CourseDetailTabs } from '@/components/courses/course-detail-tabs'
import { formatDuration, formatDate } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Clock, Eye, Calendar, User, BookOpen } from 'lucide-react'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
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
  params: { slug: string }
}) {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug, status: 'published' },
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

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              首页
            </Link>
            <span>/</span>
            <Link href="/courses" className="hover:text-primary">
              课程
            </Link>
            <span>/</span>
            <Link href={`/courses/category/${course.category.slug}`} className="hover:text-primary">
              {course.category.name}
            </Link>
            <span>/</span>
            <span className="text-foreground">{course.title}</span>
          </div>
        </div>
      </div>

      {/* Hero Section - Coursera Style */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Course Info */}
            <div className="lg:col-span-2">
              {/* Breadcrumb and Category */}
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <span>{course.category.name}</span>
                <span>•</span>
                <span>{COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}</span>
                {course.featured && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-medium">热门</span>
                  </>
                )}
              </div>
              
              {/* Title */}
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {course.title}
              </h1>
              
              {/* Description */}
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                {course.shortDescription}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>由 {course.instructor.name} 授课</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(course.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>{course.viewCount.toLocaleString()} 名学生</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>最近更新 {formatDate(course.updatedAt)}</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                  免费注册
                </Button>
                <Button variant="outline" size="lg" className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3">
                  添加到收藏
                </Button>
              </div>
            </div>

            {/* Right: Course Card */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-4">
                {/* Course Image */}
                <div className="relative w-full h-48 rounded-t-lg overflow-hidden">
                  <Image
                    src={course.coverImage}
                    alt={course.title}
                    fill
                    className="object-cover"
                  />
                </div>
                
                {/* Course Info */}
                <div className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-gray-900 mb-1">免费</div>
                    <div className="text-sm text-gray-600">开始学习</div>
                  </div>
                  
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 mb-4">
                    免费注册
                  </Button>
                  
                  <div className="text-xs text-gray-500 text-center space-y-1">
                    {course.suggestedWeeks && (
                      <div>• 建议 {course.suggestedWeeks} 周完成</div>
                    )}
                    <div>• 每周 {course.hoursPerWeek || 5} 小时</div>
                    <div>• 可自定进度</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <CourseDetailTabs
            course={{
              ...course,
              highlights: JSON.parse(course.highlights),
              chapters: course.chapters.map((ch) => ({
                ...ch,
                topics: JSON.parse(ch.topics),
              })),
            }}
            relatedCourses={relatedCourses}
          />
        </div>
      </div>
    </div>
  )
}