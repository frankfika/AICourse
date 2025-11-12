import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        instructor: true,
        chapters: { orderBy: { order: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
      },
    })

    if (!course) {
      return NextResponse.json({ error: '课程不存在' }, { status: 404 })
    }

    return NextResponse.json(course)
  } catch (error) {
    return NextResponse.json({ error: '获取课程失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const { chapters, faqs, startDate, ...courseData } = data

    // Delete existing chapters and FAQs
    await Promise.all([
      prisma.chapter.deleteMany({ where: { courseId: id } }),
      prisma.courseFAQ.deleteMany({ where: { courseId: id } }),
    ])

    // Update course with new chapters and FAQs
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...courseData,
        startDate: startDate ? new Date(startDate) : null,
        prerequisites: JSON.stringify(courseData.prerequisites || []),
        learningObjectives: JSON.stringify(courseData.learningObjectives || []),
        highlights: JSON.stringify(courseData.highlights || []),
        chapters: {
          create: chapters.map((ch: any) => ({
            title: ch.title,
            duration: ch.duration,
            topics: JSON.stringify(ch.topics || []),
            order: ch.order,
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

    return NextResponse.json(course)
  } catch (error) {
    console.error('Update course error:', error)
    return NextResponse.json({ error: '更新课程失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.course.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除课程失败' }, { status: 500 })
  }
}

