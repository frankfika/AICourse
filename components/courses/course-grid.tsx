import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Eye } from 'lucide-react'
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
      <div className="text-center py-12">
        <p className="text-muted-foreground">暂无符合条件的课程</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <Link key={course.id} href={`/courses/${course.slug}`}>
          <Card className="h-full hover:shadow-lg transition-shadow">
            <CardHeader className="p-0">
              <div className="relative w-full h-48">
                <Image
                  src={course.coverImage}
                  alt={course.title}
                  fill
                  className="object-cover rounded-t-lg"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{course.category.name}</Badge>
                <Badge variant="outline">
                  {COURSE_LEVELS[course.level as keyof typeof COURSE_LEVELS]}
                </Badge>
              </div>
              <CardTitle className="mb-2 line-clamp-2 text-lg">
                {course.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {course.shortDescription}
              </p>
              <p className="text-sm text-muted-foreground">
                讲师: {course.instructor.name}
              </p>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(course.duration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{course.viewCount}</span>
              </div>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  )
}

