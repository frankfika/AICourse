import Link from 'next/link'
import Image from 'next/image'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { Clock, Users } from 'lucide-react'

interface Course {
  id: string
  title: string
  slug: string
  shortDescription: string
  coverImage: string
  duration: number
  level: string
  viewCount: number
  startDate?: Date | null
  category: {
    name: string
  }
  instructor: {
    name: string
  }
}

export function CourseGrid({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900 mb-2">未找到相关课程</p>
        <p className="text-sm text-gray-500">尝试调整筛选条件或搜索关键词</p>
      </div>
    )
  }

  const isComingSoon = (startDate?: Date | null) => {
    return startDate && new Date(startDate) > new Date()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
      {courses.map((course, idx) => {
        const comingSoon = isComingSoon(course.startDate)
        
        return (
          <Link 
            key={course.id} 
            href={`/courses/${course.slug}`} 
            className="group"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-200 group-hover:border-primary/30 transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-2 h-full">
              {/* 封面图 */}
              <div className="aspect-video relative bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                <Image
                  src={course.coverImage}
                  alt={course.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                
                {/* 即将开始标签 */}
                {comingSoon && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg shadow-lg">
                      <Clock className="w-3.5 h-3.5" />
                      即将开始
                    </span>
                  </div>
                )}
                
                {/* 视频时长标签 */}
                <div className="absolute bottom-3 right-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-white text-xs font-semibold rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(course.duration)}
                  </span>
                </div>
              </div>

              {/* 内容区 */}
              <div className="p-6 space-y-4">
                {/* 分类和难度 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                    {course.category.name}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                  </span>
                </div>

                {/* 标题 */}
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem] leading-snug">
                  {course.title}
                </h3>

                {/* 描述 */}
                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                  {course.shortDescription}
                </p>

                {/* 底部信息 */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-700 font-medium">
                    {course.instructor.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    {course.viewCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
