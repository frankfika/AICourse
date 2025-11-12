import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

// 模拟支付（用于测试）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { orderNo },
    })

    if (!order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 验证订单所有者
    if (order.userId !== user.id) {
      return NextResponse.json(
        { error: '无权访问此订单' },
        { status: 403 }
      )
    }

    // 检查订单状态
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: '订单状态不正确' },
        { status: 400 }
      )
    }

    // 更新订单状态为已支付
    await prisma.order.update({
      where: { orderNo },
      data: {
        status: 'paid',
        paymentMethod: 'mock',
        paymentId: `MOCK_${Date.now()}`,
        paidAt: new Date(),
      },
    })

    // 创建注册记录
    if (order.itemType === 'course') {
      await prisma.enrollment.create({
        data: {
          userId: user.id,
          courseId: order.itemId,
          orderId: order.id,
        },
      })
      // 更新课程报名数
      await prisma.course.update({
        where: { id: order.itemId },
        data: { enrollCount: { increment: 1 } },
      })
    } else if (order.itemType === 'nanodegree') {
      await prisma.nanoDegreeEnrollment.create({
        data: {
          userId: user.id,
          nanoDegreeId: order.itemId,
          orderId: order.id,
        },
      })
      // 更新认证项目报名数
      await prisma.nanoDegree.update({
        where: { id: order.itemId },
        data: { enrollCount: { increment: 1 } },
      })
    }

    return NextResponse.json({
      success: true,
      message: '支付成功',
    })
  } catch (error) {
    console.error('Mock payment error:', error)
    return NextResponse.json(
      { error: '支付失败' },
      { status: 500 }
    )
  }
}
