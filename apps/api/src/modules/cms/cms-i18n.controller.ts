/**
 * CmsI18nController — 公开 GET endpoint (i18n messages)
 *
 * - GET /api/v1/i18n/messages?locale=zh-CN&category=empty
 *
 * 不走 JwtAuthGuard.
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsI18nService } from './cms-i18n.service';

@ApiTags('cms-i18n')
@Controller({ path: 'i18n', version: '1' })
export class CmsI18nController {
  constructor(private readonly cmsI18nService: CmsI18nService) {}

  @Get('messages')
  @ApiOperation({ summary: 'i18n 通用文案 (按 locale + category)' })
  listMessages(
    @Query('locale') locale?: string,
    @Query('category') category?: string,
  ) {
    return this.cmsI18nService.listMessages(locale, category);
  }
}
