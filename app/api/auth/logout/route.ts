import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/user-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession()
    session.destroy()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: '退出失败' },
      { status: 500 }
    )
  }
}
