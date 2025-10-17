import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Award, BookOpen } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'

interface NanoDegree {
  id: string
  title: string
  slug: string
  shortDescription: string
  coverImage: string
  level: string
  courses: {
    course: {
      duration: number
    }
  }[]
}

export function FeaturedNanoDegrees({ nanoDegrees }: { nanoDegrees: NanoDegree[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {nanoDegrees.map((nd) => {
        const totalDuration = nd.courses.reduce((sum, c) => sum + c.course.duration, 0)
        return (
          <Link key={nd.id} href={`/nano-degrees/${nd.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader className="p-0">
                <div className="relative w-full h-40">
                  <Image
                    src={nd.coverImage}
                    alt={nd.title}
                    fill
                    className="object-cover rounded-t-lg"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-yellow-500 text-white">
                      <Award className="h-3 w-3 mr-1" />
                      认证
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <Badge variant="outline" className="mb-2">
                  {COURSE_LEVELS[nd.level as keyof typeof COURSE_LEVELS]}
                </Badge>
                <CardTitle className="mb-2 line-clamp-2">{nd.title}</CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {nd.shortDescription}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{nd.courses.length} 门课程</span>
                  </div>
                  <div>
                    <span>{formatDuration(totalDuration)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

