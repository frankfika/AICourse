import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key) {
      const config = await prisma.siteConfig.findUnique({ where: { key } })
      return NextResponse.json({ [key]: config ? JSON.parse(config.value) : null })
    }

    const configs = await prisma.siteConfig.findMany({})
    const result: Record<string, any> = {}
    configs.forEach((c) => {
      result[c.key] = JSON.parse(c.value)
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

