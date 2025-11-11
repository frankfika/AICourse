import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nanoDegree = await prisma.nanoDegree.findUnique({
      where: { id: params.id },
      include: {
        courses: {
          include: { course: true },
          orderBy: { order: 'asc' },
        },
        faqs: { orderBy: { order: 'asc' } },
      },
    })

    if (!nanoDegree) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    return NextResponse.json(nanoDegree)
  } catch (error) {
    return NextResponse.json({ error: '获取项目失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()
    const { courseIds, faqs, startDate, ...nanoDegreeData } = data

    // Delete existing relationships
    await Promise.all([
      prisma.nanoDegreeCourse.deleteMany({ where: { nanoDegreeId: params.id } }),
      prisma.nanoDegreeFAQ.deleteMany({ where: { nanoDegreeId: params.id } }),
    ])

    // Update nano degree
    const nanoDegree = await prisma.nanoDegree.update({
      where: { id: params.id },
      data: {
        ...nanoDegreeData,
        startDate: startDate ? new Date(startDate) : null,
        prerequisites: JSON.stringify(nanoDegreeData.prerequisites || []),
        skills: JSON.stringify(nanoDegreeData.skills || []),
        highlights: JSON.stringify(nanoDegreeData.highlights || []),
        courses: {
          create: courseIds.map((courseId: string, index: number) => ({
            courseId,
            order: index,
          })),
        },
        faqs: {
          create: faqs.map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
            order: faq.order,
          })),
        },
      },
    })

    return NextResponse.json(nanoDegree)
  } catch (error) {
    console.error('Update nano degree error:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.nanoDegree.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}

