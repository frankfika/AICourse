import { PrismaClient, UserRole } from '@prisma/client';
// bcryptjs 来自 api 服务的 deps,这里 require 直接拿
// @ts-ignore
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@opencsg.com' } });
  if (existing) {
    console.log('Admin already exists:', existing.email, 'role:', existing.role);
    return;
  }
  const hash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@opencsg.com',
      passwordHash: hash,
      name: 'OpenCSG Admin',
      role: UserRole.admin,
    },
  });
  console.log('Created admin:', admin.email, 'id:', admin.id);
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
