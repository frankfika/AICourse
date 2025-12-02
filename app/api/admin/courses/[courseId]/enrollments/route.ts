import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const contentType = request.headers.get('content-type') || ''
    let email = ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      email = body.email || ''
    } else {
      const form = await request.formData()
      email = String(form.get('email') || '')
    }

    if (!email) {
      return NextResponse.json({ error: '缺少邮箱' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    })
    if (existing) {
      return NextResponse.json({ error: '已拥有权限' }, { status: 400 })
    }

    await prisma.enrollment.create({ data: { userId: user.id, courseId } })
    await prisma.course.update({ where: { id: courseId }, data: { enrollCount: { increment: 1 } } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}

