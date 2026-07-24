import { Controller, Get, Put, Delete, Body, Param, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiConfigService, UpdateAiConfigDto } from './ai-config.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { GeminiService } from '../../common/gemini/gemini.service';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * P0 修复(2026-07-24): admin 改 AI key 端点.
 *
 * 路由:
 *   GET    /api/v1/admin/ai/config          — 列所有 provider
 *   PUT    /api/v1/admin/ai/config          — upsert 一个 provider (payload 含 apiKey 明文, 写库前加密)
 *   DELETE /api/v1/admin/ai/config/:provider — 删除一个 provider
 *   POST   /api/v1/admin/ai/config/test     — 用当前 active gemini 调一次 1-token prompt, 验证 key 有效
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
    private readonly gemini: GeminiService,
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

  @Post('test')
  @ApiOperation({ summary: '用当前 active gemini 调一次最小 prompt, 验证 key + 网络' })
  async test() {
    try {
      const text = await this.gemini.generateText('Reply with the single word: ok', {
        maxOutputTokens: 16,
        temperature: 0,
      });
      return { ok: true, sample: text.slice(0, 50) };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) {
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }
}
