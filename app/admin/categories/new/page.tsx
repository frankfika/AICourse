import { CategoryForm } from '@/components/admin/category-form'

export const metadata = {
  title: '添加分类 - OpenCSG AI学院 后台',
}

export default function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">添加分类</h1>
        <p className="text-muted-foreground">创建新的课程分类</p>
      </div>
      <CategoryForm />
    </div>
  )
}

