import Link from 'next/link'
import Image from 'next/image'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

interface Course {
  id: string
  title: string
  slug: string
  shortDescription: string
  coverImage: string
  duration: number
  level: string
  viewCount: number
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
        <p className="text-lg text-muted-foreground">暂无符合条件的课程</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10">
      {courses.map((course) => (
        <Link key={course.id} href={`/courses/${course.slug}`} className="group block">
          <div className="anthropic-card overflow-hidden h-full flex flex-col">
            <div className="image-container aspect-video">
              <Image
                src={course.coverImage}
                alt={course.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="p-7 space-y-4 flex flex-col flex-grow">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="px-3 py-1 rounded-full bg-muted/70 text-foreground font-medium border border-border/50">
                  {course.category.name}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground font-medium">
                  {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                </span>
              </div>
              <h3 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                {course.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-grow">
                {course.shortDescription}
              </p>
              <div className="flex items-center justify-between text-sm pt-4 border-t border-border/50">
                <span className="text-muted-foreground font-medium">{course.instructor.name}</span>
                <span className="text-muted-foreground">{formatDuration(course.duration)}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

