import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const bannerSchema = z.object({
  title: z.string().min(1, 'Banner标题不能为空'),
  image: z.string().url('请输入有效的图片URL'),
  link: z.string().optional(),
  openInNewTab: z.boolean().default(false),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0),
})

export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(banners)
  } catch (error) {
    console.error('Get banners error:', error)
    return NextResponse.json(
      { error: '获取Banner列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const validatedData = bannerSchema.parse(data)

    const banner = await prisma.banner.create({
      data: validatedData,
    })

    return NextResponse.json(banner)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error('Create banner error:', error)
    return NextResponse.json(
      { error: '创建Banner失败' },
      { status: 500 }
    )
  }
}

