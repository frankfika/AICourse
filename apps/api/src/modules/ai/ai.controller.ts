import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

  @Post('generate-course')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async generateCourse(@Body() dto: GenerateCourseDto): Promise<{ draft: CourseDraft }> {
    const draft = await this.aiService.generateCourse(dto.topic, dto.hint);
    return { draft };
  }

  @Post('generate-degree')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async generateDegree(@Body() dto: GenerateDegreeDto): Promise<{ draft: DegreeDraft }> {
    const draft = await this.aiService.generateDegree(dto.topic, dto.hint);
    return { draft };
  }
}
