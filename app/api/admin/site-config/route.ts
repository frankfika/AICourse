import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let key = ''
    let value: any = null

    if (contentType.includes('application/json')) {
      const body = await request.json()
      key = body.key
      value = body.value
    } else {
      const form = await request.formData()
      key = String(form.get('key') || '')
      value = form.get('value')
    }

    if (!key) {
      return NextResponse.json({ error: '缺少key' }, { status: 400 })
    }

    const data = JSON.stringify(value ?? null)

    await prisma.siteConfig.upsert({
      where: { key },
      update: { value: data },
      create: { key, value: data },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 })
  }
}

