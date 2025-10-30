import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

// 生成证书编号
function generateCertificateNo() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `CERT${timestamp}${random}`
}

// 生成证书（当课程或认证项目完成时）
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
    const { type, itemId } = body

    if (!type || !itemId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 检查是否已完成
    if (type === 'course') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: itemId,
          },
        },
        include: {
          course: true,
        },
      })

      if (!enrollment) {
        return NextResponse.json(
          { error: '您未报名该课程' },
          { status: 400 }
        )
      }

      if (enrollment.progress < 100) {
        return NextResponse.json(
          { error: '请完成所有课程内容后再申请证书' },
          { status: 400 }
        )
      }

      // 检查是否已有证书
      const existingCert = await prisma.certificate.findFirst({
        where: {
          userId: user.id,
          type: 'course',
          itemId,
          status: 'active',
        },
      })

      if (existingCert) {
        return NextResponse.json({ certificate: existingCert })
      }

      // 创建证书
      const certificate = await prisma.certificate.create({
        data: {
          certificateNo: generateCertificateNo(),
          userId: user.id,
          type: 'course',
          itemId,
          itemTitle: enrollment.course.title,
          completedAt: enrollment.completedAt || new Date(),
          certificateData: JSON.stringify({
            userName: user.name,
            courseTitle: enrollment.course.title,
            completedAt: enrollment.completedAt || new Date(),
            instructorName: '', // 可以从 course.instructor 获取
          }),
        },
      })

      return NextResponse.json({
        success: true,
        certificate,
      })
    } else if (type === 'nanodegree') {
      const enrollment = await prisma.nanoDegreeEnrollment.findUnique({
        where: {
          userId_nanoDegreeId: {
            userId: user.id,
            nanoDegreeId: itemId,
          },
        },
        include: {
          nanoDegree: true,
        },
      })

      if (!enrollment) {
        return NextResponse.json(
          { error: '您未报名该认证项目' },
          { status: 400 }
        )
      }

      if (enrollment.progress < 100) {
        return NextResponse.json(
          { error: '请完成所有课程内容后再申请证书' },
          { status: 400 }
        )
      }

      const existingCert = await prisma.certificate.findFirst({
        where: {
          userId: user.id,
          type: 'nanodegree',
          itemId,
          status: 'active',
        },
      })

      if (existingCert) {
        return NextResponse.json({ certificate: existingCert })
      }

      const certificate = await prisma.certificate.create({
        data: {
          certificateNo: generateCertificateNo(),
          userId: user.id,
          type: 'nanodegree',
          itemId,
          itemTitle: enrollment.nanoDegree.title,
          completedAt: enrollment.completedAt || new Date(),
          certificateData: JSON.stringify({
            userName: user.name,
            nanoDegreeTitle: enrollment.nanoDegree.title,
            completedAt: enrollment.completedAt || new Date(),
          }),
        },
      })

      return NextResponse.json({
        success: true,
        certificate,
      })
    }

    return NextResponse.json(
      { error: '无效的类型' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Generate certificate error:', error)
    return NextResponse.json(
      { error: '生成证书失败' },
      { status: 500 }
    )
  }
}

// 获取用户所有证书
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    const certificates = await prisma.certificate.findMany({
      where: {
        userId: user.id,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ certificates })
  } catch (error) {
    console.error('Get certificates error:', error)
    return NextResponse.json(
      { error: '获取证书失败' },
      { status: 500 }
    )
  }
}
