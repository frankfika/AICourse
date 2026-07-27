import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health module
 *
 * RedisService 来自全局 RedisModule (不必显式 import).
 * PrismaService 来自全局 PrismaModule (不必显式 import).
 * ConfigService 来自全局 ConfigModule (不必显式 import).
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
