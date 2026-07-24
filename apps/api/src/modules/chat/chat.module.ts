import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RagService } from './rag.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, RagService],
})
export class ChatModule {}
