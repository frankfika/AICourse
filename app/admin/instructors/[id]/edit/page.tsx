import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { InstructorForm } from '@/components/admin/instructor-form'

export const metadata = {
  title: '编辑讲师 - OpenCSG AI学院 后台',
}

export default async function EditInstructorPage({
  params,
}: {
  params: { id: string }
}) {
  const instructor = await prisma.instructor.findUnique({
    where: { id: params.id },
  })

  if (!instructor) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑讲师</h1>
        <p className="text-muted-foreground">更新讲师信息</p>
      </div>
      <InstructorForm instructor={instructor} />
    </div>
  )
}

