import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const waitlistSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { courseId } = await params
    const body = await request.json()
    const { email } = waitlistSchema.parse(body)

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, startDate: true }
    })

    if (!course) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    // 检查课程是否已经开始
    if (!course.startDate || new Date(course.startDate) <= new Date()) {
      return NextResponse.json(
        { error: '该课程已经开始，可以直接报名' },
        { status: 400 }
      )
    }

    // 添加到等待列表
    const waitlist = await prisma.courseWaitlist.upsert({
      where: {
        email_courseId: {
          email,
          courseId
        }
      },
      update: {},
      create: {
        email,
        courseId,
        courseTitle: course.title
      }
    })

    return NextResponse.json({
      success: true,
      message: '订阅成功！课程开始时我们会通知您'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Waitlist subscription error:', error)
    return NextResponse.json(
      { error: '订阅失败，请稍后重试' },
      { status: 500 }
    )
  }
}

