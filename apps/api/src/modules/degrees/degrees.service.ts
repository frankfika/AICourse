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
      include: { course: true },
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

    return this.prisma.nanoDegree.findMany({
      where,
      include: this.degreeInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const degree = await this.prisma.nanoDegree.findUnique({
      where: { id },
      include: this.degreeInclude,
    });
    if (!degree) throw new NotFoundException('Degree not found');
    return degree;
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
