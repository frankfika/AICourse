/**
 * ChaptersController — 课程章节 CRUD
 *
 * 路径:`/api/v1/courses/:courseId/chapters`
 * 全部需 admin(JwtAuthGuard + RolesGuard)
 *
 * 包含:
 *   GET    /courses/:courseId/chapters       列出课程的章节(含 lessons)
 *   POST   /courses/:courseId/chapters       新建章节
 *   PATCH  /chapters/:id                     改章节
 *   DELETE /chapters/:id                     软删章节(保留 lessons 关系?)
 *   POST   /courses/:courseId/chapters/reorder  批量排序
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

@ApiTags('chapters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller({ path: 'courses', version: '1' })
export class ChaptersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get(':courseId/chapters')
  @ApiOperation({ summary: '列出课程章节(含 lessons)' })
  async list(@Param('courseId') courseId: string) {
    // 确认课程存在
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.chapter.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  @Post(':courseId/chapters')
  @ApiOperation({ summary: '新建章节' })
  async create(
    @Param('courseId') courseId: string,
    @Body() dto: { title: string; description?: string; orderIndex?: number },
  ) {
    if (!dto.title) throw new BadRequestException('title is required');
    // 自动 orderIndex:现有最大 + 1
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined) {
      const max = await this.prisma.chapter.aggregate({
        _max: { orderIndex: true },
        where: { courseId, deletedAt: null },
      });
      orderIndex = (max._max.orderIndex ?? -1) + 1;
    }
    const chapter = await this.prisma.chapter.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        orderIndex,
      },
    });
    await this.auditLog.log({
      action: 'chapter.create',
      entity: 'Chapter',
      entityId: chapter.id,
      details: { courseId, title: dto.title },
    });
    return chapter;
  }

  @Patch('chapters/:id')
  @ApiOperation({ summary: '改章节' })
  async update(
    @Param('id') id: string,
    @Body() dto: { title?: string; description?: string; orderIndex?: number },
  ) {
    const existing = await this.prisma.chapter.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Chapter not found');
    }
    const chapter = await this.prisma.chapter.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex,
      },
    });
    await this.auditLog.log({
      action: 'chapter.update',
      entity: 'Chapter',
      entityId: id,
      details: { changed: Object.keys(dto) },
    });
    return chapter;
  }

  @Delete('chapters/:id')
  @ApiOperation({ summary: '软删章节(同时级联软删 lessons)' })
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.chapter.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Chapter not found');
    }
    const now = new Date();
    // 事务:章节 + 其下 lessons 一起软删
    await this.prisma.$transaction([
      this.prisma.chapter.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.lesson.updateMany({
        where: { chapterId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
    await this.auditLog.log({
      action: 'chapter.delete',
      entity: 'Chapter',
      entityId: id,
    });
    return { ok: true };
  }

  @Post(':courseId/chapters/reorder')
  @ApiOperation({ summary: '批量重排章节顺序' })
  async reorder(
    @Param('courseId') courseId: string,
    @Body() dto: { ids: string[] },
  ) {
    if (!Array.isArray(dto.ids)) {
      throw new BadRequestException('ids must be an array');
    }
    // 事务:按 ids 数组顺序重设 orderIndex
    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.chapter.update({
          where: { id },
          data: { orderIndex: idx },
        }),
      ),
    );
    await this.auditLog.log({
      action: 'chapter.reorder',
      entity: 'Course',
      entityId: courseId,
      details: { count: dto.ids.length },
    });
    return { ok: true };
  }
}
