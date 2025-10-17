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
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const category = searchParams.category as string | undefined
  const level = searchParams.level as string | undefined
  const search = searchParams.search as string | undefined
  const sort = (searchParams.sort as string) || 'latest'

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
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">探索课程</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            发现 {totalCount} 门精品 AI 课程，开启你的学习之旅
          </p>
        </div>
      </section>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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

