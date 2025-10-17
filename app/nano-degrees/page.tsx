import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Award, BookOpen, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

export const metadata = {
  title: 'Nano Degree 认证项目 - CourseAI',
  description: '专业的 AI 学习路径和认证项目',
}

export default async function NanoDegreesPage() {
  const nanoDegrees = await prisma.nanoDegree.findMany({
    where: { status: 'published' },
    include: {
      courses: {
        include: {
          course: true,
        },
      },
    },
    orderBy: { viewCount: 'desc' },
  })

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Nano Degree 认证项目</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            系统化的学习路径，完成后获得行业认可的专业认证
          </p>
        </div>
      </section>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {nanoDegrees.map((nd) => {
          const totalDuration = nd.courses.reduce(
            (sum, c) => sum + c.course.duration,
            0
          )
          return (
            <Link key={nd.id} href={`/nano-degrees/${nd.slug}`}>
              <Card className="h-full hover:shadow-xl transition-shadow">
                <CardHeader className="p-0">
                  <div className="relative w-full h-56">
                    <Image
                      src={nd.coverImage}
                      alt={nd.title}
                      fill
                      className="object-cover rounded-t-lg"
                    />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-yellow-500 text-white">
                        <Award className="h-4 w-4 mr-1" />
                        认证
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <Badge variant="outline" className="mb-3">
                    {COURSE_LEVELS[nd.level as keyof typeof COURSE_LEVELS]}
                  </Badge>
                  {nd.featured && (
                    <Badge className="ml-2 bg-red-500">热门</Badge>
                  )}
                  <CardTitle className="mb-3 line-clamp-2">{nd.title}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {nd.shortDescription}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{nd.courses.length} 门课程</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(totalDuration)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
        </div>
      </div>
    </div>
  )
}

