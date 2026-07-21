import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { LearningEventsService } from './learning-events.service';
import { BatchCreateLearningEventDto, CreateLearningEventDto } from './learning-events.dto';

/**
 * 学习事件上报(LearningEvent)
 *
 * - 前端 video player 每 5s flush 一次,走 batch
 * - 单条接口给 immediate 类型(complete / note)用
 * - list 接口给用户历史 / 教师视角用
 */
@Controller('learning-events')
@UseGuards(JwtAuthGuard)
export class LearningEventsController {
  constructor(private readonly service: LearningEventsService) {}

  @Post()
  async createOne(@Request() req: any, @Body() dto: CreateLearningEventDto) {
    const event = await this.service.createOne(req.user.userId, dto);
    return { event };
  }

  // 批量上报走更宽松的 throttle(防止 30s flush 撞限流)
  @Post('batch')
  @Throttle({ short: { limit: 10, ttl: 1000 }, medium: { limit: 120, ttl: 60000 } })
  async createBatch(@Request() req: any, @Body() dto: BatchCreateLearningEventDto) {
    return this.service.createBatch(req.user.userId, dto);
  }

  @Get('me')
  async listMine(@Request() req: any, @Query('limit') limit?: string) {
    return this.service.listMine(req.user.userId, limit ? Number(limit) : 50);
  }

  @Get('lesson/:lessonId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.instructor)
  async listByLesson(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listByLesson(lessonId, limit ? Number(limit) : 50);
  }
}
