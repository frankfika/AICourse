import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { completed, lastPosition } = body

    // Upsert chapter progress
    const progress = await prisma.chapterProgress.upsert({
      where: {
        userId_chapterId: {
          userId: user.id,
          chapterId,
        },
      },
      update: {
        completed: completed !== undefined ? completed : undefined,
        completedAt: completed ? new Date() : undefined,
        lastPosition: lastPosition !== undefined ? lastPosition : undefined,
      },
      create: {
        userId: user.id,
        chapterId,
        completed: completed || false,
        completedAt: completed ? new Date() : null,
        lastPosition: lastPosition || 0,
      },
    })

    // Update enrollment progress
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    })

    if (chapter) {
      const courseChapters = await prisma.chapter.findMany({
        where: { courseId: chapter.courseId },
      })

      const completedChapters = await prisma.chapterProgress.count({
        where: {
          userId: user.id,
          chapterId: { in: courseChapters.map((ch) => ch.id) },
          completed: true,
        },
      })

      const overallProgress = Math.round(
        (completedChapters / courseChapters.length) * 100
      )

      await prisma.enrollment.updateMany({
        where: {
          userId: user.id,
          courseId: chapter.courseId,
        },
        data: {
          progress: overallProgress,
          lastAccessedAt: new Date(),
          completedAt: overallProgress === 100 ? new Date() : null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      progress,
    })
  } catch (error) {
    console.error('Update progress error:', error)
    return NextResponse.json(
      { error: '更新进度失败' },
      { status: 500 }
    )
  }
}
