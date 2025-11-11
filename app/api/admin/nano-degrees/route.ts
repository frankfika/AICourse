import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { courseIds, faqs, startDate, ...nanoDegreeData } = data

    const nanoDegree = await prisma.nanoDegree.create({
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
    console.error('Create nano degree error:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}

