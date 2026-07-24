import { Global, Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiKeyCrypto } from './ai-crypto.util';

/**
 * P0 修复(2026-07-24): 独立 AiConfigModule, 不依赖 GeminiService.
 * 避免 GeminiService <-> AiConfigService 循环依赖.
 *
 * AuditLogService 通过 PrismaModule 全局可见, 不需重新 import.
 */
@Global()
@Module({
  providers: [AiConfigService, AiKeyCrypto],
  exports: [AiConfigService, AiKeyCrypto],
})
export class AiConfigModule {}
