import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NanoDegreeDetailTabs } from '@/components/nano-degrees/nanodegree-detail-tabs'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Award, BookOpen, Clock, Eye, Calendar } from 'lucide-react'

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

      {/* Hero Section - Coursera Style */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Program Info */}
            <div className="lg:col-span-2">
              {/* Breadcrumb and Category */}
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Award className="h-4 w-4 text-yellow-600" />
                <span>专业认证</span>
                <span>•</span>
                <span>{COURSE_LEVELS[nanoDegree.level as keyof typeof COURSE_LEVELS]}</span>
                {nanoDegree.featured && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-medium">热门</span>
                  </>
                )}
              </div>
              
              {/* Title */}
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {nanoDegree.title}
              </h1>
              
              {/* Description */}
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                {nanoDegree.shortDescription}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>{nanoDegree.courses.length} 门课程</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>{nanoDegree.viewCount.toLocaleString()} 名学生</span>
                </div>
                {nanoDegree.suggestedMonths && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>建议 {nanoDegree.suggestedMonths} 个月完成</span>
                  </div>
                )}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                  免费注册
                </Button>
                <Button variant="outline" size="lg" className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3">
                  添加到收藏
                </Button>
              </div>
            </div>

            {/* Right: Program Card */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-4">
                {/* Certificate Preview */}
                <div className="relative w-full h-48 rounded-t-lg overflow-hidden bg-gray-100">
                  <Image
                    src={nanoDegree.certificateImage}
                    alt="证书预览"
                    fill
                    className="object-cover"
                  />
                </div>
                
                {/* Program Info */}
                <div className="p-6">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-gray-900 mb-1">免费</div>
                    <div className="text-sm text-gray-600">开始学习路径</div>
                  </div>
                  
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 mb-4">
                    免费注册
                  </Button>
                  
                  <div className="text-xs text-gray-500 text-center space-y-1">
                    <div>• 获得专业认证证书</div>
                    <div>• 可自定进度</div>
                    <div>• 行业认可</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 py-8">
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
    </div>
  )
}

