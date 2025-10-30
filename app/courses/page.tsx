import { prisma } from '@/lib/db'
import { CourseGrid } from '@/components/courses/course-grid'
import { CourseFilters } from '@/components/courses/course-filters'
import { Suspense } from 'react'

export const metadata = {
  title: '课程列表 - CourseAI',
  description: '浏览所有 AI 相关课程',
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const category = params.category as string | undefined
  const level = params.level as string | undefined
  const search = params.search as string | undefined
  const sort = (params.sort as string) || 'latest'

  // Build where clause
  const where: any = {
    status: 'published',
  }

  if (category) {
    where.category = { slug: category }
  }

  if (level) {
    where.level = level
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { shortDescription: { contains: search } },
    ]
  }

  // Build orderBy clause
  let orderBy: any = { createdAt: 'desc' }
  if (sort === 'popular') {
    orderBy = { viewCount: 'desc' }
  } else if (sort === 'duration-asc') {
    orderBy = { duration: 'asc' }
  } else if (sort === 'duration-desc') {
    orderBy = { duration: 'desc' }
  }

  const [courses, categories, instructors, totalCount] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: true,
        instructor: true,
      },
      orderBy,
      take: 12,
    }),
    prisma.category.findMany({
      orderBy: { order: 'asc' },
    }),
    prisma.instructor.findMany(),
    prisma.course.count({ where }),
  ])

  return (
    <div className="min-h-screen">
      {/* Hero Section - Anthropic Style */}
      <section className="section-divider hero-gradient">
        <div className="container-anthropic py-20 sm:py-24 md:py-32">
          <div className="max-w-3xl space-y-6">
            <div className="text-sm uppercase tracking-wider text-muted-foreground">
              课程目录
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl">
              探索课程
            </h1>
            <p className="text-xl text-muted-foreground">
              发现 {totalCount} 门精品 AI 课程，开启你的学习之旅
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container-anthropic section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Suspense fallback={<div>Loading...</div>}>
              <CourseFilters categories={categories} instructors={instructors} />
            </Suspense>
          </aside>

          {/* Course Grid */}
          <div className="lg:col-span-3">
            <CourseGrid courses={courses} />
          </div>
        </div>
      </div>
    </div>
  )
}

