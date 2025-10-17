import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const instructor = await prisma.instructor.create({ data })
    return NextResponse.json(instructor)
  } catch (error) {
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}

