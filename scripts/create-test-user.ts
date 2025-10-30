import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    const passwordHash = await hashPassword('test123456')

    const user = await prisma.user.create({
      data: {
        name: '测试用户',
        email: 'test@courseai.com',
        passwordHash,
      },
    })

    console.log('✅ 测试用户创建成功!')
    console.log('📧 邮箱: test@courseai.com')
    console.log('🔑 密码: test123456')
    console.log('\n用户信息:', user)
  } catch (error) {
    console.error('创建测试用户失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()
