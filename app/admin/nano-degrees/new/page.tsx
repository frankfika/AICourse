import { prisma } from '@/lib/db'
import { NanoDegreeForm } from '@/components/admin/nanodegree-form'

export const metadata = {
  title: '创建 Nano Degree - CourseAI 后台',
}

export default async function NewNanoDegreePage() {
  const courses = await prisma.course.findMany({
    where: { status: 'published' },
    orderBy: { title: 'asc' },
    include: { category: true, instructor: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">创建 Nano Degree</h1>
        <p className="text-muted-foreground">填写以下信息创建新的 Nano Degree 项目</p>
      </div>

      <NanoDegreeForm courses={courses} />
    </div>
  )
}

