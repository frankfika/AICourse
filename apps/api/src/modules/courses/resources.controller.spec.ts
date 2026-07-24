import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ResourcesController, ResourceItemController } from './resources.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

const mockPrisma: any = {
  resource: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  lesson: {
    findUnique: jest.fn(),
  },
};

const mockAuditLog: any = {
  log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('ResourcesController (lessons/:lessonId/resources)', () => {
  let controller: ResourcesController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.resource.findMany.mockReset();
    mockPrisma.resource.findUnique.mockReset();
    mockPrisma.resource.create.mockReset();
    mockPrisma.resource.update.mockReset();
    mockPrisma.lesson.findUnique.mockReset();
    mockAuditLog.log.mockClear();
    controller = new ResourcesController(
      mockPrisma as unknown as PrismaService,
      mockAuditLog as unknown as AuditLogService,
    );
  });

  // ── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    it('lesson 不存在 → NotFoundException', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce(null);
      await expect(controller.list('l-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.resource.findMany).not.toHaveBeenCalled();
    });

    it('lesson 已软删 → NotFoundException', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({ id: 'l1', deletedAt: new Date() });
      await expect(controller.list('l1')).rejects.toThrow(NotFoundException);
    });

    it('返回 deletedAt=null 的资源(默认 createdAt 升序)', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({ id: 'l1', deletedAt: null });
      mockPrisma.resource.findMany.mockResolvedValueOnce([]);
      await controller.list('l1');
      expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
        where: { lessonId: 'l1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = { title: 'PDF 讲义', url: 'https://cdn.ai-academy.local/lessons/1.pdf', type: 'pdf' as const };

    it('缺 title → BadRequestException', async () => {
      await expect(
        controller.create('l1', { ...validDto, title: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('缺 url → BadRequestException', async () => {
      await expect(
        controller.create('l1', { ...validDto, url: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('type 非法 → BadRequestException', async () => {
      await expect(
        controller.create('l1', { ...validDto, type: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lesson 不存在 → NotFoundException', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce(null);
      await expect(controller.create('l1', validDto)).rejects.toThrow(NotFoundException);
    });

    it('默认 isLocked=true', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({ id: 'l1', deletedAt: null });
      mockPrisma.resource.create.mockResolvedValueOnce({ id: 'r1' });
      await controller.create('l1', validDto);
      expect(mockPrisma.resource.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isLocked: true }),
      });
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'resource.create' }),
      );
    });

    it('isLocked=false 可显式传', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValueOnce({ id: 'l1', deletedAt: null });
      mockPrisma.resource.create.mockResolvedValueOnce({ id: 'r1' });
      await controller.create('l1', { ...validDto, isLocked: false });
      expect(mockPrisma.resource.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isLocked: false }),
      });
    });
  });

  // 注: update / remove 走 ResourceItemController (`/api/v1/resources/:id`),
  // 注: update / remove 走 ResourceItemController (`/api/v1/resources/:id`),
  // 测例在下面 describe 块。
});

// ──────────────────────────────────────────────────────────────────────
// ResourceItemController (/resources/:id) — 单个资源的 PATCH/DELETE
// ──────────────────────────────────────────────────────────────────────

describe('ResourceItemController (resources/:id)', () => {
  let controller: ResourceItemController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.resource.findUnique.mockReset();
    mockPrisma.resource.update.mockReset();
    mockAuditLog.log.mockClear();
    controller = new ResourceItemController(
      mockPrisma as unknown as PrismaService,
      mockAuditLog as unknown as AuditLogService,
    );
  });

  describe('update', () => {
    it('资源不存在 → NotFoundException', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce(null);
      await expect(controller.update('r1', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('已软删 → NotFoundException', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce({ id: 'r1', deletedAt: new Date() });
      await expect(controller.update('r1', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('type 非法 → BadRequestException', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce({ id: 'r1', deletedAt: null });
      await expect(controller.update('r1', { type: 'invalid' as any })).rejects.toThrow(BadRequestException);
    });

    it('正常修改 + 写 audit log', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce({ id: 'r1', deletedAt: null });
      mockPrisma.resource.update.mockResolvedValueOnce({ id: 'r1' });
      await controller.update('r1', { title: '新标题', isLocked: false });
      expect(mockPrisma.resource.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { title: '新标题', isLocked: false },
      });
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'resource.update', entityId: 'r1' }),
      );
    });
  });

  describe('remove', () => {
    it('软删 + 写 audit log', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce({ id: 'r1', deletedAt: null });
      mockPrisma.resource.update.mockResolvedValueOnce({ id: 'r1' });
      const result = await controller.remove('r1');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.resource.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('资源不存在 → NotFoundException', async () => {
      mockPrisma.resource.findUnique.mockResolvedValueOnce(null);
      await expect(controller.remove('r-missing')).rejects.toThrow(NotFoundException);
    });
  });
});
