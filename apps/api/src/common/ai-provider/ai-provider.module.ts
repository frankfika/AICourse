import { Global, Module } from '@nestjs/common';
import { AiConfigModule } from '../../modules/ai/ai-config.module';
import { AiProviderService } from './ai-provider.service';

@Global()
@Module({
  imports: [AiConfigModule],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
