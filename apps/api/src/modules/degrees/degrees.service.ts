import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateDegreeDto, UpdateDegreeDto, LinkCoursesDto } from './degrees.dto';
import { CourseStatus } from '@prisma/client';

@Injectable()
export class DegreesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private degreeInclude = {
    courses: {
      include: {
        course: {
          include: {
            chapters: {
              select: { id: true },
              orderBy: { orderIndex: 'asc' as const },
            },
            enrollments: {
              select: { id: true, userId: true },
            },
          },
        },
      },
      orderBy: { orderIndex: 'asc' as const },
    },
  };

  async findAll(params: { status?: CourseStatus; search?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    const degrees = await this.prisma.nanoDegree.findMany({
      where,
      include: this.degreeInclude,
      orderBy: { createdAt: 'desc' },
    });
    return degrees.map((d) => this.shapeDegree(d));
  }

  async findOne(id: string, includeDraft = false) {
    const degree = await this.prisma.nanoDegree.findFirst({
      where: {
        id,
        ...(includeDraft ? {} : { status: 'published' }),
      },
      include: this.degreeInclude,
    });
    if (!degree) throw new NotFoundException('Degree not found');
    return this.shapeDegree(degree);
  }

  /**
   * 把学位塑造成"学习路径"形状：
   * - 顶层有 stats（课程数、总章节、估算时长、学员数）
   * - 课程按 orderIndex 编号，带 chapterCount / duration
   */
  private shapeDegree(degree: any) {
    const courses = (degree.courses ?? []).map((link: any, idx: number) => {
      const c = link.course;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        level: c.level,
        duration: c.duration,
        instructor: c.instructor,
        tags: c.tags,
        costType: c.costType,
        price: c.price,
        orderIndex: link.orderIndex,
        stepNumber: idx + 1,
        chapterCount: c.chapters?.length ?? 0,
        learnerCount: c.enrollments?.length ?? 0,
      };
    });

    const totalChapters = courses.reduce(
      (sum: number, c: any) => sum + c.chapterCount,
      0,
    );
    const totalLearners = courses.reduce(
      (sum: number, c: any) => sum + c.learnerCount,
      0,
    );

    return {
      ...degree,
      courses,
      stats: {
        courseCount: courses.length,
        totalChapters,
        totalLearners,
        estimatedHours: Math.max(courses.length * 4, 1),
      },
    };
  }

  async create(dto: CreateDegreeDto) {
    const degree = await this.prisma.nanoDegree.create({
      data: {
        ...dto,
        status: dto.status ?? CourseStatus.draft,
      },
      include: this.degreeInclude,
    });

    await this.auditLog.log({
      action: 'DEGREE_CREATE',
      entity: 'degree',
      entityId: degree.id,
      details: { title: degree.title },
    });

    return degree;
  }

  async update(id: string, dto: UpdateDegreeDto) {
    const degree = await this.prisma.nanoDegree.update({
      where: { id },
      data: dto,
      include: this.degreeInclude,
    });

    await this.auditLog.log({
      action: 'DEGREE_UPDATE',
      entity: 'degree',
      entityId: degree.id,
      details: { title: degree.title },
    });

    return degree;
  }

  async delete(id: string) {
    await this.prisma.nanoDegree.delete({ where: { id } });

    await this.auditLog.log({
      action: 'DEGREE_DELETE',
      entity: 'degree',
      entityId: id,
    });

    return { message: 'Degree deleted' };
  }

  async linkCourses(id: string, dto: LinkCoursesDto) {
    await this.prisma.degreeCourse.deleteMany({ where: { degreeId: id } });
    await this.prisma.degreeCourse.createMany({
      data: dto.courses.map((c) => ({
        degreeId: id,
        courseId: c.courseId,
        orderIndex: c.orderIndex,
      })),
    });

    return this.prisma.nanoDegree.findUnique({
      where: { id },
      include: this.degreeInclude,
    });
  }
}
