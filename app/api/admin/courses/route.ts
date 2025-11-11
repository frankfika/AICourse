import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        category: true,
        instructor: true,
        chapters: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(courses)
  } catch (error) {
    return NextResponse.json(
      { error: '获取课程列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const { chapters, faqs, startDate, ...courseData } = data

    // Create course with chapters and FAQs
    const course = await prisma.course.create({
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
    console.error('Create course error:', error)
    return NextResponse.json(
      { error: '创建课程失败' },
      { status: 500 }
    )
  }
}

