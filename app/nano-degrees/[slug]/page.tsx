import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NanoDegreeDetailTabs } from '@/components/nano-degrees/nanodegree-detail-tabs'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Award, BookOpen, Clock, Eye } from 'lucide-react'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const nanoDegree = await prisma.nanoDegree.findUnique({
    where: { slug: params.slug },
  })

  if (!nanoDegree) {
    return { title: 'Nano Degree 未找到' }
  }

  return {
    title: `${nanoDegree.title} - CourseAI`,
    description: nanoDegree.shortDescription,
  }
}

export default async function NanoDegreeDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const nanoDegree = await prisma.nanoDegree.findUnique({
    where: { slug: params.slug, status: 'published' },
    include: {
      courses: {
        include: {
          course: {
            include: {
              instructor: true,
              category: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      faqs: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!nanoDegree) {
    notFound()
  }

  // Increment view count
  await prisma.nanoDegree.update({
    where: { id: nanoDegree.id },
    data: { viewCount: { increment: 1 } },
  })

  const totalDuration = nanoDegree.courses.reduce(
    (sum, c) => sum + c.course.duration,
    0
  )

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              首页
            </Link>
            <span>/</span>
            <Link href="/nano-degrees" className="hover:text-primary">
              Nano Degree
            </Link>
            <span>/</span>
            <span className="text-foreground">{nanoDegree.title}</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-yellow-500 border-yellow-500">
                  <Award className="h-4 w-4 mr-1" />
                  专业认证
                </Badge>
                <Badge variant="outline" className="bg-white/20 border-white/40 text-white">
                  {COURSE_LEVELS[nanoDegree.level as keyof typeof COURSE_LEVELS]}
                </Badge>
                {nanoDegree.featured && (
                  <Badge className="bg-red-500 border-red-500">热门</Badge>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-4">{nanoDegree.title}</h1>
              <p className="text-xl mb-6 opacity-90">
                {nanoDegree.shortDescription}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <span>{nanoDegree.courses.length} 门课程</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span>{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  <span>{nanoDegree.viewCount} 浏览</span>
                </div>
              </div>
            </div>

            {/* Right: Certificate Preview */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg p-6 shadow-xl">
                <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={nanoDegree.certificateImage}
                    alt="证书预览"
                    fill
                    className="object-cover"
                  />
                </div>
                <Button className="w-full" size="lg">
                  开始学习路径
                </Button>
                {nanoDegree.suggestedMonths && (
                  <p className="text-sm text-center mt-3 text-muted-foreground">
                    建议 {nanoDegree.suggestedMonths} 个月完成
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-4 py-12">
        <NanoDegreeDetailTabs
          nanoDegree={{
            ...nanoDegree,
            skills: JSON.parse(nanoDegree.skills),
            highlights: JSON.parse(nanoDegree.highlights),
            prerequisites: JSON.parse(nanoDegree.prerequisites),
          }}
        />
      </div>
    </div>
  )
}

