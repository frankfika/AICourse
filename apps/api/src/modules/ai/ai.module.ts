import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiConfigController } from './ai-config.controller';
import { AiConfigModule } from './ai-config.module';

/**
 * P0 修复(2026-07-24): 注册 AiConfigController, admin 后台可改 AI key.
 * AiConfigService 已由 AiConfigModule 导出(Global), 此处无需重 import.
 */
@Module({
  imports: [AiConfigModule],
  controllers: [AiController, AiConfigController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
