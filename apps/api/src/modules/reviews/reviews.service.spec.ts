import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

const mockPrisma: any = {
  review: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  course: {
    findUnique: jest.fn(),
  },
  enrollment: {
    findFirst: jest.fn(),
  },
};
mockPrisma.$transaction = jest.fn(async (ops: any) => {
  // $transaction([findMany, count]) → Promise.all → return tuple
  if (Array.isArray(ops)) {
    return Promise.all(ops);
  }
  // $transaction(cb) → run cb
  return ops(mockPrisma);
});

const mockAuditLog: any = {
  log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.review.findUnique.mockReset();
    mockPrisma.review.findMany.mockReset();
    mockPrisma.review.count.mockReset();
    mockPrisma.review.create.mockReset();
    mockPrisma.review.update.mockReset();
    mockPrisma.review.groupBy.mockReset();
    mockPrisma.course.findUnique.mockReset();
    mockPrisma.enrollment.findFirst.mockReset();
    mockAuditLog.log.mockClear();

    service = new ReviewsService(
      mockPrisma as unknown as PrismaService,
      mockAuditLog as unknown as AuditLogService,
    );
  });

  // ── adminRemove ───────────────────────────────────────────────────────

  describe('adminRemove', () => {
    it('软删 review: content 置 [已删除], 写 audit log', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce({
        id: 'r1',
        userId: 'u1',
      });
      mockPrisma.review.update.mockResolvedValueOnce({ id: 'r1' });

      const result = await service.adminRemove('r1');

      expect(result).toEqual({ ok: true, id: 'r1' });
      expect(mockPrisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          content: '[已删除]',
          userId: 'u1', // 保留 userId 用于审计
        },
      });
      expect(mockAuditLog.log).toHaveBeenCalledWith({
        action: 'review.admin_remove',
        entity: 'Review',
        entityId: 'r1',
      });
    });

    it('review 不存在 → NotFoundException', async () => {
      mockPrisma.review.findUnique.mockResolvedValueOnce(null);
      await expect(service.adminRemove('r-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.review.update).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });
  });

  // ── findAll (admin 全量列表) ─────────────────────────────────────────

  describe('findAll (admin 全量列表)', () => {
    it('默认分页 1/20', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([]);
      mockPrisma.review.count.mockResolvedValueOnce(0);

      const result = await service.findAll({});

      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('过滤 courseId', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([]);
      mockPrisma.review.count.mockResolvedValueOnce(0);

      await service.findAll({ courseId: 'c1', page: 2, limit: 10 });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 'c1' },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('过滤 rating + onlyDeleted', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([]);
      mockPrisma.review.count.mockResolvedValueOnce(0);

      await service.findAll({ rating: 5, onlyDeleted: true });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rating: 5, content: '[已删除]' },
        }),
      );
    });

    it('limit 上限 100', async () => {
      mockPrisma.review.findMany.mockResolvedValueOnce([]);
      mockPrisma.review.count.mockResolvedValueOnce(0);

      await service.findAll({ limit: 9999 });

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ── getDistribution ───────────────────────────────────────────────────

  describe('getDistribution', () => {
    it('无评价时 all zero', async () => {
      mockPrisma.review.groupBy.mockResolvedValueOnce([]);

      const r = await service.getDistribution('c1');
      expect(r).toEqual({
        total: 0,
        avg: 0,
        counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        percentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    });

    it('混合评分算平均 + 百分比', async () => {
      mockPrisma.review.groupBy.mockResolvedValueOnce([
        { rating: 5, _count: { _all: 2 } },
        { rating: 3, _count: { _all: 2 } },
      ]);

      const r = await service.getDistribution('c1');
      expect(r.total).toBe(4);
      expect(r.avg).toBe(4); // (5*2 + 3*2) / 4 = 4
      expect(r.counts).toEqual({ 1: 0, 2: 0, 3: 2, 4: 0, 5: 2 });
      expect(r.percentages).toEqual({ 1: 0, 2: 0, 3: 50, 4: 0, 5: 50 });
    });
  });
});
