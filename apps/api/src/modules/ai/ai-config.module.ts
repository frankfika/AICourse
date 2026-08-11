import { Global, Module } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AiKeyCrypto } from './ai-crypto.util';

/**
 * 独立 AiConfigModule，不依赖具体上游实现，避免配置存储与调用客户端循环依赖。
 *
 * AuditLogService 通过 PrismaModule 全局可见, 不需重新 import.
 */
@Global()
@Module({
  providers: [AiConfigService, AiKeyCrypto],
  exports: [AiConfigService, AiKeyCrypto],
})
export class AiConfigModule {}
