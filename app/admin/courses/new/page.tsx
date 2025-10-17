import { prisma } from '@/lib/db'
import { CourseForm } from '@/components/admin/course-form'

export const metadata = {
  title: '创建课程 - CourseAI 后台',
}

export default async function NewCoursePage() {
  const [categories, instructors] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    prisma.instructor.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">创建课程</h1>
        <p className="text-muted-foreground">填写以下信息创建新课程</p>
      </div>

      <CourseForm categories={categories} instructors={instructors} />
    </div>
  )
}

