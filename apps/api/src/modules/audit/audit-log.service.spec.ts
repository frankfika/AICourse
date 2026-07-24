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
          ipAddress: null,
          userAgent: null,
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

  // P0 2026-07-23: PII 脱敏 — ipAddress 末段置 0, userAgent 简化
  describe('PII 脱敏 (maskIpAddress / maskUserAgent)', () => {
    it('IPv4: 末段置 0', () => {
      expect(AuditLogService.maskIpAddress('192.168.1.100')).toBe('192.168.1.0');
      expect(AuditLogService.maskIpAddress('10.0.0.1')).toBe('10.0.0.0');
      expect(AuditLogService.maskIpAddress('8.8.8.8')).toBe('8.8.8.0');
    });

    it('IPv6: 保留前 4 组', () => {
      expect(
        AuditLogService.maskIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
      ).toBe('2001:0db8:85a3:0000::');
    });

    it('空 / null / 异常降级', () => {
      expect(AuditLogService.maskIpAddress(null)).toBeNull();
      expect(AuditLogService.maskIpAddress(undefined)).toBeNull();
      expect(AuditLogService.maskIpAddress('')).toBeNull();
      expect(AuditLogService.maskIpAddress('   ')).toBeNull();
      expect(AuditLogService.maskIpAddress('not-an-ip')).toMatch(/^unknown:/);
    });

    it('UserAgent: 提取 browser + OS, 不存精确版本', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const masked = AuditLogService.maskUserAgent(ua);
      expect(masked).toContain('Mozilla');
      expect(masked).toContain('Macintosh');
      // 完整 Chrome/120.0.0.0 不能漏
      expect(masked).not.toContain('120.0.0.0');
      // 不超过 64 字符
      expect(masked!.length).toBeLessThanOrEqual(64);
    });

    it('UserAgent: 空 / 异常降级', () => {
      expect(AuditLogService.maskUserAgent(null)).toBeNull();
      expect(AuditLogService.maskUserAgent(undefined)).toBeNull();
      expect(AuditLogService.maskUserAgent('')).toBeNull();
    });

    it('log() 写入前自动 mask', async () => {
      mockPrisma.auditLog.create.mockResolvedValueOnce({ id: 'log1' });
      await service.log({
        userId: 'u1',
        action: 'LOGIN',
        entity: 'user',
        entityId: 'u1',
        ipAddress: '203.0.113.42',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '203.0.113.0',
          userAgent: expect.stringContaining('Mozilla'),
        }),
      });
      // 关键: 完整 Chrome/120 已被 mask 掉
      const call = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(call.data.userAgent).not.toContain('Chrome/120');
    });
  });
});
