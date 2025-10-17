import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { NanoDegreeForm } from '@/components/admin/nanodegree-form'

export const metadata = {
  title: '编辑 Nano Degree - CourseAI 后台',
}

export default async function EditNanoDegreePage({
  params,
}: {
  params: { id: string }
}) {
  const [nanoDegree, courses] = await Promise.all([
    prisma.nanoDegree.findUnique({
      where: { id: params.id },
      include: {
        courses: {
          include: { course: true },
          orderBy: { order: 'asc' },
        },
        faqs: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.course.findMany({
      where: { status: 'published' },
      orderBy: { title: 'asc' },
      include: { category: true, instructor: true },
    }),
  ])

  if (!nanoDegree) {
    notFound()
  }

  // Parse JSON fields
  const nanoDegreeData = {
    ...nanoDegree,
    prerequisites: JSON.parse(nanoDegree.prerequisites),
    skills: JSON.parse(nanoDegree.skills),
    highlights: JSON.parse(nanoDegree.highlights),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑 Nano Degree</h1>
        <p className="text-muted-foreground">更新 Nano Degree 项目信息</p>
      </div>

      <NanoDegreeForm nanoDegree={nanoDegreeData} courses={courses} />
    </div>
  )
}

