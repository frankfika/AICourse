import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/user-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nanoDegreeId: string }> }
) {
  try {
    const { nanoDegreeId } = await params
    const { nanoDegreeId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ enrolled: false })
    }

    const enrollment = await prisma.nanoDegreeEnrollment.findUnique({
      where: {
        userId_nanoDegreeId: {
          userId: user.id,
          nanoDegreeId,
        },
      },
    })

    return NextResponse.json({ enrolled: !!enrollment })
  } catch (error) {
    console.error('检查注册状态失败:', error)
    return NextResponse.json({ enrolled: false })
  }
}
