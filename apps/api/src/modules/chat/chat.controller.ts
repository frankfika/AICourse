import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatService, MessageView, SessionSummary, AnswerResult } from './chat.service';
import { CreateSessionDto, SendMessageDto } from './chat.dto';

/**
 * 全站网页小助手 (RAG) — /api/v1/chat
 *
 * 复用 ChatSession / ChatMessage, lessonId=null 即 general scope.
 * 必须登录: 避免烧 Gemini quota + 留 AiUsage 计费轨迹.
 */
@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  @ApiOperation({ summary: '创建 general scope 的 ChatSession' })
  async createSession(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateSessionDto,
  ): Promise<{ sessionId: string; title: string | null }> {
    return this.chatService.createSession(req.user.userId, dto.title);
  }

  @Get('sessions')
  @ApiOperation({ summary: '当前用户所有 general session' })
  async listSessions(
    @Request() req: { user: { userId: string } },
  ): Promise<SessionSummary[]> {
    return this.chatService.listSessions(req.user.userId);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: '拉取 session 全部消息' })
  async listMessages(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ): Promise<MessageView[]> {
    return this.chatService.listMessages(req.user.userId, id);
  }

  // P2 quota 敏感: 1 req/sec 防止烧 token. Frank 的 Gemini key 42212 quota 紧.
  @Throttle({ short: { limit: 1, ttl: 1000 } })
  @Post('sessions/:id/messages')
  @HttpCode(200)
  @ApiOperation({ summary: '发消息, 走 RAG + Gemini, 返 assistant 回复 + 来源' })
  async sendMessage(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<AnswerResult> {
    return this.chatService.answer(req.user.userId, id, dto.content);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: '删除 session (硬删, ChatMessage 走 cascade)' })
  async deleteSession(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ): Promise<void> {
    await this.chatService.deleteSession(req.user.userId, id);
  }
}
