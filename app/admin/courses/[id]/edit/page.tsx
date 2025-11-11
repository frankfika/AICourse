import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CourseForm } from '@/components/admin/course-form'

export const metadata = {
  title: '编辑课程 - OpenCSG AI学院 后台',
}

export default async function EditCoursePage({
  params,
}: {
  params: { id: string }
}) {
  const [course, categories, instructors] = await Promise.all([
    prisma.course.findUnique({
      where: { id: params.id },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.instructor.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (!course) {
    notFound()
  }

  // Parse JSON fields
  const courseData = {
    ...course,
    prerequisites: JSON.parse(course.prerequisites),
    learningObjectives: JSON.parse(course.learningObjectives),
    highlights: JSON.parse(course.highlights),
    chapters: course.chapters.map((ch) => ({
      ...ch,
      topics: JSON.parse(ch.topics),
    })),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑课程</h1>
        <p className="text-muted-foreground">更新课程信息</p>
      </div>

      <CourseForm
        course={courseData}
        categories={categories}
        instructors={instructors}
      />
    </div>
  )
}

