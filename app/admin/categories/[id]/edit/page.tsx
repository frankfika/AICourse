import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CategoryForm } from '@/components/admin/category-form'

export const metadata = {
  title: '编辑分类 - OpenCSG AI学院 后台',
}

export default async function EditCategoryPage({
  params,
}: {
  params: { id: string }
}) {
  const category = await prisma.category.findUnique({
    where: { id: params.id },
  })

  if (!category) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑分类</h1>
        <p className="text-muted-foreground">更新分类信息</p>
      </div>
      <CategoryForm category={category} />
    </div>
  )
}

