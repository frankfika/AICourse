import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

// 生成订单号
function generateOrderNo() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD${timestamp}${random}`
}

// 创建订单
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { itemType, itemId } = body

    if (!itemType || !itemId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 检查商品类型
    if (itemType !== 'course' && itemType !== 'nanodegree') {
      return NextResponse.json(
        { error: '无效的商品类型' },
        { status: 400 }
      )
    }

    // 获取商品信息
    let item: any
    if (itemType === 'course') {
      item = await prisma.course.findUnique({
        where: { id: itemId, status: 'published' },
      })
    } else {
      item = await prisma.nanoDegree.findUnique({
        where: { id: itemId, status: 'published' },
      })
    }

    if (!item) {
      return NextResponse.json(
        { error: '商品不存在' },
        { status: 404 }
      )
    }

    // 检查是否已购买
    if (itemType === 'course') {
      const existing = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: itemId,
          },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: '您已经购买过该课程' },
          { status: 400 }
        )
      }
    } else {
      const existing = await prisma.nanoDegreeEnrollment.findUnique({
        where: {
          userId_nanoDegreeId: {
            userId: user.id,
            nanoDegreeId: itemId,
          },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: '您已经购买过该认证项目' },
          { status: 400 }
        )
      }
    }

    // 如果是免费商品，直接注册
    if (item.price === 0) {
      if (itemType === 'course') {
        await prisma.enrollment.create({
          data: {
            userId: user.id,
            courseId: itemId,
          },
        })
        await prisma.course.update({
          where: { id: itemId },
          data: { enrollCount: { increment: 1 } },
        })
      } else {
        await prisma.nanoDegreeEnrollment.create({
          data: {
            userId: user.id,
            nanoDegreeId: itemId,
          },
        })
        await prisma.nanoDegree.update({
          where: { id: itemId },
          data: { enrollCount: { increment: 1 } },
        })
      }

      return NextResponse.json({
        success: true,
        type: 'free',
      })
    }

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: user.id,
        itemType,
        itemId,
        itemTitle: item.title,
        itemCoverImage: item.coverImage,
        amount: item.price,
        originalAmount: item.originalPrice || item.price,
        currency: item.currency || 'CNY',
      },
    })

    return NextResponse.json({
      success: true,
      type: 'paid',
      order,
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    )
  }
}

// 获取用户订单列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { error: '获取订单失败' },
      { status: 500 }
    )
  }
}
