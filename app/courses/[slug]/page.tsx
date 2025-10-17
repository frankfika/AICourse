import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CourseDetailTabs } from '@/components/courses/course-detail-tabs'
import { formatDuration, formatDate } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Clock, Eye, Calendar, User } from 'lucide-react'

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

      {/* Hero Section */}
      <div className="bg-muted/50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Course Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{course.category.name}</Badge>
                <Badge variant="outline">
                  {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                </Badge>
                {course.featured && <Badge className="bg-yellow-500">热门</Badge>}
              </div>
              <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
              <p className="text-xl text-muted-foreground mb-6">
                {course.shortDescription}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{course.instructor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(course.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>{course.viewCount} 浏览</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>更新于 {formatDate(course.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Right: Cover Image & CTA */}
            <div className="lg:col-span-1">
              <div className="bg-background rounded-lg p-6 shadow-lg sticky top-4">
                <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={course.coverImage}
                    alt={course.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <Button className="w-full mb-4" size="lg">
                  开始学习
                </Button>
                {course.suggestedWeeks && (
                  <p className="text-sm text-muted-foreground text-center">
                    建议 {course.suggestedWeeks} 周完成 · 每周 {course.hoursPerWeek || 5} 小时
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-12">
        <CourseDetailTabs
          course={{
            ...course,
            prerequisites: JSON.parse(course.prerequisites),
            learningObjectives: JSON.parse(course.learningObjectives),
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
  )
}

