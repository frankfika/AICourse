import { prisma } from '@/lib/db'
import { CourseGrid } from '@/components/courses/course-grid'
import { CourseFilters } from '@/components/courses/course-filters'
import { Suspense } from 'react'

export const metadata = {
  title: '课程列表 - OpenCSG AI学院',
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
    <div className="min-h-screen bg-white">
      {/* Hero Section - 现代设计 */}
      <section className="relative pt-24 pb-12 sm:pt-28 sm:pb-16 overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container-anthropic relative">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-primary/20 shadow-md">
              <span className="text-sm font-semibold text-primary">课程目录</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              探索 <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">AI 课程</span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-2xl">
              发现 <span className="font-bold text-primary">{totalCount}</span> 门精品课程，开启你的学习之旅
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container-anthropic py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Suspense fallback={
              <div className="space-y-4">
                <div className="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
                <div className="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
              </div>
            }>
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

