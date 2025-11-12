import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId, status: 'published' },
    })

    if (!course) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    })

    if (existingEnrollment) {
      return NextResponse.json(
        { error: '您已经报名了该课程' },
        { status: 400 }
      )
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId,
      },
    })

    // Update course enroll count
    await prisma.course.update({
      where: { id: courseId },
      data: { enrollCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      enrollment,
    })
  } catch (error) {
    console.error('Enroll error:', error)
    return NextResponse.json(
      { error: '报名失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // Delete enrollment
    const enrollment = await prisma.enrollment.deleteMany({
      where: {
        userId: user.id,
        courseId,
      },
    })

    if (enrollment.count === 0) {
      return NextResponse.json(
        { error: '未找到报名记录' },
        { status: 404 }
      )
    }

    // Update course enroll count
    await prisma.course.update({
      where: { id: courseId },
      data: { enrollCount: { decrement: 1 } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unenroll error:', error)
    return NextResponse.json(
      { error: '取消报名失败' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ enrolled: false })
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    })

    return NextResponse.json({
      enrolled: !!enrollment,
      enrollment,
    })
  } catch (error) {
    console.error('Check enrollment error:', error)
    return NextResponse.json({ enrolled: false })
  }
}
