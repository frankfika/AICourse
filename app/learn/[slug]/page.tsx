import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-auth'
import { prisma } from '@/lib/db'
import { CoursePlayer } from '@/components/learn/course-player'

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const course = await prisma.course.findUnique({
    where: { slug, status: 'published' },
    include: {
      category: true,
      instructor: true,
      chapters: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!course) {
    notFound()
  }

  // Check enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id,
      },
    },
  })

  if (!enrollment) {
    redirect(`/courses/${slug}`)
  }

  // Get chapter progress
  const progress = await prisma.chapterProgress.findMany({
    where: {
      userId: user.id,
      chapterId: { in: course.chapters.map((ch) => ch.id) },
    },
  })

  const chaptersWithProgress = course.chapters.map((chapter) => {
    const chapterProgress = progress.find((p) => p.chapterId === chapter.id)
    return {
      ...chapter,
      completed: chapterProgress?.completed || false,
      lastPosition: chapterProgress?.lastPosition || 0,
    }
  })

  return (
    <CoursePlayer
      course={{
        ...course,
        chapters: chaptersWithProgress.map((ch) => ({
          ...ch,
          topics: JSON.parse(ch.topics),
        })),
      }}
      enrollment={enrollment}
      userId={user.id}
    />
  )
}
