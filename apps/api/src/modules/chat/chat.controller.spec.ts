import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SendMessageDto } from './chat.dto';
import { GUARDS_METADATA } from '@nestjs/common/constants';

/**
 * Controller 层覆盖:
 * - 401: JwtAuthGuard 在未登录时抛 UnauthorizedException
 * - 400: SendMessageDto 空 content 触发 class-validator
 * - 200: 已登录时 controller 直接 dispatch 到 ChatService.answer
 *
 * 因为项目没装 supertest, 用 Nest TestingModule + 直接 invoke controller 方法 +
 * ValidationPipe 模拟, 覆盖 3 个核心 case.
 */
describe('ChatController', () => {
  let controller: ChatController;
  let service: jest.Mocked<ChatService>;
  let reflector: Reflector;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<ChatService>> = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      listMessages: jest.fn(),
      deleteSession: jest.fn(),
      answer: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 1 }])],
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: serviceMock },
        Reflector,
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get(ChatService) as jest.Mocked<ChatService>;
    reflector = module.get(Reflector);
  });

  it('case 401: JwtAuthGuard 挂在 controller 上, 且 user=undefined 时 handleRequest 抛 401', async () => {
    // 1) metadata 上确实挂了 JwtAuthGuard
    const guards = reflector.get<any[]>(GUARDS_METADATA, ChatController);
    expect(guards).toBeDefined();
    expect(guards!.some((g) => g === JwtAuthGuard || g?.name === 'JwtAuthGuard')).toBe(true);

    // 2) 实际 handleRequest 行为: user=undefined -> 抛 UnauthorizedException
    //    handleRequest 是同步 throw, 用 Promise.resolve 包一下让 rejects 能 match
    const guard = new JwtAuthGuard();
    await expect(Promise.resolve().then(() => (guard as any).handleRequest(null, undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('case 200: 登录后 sendMessage 调 service.answer, 返 answer + sources', async () => {
    service.answer.mockResolvedValue({
      userMsg: { id: 'm-1', role: 'user', content: 'q', createdAt: new Date() },
      assistantMsg: { id: 'm-2', role: 'assistant', content: 'a', createdAt: new Date() },
      sources: [{ type: 'course', id: 'c-1', title: 'RAG 实战', url: '/courses/c-1' }],
    });

    const result = await controller.sendMessage(
      { user: { userId: 'u-1' } },
      's-1',
      { content: 'RAG 是啥' },
    );

    expect(service.answer).toHaveBeenCalledWith('u-1', 's-1', 'RAG 是啥');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].type).toBe('course');
  });

  it('case 400: 空 content 被 class-validator 拒掉', async () => {
    // 真实 ValidationPipe 走一下, 确认 DTO 在框架层就被拒
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    const dto = new SendMessageDto();
    // 不设 content, 应抛 BadRequestException
    await expect(pipe.transform(dto, { type: 'body', metatype: SendMessageDto } as any)).rejects.toThrow(
      BadRequestException,
    );
    // 服务没被调到
    expect(service.answer).not.toHaveBeenCalled();
  });

  it('createSession 不调 answer', async () => {
    service.createSession.mockResolvedValue({ sessionId: 's-1', title: 't' });
    const r = await controller.createSession({ user: { userId: 'u-1' } }, { title: 't' });
    expect(r.sessionId).toBe('s-1');
    expect(service.answer).not.toHaveBeenCalled();
  });
});
