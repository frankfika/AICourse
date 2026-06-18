import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CostType } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true, degree: true },
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

    return this.prisma.enrollment.upsert({
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
  }
}
