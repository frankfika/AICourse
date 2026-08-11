import { Controller, Get, Put, Delete, Body, Param, UseGuards, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiConfigService, UpdateAiConfigDto } from './ai-config.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AiProviderService } from '../../common/ai-provider/ai-provider.service';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * P0 修复(2026-07-24): admin 改 AI key 端点.
 *
 * 路由:
 *   GET    /api/v1/admin/ai/config          — 列所有 provider
 *   PUT    /api/v1/admin/ai/config          — upsert 一个 provider (payload 含 apiKey 明文, 写库前加密)
 *   DELETE /api/v1/admin/ai/config/:provider — 删除一个 provider
 *   POST   /api/v1/admin/ai/config/:provider/verify — 验证指定配置并持久化结果
 *
 * 安全: 全 require admin. apiKey 写到 DB 前走 AES-256-GCM 加密;
 *       GET 返回时只返 mask (末 4 位).
 */
@ApiTags('admin/ai-config')
@Controller('admin/ai/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@ApiBearerAuth()
export class AiConfigController {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly provider: AiProviderService,
  ) {}

  @Get()
  @ApiOperation({ summary: '列所有 AI provider 配置 (key 仅返末 4 位)' })
  async list() {
    return this.aiConfig.list();
  }

  @Put()
  @ApiOperation({ summary: 'upsert 一个 provider (传入明文 apiKey, 写库前加密)' })
  async upsert(@Body() dto: UpdateAiConfigDto) {
    return this.aiConfig.upsert(dto);
  }

  @Delete(':provider')
  @ApiOperation({ summary: '删除一个 provider' })
  async remove(@Param('provider') provider: string) {
    return this.aiConfig.remove(provider);
  }

  @Post(':provider/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证指定 OpenAI-compatible 配置的 key、模型与网络' })
  async verify(@Param('provider') providerId: string) {
    try {
      const text = await this.provider.verify(providerId);
      const config = await this.aiConfig.recordVerification(providerId);
      return { ok: true, sample: text.slice(0, 50), config };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI 配置验证失败';
      try {
        await this.aiConfig.recordVerification(providerId, message);
      } catch {
        // 配置不存在时保留原始验证错误。
      }
      if (e instanceof ServiceUnavailableException) return { ok: false, error: message };
      return { ok: false, error: message };
    }
  }
}
