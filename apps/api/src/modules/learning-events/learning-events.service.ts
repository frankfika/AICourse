import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchCreateLearningEventDto, CreateLearningEventDto } from './learning-events.dto';

@Injectable()
export class LearningEventsService {
  private readonly logger = new Logger(LearningEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 单条上报: 写一条 LearningEvent
   */
  async createOne(userId: string, dto: CreateLearningEventDto) {
    return this.prisma.learningEvent.create({
      data: {
        userId,
        lessonId: dto.lessonId,
        eventType: dto.eventType,
        positionSec: dto.positionSec,
        durationMs: dto.durationMs,
        metadata: dto.metadata as any,
      },
    });
  }

  /**
   * 批量上报: 前端每 30s flush 一次
   * 走 createMany + skipDuplicates(无 unique 约束时是普通 insert)
   */
  async createBatch(userId: string, dto: BatchCreateLearningEventDto) {
    const data = dto.events.map((e) => ({
      userId,
      lessonId: e.lessonId,
      eventType: e.eventType,
      positionSec: e.positionSec,
      durationMs: e.durationMs,
      metadata: e.metadata as any,
    }));
    const result = await this.prisma.learningEvent.createMany({ data });
    this.logger.log(`user=${userId} batch=${result.count}`);
    return { count: result.count };
  }

  /**
   * 我的最近学习事件(分页)
   */
  async listMine(userId: string, limit = 50) {
    return this.prisma.learningEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * 课时级事件(教师 / admin 用)
   */
  async listByLesson(lessonId: string, limit = 50) {
    return this.prisma.learningEvent.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
