import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService, CourseDraft, DegreeDraft } from './ai.service';
import { GenerateCourseDto, GenerateDegreeDto } from './ai.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

/**
 * AI 内容生成
 * 仅管理员可调用，用于课程/学位的智能填充草稿。
 */
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // P1-7: 1 req/sec 防止烧 Gemini quota
  @Throttle({ short: { limit: 1, ttl: 1000 } })
  @Post('generate-course')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async generateCourse(@Body() dto: GenerateCourseDto): Promise<{ draft: CourseDraft }> {
    const draft = await this.aiService.generateCourse(dto.topic, dto.hint);
    return { draft };
  }

  // P1-7: 1 req/sec 防止烧 Gemini quota
  @Throttle({ short: { limit: 1, ttl: 1000 } })
  @Post('generate-degree')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async generateDegree(@Body() dto: GenerateDegreeDto): Promise<{ draft: DegreeDraft }> {
    const draft = await this.aiService.generateDegree(dto.topic, dto.hint);
    return { draft };
  }
}
