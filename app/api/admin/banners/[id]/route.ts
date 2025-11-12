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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const banner = await prisma.banner.findUnique({
      where: { id: id },
    })

    if (!banner) {
      return NextResponse.json({ error: 'Banner不存在' }, { status: 404 })
    }

    return NextResponse.json(banner)
  } catch (error) {
    console.error('Get banner error:', error)
    return NextResponse.json({ error: '获取Banner失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const validatedData = bannerSchema.parse(data)

    const banner = await prisma.banner.update({
      where: { id: id },
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
    console.error('Update banner error:', error)
    return NextResponse.json({ error: '更新Banner失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.banner.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete banner error:', error)
    return NextResponse.json({ error: '删除Banner失败' }, { status: 500 })
  }
}

