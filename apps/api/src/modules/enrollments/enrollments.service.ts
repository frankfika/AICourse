import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadgesService } from '../badges/badges.service';
import { CostType } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badgesService: BadgesService,
  ) {}

  async findByUser(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true, degree: true },
      // P1-7 防御: max 100, 防 DoS
      take: 100,
    });
  }

  async enrollFreeCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new BadRequestException('Course not found');
    }

    if (course.costType !== CostType.free && course.costType !== CostType.charity) {
      throw new BadRequestException('This course is not free');
    }

    const enrollment = await this.prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      update: {},
      create: {
        userId,
        courseId,
        source: 'direct',
      },
    });

    // 异步检查首次报名等徽章（不阻塞报名流程）
    this.badgesService.checkAndAward(userId).catch(() => undefined);

    return enrollment;
  }
}
