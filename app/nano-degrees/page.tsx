import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { formatDuration } from '@/lib/utils'
import { BookOpen, Clock } from 'lucide-react'

export const metadata = {
  title: 'Nano Degree 认证项目 - OpenCSG AI学院',
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
    <div className="min-h-screen bg-white">
      {/* Hero Section - 现代设计 */}
      <section className="relative pt-24 pb-12 sm:pt-28 sm:pb-16 overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50">
        {/* 装饰性背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="container-anthropic relative">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-primary/20 shadow-md">
              <span className="text-sm font-semibold text-primary">专业认证项目</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              获得 <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">专业认证</span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-2xl">
              系统化的学习路径，完成后获得行业认可的专业认证
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container-anthropic py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {nanoDegrees.map((nd, idx) => {
          const totalDuration = nd.courses.reduce(
            (sum, c) => sum + c.course.duration,
            0
          )
          return (
            <Link 
              key={nd.id} 
              href={`/nano-degrees/${nd.slug}`} 
              className="group relative"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* 发光效果背景 */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative bg-gradient-to-br from-white to-gray-50/50 border-2 border-gray-200 group-hover:border-primary/50 rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-2 h-full">
                {/* 装饰性圆圈 */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full -mr-16 -mt-16"></div>
                
                {/* 封面图 */}
                <div className="aspect-[4/3] relative bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                  <Image
                    src={nd.coverImage}
                    alt={nd.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>

                <div className="p-6 space-y-4 relative">
                  {/* 认证徽章 */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-green-500/10 border border-primary/20 text-xs font-bold text-primary">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      认证项目
                    </span>
                    {nd.featured && (
                      <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-600 text-xs font-semibold">
                        🔥 热门
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
                    {nd.title}
                  </h3>

                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                    {nd.shortDescription}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100 text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <BookOpen className="w-4 h-4 text-primary" />
                      {nd.courses.length} 门课程
                    </span>
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      {formatDuration(totalDuration)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
        </div>
      </div>
    </div>
  )
}

