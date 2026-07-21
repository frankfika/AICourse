import { Test, TestingModule } from '@nestjs/testing';
import { LearningEventsService } from './learning-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearningEventType } from './learning-events.dto';

describe('LearningEventsService', () => {
  let service: LearningEventsService;
  let prisma: {
    learningEvent: {
      create: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      learningEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningEventsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<LearningEventsService>(LearningEventsService);
  });

  describe('createOne', () => {
    it('should write a single event for the user', async () => {
      const result = await service.createOne('u-1', {
        eventType: LearningEventType.play,
        lessonId: 'l-1',
        positionSec: 120,
      });
      expect(prisma.learningEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          lessonId: 'l-1',
          eventType: 'play',
          positionSec: 120,
          durationMs: undefined,
          metadata: undefined,
        },
      });
      expect(result).toEqual({ id: 'ev-1' });
    });

    it('should pass metadata when provided', async () => {
      await service.createOne('u-1', {
        eventType: LearningEventType.note,
        lessonId: 'l-1',
        metadata: { text: 'hello' },
      });
      expect(prisma.learningEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { text: 'hello' },
        }),
      });
    });
  });

  describe('createBatch', () => {
    it('should write a batch of events for the user', async () => {
      const result = await service.createBatch('u-1', {
        events: [
          { eventType: LearningEventType.play, positionSec: 0 },
          { eventType: LearningEventType.pause, positionSec: 30 },
          { eventType: LearningEventType.play, positionSec: 30 },
        ],
      });
      expect(prisma.learningEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'u-1', eventType: 'play' }),
          expect.objectContaining({ userId: 'u-1', eventType: 'pause' }),
        ]),
      });
      expect(result.count).toBe(3);
    });

    it('should cap userId to caller, not trust request body', async () => {
      await service.createBatch('u-attacker', {
        events: [{ eventType: LearningEventType.play }],
      });
      const call = prisma.learningEvent.createMany.mock.calls[0][0];
      // 即使 DTO 没 userId,写入也用 service 参数,不是 dto 字段
      for (const row of call.data) {
        expect(row.userId).toBe('u-attacker');
      }
    });
  });

  describe('listMine', () => {
    it('should query with userId and order by createdAt desc', async () => {
      await service.listMine('u-1', 10);
      expect(prisma.learningEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should cap limit at 200 to prevent runaway queries', async () => {
      await service.listMine('u-1', 9999);
      const call = prisma.learningEvent.findMany.mock.calls[0][0];
      expect(call.take).toBeLessThanOrEqual(200);
    });
  });

  describe('listByLesson', () => {
    it('should query with lessonId', async () => {
      await service.listByLesson('l-1', 20);
      expect(prisma.learningEvent.findMany).toHaveBeenCalledWith({
        where: { lessonId: 'l-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });
});
