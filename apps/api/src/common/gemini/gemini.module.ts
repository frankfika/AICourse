import { Global, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AiConfigModule } from '../../modules/ai/ai-config.module';

@Global()
@Module({
  imports: [AiConfigModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
