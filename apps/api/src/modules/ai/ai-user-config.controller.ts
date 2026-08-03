import { Body, Controller, Delete, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiConfigService, UpdateAiConfigDto } from './ai-config.service';

@ApiTags('ai-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'ai/config', version: '1' })
export class AiUserConfigController {
  constructor(private readonly aiConfig: AiConfigService) {}

  @Get('providers')
  list(@Request() req: { user: { userId: string } }) {
    return this.aiConfig.listForUser(req.user.userId);
  }

  @Put('providers')
  upsert(@Request() req: { user: { userId: string } }, @Body() dto: UpdateAiConfigDto) {
    return this.aiConfig.upsertForUser(req.user.userId, dto);
  }

  @Delete('providers/:provider')
  async remove(@Request() req: { user: { userId: string } }, @Param('provider') provider: string) {
    await this.aiConfig.removeForUser(req.user.userId, provider);
    return { ok: true };
  }
}
