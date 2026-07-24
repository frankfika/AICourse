import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateCourseDto, UpdateCourseDto, LinkDegreesDto } from './courses.dto';
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
    // P0 修复(2026-07-24): 返回 course 所属的 degree, 让前端能展示
    degreeCourses: {
      include: {
        degree: {
          select: { id: true, title: true, status: true, costType: true },
        },
      },
      orderBy: { orderIndex: 'asc' as const },
    },
    // P1 修复(2026-07-24): 行业/分类
    industry: { select: { id: true, key: true, label: true, icon: true } },
    category: { select: { id: true, key: true, label: true } },
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
      // P1-7 防御: 默认 50, max 100, 防 DoS (公开 list 拉全表 OOM)
      take: 100,
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

  /**
   * P0 修复(2026-07-24): 课程挂学位 — append 语义。
   * 把此 course 追加到每个指定 degree 的末尾(orderIndex = 现有 max + 1..N)。
   * 同一 (course, degree) 已存在则跳过(避免重复)。
   * 精确位置编辑请走 degree service.linkCourses。
   */
  async linkDegrees(courseId: string, dto: LinkDegreesDto) {
    // 校验 course 存在
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    let appended = 0;
    let skipped = 0;
    for (const degreeId of dto.degreeIds) {
      // 已存在则跳过
      const existing = await this.prisma.degreeCourse.findUnique({
        where: { degreeId_courseId: { degreeId, courseId } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      // 找该 degree 内现有最大 orderIndex
      const max = await this.prisma.degreeCourse.aggregate({
        where: { degreeId },
        _max: { orderIndex: true },
      });
      const orderIndex = (max._max.orderIndex ?? -1) + 1;
      await this.prisma.degreeCourse.create({
        data: { degreeId, courseId, orderIndex },
      });
      appended += 1;
    }

    await this.auditLog.log({
      action: 'COURSE_LINK_DEGREES',
      entity: 'course',
      entityId: courseId,
      details: { appended, skipped, requested: dto.degreeIds.length },
    });

    return this.findOne(courseId, true);
  }
}
