import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit } from 'lucide-react'

export const metadata = {
  title: '讲师管理 - OpenCSG AI学院 后台',
}

export default async function AdminInstructorsPage() {
  const instructors = await prisma.instructor.findMany({
    include: {
      _count: {
        select: { courses: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">讲师管理</h1>
          <p className="text-muted-foreground">管理所有讲师</p>
        </div>
        <Link href="/admin/instructors/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            添加讲师
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instructors.map((instructor) => (
          <Card key={instructor.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden">
                  <Image
                    src={instructor.avatar}
                    alt={instructor.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{instructor.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{instructor.title}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                {instructor.bio}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {instructor._count.courses} 门课程
                </span>
                <Link href={`/admin/instructors/${instructor.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

