import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total: ${users.length}`);
  for (const u of users) {
    console.log(`  ${u.role.padEnd(8)} | ${u.email.padEnd(30)} | ${u.name}`);
  }
  const instr = await prisma.instructor.count();
  const exp = await prisma.instructorExpertise.count();
  const course = await prisma.course.count();
  const link = await prisma.courseInstructorLink.count();
  const expLink = await prisma.instructorExpertiseLink.count();
  console.log(`\n讲师: ${instr} | 专长: ${exp} | 讲师-专长挂载: ${expLink} | 课程: ${course} | 课程-讲师挂载: ${link}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
