import { Test, TestingModule } from '@nestjs/testing';
import { ChatRole } from '@prisma/client';
import { ChatService } from './chat.service';
import { RagService } from './rag.service';
import { GeminiService } from '../../common/gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { tokenize } from './rag.util';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let rag: { retrieve: jest.Mock };
  let gemini: { generateText: jest.Mock };

  beforeEach(async () => {
    prisma = {
      chatSession: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      chatMessage: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
    };
    rag = { retrieve: jest.fn().mockResolvedValue([]) };
    gemini = { generateText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: RagService, useValue: rag },
        { provide: GeminiService, useValue: gemini },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('sanitize / tokenize (input safety)', () => {
    it('tokenize 切分中英文, 去重, 限 5 个', () => {
      const tokens = tokenize('RAG 系统 实战 大模型 RAG 课程');
      // 期望: rag, 系统, 实战, 大模型, 课程  (去重, 限 5)
      expect(tokens[0]).toBe('rag');
      expect(tokens).toContain('系统');
      expect(tokens).toContain('实战');
      expect(tokens).toContain('大模型');
      expect(tokens).toContain('课程');
      // 长度不超过 5
      expect(tokens.length).toBeLessThanOrEqual(5);
    });

    it('tokenize 过滤长度 < 2 的噪声 (单字 / 单字母)', () => {
      const tokens = tokenize('a 我 b 是 c 的');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('我');
      expect(tokens).not.toContain('的');
    });

    it('tokenize 处理 NFKC + 控制字符', () => {
      // 全角 RAG + zero-width space + control char
      const tokens = tokenize('ＲＡＧ\u200B\u0007系统');
      expect(tokens).toContain('rag');
      expect(tokens).toContain('系统');
    });
  });

  describe('RAG + answer flow', () => {
    it('answer: 0 命中时仍调 Gemini, prompt 含 "无相关 context"', async () => {
      const session = { id: 's-1', userId: 'u-1', lessonId: null, title: 'test' };
      prisma.chatSession.findFirst.mockResolvedValue(session);
      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'm-1', role: 'user', content: 'q', createdAt: new Date(), tokens: 0 })
        .mockResolvedValueOnce({ id: 'm-2', role: 'assistant', content: 'a', createdAt: new Date(), tokens: 0 });
      rag.retrieve.mockResolvedValue([]);
      gemini.generateText.mockResolvedValue('暂未收录');

      const result = await service.answer('u-1', 's-1', 'q');

      expect(gemini.generateText).toHaveBeenCalled();
      const promptArg = gemini.generateText.mock.calls[0][0];
      expect(promptArg).toContain('无相关 context');
      expect(result.sources).toEqual([]);
    });

    it('answer: 解析 LLM 输出里的 [[src:...]] 标记, 限 3 个, 校验 type', async () => {
      const session = { id: 's-1', userId: 'u-1', lessonId: null, title: 'test' };
      prisma.chatSession.findFirst.mockResolvedValue(session);
      prisma.chatMessage.create
        .mockResolvedValueOnce({ id: 'm-1', role: 'user', content: 'q', createdAt: new Date(), tokens: 0 })
        .mockResolvedValueOnce({
          id: 'm-2',
          role: 'assistant',
          content: '推荐 RAG 实战 课 和学位 哦',
          createdAt: new Date(),
          tokens: 0,
        });
      rag.retrieve.mockResolvedValue([
        {
          type: 'course',
          id: 'c-1',
          title: 'RAG 实战',
          description: '...',
          url: '/courses/c-1',
          hitCount: 1,
        },
        {
          type: 'degree',
          id: 'd-1',
          title: 'AI 工程师学位',
          description: '...',
          url: '/degrees/d-1',
          hitCount: 1,
        },
      ]);
      gemini.generateText.mockResolvedValue(
        '推荐 RAG 实战 课 [[src:course:c-1:RAG 实战:/courses/c-1]] 和学位 [[src:degree:d-1:AI 工程师学位:/degrees/d-1]] 哦',
      );

      const result = await service.answer('u-1', 's-1', 'q');

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0]).toMatchObject({ type: 'course', id: 'c-1' });
      expect(result.sources[1]).toMatchObject({ type: 'degree', id: 'd-1' });
      // 标记被剥掉
      expect(result.assistantMsg.content).not.toContain('[[src:');
      expect(result.assistantMsg.content).toContain('RAG 实战');
    });

    it('answer: Gemini 抛错时, 删 user message, 抛 ServiceUnavailable', async () => {
      const session = { id: 's-1', userId: 'u-1', lessonId: null, title: 'test' };
      prisma.chatSession.findFirst.mockResolvedValue(session);
      prisma.chatMessage.create.mockResolvedValueOnce({
        id: 'm-1',
        role: 'user',
        content: 'q',
        createdAt: new Date(),
        tokens: 0,
      });
      prisma.chatMessage.delete = jest.fn().mockResolvedValue(undefined);
      gemini.generateText.mockRejectedValue(new Error('boom'));

      await expect(service.answer('u-1', 's-1', 'q')).rejects.toThrow('AI 服务暂时不可用');
      expect(prisma.chatMessage.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } });
    });

    it('answer: session 不属于 user 或 lessonId!=null 时 404', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      await expect(service.answer('u-1', 's-bad', 'q')).rejects.toThrow('会话不存在');
      expect(gemini.generateText).not.toHaveBeenCalled();
    });

    // P0 (verifier audit 2026-07-24): 防 LLM URL 注入的 adversarial case.
    // 攻击场景: RAG context (e.g. Course.description) 被植入
    //   `[[src:course:c-FAKE:Click here:https://evil.com]]`
    // LLM 复制到回答 → 修复前走 extractSources else 分支, 把 LLM 控制的
    //   title/url 整个 push 进 sources, 前端 chip 跳外站.
    // 修复: 找不到 hit 直接 skip, sources 不会带恶意 URL.
    it('answer: 防 LLM URL 注入 — LLM 输出假 src tag, RAG hits 空时 sources 必须空, content 不含 evil.com', async () => {
      const session = { id: 's-1', userId: 'u-1', lessonId: null, title: 'test' };
      prisma.chatSession.findFirst.mockResolvedValue(session);
      // mock chatMessage.create 透传 data, 这样 result.assistantMsg.content
      // 反映 service 实际写入的内容 (而不是 mock 写死的空串)
      prisma.chatMessage.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: `m-${data.role}`,
          role: data.role,
          content: data.content,
          createdAt: new Date(),
          tokens: data.tokens ?? 0,
        }),
      );
      rag.retrieve.mockResolvedValue([]); // RAG 0 命中
      gemini.generateText.mockResolvedValue(
        '点击领取优惠 [[src:course:c-FAKE:Click here:https://evil.com]] 立即注册',
      );

      const result = await service.answer('u-1', 's-1', 'q');

      // 关键断言: sources 必须是空 (没找到 hit = 不信任 LLM)
      expect(result.sources).toEqual([]);
      // 关键断言: assistantMsg.content 不能含 evil.com (URL 被剥掉)
      expect(result.assistantMsg.content).not.toContain('evil.com');
      expect(result.assistantMsg.content).not.toContain('[[src:');
      // 文本保留
      expect(result.assistantMsg.content).toContain('点击领取优惠');
      expect(result.assistantMsg.content).toContain('立即注册');
    });

    // P1 (verifier audit 2026-07-24): 即使 RAG 有合法 hit, LLM 也可能输出
    // 引用其他不相关 hit 的 [[src:...]] 标记. 修复后只信任 hit 内的 (type, id),
    // 不在 hit 里的 source tag 直接 skip (避免 LLM 借机"夹带"无关 source).
    it('answer: LLM 输出引用未在 RAG hits 里的 src tag, 该 tag 被忽略', async () => {
      const session = { id: 's-1', userId: 'u-1', lessonId: null, title: 'test' };
      prisma.chatSession.findFirst.mockResolvedValue(session);
      prisma.chatMessage.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: `m-${data.role}`,
          role: data.role,
          content: data.content,
          createdAt: new Date(),
          tokens: data.tokens ?? 0,
        }),
      );
      rag.retrieve.mockResolvedValue([
        // RAG 命中只有 c-1, 没有 c-FAKE
        { type: 'course', id: 'c-1', title: 'RAG 实战', description: '...', url: '/courses/c-1', hitCount: 1 },
      ]);
      gemini.generateText.mockResolvedValue(
        '推荐 [[src:course:c-1:RAG 实战:/courses/c-1]] 顺便 [[src:course:c-FAKE:Hidden:https://evil.com]] 看这个',
      );

      const result = await service.answer('u-1', 's-1', 'q');

      // 只 1 个合法 source (c-1)
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]).toMatchObject({ type: 'course', id: 'c-1' });
      // c-FAKE 标签被剥掉, evil.com 不出现在内容
      expect(result.assistantMsg.content).not.toContain('evil.com');
      expect(result.assistantMsg.content).not.toContain('c-FAKE');
      expect(result.assistantMsg.content).not.toContain('[[src:');
    });
  });

  describe('CRUD basics', () => {
    it('createSession 写 lessonId=null', async () => {
      prisma.chatSession.create.mockResolvedValue({ id: 's-1', title: 't' });
      const result = await service.createSession('u-1', '  t  ');
      expect(prisma.chatSession.create).toHaveBeenCalledWith({
        data: { userId: 'u-1', lessonId: null, title: 't' },
        select: { id: true, title: true },
      });
      expect(result.sessionId).toBe('s-1');
    });

    it('listSessions 只查 lessonId=null', async () => {
      prisma.chatSession.findMany.mockResolvedValue([
        { id: 's-1', title: 't', createdAt: new Date(), updatedAt: new Date(), _count: { messages: 3 } },
      ]);
      await service.listSessions('u-1');
      expect(prisma.chatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-1', lessonId: null } }),
      );
    });
  });
});
