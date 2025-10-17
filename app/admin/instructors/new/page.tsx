import { InstructorForm } from '@/components/admin/instructor-form'

export const metadata = {
  title: '添加讲师 - CourseAI 后台',
}

export default function NewInstructorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">添加讲师</h1>
        <p className="text-muted-foreground">填写讲师信息</p>
      </div>
      <InstructorForm />
    </div>
  )
}

