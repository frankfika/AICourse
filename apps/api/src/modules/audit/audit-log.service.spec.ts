import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockReset();
    mockPrisma.auditLog.findMany.mockReset();
    mockPrisma.auditLog.count.mockReset();
    service = new AuditLogService(mockPrisma as unknown as PrismaService);
  });

  // ── log ──────────────────────────────────────────────────────────────

  describe('log', () => {
    it('基础字段写入', async () => {
      mockPrisma.auditLog.create.mockResolvedValueOnce({ id: 'a1' });

      await service.log({
        userId: 'u1',
        action: 'course.create',
        entity: 'Course',
        entityId: 'c1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          action: 'course.create',
          entity: 'Course',
          entityId: 'c1',
          details: null,
        },
      });
    });

    it('details 序列化为 JSON string', async () => {
      mockPrisma.auditLog.create.mockResolvedValueOnce({ id: 'a1' });

      await service.log({
        userId: 'u1',
        action: 'course.update',
        entity: 'Course',
        details: { changed: ['title', 'price'] },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: JSON.stringify({ changed: ['title', 'price'] }),
        }),
      });
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe('list', () => {
    it('默认 page=1, limit=20, 按 createdAt desc', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);

      const r = await service.list({});

      expect(r).toEqual({ data: [], total: 0, page: 1, limit: 20 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('page 2 + 过滤', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        { id: 'a1', userId: 'u1', action: 'review.create', entity: 'Review', entityId: 'r1', details: null, createdAt: new Date() },
      ]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(1);

      const r = await service.list({ userId: 'u1', page: 2, limit: 5 });

      expect(r.total).toBe(1);
      expect(r.page).toBe(2);
      expect(r.limit).toBe(5);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          skip: 5,
          take: 5,
        }),
      );
    });

    it('details JSON 字符串被 parse 回对象', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'a1',
          userId: null,
          action: 'chapter.create',
          entity: 'Chapter',
          entityId: 'ch1',
          details: JSON.stringify({ courseId: 'c1', title: 'Chapter 1' }),
          createdAt: new Date(),
        },
      ]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(1);

      const r = await service.list({});
      expect(r.data[0].details).toEqual({ courseId: 'c1', title: 'Chapter 1' });
    });

    it('limit 上限 100', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
      mockPrisma.auditLog.count.mockResolvedValueOnce(0);

      await service.list({ limit: 9999 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
