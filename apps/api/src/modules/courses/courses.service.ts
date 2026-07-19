import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCourseDto, UpdateCourseDto } from './courses.dto';
import { CourseStatus, CourseType } from '@prisma/client';

export interface RatingDistribution {
  avg: number;
  count: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export interface CourseWithRating {
  id: string;
  title: string;
  // ... 课程全字段
  rating: RatingDistribution;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private courseInclude = {
    chapters: {
      include: {
        lessons: {
          include: { resources: true },
          orderBy: { orderIndex: 'asc' as const },
        },
      },
      orderBy: { orderIndex: 'asc' as const },
    },
  };

  async findAll(params: { status?: CourseStatus; courseType?: CourseType; search?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.courseType) where.courseType = params.courseType;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
        { instructor: { contains: params.search } },
      ];
    }

    return this.prisma.course.findMany({
      where,
      include: this.courseInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, includeDraft = false) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        ...(includeDraft ? {} : { status: 'published' }),
      },
      include: this.courseInclude,
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(dto: CreateCourseDto) {
    const { chapters, sourceVideoUrl, sourcePlatform, externalUrl, courseType, ...courseData } = dto as CreateCourseDto & {
      sourceVideoUrl?: string;
      sourcePlatform?: string;
      externalUrl?: string;
      courseType?: CourseType;
    };
    const course = await this.prisma.course.create({
      data: {
        ...courseData,
        ...(sourceVideoUrl ? { sourceVideoUrl } : {}),
        ...(sourcePlatform ? { sourcePlatform } : {}),
        ...(externalUrl ? { externalUrl } : {}),
        ...(courseType ? { courseType } : {}),
        status: courseData.status ?? CourseStatus.draft,
        chapters: chapters
          ? {
              create: chapters.map((chapter) => ({
                title: chapter.title,
                description: chapter.description,
                orderIndex: chapter.orderIndex,
                lessons: chapter.lessons
                  ? {
                      create: chapter.lessons.map((lesson) => ({
                        title: lesson.title,
                        description: lesson.description,
                        videoUrl: lesson.videoUrl,
                        videoDuration: lesson.videoDuration,
                        orderIndex: lesson.orderIndex,
                        isPreview: lesson.isPreview ?? false,
                        resources: lesson.resources
                          ? { create: lesson.resources }
                          : undefined,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: this.courseInclude,
    });

    await this.auditLog.log({
      action: 'COURSE_CREATE',
      entity: 'course',
      entityId: course.id,
      details: { title: course.title },
    });

    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    // chapters 字段:dedicated endpoints 处理,这里只更新 course 本身
    const { chapters: _chapters, ...courseData } = dto;
    const course = await this.prisma.course.update({
      where: { id },
      data: courseData,
      include: this.courseInclude,
    });

    await this.auditLog.log({
      action: 'COURSE_UPDATE',
      entity: 'course',
      entityId: course.id,
      details: { title: course.title },
    });

    return course;
  }

  async delete(id: string) {
    await this.prisma.course.delete({ where: { id } });

    await this.auditLog.log({
      action: 'COURSE_DELETE',
      entity: 'course',
      entityId: id,
    });

    return { message: 'Course deleted' };
  }
}
