import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CourseForm } from '@/components/admin/course-form'

export const metadata = {
  title: '编辑课程 - OpenCSG AI学院 后台',
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [course, categories, instructors] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
        enrollments: { include: { user: true } },
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

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">课程权限管理</h2>
        <div className="anthropic-card p-4 space-y-3">
          <form method="POST" action={`/api/admin/courses/${id}/enrollments`} className="flex gap-3">
            <input
              type="email"
              name="email"
              placeholder="输入学员邮箱"
              className="flex-1 px-3 py-2 border rounded-md"
              required
            />
            <button className="px-4 py-2 rounded-md bg-primary text-white">开放权限</button>
          </form>
          <div className="text-sm text-muted-foreground">已有权限学员（{course.enrollments.length}）</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {course.enrollments.map((en) => (
              <div key={en.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{en.user.name}</div>
                  <div className="text-xs text-muted-foreground">{en.user.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
